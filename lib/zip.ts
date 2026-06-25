import JSZip from "jszip";
import { ValidationReport } from "./validate";
import { StickerMeta } from "./meta";

export interface ZipInput {
  stickers: { name: string; data: Buffer }[]; // 01.png ~ 24.png
  main: Buffer; // 대표 240x240
  tab: Buffer; // 탭 96x74
  meta: StickerMeta;
  report: ValidationReport;
  style: string;
}

export async function buildZip(input: ZipInput): Promise<Buffer> {
  const zip = new JSZip();
  const folder = zip.folder("stickers")!;
  for (const s of input.stickers) {
    folder.file(s.name, s.data);
  }
  zip.file("main.png", input.main);
  zip.file("tab.png", input.tab);

  const manifest = {
    title: input.meta.title,
    keywords: input.meta.keywords,
    style: input.style,
    spec: "OGQ Sticker (740x640, 24ea)",
    score: input.report.score,
    submittable: input.report.submittable,
    generatedAt: new Date().toISOString(),
    stickers: input.stickers.map((s) => s.name),
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export interface KakaoZipInput {
  items: { data: Buffer }[]; // 번호순 정렬된 이모티콘들
  thumbnail: Buffer;
  preview: Buffer;
  meta: StickerMeta;
  report: ValidationReport;
  style: string;
}

// 카카오 규격 ZIP: 0001.png ~ NNNN.png + thumbnail.png + preview.png + manifest.json
export async function buildKakaoZip(input: KakaoZipInput): Promise<Buffer> {
  const zip = new JSZip();
  const names: string[] = [];
  input.items.forEach((it, i) => {
    const name = String(i + 1).padStart(4, "0") + ".png";
    names.push(name);
    zip.file(name, it.data);
  });
  zip.file("thumbnail.png", input.thumbnail);
  zip.file("preview.png", input.preview);

  const manifest = {
    title: input.meta.title,
    keywords: input.meta.keywords,
    style: input.style,
    spec: "KakaoTalk Emoticon (360x360)",
    count: input.items.length,
    score: input.report.score,
    submittable: input.report.submittable,
    generatedAt: new Date().toISOString(),
    items: names,
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
