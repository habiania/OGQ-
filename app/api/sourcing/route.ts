import { NextRequest, NextResponse } from "next/server";
import { runSourcing } from "@/lib/sourcing";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { keyword, target, useAI } = (await req.json()) as { keyword?: string; target?: number; useAI?: boolean };
    if (!keyword || !keyword.trim()) {
      return NextResponse.json({ error: "검색 키워드를 입력하세요." }, { status: 400 });
    }
    const n = Math.min(Math.max(Number(target) || 12, 1), 20);
    const result = await runSourcing(keyword.trim(), n, useAI !== false);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
