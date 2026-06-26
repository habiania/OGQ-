import OpenAI from "openai";
import { Analysis } from "./wholesale";

export interface Listing {
  productName: string; // 스마트스토어 최적화 상품명 (100자 이하)
  shortDesc: string; // 짧은 설명
  detail: string; // 상세설명
  metaDescription: string;
  tags: string[]; // 검색태그
  keywords: string[]; // 검색키워드
  promo: string; // 홍보문구
  points: string[]; // 구매포인트
  faq: { q: string; a: string }[];
}

const SYSTEM = `당신은 한국 스마트스토어 위탁판매 SEO 전문가입니다.
주어진 키워드와 경쟁/가격 분석을 바탕으로, 검색 노출과 클릭률이 높은 상품 리스팅을 만듭니다.
규칙:
- 상품명은 100자 이하, 반복 키워드 제거, 상표/브랜드명 도용 금지, 검색량 높은 키워드 우선 배치.
- 과장·허위·의료효능 표현 금지. 자연스러운 한국어.
- 반드시 지정한 JSON 스키마로만 응답.`;

export async function generateListing(analysis: Analysis, apiKey?: string): Promise<Listing> {
  const key = (apiKey && apiKey.trim()) || process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OpenAI API 키가 없습니다.");
  const client = new OpenAI({ apiKey: key });

  const ctx = `키워드: ${analysis.keyword}
경쟁상품 수: ${analysis.total.toLocaleString()} (경쟁도 ${analysis.competition.level})
가격대: 최저 ${analysis.price.min}원 / 평균 ${analysis.price.avg}원 / 최고 ${analysis.price.max}원
상위 상품명 예시: ${analysis.topItems.slice(0, 5).map((i) => i.title).join(" | ")}`;

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `${ctx}\n\n아래 JSON 스키마로 리스팅을 생성하세요:
{"productName":"","shortDesc":"","detail":"","metaDescription":"","tags":["",""],"keywords":["",""],"promo":"","points":["",""],"faq":[{"q":"","a":""}]}`,
      },
    ],
  });

  const txt = res.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(txt);
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
