import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import path from "path";

let FONT = "sans-serif", FONT_B = "sans-serif", ready = false;
function ensureFont() {
  if (ready) return;
  ready = true;
  try { if (GlobalFonts.registerFromPath(path.join(process.cwd(), "assets/fonts/NanumGothic.ttf"), "WaR")) FONT = "WaR"; } catch {}
  try { if (GlobalFonts.registerFromPath(path.join(process.cwd(), "assets/fonts/NanumGothicBold.ttf"), "WaB")) FONT_B = "WaB"; } catch {}
}

export type WallStyle = "boho" | "colorblock" | "lineart" | "typographic";

export interface Palette { bg: string; ink: string; a: string; b: string }

// 상업성 검증된 인기 팔레트 (보호/중성/미드센추리)
export const PALETTES: Palette[] = [
  { bg: "#efe6db", ink: "#3a2e25", a: "#c08552", b: "#8a9a5b" }, // earthy boho
  { bg: "#e9ece4", ink: "#2f3e2e", a: "#8a9a5b", b: "#c9b79c" }, // sage
  { bg: "#f4e7de", ink: "#5c3a2e", a: "#c1654f", b: "#e0a48a" }, // terracotta
  { bg: "#0f1f33", ink: "#f4f1e8", a: "#c9a227", b: "#5b86b0" }, // navy & gold
  { bg: "#f7ecec", ink: "#5a3d3d", a: "#d98b8b", b: "#caa6a6" }, // blush
  { bg: "#f0e9df", ink: "#262626", a: "#d8552b", b: "#3a7563" }, // mid-century
];

// 인쇄 사이즈 (메모리 안전 범위, 비율 정확)
export const PRINT_SIZES: { name: string; w: number; h: number }[] = [
  { name: "A4", w: 1654, h: 2339 },
  { name: "A3", w: 1754, h: 2480 },
  { name: "US_Letter", w: 1700, h: 2200 },
  { name: "ratio_2x3", w: 1600, h: 2400 },
  { name: "ratio_3x4", w: 1800, h: 2400 },
  { name: "ratio_4x5", w: 1920, h: 2400 },
  { name: "11x14", w: 1571, h: 2000 },
];

function wrap(ctx: any, text: string, maxW: number): string[] {
  const out: string[] = []; let line = "";
  for (const ch of text) { const t = line + ch; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = ch; } else line = t; }
  if (line) out.push(line);
  return out;
}

