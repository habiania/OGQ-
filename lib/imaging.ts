import { createCanvas, loadImage, GlobalFonts, type Image } from "@napi-rs/canvas";
import path from "path";
import { OGQ_SPEC } from "./constants";

// 한글 렌더링용 폰트 등록.
// 1순위: 프로젝트에 번들한 나눔고딕(리눅스/Render 등 어디서나 동작)
// 2순위: 로컬 윈도우 맑은 고딕
// 실패 시 sans-serif (배포 환경에선 한글 깨질 수 있으므로 번들 폰트가 핵심)
let FONT_FAMILY = "sans-serif";
let fontReady = false;
function ensureFont() {
  if (fontReady) return;
  fontReady = true;
  const candidates: string[] = [
    path.join(process.cwd(), "assets/fonts/NanumGothicBold.ttf"), // 번들 폰트(배포용)
    "C:/Windows/Fonts/malgunbd.ttf", // 로컬 윈도우
    "C:/Windows/Fonts/malgun.ttf",
  ];
  for (const p of candidates) {
    try {
      if (GlobalFonts.registerFromPath(p, "OGQFont")) {
        FONT_FAMILY = "OGQFont";
        return;
      }
    } catch {
      /* 다음 후보 시도 */
    }
  }
}

async function load(buf: Buffer): Promise<Image> {
  return loadImage(buf);
}

/** 근사 흰색 픽셀을 투명으로 (네이티브 투명배경이 없는 제공자용 후처리) */
function knockoutWhite(data: Uint8ClampedArray, threshold = 244) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] >= threshold && data[i + 1] >= threshold && data[i + 2] >= threshold) {
      data[i + 3] = 0;
    }
  }
}

interface ComposeOpts {
  caption?: string;
  removeWhite?: boolean;
  width?: number; // 기본 OGQ 740
  height?: number; // 기본 OGQ 640
}

