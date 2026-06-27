import PDFDocument from "pdfkit";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import path from "path";

export type PlannerPage = "daily" | "weekly" | "checklist" | "habit";

let FR = "sans-serif", FB = "sans-serif", fontReady = false;
function ensureFont() {
  if (fontReady) return; fontReady = true;
  try { if (GlobalFonts.registerFromPath(path.join(process.cwd(), "assets/fonts/NanumGothic.ttf"), "PlR")) FR = "PlR"; } catch {}
  try { if (GlobalFonts.registerFromPath(path.join(process.cwd(), "assets/fonts/NanumGothicBold.ttf"), "PlB")) FB = "PlB"; } catch {}
}

export interface PlannerInput {
  title: string;
  pages: PlannerPage[];
  checklistItems?: string[];
  habits?: string[];
  palette?: number;
}

// 부드러운 프리미엄 팔레트 (배경, 잉크, 액센트, 연한면)
const PALS: [string, string, string, string][] = [
  ["#fbf7f2", "#3b352e", "#c08552", "#efe3d6"], // warm sand
  ["#f4f7f4", "#2f3e2e", "#7e9b6b", "#e3ece0"], // sage
  ["#f6f3fb", "#332b45", "#8a7bb0", "#e8e2f3"], // lavender
  ["#fdf4f4", "#4a3535", "#d08a8a", "#f3e2e2"], // blush
];

const A4 = { w: 1240, h: 1754 }; // 150dpi

function pageCanvas(title: string, sub: string, pal: [string, string, string, string]) {
  ensureFont();
  const { w, h } = A4;
  const c = createCanvas(w, h); const ctx = c.getContext("2d");
  const [bg, ink, acc, soft] = pal;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // 헤더 밴드
  ctx.fillStyle = acc; ctx.fillRect(0, 0, w, 150);
  ctx.fillStyle = "#ffffff"; ctx.textBaseline = "middle";
  ctx.font = `bold 52px "${FB}"`; ctx.textAlign = "left";
  ctx.fillText(title, 70, 70);
  if (sub) { ctx.font = `400 26px "${FR}"`; ctx.fillStyle = "#ffffffcc"; ctx.fillText(sub, 70, 116); }
  return { c, ctx, w, h, ink, acc, soft };
}

function sectionTitle(ctx: any, t: string, x: number, y: number, ink: string, acc: string, FBn: string) {
  ctx.fillStyle = acc; ctx.fillRect(x, y, 8, 30);
  ctx.fillStyle = ink; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.font = `bold 30px "${FBn}"`; ctx.fillText(t, x + 22, y + 16);
}
function checkboxRow(ctx: any, x: number, y: number, w: number, label: string, ink: string, soft: string, FRn: string) {
  ctx.fillStyle = soft; roundRect(ctx, x, y, w, 52, 12); ctx.fill();
  ctx.strokeStyle = "#0000001a"; ctx.lineWidth = 2; roundRect(ctx, x + 16, y + 14, 24, 24, 6); ctx.stroke();
  if (label) { ctx.fillStyle = ink; ctx.font = `400 24px "${FRn}"`; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(label, x + 56, y + 27); }
}
function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function renderPage(kind: PlannerPage, title: string, pal: [string, string, string, string], items?: string[], habits?: string[]): Buffer {
  const titleMap = { daily: "DAILY PLANNER", weekly: "WEEKLY PLANNER", checklist: "CHECKLIST", habit: "HABIT TRACKER" };
  const { c, ctx, w, h, ink, acc, soft } = pageCanvas(title || titleMap[kind], kind === "daily" ? "Date:  ____ . ____ . ____" : "", pal);
  const M = 70; const CW = w - M * 2;
  let y = 210;

  if (kind === "daily") {
    sectionTitle(ctx, "TOP PRIORITIES", M, y, ink, acc, FB); y += 56;
    for (let i = 0; i < 3; i++) { checkboxRow(ctx, M, y, CW, "", ink, soft, FR); y += 64; }
    y += 20;
    sectionTitle(ctx, "TO-DO", M, y, ink, acc, FB); y += 56;
    for (let i = 0; i < 6; i++) { checkboxRow(ctx, M, y, CW, "", ink, soft, FR); y += 64; }
    y += 20;
    sectionTitle(ctx, "NOTES", M, y, ink, acc, FB); y += 50;
    ctx.fillStyle = soft; roundRect(ctx, M, y, CW, h - y - 80, 14); ctx.fill();
  } else if (kind === "checklist") {
    const list = items && items.length ? items : new Array(12).fill("");
    for (const it of list) { checkboxRow(ctx, M, y, CW, it, ink, soft, FR); y += 64; if (y > h - 90) break; }
  } else if (kind === "habit") {
    const hs = habits && habits.length ? habits : new Array(8).fill("");
    sectionTitle(ctx, "HABITS", M, y, ink, acc, FB); y += 60;
    const days = 31, labelW = 280, gridW = CW - labelW, colW = gridW / days;
    ctx.font = `400 12px "${FR}"`; ctx.fillStyle = ink + "99"; ctx.textAlign = "center";
    for (let d = 0; d < days; d++) ctx.fillText(String(d + 1), M + labelW + d * colW + colW / 2, y - 12);
    for (const hh of hs) {
      ctx.fillStyle = soft; roundRect(ctx, M, y, labelW - 12, 40, 8); ctx.fill();
      ctx.fillStyle = ink; ctx.font = `400 20px "${FR}"`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(hh || "", M + 14, y + 21);
      for (let d = 0; d < days; d++) { ctx.strokeStyle = "#0000001a"; ctx.lineWidth = 1; ctx.strokeRect(M + labelW + d * colW + 1, y + 4, colW - 2, 32); }
      y += 50;
    }
  } else { // weekly
    const dn = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    const cardH = (h - y - 80) / 7;
    for (const d of dn) {
      ctx.fillStyle = soft; roundRect(ctx, M, y, CW, cardH - 14, 12); ctx.fill();
      ctx.fillStyle = acc; ctx.font = `bold 24px "${FB}"`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(d, M + 20, y + cardH / 2 - 6);
      ctx.strokeStyle = "#00000012"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(M + 110, y + (cardH - 14) / 2); ctx.lineTo(M + CW - 24, y + (cardH - 14) / 2); ctx.stroke();
      y += cardH;
    }
  }
  return c.toBuffer("image/png");
}

export function buildPlannerPdf(input: PlannerInput): Promise<Buffer> {
  const pal = PALS[(input.palette ?? Math.floor(Math.random() * PALS.length)) % PALS.length];
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(chunks))));
  const PW = doc.page.width, PH = doc.page.height;

  input.pages.forEach((p, idx) => {
    if (idx > 0) doc.addPage();
    const png = renderPage(p, input.title, pal, input.checklistItems, input.habits);
    try { doc.image(png, 0, 0, { width: PW, height: PH }); } catch {}
  });

  doc.end();
  return done;
}
