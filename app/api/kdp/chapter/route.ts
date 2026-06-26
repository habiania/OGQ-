import { NextRequest, NextResponse } from "next/server";
import { research, writeChapter, chapterImage, BookMeta } from "@/lib/kdp";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { meta, chapterTitle, withImage, imageStyle } = (await req.json()) as {
      meta: BookMeta;
      chapterTitle: string;
      withImage?: boolean;
      imageStyle?: string;
    };
    if (!meta?.title || !chapterTitle) {
      return NextResponse.json({ error: "책 정보/챕터가 부족합니다." }, { status: 400 });
    }

    const r = await research(meta.title, chapterTitle);
    const content = await writeChapter(meta, chapterTitle, r);

    let imageB64: string | null = null;
    if (withImage) {
      const img = await chapterImage(chapterTitle, imageStyle || "flat minimal");
      if (img) imageB64 = `data:image/png;base64,${img.toString("base64")}`;
    }

    return NextResponse.json({
      content,
      sources: r.sources,
      researchEnabled: r.enabled,
      imageB64,
    });
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
