import { NextRequest, NextResponse } from "next/server";
import { buildStickerSheet } from "@/lib/stickersheet";
import { sanitizePng } from "@/lib/png";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  try {
    const { images, cols } = (await req.json()) as { images: string[]; cols?: number };
    if (!images?.length) return NextResponse.json({ error: "이미지를 1개 이상 올리세요." }, { status: 400 });
    const bufs = images.map((b) => sanitizePng(Buffer.from((b.split(",")[1] || b), "base64")));
    const pdf = await buildStickerSheet(bufs, Math.min(Math.max(cols || 3, 2), 5));
    return NextResponse.json({ pdfB64: `data:application/pdf;base64,${pdf.toString("base64")}` });
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
