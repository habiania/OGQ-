import { GoogleGenAI } from "@google/genai";
import { Analysis } from "./wholesale";

export interface Candidate {
  index: number;
  title: string;
  supplyPrice: number;
  deliveryFee: number;
}

export interface Pick {
  index: number;
  reason: string; // 왜 잘 팔릴지 한 줄
  score: number; // 0~100
}

// 도매매 후보 중 "팔기 좋은" 상품을 AI가 판단해 상위 추천
export async function recommendProducts(analysis: Analysis, candidates: Candidate[]): Promise<Pick[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini API 키가 없습니다.");
  const ai = new GoogleGenAI({ apiKey: key });

  const list = candidates
    .map((c) => `#${c.index} | ${c.title} | 공급가 ${c.supplyPrice}원 | 배송 ${c.deliveryFee}원`)
    .join("\n");

  const prompt = `당신은 한국 스마트스토어 위탁판매 MD입니다.
키워드 "${analysis.keyword}" 시장: 경쟁상품 ${analysis.total.toLocaleString()}개(경쟁도 ${analysis.competition.level}), 시장 판매가 최저 ${analysis.price.min} / 평균 ${analysis.price.avg} / 최고 ${analysis.price.max}원.

아래 도매 공급 상품 후보 중, 위탁판매로 "팔기 좋은" 상품 상위 3개를 골라주세요.
판단 기준: (1) 공급가 대비 시장가 마진 여유, (2) 대중적 수요/범용성, (3) 배송비 부담 적음, (4) 상품명에서 느껴지는 상품성.

후보:
${list}

JSON으로만 응답: {"picks":[{"index":0,"reason":"","score":0}]}  (score는 0~100, 높을수록 추천)`;

  let lastErr: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });
      const parsed = JSON.parse(res.text || "{}");
      const picks: Pick[] = (parsed.picks || [])
        .map((p: any) => ({ index: Number(p.index), reason: p.reason || "", score: Number(p.score) || 0 }))
        .filter((p: Pick) => candidates.some((c) => c.index === p.index));
      return picks.sort((a, b) => b.score - a.score).slice(0, 3);
    } catch (e: any) {
      lastErr = e;
      const msg = (e?.message || "").toLowerCase();
      if (!(msg.includes("503") || msg.includes("overload") || msg.includes("unavailable") || msg.includes("429")) || attempt === 2) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}
