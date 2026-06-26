import { NextRequest, NextResponse } from "next/server";
import { generateListing } from "@/lib/listing";
import { Analysis } from "@/lib/wholesale";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { analysis } = (await req.json()) as { analysis: Analysis };
    if (!analysis?.keyword) {
      return NextResponse.json({ error: "먼저 키워드 분석을 실행하세요." }, { status: 400 });
    }
    const listing = await generateListing(analysis);
    return NextResponse.json({ listing });
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
