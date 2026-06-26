import { NextRequest, NextResponse } from "next/server";

// HTTP 기본 인증(암호 잠금). BASIC_AUTH_USER/PASS 가 설정돼 있을 때만 활성화.
// 로컬 개발(.env.local 미설정)에서는 그냥 통과.
export function middleware(req: NextRequest) {
  const USER = process.env.BASIC_AUTH_USER;
  const PASS = process.env.BASIC_AUTH_PASS;
  if (!USER || !PASS) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6)); // "user:pass"
      const idx = decoded.indexOf(":");
      const u = decoded.slice(0, idx);
      const p = decoded.slice(idx + 1);
      if (u === USER && p === PASS) return NextResponse.next();
    } catch {
      /* 잘못된 헤더 → 아래에서 401 */
    }
  }

  return new NextResponse("인증이 필요합니다.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="OGQ Sticker Maker", charset="UTF-8"' },
  });
}

// 정적 자산 + 헬스체크 제외 전체 보호 (API 포함 — 키 소모 엔드포인트도 잠금)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
