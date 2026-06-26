import { NextResponse } from "next/server";

// 배포 헬스체크용 (인증 미적용 — middleware matcher에서 제외)
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ ok: true });
}
