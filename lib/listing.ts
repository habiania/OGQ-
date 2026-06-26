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
}

const SYSTEM = `당신은 한국 스마트스토어 위탁판매 SEO 전문가입니다.
주어진 키워드와 경쟁/가격 분석을 바탕으로, 검색 노출과 클릭률이 높은 상품 리스팅을 만듭니다.
규칙:
- 상품명은 100자 이하, 반복 키워드 제거, 상표/브랜드명 도용 금지, 검색량 높은 키워드 우선 배치.
- 과장·허위·의료효능 표현 금지. 자연스러운 한국어.
- 반드시 지정한 JSON 스키마로만 응답.`;

function buildPrompt(analysis: Analysis): string {
  const ctx = `키워드: ${analysis.keyword}
경쟁상품 수: ${analysis.total.toLocaleString()} (경쟁도 ${analysis.competition.level})
가격대: 최저 ${analysis.price.min}원 / 평균 ${analysis.price.avg}원 / 최고 ${analysis.price.max}원
상위 상품명 예시: ${analysis.topItems.slice(0, 5).map((i) => i.title).join(" | ")}`;
  return `${SYSTEM}\n\n${ctx}\n\n아래 JSON 스키마로만 응답:
{"productName":"","shortDesc":"","detail":"","metaDescription":"","tags":["",""],"keywords":["",""],"promo":"","points":["",""],"faq":[{"q":"","a":""}]}`;
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
  };
}

// 텍스트 생성은 Gemini(무료 티어)를 우선 사용, 없으면 OpenAI로 폴백.
export async function generateListing(analysis: Analysis): Promise<Listing> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    // 503(과부하)·일시 오류 시 자동 재시도 (최대 3회, 점증 대기)
    let lastErr: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: buildPrompt(analysis),
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
    messages: [{ role: "user", content: buildPrompt(analysis) }],
  });
  return normalize(JSON.parse(res.choices[0]?.message?.content || "{}"));
}
