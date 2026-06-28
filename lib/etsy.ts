import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import path from "path";
import { GoogleGenAI } from "@google/genai";

let FONT = "sans-serif", FONT_B = "sans-serif", ready = false;
function ensureFont() {
  if (ready) return;
  ready = true;
  try { if (GlobalFonts.registerFromPath(path.join(process.cwd(), "assets/fonts/NanumGothic.ttf"), "EtsyR")) FONT = "EtsyR"; } catch {}
  try { if (GlobalFonts.registerFromPath(path.join(process.cwd(), "assets/fonts/NanumGothicBold.ttf"), "EtsyB")) FONT_B = "EtsyB"; } catch {}
}

export interface Quote { text: string; author: string }

// 주제별 명언/문구 생성 (Gemini 무료)
export async function generateQuotes(theme: string, count: number, language: string): Promise<Quote[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY 가 없습니다.");
  const ai = new GoogleGenAI({ apiKey: key });
  const lang = language === "en" ? "English" : "한국어";
  const prompt = `주제 "${theme}"에 어울리는 짧고 임팩트 있는 ${lang} 명언/문구 ${count}개를 만들어줘.
- 기존 유명 저작권 문구 그대로 복제 금지(원작자 인용은 일반적으로 알려진 짧은 격언만, 아니면 author는 빈 문자열).
- 포스터/카드용으로 1~2문장, 강렬하게.
JSON으로만: {"quotes":[{"text":"","author":""}]}`;
  let last: any = null;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt, config: { responseMimeType: "application/json" } });
      const p = JSON.parse(res.text || "{}");
      return (p.quotes || []).slice(0, count).map((q: any) => ({ text: q.text || "", author: q.author || "" }));
    } catch (e: any) {
      last = e; const m = (e?.message || "").toLowerCase();
      if (!(m.includes("503") || m.includes("overload") || m.includes("unavailable") || m.includes("429")) || i === 2) break;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

// 색 팔레트 (배경, 글자, 포인트)
const PALETTES: [string, string, string][] = [
  ["#0f172a", "#f8fafc", "#38bdf8"],
  ["#fdf2f8", "#831843", "#ec4899"],
  ["#ecfdf5", "#064e3b", "#10b981"],
  ["#fffbeb", "#78350f", "#f59e0b"],
  ["#1e1b4b", "#e0e7ff", "#a78bfa"],
  ["#f8fafc", "#0f172a", "#0ea5e9"],
];

function wrap(ctx: any, text: string, maxW: number): string[] {
  const out: string[] = []; let line = "";
  for (const ch of text) {
    const t = line + ch;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = ch; }
    else line = t;
  }
  if (line) out.push(line);
  return out;
}

function centeredText(ctx: any, lines: string[], cx: number, cy: number, lh: number) {
  const total = lines.length * lh;
  let y = cy - total / 2 + lh / 2;
  for (const ln of lines) { ctx.fillText(ln, cx, y); y += lh; }
}

// 명언 포스터 (A4 세로, 200dpi 1654x2339)
export function composePoster(q: Quote, idx: number): Buffer {
  ensureFont();
  const W = 1654, H = 2339;
  const [bg, fg, accent] = PALETTES[idx % PALETTES.length];
  const c = createCanvas(W, H); const ctx = c.getContext("2d");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // 테두리
  ctx.strokeStyle = accent; ctx.lineWidth = 8; ctx.strokeRect(70, 70, W - 140, H - 140);
  // 본문
  ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  let size = q.text.length > 60 ? 92 : q.text.length > 30 ? 120 : 150;
  ctx.font = `bold ${size}px "${FONT_B}"`;
  const lines = wrap(ctx, q.text, W - 360);
  centeredText(ctx, lines, W / 2, H / 2 - 40, size * 1.3);
  // 포인트 선
  ctx.strokeStyle = accent; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(W / 2 - 120, H / 2 + lines.length * size * 0.7 + 60); ctx.lineTo(W / 2 + 120, H / 2 + lines.length * size * 0.7 + 60); ctx.stroke();
  // 저자
  if (q.author) {
    ctx.fillStyle = accent; ctx.font = `400 56px "${FONT}"`;
    ctx.fillText(`— ${q.author}`, W / 2, H / 2 + lines.length * size * 0.7 + 140);
  }
  return c.toBuffer("image/png");
}

// 인용구 카드 (정사각 1080x1080, SNS/Etsy)
export function composeCard(q: Quote, idx: number): Buffer {
  ensureFont();
  const S = 1080;
  const [bg, fg, accent] = PALETTES[idx % PALETTES.length];
  const c = createCanvas(S, S); const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, bg); g.addColorStop(1, accent + "22");
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  let size = q.text.length > 50 ? 56 : q.text.length > 24 ? 72 : 92;
  ctx.font = `bold ${size}px "${FONT_B}"`;
  const lines = wrap(ctx, q.text, S - 180);
  centeredText(ctx, lines, S / 2, S / 2 - 20, size * 1.3);
  if (q.author) {
    ctx.fillStyle = accent; ctx.font = `400 36px "${FONT}"`;
    ctx.fillText(`— ${q.author}`, S / 2, S / 2 + lines.length * size * 0.72 + 70);
  }
  return c.toBuffer("image/png");
}