// 프리미엄 월아트 1장 렌더 (스타일별 구성 + 타이포)
export function renderWallArt(style: WallStyle, W: number, H: number, title: string, subtitle: string, pal: Palette): Buffer {
  ensureFont();
  const c = createCanvas(W, H); const ctx = c.getContext("2d");
  const U = Math.min(W, H);
  ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H);
  // 내부 매트 여백 프레임
  const pad = U * 0.08;
  ctx.strokeStyle = pal.ink + "22"; ctx.lineWidth = Math.max(2, U * 0.004);
  ctx.strokeRect(pad * 0.55, pad * 0.55, W - pad * 1.1, H - pad * 1.1);

  ctx.save();
  if (style === "boho") {
    // 아치 + 원 + 유기적 블롭
    const cx = W / 2, archW = W * 0.5, archTop = H * 0.22, archBot = H * 0.6;
    ctx.fillStyle = pal.a;
    ctx.beginPath();
    ctx.moveTo(cx - archW / 2, archBot);
    ctx.lineTo(cx - archW / 2, archTop + archW / 2);
    ctx.arc(cx, archTop + archW / 2, archW / 2, Math.PI, 0);
    ctx.lineTo(cx + archW / 2, archBot);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.b; ctx.beginPath(); ctx.arc(cx, H * 0.42, archW * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.bg; ctx.beginPath(); ctx.arc(cx, H * 0.36, archW * 0.16, 0, Math.PI * 2); ctx.fill();
    // 점선 호
    ctx.strokeStyle = pal.ink; ctx.lineWidth = U * 0.006; ctx.setLineDash([U * 0.02, U * 0.025]);
    ctx.beginPath(); ctx.arc(cx, H * 0.5, archW * 0.62, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.setLineDash([]);
  } else if (style === "colorblock") {
    // 미드센추리 기하 블록
    ctx.fillStyle = pal.a; ctx.fillRect(W * 0.12, H * 0.14, W * 0.4, H * 0.4);
    ctx.fillStyle = pal.b; ctx.beginPath(); ctx.arc(W * 0.68, H * 0.3, W * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.ink; ctx.fillRect(W * 0.55, H * 0.5, W * 0.32, H * 0.12);
    ctx.strokeStyle = pal.ink; ctx.lineWidth = U * 0.01;
    ctx.beginPath(); ctx.moveTo(W * 0.12, H * 0.62); ctx.lineTo(W * 0.5, H * 0.62); ctx.stroke();
  } else if (style === "lineart") {
    // 미니멀 추상 단선
    ctx.strokeStyle = pal.ink; ctx.lineWidth = U * 0.012; ctx.lineCap = "round";
    const cx = W / 2, cy = H * 0.4, r = U * 0.22;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + r);
    ctx.bezierCurveTo(cx - r * 1.4, cy - r, cx - r * 0.2, cy - r * 1.6, cx + r * 0.2, cy - r * 0.6);
    ctx.bezierCurveTo(cx + r * 0.6, cy, cx + r * 1.3, cy - r * 0.3, cx + r, cy + r);
    ctx.stroke();
    ctx.fillStyle = pal.a; ctx.beginPath(); ctx.arc(cx + r * 1.1, cy - r * 1.1, U * 0.04, 0, Math.PI * 2); ctx.fill();
  } else {
    // typographic — 큰 포인트 도형 + 라인
    ctx.fillStyle = pal.a; ctx.beginPath(); ctx.arc(W / 2, H * 0.3, U * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = pal.b; ctx.lineWidth = U * 0.008;
    ctx.beginPath(); ctx.moveTo(W * 0.2, H * 0.52); ctx.lineTo(W * 0.8, H * 0.52); ctx.stroke();
  }
  ctx.restore();

  // 타이포 (하단)
  ctx.textAlign = "center"; ctx.fillStyle = pal.ink;
  const tSize = U * (style === "typographic" ? 0.11 : 0.075);
  ctx.font = `bold ${tSize}px "${FONT_B}"`;
  ctx.textBaseline = "alphabetic";
  const ty = style === "typographic" ? H * 0.6 : H * 0.74;
  const lines = wrap(ctx, (title || "").toUpperCase(), W - pad * 3);
  let yy = ty;
  for (const ln of lines) { ctx.fillText(ln, W / 2, yy); yy += tSize * 1.15; }
  if (subtitle) {
    ctx.font = `400 ${U * 0.032}px "${FONT}"`;
    ctx.fillStyle = pal.ink + "cc";
    ctx.fillText(subtitle, W / 2, yy + U * 0.03);
  }
  return c.toBuffer("image/png");
}

// 액자 목업 (벽 배경 + 프레임 + 작품)
export function renderMockup(art: Buffer, pal: Palette): Promise<Buffer> {
  return (async () => {
    const { loadImage } = await import("@napi-rs/canvas");
    const S = 1200;
    const c = createCanvas(S, S); const ctx = c.getContext("2d");
    // 벽
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, "#eceae5"); g.addColorStop(1, "#ddd9d2");
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    // 바닥/그림자 느낌
    ctx.fillStyle = "#00000010"; ctx.fillRect(0, S * 0.82, S, S * 0.18);
    const img = await loadImage(art);
    const fw = S * 0.5, fh = fw * (img.height / img.width);
    const fx = (S - fw) / 2, fy = S * 0.16;
    // 프레임
    const fr = S * 0.022;
    ctx.save();
    ctx.shadowColor = "#00000033"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 16;
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(fx - fr, fy - fr, fw + fr * 2, fh + fr * 2);
    ctx.restore();
    // 매트
    ctx.fillStyle = "#ffffff"; ctx.fillRect(fx, fy, fw, fh);
    const m = fw * 0.06;
    ctx.drawImage(img, fx + m, fy + m, fw - m * 2, fh - m * 2);
    return c.toBuffer("image/png");
  })();
}
