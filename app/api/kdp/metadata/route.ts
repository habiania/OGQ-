import { NextRequest, NextResponse } from "next/server";
import { generateKdpMetadata, BookMeta } from "@/lib/kdp";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { meta, chapterTitles } = (await req.json()) as { meta: BookMeta; chapterTitles: string[] };
    if (!meta?.title) return NextResponse.json({ error: "책 정보가 부족합니다." }, { status: 400 });
    const metadata = await generateKdpMetadata(meta, chapterTitles || []);
    return NextResponse.json({ metadata });
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
