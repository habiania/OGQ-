import { NextRequest, NextResponse } from "next/server";
import { animateSticker, Effect } from "@/lib/animate";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { imageB64, effect, size } = (await req.json()) as {
      imageB64: string;
      effect?: Effect;
      size?: number;
    };
    if (!imageB64) return NextResponse.json({ error: "이미지가 없습니다." }, { status: 400 });
    const buf = Buffer.from(imageB64.split(",")[1] || imageB64, "base64");
    const gif = await animateSticker(buf, effect || "bounce", size || 360);
    return NextResponse.json({ gifB64: `data:image/gif;base64,${gif.toString("base64")}` });
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