/** 캐릭터 아트 → 지정 규격(기본 OGQ 740x640, 투명, 하단 대사) PNG */
export async function composeSticker(art: Buffer, opts: ComposeOpts = {}): Promise<Buffer> {
  ensureFont();
  const W = opts.width ?? OGQ_SPEC.sticker.width;
  const H = opts.height ?? OGQ_SPEC.sticker.height;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // 흰배경 제거(옵션)는 원본 아트를 별도 캔버스에서 처리 후 사용
  let img: Image;
  if (opts.removeWhite) {
    const src = await load(art);
    const tmp = createCanvas(src.width, src.height);
    const tctx = tmp.getContext("2d");
    tctx.drawImage(src, 0, 0);
    const id = tctx.getImageData(0, 0, src.width, src.height);
    knockoutWhite(id.data);
    tctx.putImageData(id, 0, 0);
    img = (await load(tmp.toBuffer("image/png"))) as Image;
  } else {
    img = await load(art);
  }

  // 아트 배치 영역: 대사가 있으면 하단 여백 확보 (크기에 비례)
  const margin = Math.round(W * 0.033);
  const captionH = opts.caption ? Math.round(H * 0.21) : 0;
  const areaW = W - margin * 2;
  const areaH = H - margin * 2 - captionH;
  const scale = Math.min(areaW / img.width, areaH / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = (W - dw) / 2;
  const dy = margin + (areaH - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);

  if (opts.caption) {
    // 캡션은 캔버스 가로 중앙(W/2), 하단 밴드 중앙에 배치
    drawCaption(ctx, opts.caption, W / 2, H - captionH / 2, W - margin * 2, captionH);
  }

  return canvas.toBuffer("image/png");
}

function drawCaption(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  text: string,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number
) {
  // 폰트 크기를 글자 수 기준으로 잡되, 실제 폭을 측정해 넘치면 줄여서 잘림 방지
  let size = text.length <= 2 ? 96 : text.length <= 3 ? 84 : text.length <= 4 ? 70 : 58;
  // 외곽선까지 포함한 폭이 maxW 안에 들어올 때까지 축소
  for (; size > 24; size -= 2) {
    ctx.font = `bold ${size}px "${FONT_FAMILY}"`;
    const w = ctx.measureText(text).width + size * 0.28; // 외곽선 두께 여유
    if (w <= maxW && size * 1.2 <= maxH) break;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  // 흰색 외곽선(두껍게) → 어떤 배경에서도 가독성
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.round(size * 0.28);
  ctx.strokeText(text, cx, cy);
  ctx.fillStyle = "#2b2b2b";
  ctx.fillText(text, cx, cy);
}

/** 정사각 대표 이미지 (240x240) — 캐릭터 중앙 배치 */
export async function makeMain(art: Buffer, removeWhite = false): Promise<Buffer> {
  return fitInto(art, OGQ_SPEC.main.width, OGQ_SPEC.main.height, removeWhite, 12);
}

/** 탭 이미지 (96x74) */
export async function makeTab(art: Buffer, removeWhite = false): Promise<Buffer> {
  return fitInto(art, OGQ_SPEC.tab.width, OGQ_SPEC.tab.height, removeWhite, 6);
}

/** 임의 정사각/직사각 썸네일 (카카오 360x360 등) */
export async function makeThumbnail(art: Buffer, w: number, h: number, removeWhite = false): Promise<Buffer> {
  return fitInto(art, w, h, removeWhite, Math.round(w * 0.06));
}

async function fitInto(art: Buffer, W: number, H: number, removeWhite: boolean, margin: number): Promise<Buffer> {
  let img = await load(art);
  if (removeWhite) {
    const tmp = createCanvas(img.width, img.height);
    const tctx = tmp.getContext("2d");
    tctx.drawImage(img, 0, 0);
    const id = tctx.getImageData(0, 0, img.width, img.height);
    knockoutWhite(id.data);
    tctx.putImageData(id, 0, 0);
    img = (await load(tmp.toBuffer("image/png"))) as Image;
  }
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const areaW = W - margin * 2;
  const areaH = H - margin * 2;
  const scale = Math.min(areaW / img.width, areaH / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  return canvas.toBuffer("image/png");
}

/** PNG 메타: 폭/높이/투명여부/바이트수 (검수용) */
export async function inspectPng(buf: Buffer) {
  const img = await load(buf);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  let hasTransparent = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) {
      hasTransparent = true;
      break;
    }
  }
  return { width: img.width, height: img.height, hasTransparent, bytes: buf.length };
}

// ===== 위탁판매 썸네일/상세 합성 (도매매 사진 + AI 카피, 무료) =====

// 텍스트를 maxWidth에 맞춰 줄바꿈 (최대 maxLines줄, 넘치면 …)
function wrapText(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines) lines.push(line);
  // 남은 텍스트가 있으면 마지막 줄에 … 처리
  const used = lines.join("").length;
  if (used < text.length && lines.length) {
    let last = lines[lines.length - 1];
    while (ctx.measureText(last + "…").width > maxWidth && last) last = last.slice(0, -1);
    lines[lines.length - 1] = last + "…";
  }
  return lines;
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 1000x1000 상품 썸네일: 상품사진 + 상품명 + 가격 배지 */
export async function composeProductThumbnail(
  productImg: Buffer,
  title: string,
  priceText: string
): Promise<Buffer> {
  ensureFont();
  const S = 1000;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext("2d");

  // 배경: 연한 그라데이션
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#eef1f5");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // 상품 사진 (상단 영역에 흰 카드 + 이미지 fit)
  const img = await load(productImg);
  const pad = 90;
  const areaY = 70;
  const areaH = 600;
  const areaW = S - pad * 2;
  const scale = Math.min(areaW / img.width, areaH / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (S - dw) / 2, areaY + (areaH - dh) / 2, dw, dh);

  // 상품명 (하단 2줄)
  ctx.fillStyle = "#1f2937";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `bold 52px "${FONT_FAMILY}"`;
  const lines = wrapText(ctx, title, S - 120, 2);
  let ty = 770;
  for (const ln of lines) {
    ctx.fillText(ln, S / 2, ty);
    ty += 62;
  }

  // 가격 배지 (하단 빨간 라운드)
  ctx.font = `bold 56px "${FONT_FAMILY}"`;
  const pw = ctx.measureText(priceText).width + 80;
  const bx = (S - pw) / 2;
  const by = 880;
  ctx.fillStyle = "#ef4444";
  roundRect(ctx, bx, by, pw, 84, 42);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(priceText, S / 2, by + 44);

  return canvas.toBuffer("image/png");
}

// 여러 줄 줄바꿈(제한 없음)
function wrapAll(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  text: string,
  maxWidth: number
): string[] {
  const out: string[] = [];
  let line = "";
  for (const ch of text) {
    if (ch === "\n") { out.push(line); line = ""; continue; }
    const t = line + ch;
    if (ctx.measureText(t).width > maxWidth && line) { out.push(line); line = ch; }
    else line = t;
  }
  if (line) out.push(line);
  return out;
}

export interface DetailData {
  productName: string;
  price: number;
  listPrice: number;
  points: string[];
  detail: string;
  faq: { q: string; a: string }[];
}

/** 스마트스토어용 상세페이지 (세로 긴 이미지): 상품명·가격·대표사진·구매포인트·상세·FAQ */
export async function composeDetailPage(productImg: Buffer, data: DetailData): Promise<Buffer> {
  ensureFont();
  const W = 860, M = 48, CW = W - M * 2;
  const tmp = createCanvas(W, 7000);
  const ctx = tmp.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, 7000);
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  let y = 50;

  const heading = (t: string) => {
    y += 40;
    ctx.fillStyle = "#10b981"; ctx.fillRect(M, y + 4, 6, 32);
    ctx.fillStyle = "#111827"; ctx.font = `bold 36px "${FONT_FAMILY}"`;
    ctx.fillText(t, M + 20, y);
    y += 58;
  };
  const para = (t: string, size = 28, color = "#374151", lh = 44) => {
    ctx.fillStyle = color; ctx.font = `400 ${size}px "${FONT_FAMILY}"`;
    for (const ln of wrapAll(ctx, t, CW)) { ctx.fillText(ln, M, y); y += lh; }
  };

  // 1. 상품명
  ctx.fillStyle = "#111827"; ctx.font = `bold 44px "${FONT_FAMILY}"`;
  for (const ln of wrapAll(ctx, data.productName, CW)) { ctx.fillText(ln, M, y); y += 56; }
  // 가격
  y += 14;
  if (data.listPrice) {
    ctx.fillStyle = "#9ca3af"; ctx.font = `400 30px "${FONT_FAMILY}"`;
    const lp = `${data.listPrice.toLocaleString()}원`;
    ctx.fillText(lp, M, y);
    ctx.fillRect(M, y + 18, ctx.measureText(lp).width, 2);
    y += 42;
  }
  ctx.fillStyle = "#ef4444"; ctx.font = `bold 54px "${FONT_FAMILY}"`;
  ctx.fillText(`${data.price.toLocaleString()}원`, M, y);
  y += 80;

  // 2. 대표 이미지
  const img = await load(productImg);
  const ih = Math.min(img.height * (CW / img.width), 720);
  ctx.drawImage(img, M, y, CW, ih);
  y += ih + 30;

  // 3. 구매포인트
  if (data.points?.length) {
    heading("이런 점이 좋아요 ✔");
    for (const p of data.points) {
      ctx.fillStyle = "#10b981"; ctx.font = `bold 28px "${FONT_FAMILY}"`;
      ctx.fillText("•", M, y);
      ctx.fillStyle = "#374151"; ctx.font = `400 28px "${FONT_FAMILY}"`;
      for (const ln of wrapAll(ctx, p, CW - 30)) { ctx.fillText(ln, M + 28, y); y += 42; }
      y += 10;
    }
  }

  // 4. 상세설명
  if (data.detail) { heading("상품 상세"); para(data.detail); }

  // 5. FAQ
  if (data.faq?.length) {
    heading("자주 묻는 질문");
    for (const f of data.faq) {
      ctx.fillStyle = "#111827"; ctx.font = `bold 28px "${FONT_FAMILY}"`;
      for (const ln of wrapAll(ctx, "Q. " + f.q, CW)) { ctx.fillText(ln, M, y); y += 40; }
      ctx.fillStyle = "#6b7280"; ctx.font = `400 26px "${FONT_FAMILY}"`;
      for (const ln of wrapAll(ctx, "A. " + f.a, CW)) { ctx.fillText(ln, M, y); y += 38; }
      y += 16;
    }
  }

  // 6. 안내 푸터
  y += 24;
  ctx.fillStyle = "#f3f4f6"; ctx.fillRect(0, y, W, 168);
  ctx.fillStyle = "#6b7280"; ctx.font = `400 24px "${FONT_FAMILY}"`;
  ctx.fillText("• 평일 오후 2시 이전 주문 시 당일 출고됩니다.", M, y + 32);
  ctx.fillText("• 교환/반품은 상품 수령 후 7일 이내 가능합니다.", M, y + 70);
  ctx.fillText("• 상품 문의는 톡톡 또는 Q&A로 남겨주세요.", M, y + 108);
  y += 192;

  const H = Math.ceil(y);
  const out = createCanvas(W, H);
  out.getContext("2d").drawImage(tmp, 0, 0);
  return out.toBuffer("image/png");
}
