import { NextRequest, NextResponse } from "next/server";
import { runSourcing } from "@/lib/sourcing";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { keyword, theme, target, useAI } = (await req.json()) as { keyword?: string; theme?: string; target?: number; useAI?: boolean };
    if ((!keyword || !keyword.trim()) && !theme) {
      return NextResponse.json({ error: "테마를 고르거나 검색어를 입력하세요." }, { status: 400 });
    }
    const n = Math.min(Math.max(Number(target) || 12, 1), 20);
    const result = await runSourcing({ keyword: keyword?.trim(), theme, target: n, useAI: useAI !== false });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
