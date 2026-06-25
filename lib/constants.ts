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

// 카카오 이모티콘 규격 (멈춰있는 이모티콘 제안 기준)
// 이미지: 360 x 360 px, PNG, 투명배경 / 썸네일 360 x 360 / 각 파일 150KB 이하 권장
// 제안 표준 개수는 32개. 본 도구는 24/32/40 선택 지원.
export const KAKAO_SPEC = {
  item: { width: 360, height: 360 },
  thumb: { width: 360, height: 360 },
  counts: [24, 32, 40] as const,
  maxFileBytes: 150 * 1024, // 150KB
  format: "png" as const,
} as const;

export type GenMode = "ogq" | "kakao";

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

// 카카오 이모티콘용 40종 — 과장된 표정 + 역동적 포즈 + 카카오에서 자주 쓰는 문구.
// 24/32/40 선택 시 앞에서부터 잘라 사용(앞쪽일수록 사용 빈도 높은 기본 감정).
export const KAKAO_ITEMS: Emotion[] = [
  { n: 1, key: "hi", ko: "안녕!", expr: "waving both hands wildly, huge beaming smile, bouncing" },
  { n: 2, key: "morning", ko: "굿모닝", expr: "stretching arms up just waking, sparkly eyes, sunrise vibe" },
  { n: 3, key: "gnight", ko: "잘자~", expr: "lying down sleeping, giant Zzz bubbles, blissful face" },
  { n: 4, key: "thanks", ko: "고마워!", expr: "deep grateful bow, hands pressed together, sparkling eyes" },
  { n: 5, key: "sorry", ko: "미안해...", expr: "kneeling apology, big teary puppy eyes, hands clasped" },
  { n: 6, key: "lol", ko: "ㅋㅋㅋㅋ", expr: "rolling on the floor laughing, holding belly, tears of laughter bursting" },
  { n: 7, key: "huh", ko: "헉!", expr: "jumping back in shock, jaw dropped, eyes popping out" },
  { n: 8, key: "daebak", ko: "대박!", expr: "mind-blown amazement, both hands on cheeks, explosion behind" },
  { n: 9, key: "like", ko: "좋아!", expr: "enthusiastic double thumbs up, beaming, leaning in" },
  { n: 10, key: "best", ko: "최고!", expr: "jumping high with both thumbs up, star-shaped eyes" },
  { n: 11, key: "ok", ko: "오케이!", expr: "giant OK hand sign close-up, confident wink" },
  { n: 12, key: "agree", ko: "인정!", expr: "nodding hard, pointing finger, strong agreeing face" },
  { n: 13, key: "why", ko: "왜?", expr: "head tilted, confused, giant question mark above head" },
  { n: 14, key: "hungry", ko: "배고파", expr: "clutching growling stomach, drooling, begging eyes" },
  { n: 15, key: "sleepy", ko: "졸려", expr: "half-asleep, enormous yawn, drooping eyelids, wobbling" },
  { n: 16, key: "fighting", ko: "힘내!", expr: "cheering with both fists raised, fiery energetic spirit" },
  { n: 17, key: "love", ko: "사랑해♡", expr: "making a big heart with both arms, eyes turned into hearts" },
  { n: 18, key: "congrats", ko: "축하해!", expr: "popping party poppers, confetti everywhere, huge grin, jumping" },
  { n: 19, key: "angry", ko: "화났어!", expr: "furious, steam blasting from head, stomping, red face" },
  { n: 20, key: "wait", ko: "기다려!", expr: "thrusting palm out in a big STOP gesture, urgent face" },
  { n: 21, key: "towork", ko: "출근...", expr: "dragging feet exhausted, gloomy rain cloud overhead, dead eyes" },
  { n: 22, key: "offwork", ko: "퇴근!", expr: "running off joyfully, arms thrown up, liberated huge smile" },
  { n: 23, key: "goodnight2", ko: "굿밤", expr: "cozy wrapped in blanket, candle, peaceful sleepy smile" },
  { n: 24, key: "seeyou", ko: "잘 다녀와", expr: "waving goodbye with a handkerchief, gentle warm smile" },
  { n: 25, key: "sob", ko: "엉엉", expr: "ugly-crying a flood of tears, dramatic wailing, hands on face" },
  { n: 26, key: "bow", ko: "굽신굽신", expr: "exaggerated repeated polite 90-degree bowing, motion lines" },
  { n: 27, key: "eyeheart", ko: "뿅", expr: "eyes as giant beating hearts, blowing kisses, floating hearts" },
  { n: 28, key: "shy", ko: "부끄", expr: "blushing intensely, hiding face with hands, peeking shyly" },
  { n: 29, key: "aegyo", ko: "애교뿜뿜", expr: "cute aegyo pose, finger on cheek, sparkly wink" },
  { n: 30, key: "cheer", ko: "화이팅", expr: "shaking pom-poms, big cheerleader jump, sparkles" },
  { n: 31, key: "clap", ko: "짝짝짝", expr: "clapping hands enthusiastically, sparkles, excited" },
  { n: 32, key: "dance", ko: "신나", expr: "dancing energetically, dynamic motion lines, joyful" },
  { n: 33, key: "jump", ko: "점프!", expr: "jumping super high with joy, arms and legs spread wide" },
  { n: 34, key: "roll", ko: "데구르르", expr: "tumbling and rolling, dizzy spirals, motion blur" },
  { n: 35, key: "thumbsup", ko: "엄지척", expr: "giant exaggerated thumbs up filling the frame, big grin" },
  { n: 36, key: "fingerheart", ko: "하트뿅", expr: "shooting a finger-heart beam, playful wink, sparkles" },
  { n: 37, key: "excited", ko: "두근두근", expr: "trembling with excitement, sparkling eyes, hands clenched" },
  { n: 38, key: "shocked", ko: "깜놀", expr: "extreme shock, hair standing up, blank white eyes, frozen" },
  { n: 39, key: "proud", ko: "굿!", expr: "confident proud good gesture, hand on hip, big smirk" },
  { n: 40, key: "meltdown", ko: "멘붕", expr: "total meltdown, frazzled, swirly spiral eyes, shattered" },
];

export function getItems(mode: GenMode, count = 24): Emotion[] {
  return mode === "kakao" ? KAKAO_ITEMS.slice(0, count) : EMOTIONS;
}
