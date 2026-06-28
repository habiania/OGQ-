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
  categorySource: "map" | "ai" | "none";
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
그리고 이 상품에 맞는 네이버 스마트스토어 카테고리 경로 1개를 추천하라 (예: "생활/건강 > 반려동물 > 강아지 > 간식").
JSON으로만: {"title":"","tags":["",""],"description":"","model":"","category":""}`;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt, config: { responseMimeType: "application/json" } });
      const p = JSON.parse(res.text || "{}");
      return {
        title: sanitizeTitle(p.title || origTitle, removeWords),
        tags: (p.tags || []).slice(0, 10).join(", "),
        description: p.description || "",
        model: p.model || "",
        category: (p.category || "").trim(),
      };
    } catch (e: any) {
      const m = (e?.message || "").toLowerCase();
      if (!(m.includes("429") || m.includes("503") || m.includes("overload")) || i === 2) break;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  return null;
}

// 테마 → 기본 검색어 (AI 없을 때 폴백). 위탁판매에 잘 맞는 소형/배송간편 위주.
export const THEMES: { key: string; label: string; seeds: string[] }[] = [
  { key: "pet", label: "🐶 반려동물", seeds: ["강아지 장난감", "고양이 사료그릇", "애견 방석", "반려동물 급식기"] },
  { key: "kitchen", label: "🍳 주방·생활", seeds: ["실리콘 주방용품", "밀폐용기", "주방 정리함", "다용도 수납"] },
  { key: "car", label: "🚗 차량용품", seeds: ["차량용 거치대", "차량용 정리함", "자동차 방향제", "차량용 청소"] },
  { key: "interior", label: "🛋️ 인테리어·소품", seeds: ["무드등", "벽 선반", "디퓨저", "인테리어 소품"] },
  { key: "camping", label: "⛺ 캠핑·아웃도어", seeds: ["캠핑 의자", "캠핑 조명", "휴대용 테이블", "아웃도어 매트"] },
  { key: "baby", label: "🧸 유아·완구", seeds: ["유아 식판", "아기 목욕용품", "교육 완구", "유아 안전용품"] },
  { key: "digital", label: "🔌 디지털·악세서리", seeds: ["무선 충전기", "휴대폰 거치대", "케이블 정리", "블루투스 미니"] },
  { key: "beauty", label: "💆 뷰티·헬스", seeds: ["마사지기", "괄사", "셀프 네일", "두피 브러시"] },
];

// 동시 실행 수 제한 병렬 map (429/타임아웃 방지)
async function pmap<T, R>(arr: T[], concurrency: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(arr.length);
  let idx = 0;
  async function worker() { while (idx < arr.length) { const i = idx++; out[i] = await fn(arr[i], i); } }
  await Promise.all(Array.from({ length: Math.min(concurrency, arr.length) }, worker));
  return out;
}

// 테마 → 검색어 결정 (AI 있으면 Gemini가 생성, 없으면 시드 사용)
async function resolveKeywords(ai: GoogleGenAI | null, theme: string): Promise<string[]> {
  const t = THEMES.find((x) => x.key === theme || x.label.includes(theme));
  if (ai) {
    const label = t?.label.replace(/^[^가-힣a-zA-Z]+/, "").trim() || theme;
    try {
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `도매매에서 떼와 스마트스토어 위탁판매로 올리기 좋은 "${label}" 카테고리의 구체적인 상품 검색어 6개를 뽑아라.
조건: 마진 잘 남는 소형/경량(배송 간편), 너무 광범위한 단어 말고 실제 검색되는 상품명 위주, 브랜드명 제외.
JSON으로만: {"keywords":["",""]}`,
        config: { responseMimeType: "application/json" },
      });
      const p = JSON.parse(res.text || "{}");
      const ks = (p.keywords || []).map((s: any) => String(s).trim()).filter(Boolean).slice(0, 6);
      if (ks.length) return ks;
    } catch { /* 폴백 */ }
  }
  return t?.seeds || [theme];
}

export interface SourcingResult {
  keyword: string; keywordsUsed: string[]; target: number; collected: number;
  rejected: { margin: number; banned: number; dup: number; stock: number };
  unmapped: number; noOrigin: number; aiUsed: boolean;
  items: Sourced[];
}

export interface SourcingOpts { keyword?: string; theme?: string; target?: number; useAI?: boolean }

export async function runSourcing(opts: SourcingOpts): Promise<SourcingResult> {
  const target = Math.min(Math.max(opts.target || 12, 1), 20);
  const useAI = opts.useAI !== false;
  const ai = useAI && process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }) : null;

  // 0) 검색어 결정 — 직접 입력 우선, 없으면 테마로 AI/시드 생성
  let keywords: string[];
  if (opts.keyword && opts.keyword.trim()) keywords = [opts.keyword.trim()];
  else if (opts.theme) keywords = await resolveKeywords(ai, opts.theme);
  else throw new Error("검색어 또는 테마를 지정하세요.");

  // 1) 후보 수집 — 키워드별 병렬 검색 후 상품번호로 중복 제거
  const perKw = keywords.length > 1 ? Math.max(target * 2, 15) : target * 3;
  const lists = await Promise.all(
    keywords.map((k) => searchSupply(k, Math.min(perKw, 60)).catch(() => ({ total: 0, items: [] as any[] })))
  );
  const seenNo = new Set<string>();
  const candidates: any[] = [];
  for (const l of lists) for (const it of l.items) if (!seenNo.has(it.no)) { seenNo.add(it.no); candidates.push(it); }

  const rej = { margin: 0, banned: 0, dup: 0, stock: 0 };

  // 2) 1차 필터 (가격/마진/금지어/중복) — getItemList 정보만으로
  const seen: string[] = [];
  const passed: any[] = [];
  for (const it of candidates) {
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

  // 3) 상위만 상세조회 + AI 재작성 — 병렬(동시 4개)로 속도 확보
  const results = await pmap(top, 4, async ({ it, pr }) => {
    let detail;
    try { detail = await getSupplyDetail(it.no); } catch { detail = null; }
    if (detail && detail.inventory <= 0) return { reject: "stock" as const };
    const removeWords = [...BANNED, detail?.manufacturer || ""];
    let newTitle = sanitizeTitle(it.title, removeWords);
    let tags = (detail?.keywordsDome || []).slice(0, 10).join(", ");
    let description = `${newTitle} 상품입니다. 실용적이고 활용도가 높습니다.`;
    let model = `ST-${it.no.slice(-6)}`;
    let aiCategory = "";
    if (ai) {
      const r = await aiRewrite(ai, it.title, detail?.keywordsDome || [], detail?.categoryPath || "", removeWords);
      if (r) { newTitle = r.title || newTitle; tags = r.tags || tags; description = r.description || description; model = r.model || model; aiCategory = r.category || ""; }
    }
    // 확정 매핑(map) 우선, 없으면 AI 추천(확인 필요), 그것도 없으면 미매핑(none)
    const mapped = CATEGORY_MAP[detail?.categoryCode || ""] || "";
    const naverCategory = mapped || aiCategory;
    const categorySource: "map" | "ai" | "none" = mapped ? "map" : aiCategory ? "ai" : "none";
    const sourced: Sourced = {
      no: it.no, origTitle: it.title, newTitle, thumb: it.thumb, url: it.url,
      supplyPrice: it.supplyPrice, deliveryFee: it.deliveryFee, freeShip: it.freeShip,
      sellPrice: pr.sell, normalPrice: pr.normal, marginRate: Math.round(pr.rate * 100),
      inventory: detail?.inventory ?? 0, origin: detail?.origin || "", categoryDome: detail?.categoryPath || "",
      naverCategory, categorySource,
      tags, description, model, titleOk: newTitle.length > 0 && newTitle.length <= 50,
    };
    return { item: sourced };
  });

  const items: Sourced[] = [];
  let unmapped = 0, noOrigin = 0;
  for (const r of results) {
    if ("reject" in r) { rej.stock++; continue; }
    const s = r.item;
    if (s.categorySource === "none") unmapped++;
    if (!s.origin) noOrigin++;
    items.push(s);
  }
  // 마진율 높은 순 정렬 유지
  items.sort((a, b) => b.marginRate - a.marginRate);

  return {
    keyword: opts.keyword || opts.theme || "", keywordsUsed: keywords, target,
    collected: candidates.length, rejected: rej, unmapped, noOrigin, aiUsed: !!ai, items,
  };
}
