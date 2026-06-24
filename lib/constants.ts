// OGQ 스티커 판매 규격 (OGQ 크리에이터 스튜디오 기준)
// 스티커 이미지: 740 x 640 px, PNG, 투명배경, 24개
// 대표 이미지(메인): 240 x 240 px, PNG
// 탭 이미지: 96 x 74 px, PNG
// 각 파일 1MB 이하 권장
export const OGQ_SPEC = {
  sticker: { width: 740, height: 640, count: 24 },
  main: { width: 240, height: 240 },
  tab: { width: 96, height: 74 },
  maxFileBytes: 1024 * 1024, // 1MB
  format: "png" as const,
} as const;

export type StyleId =
  | "cute"
  | "chibi"
  | "pixel"
  | "anime"
  | "cartoon"
  | "sticker"
  | "watercolor"
  | "3d";

export interface StyleOption {
  id: StyleId;
  name: string;
  desc: string;
  // 캐릭터 생성 프롬프트에 주입되는 스타일 지시문
  prompt: string;
}

export const STYLES: StyleOption[] = [
  { id: "cute", name: "Cute", desc: "귀여운 스타일", prompt: "adorable kawaii cute character, soft rounded shapes, pastel friendly look" },
  { id: "chibi", name: "Chibi", desc: "SD 스타일", prompt: "super-deformed chibi character, big head small body, SD proportions" },
  { id: "pixel", name: "Pixel", desc: "픽셀 스타일", prompt: "retro pixel-art character, crisp pixels, limited palette, 16-bit game sprite" },
  { id: "anime", name: "Anime", desc: "애니 스타일", prompt: "clean anime style character, expressive eyes, cel shading" },
  { id: "cartoon", name: "Cartoon", desc: "카툰 스타일", prompt: "bold cartoon character, thick clean outlines, flat vibrant colors" },
  { id: "sticker", name: "Sticker", desc: "OGQ 최적화", prompt: "messenger sticker style character, thick white die-cut outline, simple bold expression, flat colors" },
  { id: "watercolor", name: "Watercolor", desc: "수채화 스타일", prompt: "soft watercolor illustration character, gentle gradients, painterly texture" },
  { id: "3d", name: "3D", desc: "3D 피규어 스타일", prompt: "cute 3D render character, soft studio lighting, glossy toy figure look" },
];

export interface Emotion {
  n: number;
  key: string;
  ko: string; // 스티커에 들어갈 한글 대사
  // 표정/포즈 영문 지시 (이미지 모델용)
  expr: string;
}

// 기본 24종 감정 세트
export const EMOTIONS: Emotion[] = [
  { n: 1, key: "hi", ko: "안녕", expr: "waving hello, friendly smile" },
  { n: 2, key: "thanks", ko: "고마워", expr: "grateful gesture, slight bow, warm smile" },
  { n: 3, key: "love", ko: "사랑해", expr: "blowing a kiss, hearts around" },
  { n: 4, key: "like", ko: "좋아", expr: "thumbs up, cheerful" },
  { n: 5, key: "best", ko: "최고", expr: "both thumbs up, sparkling eyes" },
  { n: 6, key: "sorry", ko: "미안해", expr: "apologetic, hands together, sad eyes" },
  { n: 7, key: "hungry", ko: "배고파", expr: "holding belly, drooling, longing look" },
  { n: 8, key: "sleepy", ko: "졸려", expr: "yawning, half-closed eyes, sleepy" },
  { n: 9, key: "angry", ko: "화났어", expr: "angry pout, steam, frowning" },
  { n: 10, key: "cheerup", ko: "힘내", expr: "clenched fist of encouragement, determined smile" },
  { n: 11, key: "support", ko: "응원해", expr: "cheering with pom-pom energy, excited" },
  { n: 12, key: "congrats", ko: "축하해", expr: "celebrating with confetti, party" },
  { n: 13, key: "happy", ko: "행복해", expr: "blissful big smile, sparkles" },
  { n: 14, key: "sad", ko: "슬퍼", expr: "downcast, single tear, frowning" },
  { n: 15, key: "crying", ko: "울고있어", expr: "crying with streaming tears" },
  { n: 16, key: "play", ko: "놀자", expr: "excited inviting gesture, playful" },
  { n: 17, key: "wow", ko: "대박", expr: "shocked amazed expression, wide eyes, mouth open" },
  { n: 18, key: "good", ko: "굿", expr: "ok hand sign, confident wink" },
  { n: 19, key: "heart", ko: "하트", expr: "making finger heart, loving smile" },
  { n: 20, key: "touched", ko: "감동", expr: "moved to happy tears, hands on cheeks" },
  { n: 21, key: "call", ko: "콜", expr: "phone-call hand gesture, agreeing wink" },
  { n: 22, key: "go", ko: "출발", expr: "running forward energetically, motion lines" },
  { n: 23, key: "wait", ko: "기다려", expr: "holding palm out to wait, patient look" },
  { n: 24, key: "goodnight", ko: "잘자", expr: "sleeping with nightcap, peaceful, zzz" },
];
