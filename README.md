# OGQ AI 스티커 메이커 (개인용)

사진 한 장 → AI 캐릭터화 → 24종 감정 스티커 → OGQ 규격 검수 → ZIP 다운로드.
혼자 쓰는 로컬 도구라 **로그인·결제·DB·관리자·분석은 전부 제외**했습니다.

## 빠른 시작

1. 키 입력 — `.env.local` 에 OpenAI 또는 Gemini 키 중 하나 이상:
   ```
   OPENAI_API_KEY=sk-...
   GEMINI_API_KEY=...
   ```
2. 실행:
   ```
   npm run dev
   ```
3. 브라우저에서 http://localhost:3000 접속 → 사진 업로드 → 스타일 선택 → 생성.

## 동작 방식

| 단계 | 내용 |
|------|------|
| 캐릭터 베이스 | 업로드 사진을 선택 스타일로 캐릭터화 (1장) |
| 24종 생성 | 같은 캐릭터 유지하며 표정/포즈만 변형 |
| 한글 대사 | 이미지 모델 대신 **Skia(@napi-rs/canvas)로 직접 합성** → 깨짐 없음 |
| 검수 | 740x640 / 투명배경 / 1MB / 개수 / 대표·탭 규격 점수화 |
| 출력 | `output/<jobId>/sticker-pack.zip` (stickers/01~24.png, main.png, tab.png, manifest.json) |

## 제공자 차이

- **OpenAI (gpt-image-1)**: 투명배경 네이티브 지원 → 권장.
- **Gemini (2.5 flash image)**: 투명배경 미지원 → 흰배경 생성 후 근사 흰색 제거로 후처리(완벽하지 않을 수 있음).

## OGQ 규격

- 스티커: 740×640 PNG 투명, 24개
- 대표: 240×240 PNG
- 탭: 96×74 PNG

## 스택

Next.js 15 · TypeScript · Tailwind · @napi-rs/canvas · JSZip · OpenAI/Gemini SDK
