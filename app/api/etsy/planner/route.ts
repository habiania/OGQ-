import { NextRequest, NextResponse } from "next/server";
import { buildPlannerPdf, PlannerPage } from "@/lib/planner";
import { generateListItems } from "@/lib/etsy";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  try {
    const { title, pages, theme, language } = (await req.json()) as {
      title: string;
      pages: PlannerPage[];
      theme?: string;
      language?: string;
    };
    if (!pages?.length) return NextResponse.json({ error: "페이지 종류를 1개 이상 선택하세요." }, { status: 400 });

    let checklistItems: string[] = [];
    let habits: string[] = [];
    if (theme?.trim()) {
      if (pages.includes("checklist")) checklistItems = await generateListItems(theme.trim(), 12, "checklist", language || "ko");
      if (pages.includes("habit")) habits = await generateListItems(theme.trim(), 8, "habit", language || "ko");
    }

    const pdf = await buildPlannerPdf({ title: title || "My Planner", pages, checklistItems, habits });
    return NextResponse.json({ pdfB64: `data:application/pdf;base64,${pdf.toString("base64")}` });
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
