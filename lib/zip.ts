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
