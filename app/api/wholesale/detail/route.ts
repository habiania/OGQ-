import { NextRequest, NextResponse } from "next/server";
import { generateListing } from "@/lib/listing";
import { composeDetailPage } from "@/lib/imaging";
import { sanitizePng } from "@/lib/png";
import { Analysis } from "@/lib/wholesale";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  try {
    const { analysis, supply, product, imageUrl, price } = (await req.json()) as {
      analysis: Analysis;
      supply?: { minSupply: number; avgSupply: number };
      product?: { title: string; supplyPrice: number; deliveryFee: number };
      imageUrl: string;
      price: number;
    };
    if (!analysis?.keyword || !imageUrl) {
      return NextResponse.json({ error: "상품 정보가 부족합니다." }, { status: 400 });
    }

    // AI 카피 생성(무료 Gemini) → 상세페이지 합성
    const listing = await generateListing(analysis, supply, product);
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return NextResponse.json({ error: "상품 이미지를 불러오지 못했습니다." }, { status: 400 });
    const imgBuf = sanitizePng(Buffer.from(await imgRes.arrayBuffer()));

    const png = await composeDetailPage(imgBuf, {
      productName: listing.productName,
      price: listing.recommendedPrice || price || 0,
      listPrice: listing.listPrice || 0,
      points: listing.points,
      detail: listing.detail,
      faq: listing.faq,
    });
    return NextResponse.json({ detailB64: `data:image/png;base64,${png.toString("base64")}` });
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
