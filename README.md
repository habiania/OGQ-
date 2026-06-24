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

## 배포 (Render, 암호 잠금)

이 앱은 네이티브 모듈(`@napi-rs/canvas`)과 파일시스템을 써서 **Cloudflare Pages/정적 호스팅에선 동작하지 않습니다.** 상시 Node 서버가 도는 [Render](https://render.com) 무료 플랜을 권장합니다.

1. Render 대시보드 → **New + → Blueprint** → 이 깃허브 저장소 선택 (`render.yaml` 자동 인식).
2. 환경변수 입력:
   - `OPENAI_API_KEY` (필수)
   - `BASIC_AUTH_USER`, `BASIC_AUTH_PASS` (암호 잠금 — 둘 다 채우면 사이트·API 전체가 잠김)
3. 배포 후 URL 접속 시 브라우저가 아이디/비밀번호를 묻습니다.

> 암호는 `middleware.ts`의 HTTP 기본 인증으로 처리됩니다. `BASIC_AUTH_*`를 비워두면 인증 없이 열립니다(로컬 개발용). **공개 배포 시 반드시 채우세요 — 안 그러면 누구나 접속해 OpenAI 크레딧을 소모할 수 있습니다.**

## 스택

Next.js 15 · TypeScript · Tailwind · @napi-rs/canvas · JSZip · OpenAI/Gemini SDK