// 플래너용 항목 생성 (체크리스트/습관) — 테마 주면 Gemini가 생성
export async function generateListItems(theme: string, count: number, kind: "checklist" | "habit", language: string): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const lang = language === "en" ? "English" : "한국어";
    const what = kind === "habit" ? "매일 실천할 습관 항목(짧게)" : "체크리스트 항목(짧게)";
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `주제 "${theme}"에 대한 ${what} ${count}개를 ${lang}로. JSON으로만: {"items":["",""]}`,
      config: { responseMimeType: "application/json" },
    });
    const p = JSON.parse(res.text || "{}");
    return (p.items || []).slice(0, count);
  } catch { return []; }
}

// ===== 프리미엄 Etsy 리스팅 풀세트 (상업성 평가 포함) =====
export interface ListingKit {
  artTitle: string;        // 작품에 들어갈 짧은 문구
  artSubtitle: string;
  recommendedStyle: "boho" | "colorblock" | "lineart" | "typographic";
  productTitle: string;    // Etsy 상품 제목(키워드)
  seoTitle: string;        // 검색 최적화 제목
  description: string;
  tags: string[];          // 13개
  materials: string;
  category: string;
  fileList: string[];
  downloadInstructions: string;
  commercialScore: number; // 0~100
  commercialReason: string;
  features: string[];       // 제품 특징/차별점
  targetCustomer: string;   // 타겟 고객
  seoKeywords: string[];    // SEO 키워드
  analysis: string;         // 상위 판매 상품 분석 + 개선 포인트
}

export async function generateListingKit(category: string, theme: string, language: string): Promise<ListingKit> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY 가 없습니다.");
  const ai = new GoogleGenAI({ apiKey: key });
  const lang = language === "en" ? "English" : "한국어";
  const prompt = `You are an expert Etsy digital-product seller. Create a READY-TO-SELL listing for a printable "${category}" on the theme "${theme}".
Prioritize commercial success on Etsy: high demand, evergreen, high perceived value. Original only — never imitate copyrighted art/brands.
Write description/tags in ${lang === "English" ? "English" : "Korean"} (Etsy tags should be lowercase short phrases).

Respond JSON only:
{
 "artTitle": "short phrase printed on the art (1-4 words)",
 "artSubtitle": "tiny subtitle or empty",
 "recommendedStyle": "boho | colorblock | lineart | typographic",
 "productTitle": "keyword-rich Etsy title (<=140 chars)",
 "seoTitle": "SEO optimized title",
 "description": "compelling 4-6 sentence product description",
 "tags": ["13 etsy tags, each <=20 chars"],
 "materials": "e.g. Digital file, PNG, PDF",
 "category": "etsy category path",
 "fileList": ["list of included files e.g. A4 300DPI PNG, ..."],
 "downloadInstructions": "how the buyer downloads & prints",
 "commercialScore": <integer 0-100, where 80+ means strong evergreen seller>,
 "commercialReason": "why this sells well (1 line)",
 "features": ["6-8 product features / differentiators vs typical competitors"],
 "targetCustomer": "who this is for (1-2 sentences)",
 "seoKeywords": ["10 high-intent search keywords buyers use"],
 "analysis": "Brief competitor analysis of top sellers for this keyword: common title patterns, what reviews praise, common gaps, and 3+ ways THIS product is better. 3-5 sentences."
}`;
  let last: any = null;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt, config: { responseMimeType: "application/json" } });
      const p = JSON.parse(res.text || "{}");
      const style = ["boho", "colorblock", "lineart", "typographic"].includes(p.recommendedStyle) ? p.recommendedStyle : "boho";
      return {
        artTitle: p.artTitle || theme,
        artSubtitle: p.artSubtitle || "",
        recommendedStyle: style,
        productTitle: p.productTitle || "",
        seoTitle: p.seoTitle || "",
        description: p.description || "",
        tags: (p.tags || []).slice(0, 13),
        materials: p.materials || "Digital download (PNG)",
        category: p.category || category,
        fileList: p.fileList || [],
        downloadInstructions: p.downloadInstructions || "",
        commercialScore: Number(p.commercialScore) || 0,
        commercialReason: p.commercialReason || "",
        features: p.features || [],
        targetCustomer: p.targetCustomer || "",
        seoKeywords: p.seoKeywords || [],
        analysis: p.analysis || "",
      };
    } catch (e: any) {
      last = e; const m = (e?.message || "").toLowerCase();
      if (!(m.includes("503") || m.includes("overload") || m.includes("unavailable") || m.includes("429")) || i === 2) break;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}
