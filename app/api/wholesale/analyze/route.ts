import { NextRequest, NextResponse } from "next/server";
import { searchShop, shoppingTrend } from "@/lib/naver";
import { analyze } from "@/lib/wholesale";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { keyword } = (await req.json()) as { keyword: string };
    if (!keyword || !keyword.trim()) {
      return NextResponse.json({ error: "키워드를 입력하세요." }, { status: 400 });
    }
    const kw = keyword.trim();
    const [search, trend] = await Promise.all([searchShop(kw, 20), shoppingTrend(kw)]);
    return NextResponse.json({ analysis: analyze(kw, search, trend) });
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
