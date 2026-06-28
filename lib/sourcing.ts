import { GoogleGenAI } from "@google/genai";
import { searchSupply, getSupplyDetail } from "./domeggook";

// ---- 설정 (PRD 기준) ----
const FEE_RATE = 0.06;
const SELL_MULT = 2.5;       // 판매가 = 도매가 × 배수
const NORMAL_MULT = 3.0;     // 정상가 = 도매가 × 배수
const MIN_MARGIN = 0.25;     // 마진율 미달 제외
const DEDUP = 0.82;          // 상품명 유사도 중복 기준
const ALLOWED = new Set("()-·[]/&+,~. ".split(""));
const BANNED = ["특가", "최저가", "무료배송", "사은품", "이벤트", "할인", "세일", "정품", "당일발송", "무료", "1+1", "초특가", "땡처리"];

// 도매매 카테고리코드 → 네이버 카테고리 (필요시 확장. 없으면 미매핑 경고)
const CATEGORY_MAP: Record<string, string> = {
  "13_04_05_05_00": "생활/건강 > 반려동물 > 강아지 > 훈련용품",
  "13_04_05_00_00": "생활/건강 > 반려동물 > 강아지 > 장난감",
  "13_04_00_00_00": "생활/건강 > 반려동물",
};

export interface Sourced {
  no: string; origTitle: string; newTitle: string; thumb: string; url: string;
  supplyPrice: number; deliveryFee: number; freeShip: boolean;
  sellPrice: number; normalPrice: number; marginRate: number;
  inventory: number; origin: string; categoryDome: string; naverCategory: string;
  tags: string; description: string; model: string; titleOk: boolean;
}

function ceil100(x: number) { return Math.ceil(x / 100) * 100; }
function price(dome: number, fee: number) {
  const sell = ceil100(dome * SELL_MULT);
  const feeAmt = Math.round(sell * FEE_RATE);
  const margin = sell - dome - fee - feeAmt;
  const rate = sell ? margin / sell : 0;
  const normal = Math.max(ceil100(dome * NORMAL_MULT), ceil100(sell * 1.25));
  return { sell, normal, margin, rate };
}

const norm = (t: string) => (t || "").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
function dice(a: string, b: string) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bg = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const A = bg(a), B = bg(b); let inter = 0;
  for (const [g, c] of A) if (B.has(g)) inter += Math.min(c, B.get(g)!);
  return (2 * inter) / (a.length - 1 + b.length - 1);
}

function sanitizeTitle(t: string, removeWords: string[]): string {
  let s = t || "";
  for (const w of removeWords) if (w) s = s.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  s = s.split("").filter((ch) => /[0-9a-z가-힣]/i.test(ch) || ALLOWED.has(ch)).join("");
  const seen = new Set<string>(); const out: string[] = [];
  for (const w of s.split(/\s+/)) { const lw = w.toLowerCase(); if (lw && !seen.has(lw)) { seen.add(lw); out.push(w); } }
  s = out.join(" ").replace(/\s+/g, " ").trim();
  if (s.length > 50) { const cut = s.slice(0, 50); s = cut.includes(" ") ? cut.slice(0, cut.lastIndexOf(" ")) : cut; }
  return s.trim();
}

async function aiRewrite(ai: GoogleGenAI, origTitle: string, kw: string[], catPath: string, removeWords: string[]) {
  const prompt = `너는 네이버 스마트스토어 SEO 전문가다. 아래 도매 원본 상품명을 네이버 규칙에 맞게 재작성하라.
원본: ${origTitle}
참고 키워드: ${kw.slice(0, 10).join(", ")}
카테고리: ${catPath}
규칙: 50자 이내, 핵심키워드 앞쪽. 홍보문구(특가/최저가/무료배송/사은품/이벤트) 금지. 공급사/브랜드명 제거. 키워드 도배 금지.
또한 상품명에 못 넣은 연관 검색태그 최대 10개, 2~3문장 상품설명, 스토어 전용 모델명(공급사코드 금지)도 생성.
JSON으로만: {"title":"","tags":["",""],"description":"","model":""}`;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt, config: { responseMimeType: "application/json" } });
      const p = JSON.parse(res.text || "{}");
      return {
        title: sanitizeTitle(p.title || origTitle, removeWords),
        tags: (p.tags || []).slice(0, 10).join(", "),
        description: p.description || "",
        model: p.model || "",
      };
    } catch (e: any) {
      const m = (e?.message || "").toLowerCase();
      if (!(m.includes("429") || m.includes("503") || m.includes("overload")) || i === 2) break;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  return null;
}

