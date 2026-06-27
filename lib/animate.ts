import { createCanvas, loadImage } from "@napi-rs/canvas";
import { GIFEncoder, quantize, applyPalette } from "gifenc";

export type Effect = "bounce" | "pulse" | "shake" | "wiggle";

// 정적 스티커(투명 PNG) → 움직이는 GIF (모션 효과)
export async function animateSticker(
  png: Buffer,
  effect: Effect = "bounce",
  size = 360,
  frames = 14
): Promise<Buffer> {
  const img = await loadImage(png);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  const margin = size * 0.14; // 움직임이 잘리지 않게 여백
  const area = size - margin * 2;
  const scale = Math.min(area / img.width, area / img.height);
  const w0 = img.width * scale;
  const h0 = img.height * scale;

  const gif = GIFEncoder();
  for (let f = 0; f < frames; f++) {
    const ph = Math.sin((f / frames) * Math.PI * 2);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    let dx = (size - w0) / 2;
    let dy = (size - h0) / 2;
    let sc = 1;
    let rot = 0;
    if (effect === "bounce") dy -= ph * size * 0.07;
    else if (effect === "pulse") sc = 1 + ph * 0.09;
    else if (effect === "shake") dx += ph * size * 0.06;
    else if (effect === "wiggle") rot = ph * 0.14;
    ctx.translate(size / 2, size / 2);
    ctx.rotate(rot);
    ctx.scale(sc, sc);
    ctx.translate(-size / 2, -size / 2);
    ctx.drawImage(img, dx, dy, w0, h0);
    ctx.restore();

    const { data } = ctx.getImageData(0, 0, size, size);
    const palette = quantize(data, 256, { format: "rgba4444" });
    const index = applyPalette(data, palette, "rgba4444");
    gif.writeFrame(index, size, size, { palette, transparent: true, delay: 80, dispose: 2 });
  }
  gif.finish();
  return Buffer.from(gif.bytes());
}
