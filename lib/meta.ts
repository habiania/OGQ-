import { StyleOption } from "./constants";

export interface StickerMeta {
  title: string;
  keywords: string[];
}

// 개인용: 별도 API 없이 스타일/주제 기반 템플릿으로 제목·키워드 자동 생성
export function generateMeta(style: StyleOption, subject?: string): StickerMeta {
  const s = (subject || "").trim();
  const base = s || "내 캐릭터";
  const titles = [
    `${base}의 감정 스티커`,
    `${base} 일상 스티커`,
    `${style.name} ${base}`,
  ];
  const keywords = Array.from(
    new Set([
      base,
      "감정",
      "일상",
      "캐릭터",
      "스티커",
      "귀여움",
      style.name.toLowerCase(),
    ])
  ).slice(0, 8);
  return { title: titles[0], keywords };
}

export const titleSuggestions = (style: StyleOption, subject?: string): string[] => {
  const base = (subject || "내 캐릭터").trim();
  return [
    `${base}의 감정 스티커`,
    `${base} 일상 스티커`,
    `${style.name} ${base}`,
    `${base}의 하루`,
  ];
};
