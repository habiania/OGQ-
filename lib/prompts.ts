import { Emotion, StyleOption } from "./constants";

// 해부학 오류·헛것 생성을 막는 공통 제약 (다리 5개, 손가락 과다, 안 시킨 새/소품 등 방지)
const ANATOMY_RULES = [
  `Anatomically correct: exactly one head, two arms, two legs (or the natural number of limbs for the subject) — never extra, duplicated, fused, or floating limbs, hands, or fingers.`,
  `A single clean character only. Do NOT add any extra creatures, animals, birds, hats, crowns, accessories, props, or objects that are not part of the original subject.`,
  `No deformed, melted, or mismatched body parts. Symmetrical and tidy.`,
].join(" ");

// 캐릭터 베이스 생성 프롬프트 (사진 → 스타일화 캐릭터)
export function characterPrompt(style: StyleOption): string {
  return [
    `Turn the subject in the photo into an original mascot sticker character.`,
    `Style: ${style.prompt}.`,
    `Full body, centered, facing forward, friendly neutral expression, standing in a simple natural pose.`,
    `Clean simple design suitable for a messenger sticker. No text. No background, fully transparent.`,
    `Keep the subject's key identifying features (overall shape, main colors, distinctive marks).`,
    ANATOMY_RULES,
  ].join(" ");
}

// 감정별 변형 프롬프트 (캐릭터 일관성 유지 핵심)
export function emotionPrompt(emotion: Emotion): string {
  return [
    `Create the EXACT same character as the input image.`,
    `Do not change the character's design, hairstyle, body shape, colors, or the number of limbs.`,
    `Only change the expression and pose to: ${emotion.expr}.`,
    `Keep it centered, simple, sticker-friendly. No text. Fully transparent background.`,
    ANATOMY_RULES,
  ].join(" ");
}
