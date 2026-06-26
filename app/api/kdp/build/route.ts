import { NextRequest, NextResponse } from "next/server";
import { buildBookPdf, PageSize, Chapter } from "@/lib/bookpdf";
import { KdpMetadata } from "@/lib/kdp";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { title, subtitle, chapters, metadata, sources, pageSize } = (await req.json()) as {
      title: string;
      subtitle: string;
      chapters: { title: string; content: string; imageB64?: string | null }[];
      metadata?: KdpMetadata;
      sources?: string[];
      pageSize?: PageSize;
    };
    if (!title || !chapters?.length) {
      return NextResponse.json({ error: "책 제목/챕터가 없습니다." }, { status: 400 });
    }

    const chs: Chapter[] = chapters.map((c) => ({
      title: c.title,
      content: c.content,
      image: c.imageB64 ? Buffer.from(c.imageB64.split(",")[1], "base64") : null,
    }));

    const pdf = await buildBookPdf({
      title,
      subtitle,
      chapters: chs,
      metadata,
      sources,
      pageSize: pageSize || "A4",
    });

    return NextResponse.json({ pdfB64: `data:application/pdf;base64,${pdf.toString("base64")}` });
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
