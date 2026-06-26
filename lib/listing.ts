import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { Analysis } from "./wholesale";

export interface Listing {
  productName: string; // 스마트스토어 최적화 상품명 (100자 이하)
  shortDesc: string;
  detail: string;
  metaDescription: string;
  tags: string[];
  keywords: string[];
  promo: string;
  points: string[];
  faq: { q: string; a: string }[];
  recommendedPrice: number; // AI 추천 판매가
  listPrice: number; // AI 추천 정상가(할인 연출)
  priceReason: string; // 가격 추천 근거 한 줄
}

export interface SupplyInfo {
  minSupply: number; // 도매 공급가 최저
  avgSupply: number; // 도매 공급가 평균
}

export interface ProductInfo {
  title: string; // 도매 원본 상품명
  supplyPrice: number; // 이 상품 공급가
  deliveryFee: number; // 이 상품 배송비
}

const SYSTEM = `당신은 한국 스마트스토어 위탁판매 SEO 전문가입니다.
주어진 키워드와 경쟁/가격 분석을 바탕으로, 검색 노출과 클릭률이 높은 상품 리스팅을 만듭니다.
규칙:
- 상품명은 100자 이하, 반복 키워드 제거, 상표/브랜드명 도용 금지, 검색량 높은 키워드 우선 배치.
- 과장·허위·의료효능 표현 금지. 자연스러운 한국어.
- 반드시 지정한 JSON 스키마로만 응답.`;

function buildPrompt(analysis: Analysis, supply?: SupplyInfo, product?: ProductInfo): string {
  const supplyLine = product
    ? `이 상품 공급가(원가): ${product.supplyPrice}원 / 배송비 ${product.deliveryFee}원`
    : supply
    ? `도매 공급가(원가): 최저 ${supply.minSupply}원 / 평균 ${supply.avgSupply}원`
    : `도매 공급가: 알 수 없음(시장가 기준으로 추천)`;
  const productLine = product
    ? `\n대상 상품(도매 원본명): "${product.title}"\n→ 이 상품을 기준으로 상품명/상세/가격을 만드세요. 원본명에서 브랜드·상표 의심 단어는 빼고 일반 명사로 바꾸세요.`
    : "";
  const ctx = `키워드: ${analysis.keyword}
경쟁상품 수: ${analysis.total.toLocaleString()} (경쟁도 ${analysis.competition.level})
시장 판매가: 최저 ${analysis.price.min}원 / 평균 ${analysis.price.avg}원 / 최고 ${analysis.price.max}원
${supplyLine}${productLine}
상위 상품명 예시: ${analysis.topItems.slice(0, 5).map((i) => i.title).join(" | ")}`;
  return `${SYSTEM}

${ctx}

가격 추천 규칙:
- recommendedPrice(판매가): 시장에서 경쟁력 있게(보통 시장 평균가 근처 또는 약간 아래), 단 공급가 대비 판매수수료 6%+마진 25% 이상 남도록. 100원 단위 정수.
- listPrice(정상가): recommendedPrice보다 20~30% 높게(할인 연출용). 100원 단위 정수.
- priceReason: 한 줄 근거.

아래 JSON 스키마로만 응답:
{"productName":"","shortDesc":"","detail":"","metaDescription":"","tags":["",""],"keywords":["",""],"promo":"","points":["",""],"faq":[{"q":"","a":""}],"recommendedPrice":0,"listPrice":0,"priceReason":""}`;
}

function normalize(parsed: any): Listing {
  return {
    productName: parsed.productName || "",
    shortDesc: parsed.shortDesc || "",
    detail: parsed.detail || "",
    metaDescription: parsed.metaDescription || "",
    tags: parsed.tags || [],
    keywords: parsed.keywords || [],
    promo: parsed.promo || "",
    points: parsed.points || [],
    faq: parsed.faq || [],
    recommendedPrice: Number(parsed.recommendedPrice) || 0,
    listPrice: Number(parsed.listPrice) || 0,
    priceReason: parsed.priceReason || "",
  };
}

// 텍스트 생성은 Gemini(무료 티어)를 우선 사용, 없으면 OpenAI로 폴백.
export async function generateListing(analysis: Analysis, supply?: SupplyInfo, product?: ProductInfo): Promise<Listing> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    // 503(과부하)·일시 오류 시 자동 재시도 (최대 3회, 점증 대기)
    let lastErr: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: buildPrompt(analysis, supply, product),
          config: { responseMimeType: "application/json" },
        });
        return normalize(JSON.parse(res.text || "{}"));
      } catch (e: any) {
        lastErr = e;
        const msg = (e?.message || "").toLowerCase();
        const retryable = msg.includes("503") || msg.includes("overload") || msg.includes("unavailable") || msg.includes("429");
        if (!retryable || attempt === 2) break;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    throw lastErr;
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("AI 키가 없습니다 (GEMINI_API_KEY 또는 OPENAI_API_KEY).");
  const client = new OpenAI({ apiKey: openaiKey });
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: buildPrompt(analysis, supply, product) }],
  });
  return normalize(JSON.parse(res.choices[0]?.message?.content || "{}"));
}
