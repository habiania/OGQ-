// OpenAI(gpt-image-1)는 결과 PNG에 C2PA 콘텐츠 자격증명(caBX) 같은 비표준 청크를
// IHDR 뒤에 삽입한다. @napi-rs/canvas 디코더가 이런 청크에서 막혀 "Invalid SVG image"로
// 실패하므로, 표준 청크만 남기고 정제한다.
const KEEP = new Set([
  "IHDR",
  "PLTE",
  "IDAT",
  "IEND",
  "tRNS",
  "gAMA",
  "cHRM",
  "sRGB",
  "iCCP",
  "bKGD",
  "pHYs",
]);

const PNG_MAGIC = 0x89504e47;

export function sanitizePng(buf: Buffer): Buffer {
  if (buf.length < 8 || buf.readUInt32BE(0) !== PNG_MAGIC) return buf; // PNG 아니면 그대로
  const parts: Buffer[] = [buf.subarray(0, 8)];
  let p = 8;
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    const end = p + 12 + len;
    if (end > buf.length) break; // 손상/잘림 방지
    if (KEEP.has(type)) parts.push(buf.subarray(p, end));
    p = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(parts);
}
