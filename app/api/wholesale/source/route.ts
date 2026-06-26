import { NextRequest, NextResponse } from "next/server";
import { searchSupply } from "@/lib/domeggook";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { keyword } = (await req.json()) as { keyword: string };
    if (!keyword?.trim()) {
      return NextResponse.json({ error: "키워드를 입력하세요." }, { status: 400 });
    }
    const result = await searchSupply(keyword.trim(), 12);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
