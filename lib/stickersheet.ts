import PDFDocument from "pdfkit";

// 이미지들을 A4 한 장에 격자로 배치 (인쇄용 스티커 시트)
export function buildStickerSheet(images: Buffer[], cols = 3): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margins: { top: 36, bottom: 36, left: 36, right: 36 } });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(chunks))));

  const L = doc.page.margins.left;
  const T = doc.page.margins.top;
  const W = doc.page.width - L * 2;
  const H = doc.page.height - T * 2;
  const gap = 14;
  const cellW = (W - gap * (cols - 1)) / cols;
  const rows = Math.floor((H + gap) / (cellW + gap)); // 정사각 셀 기준
  const perPage = cols * rows;

  images.forEach((img, i) => {
    const idx = i % perPage;
    if (i > 0 && idx === 0) doc.addPage();
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const x = L + c * (cellW + gap);
    const y = T + r * (cellW + gap);
    try { doc.image(img, x, y, { fit: [cellW, cellW], align: "center", valign: "center" }); } catch {}
  });

  doc.end();
  return done;
}
