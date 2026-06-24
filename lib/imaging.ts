import { createCanvas, loadImage, GlobalFonts, type Image } from "@napi-rs/canvas";
import { OGQ_SPEC } from "./constants";

// 한글 렌더링용 폰트 등록 (Windows 기본 맑은 고딕). 실패해도 기본 폰트로 진행.
let FONT_FAMILY = "sans-serif";
let fontReady = false;
function ensureFont() {
  if (fontReady) return;
  fontReady = true;
  const candidates = [
    ["C:/Windows/Fonts/malgunbd.ttf", "OGQFont"], // 맑은 고딕 Bold
    ["C:/Windows/Fonts/malgun.ttf", "OGQFont"],
  ];
  for (const [path, name] of candidates) {
    try {
      if (GlobalFonts.registerFromPath(path, name)) {
        FONT_FAMILY = name;
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
}

/** 캐릭터 아트 → OGQ 스티커 규격(740x640, 투명, 하단 대사) PNG */
export async function composeSticker(art: Buffer, opts: ComposeOpts = {}): Promise<Buffer> {
  ensureFont();
  const { width: W, height: H } = OGQ_SPEC.sticker;
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

  // 아트 배치 영역: 대사가 있으면 하단 여백 확보
  const margin = 24;
  const captionH = opts.caption ? 132 : 0;
  const areaW = W - margin * 2;
  const areaH = H - margin * 2 - captionH;
  const scale = Math.min(areaW / img.width, areaH / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = (W - dw) / 2;
  const dy = margin + (areaH - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);

  if (opts.caption) {
    drawCaption(ctx, opts.caption, W, H - captionH / 2 - 8);
  }

  return canvas.toBuffer("image/png");
}

function drawCaption(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  text: string,
  cx: number,
  cy: number
) {
  // 길이에 따라 폰트 크기 자동 조정
  let size = 92;
  if (text.length >= 4) size = 72;
  if (text.length >= 6) size = 56;
  ctx.font = `bold ${size}px "${FONT_FAMILY}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
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