export interface SourcingResult {
  keyword: string; target: number; collected: number;
  rejected: { margin: number; banned: number; dup: number; stock: number };
  unmapped: number; noOrigin: number; aiUsed: boolean;
  items: Sourced[];
}

export async function runSourcing(keyword: string, target = 12, useAI = true): Promise<SourcingResult> {
  // 1) 후보 수집 (목표 ×3)
  const search = await searchSupply(keyword, Math.min(target * 3, 60));
  const rej = { margin: 0, banned: 0, dup: 0, stock: 0 };

  // 2) 1차 필터 (가격/마진/금지어/중복) — getItemList 정보만으로
  const seen: string[] = [];
  const passed: any[] = [];
  for (const it of search.items) {
    if (BANNED.some((b) => it.title.includes(b))) { rej.banned++; continue; }
    const pr = price(it.supplyPrice, it.deliveryFee);
    if (pr.rate < MIN_MARGIN) { rej.margin++; continue; }
    const n = norm(it.title);
    if (seen.some((s) => dice(n, s) >= DEDUP)) { rej.dup++; continue; }
    seen.push(n);
    passed.push({ it, pr });
  }
  passed.sort((a, b) => b.pr.rate - a.pr.rate);
  const top = passed.slice(0, target);

  // 3) 상위만 상세조회(재고/원산지/카테고리) + 재고 필터 + AI 재작성
  const ai = useAI && process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }) : null;
  const items: Sourced[] = [];
  let unmapped = 0, noOrigin = 0;
  for (const { it, pr } of top) {
    let detail;
    try { detail = await getSupplyDetail(it.no); } catch { detail = null; }
    if (detail && detail.inventory <= 0) { rej.stock++; continue; }
    const removeWords = [...BANNED, detail?.manufacturer || ""];
    let newTitle = sanitizeTitle(it.title, removeWords);
    let tags = (detail?.keywordsDome || []).slice(0, 10).join(", ");
    let description = `${newTitle} 상품입니다. 실용적이고 활용도가 높습니다.`;
    let model = `ST-${it.no.slice(-6)}`;
    if (ai) {
      const r = await aiRewrite(ai, it.title, detail?.keywordsDome || [], detail?.categoryPath || "", removeWords);
      if (r) { newTitle = r.title || newTitle; tags = r.tags || tags; description = r.description || description; model = r.model || model; }
      await new Promise((r) => setTimeout(r, 300));
    }
    const naverCategory = CATEGORY_MAP[detail?.categoryCode || ""] || "";
    if (!naverCategory) unmapped++;
    if (!detail?.origin) noOrigin++;
    items.push({
      no: it.no, origTitle: it.title, newTitle, thumb: it.thumb, url: it.url,
      supplyPrice: it.supplyPrice, deliveryFee: it.deliveryFee, freeShip: it.freeShip,
      sellPrice: pr.sell, normalPrice: pr.normal, marginRate: Math.round(pr.rate * 100),
      inventory: detail?.inventory ?? 0, origin: detail?.origin || "", categoryDome: detail?.categoryPath || "",
      naverCategory, tags, description, model, titleOk: newTitle.length > 0 && newTitle.length <= 50,
    });
  }

  return { keyword, target, collected: search.items.length, rejected: rej, unmapped, noOrigin, aiUsed: !!ai, items };
}
