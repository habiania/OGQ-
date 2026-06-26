import { NextRequest, NextResponse } from "next/server";
import { composeProductThumbnail } from "@/lib/imaging";
import { sanitizePng } from "@/lib/png";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, title, price } = (await req.json()) as {
      imageUrl: string;
      title: string;
      price: number;
    };
    if (!imageUrl || !title) {
      return NextResponse.json({ error: "상품 정보가 부족합니다." }, { status: 400 });
    }
    const res = await fetch(imageUrl);
    if (!res.ok) return NextResponse.json({ error: "상품 이미지를 불러오지 못했습니다." }, { status: 400 });
    const imgBuf = sanitizePng(Buffer.from(await res.arrayBuffer()));

    const priceText = `${(price || 0).toLocaleString()}원`;
    const png = await composeProductThumbnail(imgBuf, title, priceText);
    return NextResponse.json({ thumbnailB64: `data:image/png;base64,${png.toString("base64")}` });
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
