import { Emotion, StyleOption } from "./constants";

// 캐릭터 베이스 생성 프롬프트 (사진 → 스타일화 캐릭터)
export function characterPrompt(style: StyleOption): string {
  return [
    `Turn the subject in the photo into an original mascot sticker character.`,
    `Style: ${style.prompt}.`,
    `Full body or upper body, centered, facing forward, friendly neutral expression.`,
    `Clean simple design suitable for a messenger sticker. No text. No background, fully transparent.`,
    `Keep the subject's key identifying features (overall shape, main colors, distinctive marks).`,
  ].join(" ");
}

// 감정별 변형 프롬프트 (캐릭터 일관성 유지 핵심)
export function emotionPrompt(emotion: Emotion): string {
  return [
    `Create the EXACT same character as the input image.`,
    `Do not change the character's design, hairstyle, body shape, or colors.`,
    `Only change the expression and pose to: ${emotion.expr}.`,
    `Keep it centered, simple, sticker-friendly. No text. Fully transparent background.`,
  ].join(" ");
}
