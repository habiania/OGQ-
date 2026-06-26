import PDFDocument from "pdfkit";
import path from "path";
import { KdpMetadata } from "./kdp";

export type PageSize = "A4" | "LETTER" | "6x9" | "7x10";

const SIZES: Record<PageSize, [number, number]> = {
  A4: [595.28, 841.89],
  LETTER: [612, 792],
  "6x9": [432, 648],
  "7x10": [504, 720],
};

const FONT_REG = path.join(process.cwd(), "assets/fonts/NanumGothic.ttf");
const FONT_BOLD = path.join(process.cwd(), "assets/fonts/NanumGothicBold.ttf");

export interface Chapter {
  title: string;
  content: string;
  image?: Buffer | null;
}

export interface BuildInput {
  title: string;
  subtitle: string;
  chapters: Chapter[];
  metadata?: KdpMetadata;
  sources?: string[];
  pageSize: PageSize;
}

export function buildBookPdf(input: BuildInput): Promise<Buffer> {
  const size = SIZES[input.pageSize] || SIZES.A4;
  const doc = new PDFDocument({ size, margins: { top: 64, bottom: 64, left: 56, right: 56 }, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // 한글 폰트 등록 (없으면 기본 폰트)
  let REG = "Helvetica", BOLD = "Helvetica-Bold";
  try { doc.registerFont("KR", FONT_REG); REG = "KR"; } catch {}
  try { doc.registerFont("KRB", FONT_BOLD); BOLD = "KRB"; } catch {}
  const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // ===== 표지 =====
  doc.font(BOLD).fontSize(34).fillColor("#111827");
  doc.y = doc.page.height * 0.32;
  doc.text(input.title, { align: "center", width: W });
  doc.moveDown(0.6);
  doc.font(REG).fontSize(18).fillColor("#4b5563").text(input.subtitle, { align: "center", width: W });

  // ===== 목차 =====
  doc.addPage();
  doc.font(BOLD).fontSize(24).fillColor("#111827").text("목차", { width: W });
  doc.moveDown(0.8);
  doc.font(REG).fontSize(13).fillColor("#374151");
  input.chapters.forEach((c, i) => {
    doc.text(`${i + 1}. ${c.title}`, { width: W });
    doc.moveDown(0.4);
  });

  // ===== 챕터 =====
  input.chapters.forEach((c, i) => {
    doc.addPage();
    doc.font(BOLD).fontSize(22).fillColor("#111827").text(`${i + 1}. ${c.title}`, { width: W });
    doc.moveDown(0.6);

    if (c.image) {
      try { doc.image(c.image, { fit: [W, W * 0.6], align: "center" }); doc.moveDown(0.6); } catch {}
    }

    renderMarkdown(doc, c.content, W, REG, BOLD);
  });

  // ===== 참고문헌 =====
  if (input.sources && input.sources.length) {
    doc.addPage();
    doc.font(BOLD).fontSize(22).fillColor("#111827").text("참고자료", { width: W });
    doc.moveDown(0.6);
    doc.font(REG).fontSize(11).fillColor("#2563eb");
    input.sources.forEach((s, i) => { doc.text(`[${i + 1}] ${s}`, { width: W, link: s, underline: true }); doc.moveDown(0.3); });
  }

  // ===== 페이지 번호 (표지 제외) =====
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count; i++) {
    doc.switchToPage(i);
    doc.font(REG).fontSize(9).fillColor("#9ca3af");
    doc.text(`${i}`, 0, doc.page.height - 40, { align: "center", width: doc.page.width });
  }

  doc.end();
  return done;
}

// 간단 마크다운 렌더 (## 소제목, TIP:, 주의:, 체크:, 표:, 일반 문단)
function renderMarkdown(doc: PDFKit.PDFDocument, md: string, W: number, REG: string, BOLD: string) {
  const lines = md.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { doc.moveDown(0.4); continue; }
    if (line.startsWith("## ")) {
      doc.moveDown(0.4).font(BOLD).fontSize(15).fillColor("#111827").text(line.slice(3), { width: W }).moveDown(0.2);
    } else if (line.startsWith("# ")) {
      doc.moveDown(0.4).font(BOLD).fontSize(17).fillColor("#111827").text(line.slice(2), { width: W }).moveDown(0.2);
    } else if (/^(TIP[:：])/i.test(line)) {
      box(doc, line.replace(/^TIP[:：]\s*/i, "💡 TIP: "), W, "#ecfdf5", "#065f46", REG);
    } else if (/^(주의[:：])/.test(line)) {
      box(doc, line.replace(/^주의[:：]\s*/, "⚠️ 주의: "), W, "#fef2f2", "#991b1b", REG);
    } else if (/^(체크[:：]|[-*]\s)/.test(line)) {
      doc.font(REG).fontSize(12).fillColor("#374151").text("☐ " + line.replace(/^(체크[:：]|[-*])\s*/, ""), { width: W, indent: 8 }).moveDown(0.1);
    } else if (line.startsWith("표:") || line.includes(" | ")) {
      doc.font(REG).fontSize(11).fillColor("#374151").text(line.replace(/^표:\s*/, ""), { width: W }).moveDown(0.1);
    } else {
      doc.font(REG).fontSize(12).fillColor("#374151").text(line.replace(/^#+\s*/, ""), { width: W, align: "left", lineGap: 3 }).moveDown(0.25);
    }
  }
}

function box(doc: PDFKit.PDFDocument, text: string, W: number, bg: string, fg: string, REG: string) {
  doc.moveDown(0.3);
  const x = doc.x, y = doc.y;
  doc.font(REG).fontSize(11.5).fillColor(fg);
  const h = doc.heightOfString(text, { width: W - 24 }) + 16;
  doc.save().roundedRect(x, y, W, h, 6).fill(bg).restore();
  doc.fillColor(fg).text(text, x + 12, y + 8, { width: W - 24 });
  doc.y = y + h;
  doc.moveDown(0.4);
}
