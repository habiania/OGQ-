import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { generateQuotes, composePoster, composeCard } from "@/lib/etsy";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  try {
    const { type, theme, count, language } = (await req.json()) as {
      type: "poster" | "card";
      theme: string;
      count: number;
      language: string;
    };
    if (!theme?.trim()) return NextResponse.json({ error: "주제를 입력하세요." }, { status: 400 });
    const n = Math.min(Math.max(count || 4, 1), 12);

    const quotes = await generateQuotes(theme.trim(), n, language || "ko");
    const zip = new JSZip();
    const previews: string[] = [];

    quotes.forEach((q, i) => {
      const buf = type === "poster" ? composePoster(q, i) : composeCard(q, i);
      const name = `${type}-${String(i + 1).padStart(2, "0")}.png`;
      zip.file(name, buf);
      if (i < 4) previews.push(`data:image/png;base64,${buf.toString("base64")}`);
    });

    const zipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    return NextResponse.json({
      quotes,
      previews,
      zipB64: `data:application/zip;base64,${zipBuf.toString("base64")}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
