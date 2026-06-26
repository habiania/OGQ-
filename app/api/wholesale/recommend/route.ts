import { NextRequest, NextResponse } from "next/server";
import { recommendProducts, Candidate } from "@/lib/recommend";
import { Analysis } from "@/lib/wholesale";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { analysis, candidates } = (await req.json()) as { analysis: Analysis; candidates: Candidate[] };
    if (!analysis?.keyword || !candidates?.length) {
      return NextResponse.json({ error: "먼저 분석을 실행하세요." }, { status: 400 });
    }
    const picks = await recommendProducts(analysis, candidates);
    return NextResponse.json({ picks });
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
