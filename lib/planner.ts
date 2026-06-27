import PDFDocument from "pdfkit";
import path from "path";

export type PlannerPage = "daily" | "weekly" | "checklist" | "habit";

const FONT_REG = path.join(process.cwd(), "assets/fonts/NanumGothic.ttf");
const FONT_BOLD = path.join(process.cwd(), "assets/fonts/NanumGothicBold.ttf");

export interface PlannerInput {
  title: string;
  pages: PlannerPage[];
  checklistItems?: string[]; // AI 생성 체크리스트 항목(선택)
  habits?: string[]; // 습관 트래커 항목(선택)
}

export function buildPlannerPdf(input: PlannerInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margins: { top: 56, bottom: 56, left: 56, right: 56 }, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(chunks))));

  let REG = "Helvetica", BOLD = "Helvetica-Bold";
  try { doc.registerFont("KR", FONT_REG); REG = "KR"; } catch {}
  try { doc.registerFont("KRB", FONT_BOLD); BOLD = "KRB"; } catch {}
  const L = doc.page.margins.left;
  const W = doc.page.width - L - doc.page.margins.right;
  const accent = "#10b981";

  const header = (t: string) => {
    doc.font(BOLD).fontSize(26).fillColor("#111827").text(t, L, 56);
    doc.moveTo(L, 96).lineTo(L + W, 96).lineWidth(2).strokeColor(accent).stroke();
    doc.y = 116;
  };
  const lines = (n: number, gap = 30) => {
    let y = doc.y;
    for (let i = 0; i < n; i++) {
      doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.7).strokeColor("#d1d5db").stroke();
      y += gap;
    }
    doc.y = y;
  };
  const checkLines = (items: string[] | undefined, n: number) => {
    let y = doc.y;
    const list = items && items.length ? items : new Array(n).fill("");
    for (const it of list) {
      doc.lineWidth(1).strokeColor("#9ca3af").rect(L, y, 16, 16).stroke();
      if (it) doc.font(REG).fontSize(13).fillColor("#374151").text(it, L + 26, y + 1, { width: W - 26 });
      y += 34;
    }
    doc.y = y;
  };

  input.pages.forEach((p, idx) => {
    if (idx > 0) doc.addPage();
    if (p === "daily") {
      header(input.title || "Daily Planner");
      doc.font(REG).fontSize(13).fillColor("#6b7280").text("날짜:  ____ . ____ . ____", L, doc.y).moveDown(1);
      doc.font(BOLD).fontSize(15).fillColor(accent).text("오늘의 할 일", L, doc.y).moveDown(0.5);
      checkLines(undefined, 8);
      doc.moveDown(0.5);
      doc.font(BOLD).fontSize(15).fillColor(accent).text("메모", L, doc.y).moveDown(0.5);
      lines(6);
    } else if (p === "weekly") {
      header(input.title || "Weekly Planner");
      const days = ["월", "화", "수", "목", "금", "토", "일"];
      let y = doc.y;
      for (const d of days) {
        doc.font(BOLD).fontSize(14).fillColor("#111827").text(d, L, y + 6);
        doc.moveTo(L + 40, y + 24).lineTo(L + W, y + 24).lineWidth(0.7).strokeColor("#d1d5db").stroke();
        doc.moveTo(L + 40, y + 54).lineTo(L + W, y + 54).lineWidth(0.7).strokeColor("#d1d5db").stroke();
        y += 90;
      }
    } else if (p === "checklist") {
      header(input.title || "Checklist");
      checkLines(input.checklistItems, 14);
    } else if (p === "habit") {
      header(input.title || "Habit Tracker");
      const habits = input.habits && input.habits.length ? input.habits : new Array(8).fill("");
      const days = 31;
      const colW = (W - 160) / days;
      let y = doc.y + 10;
      // 헤더(날짜 1~31)
      doc.font(REG).fontSize(6).fillColor("#9ca3af");
      for (let d = 0; d < days; d++) doc.text(String(d + 1), L + 160 + d * colW, y, { width: colW, align: "center" });
      y += 16;
      for (const h of habits) {
        doc.font(REG).fontSize(11).fillColor("#374151").text(h || "____________", L, y, { width: 150 });
        for (let d = 0; d < days; d++) doc.rect(L + 160 + d * colW + 1, y - 2, colW - 2, 16).lineWidth(0.5).strokeColor("#d1d5db").stroke();
        y += 24;
      }
    }
  });

  doc.end();
  return done;
}
