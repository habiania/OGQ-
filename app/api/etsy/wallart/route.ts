import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { generateListingKit } from "@/lib/etsy";
import { renderWallArt, renderMockup, PRINT_SIZES, PALETTES, WallStyle } from "@/lib/wallart";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { theme, category, style, language } = (await req.json()) as {
      theme: string;
      category?: string;
      style?: WallStyle | "auto";
      language?: string;
    };
    if (!theme?.trim()) return NextResponse.json({ error: "주제를 입력하세요." }, { status: 400 });

    const cat = category || "Printable Wall Art";
    const kit = await generateListingKit(cat, theme.trim(), language || "en");
    const useStyle: WallStyle = !style || style === "auto" ? kit.recommendedStyle : style;
    const pal = PALETTES[Math.floor(Math.random() * PALETTES.length)];

    const zip = new JSZip();
    let mockupSrc: Buffer | null = null;
    for (const s of PRINT_SIZES) {
      const buf = renderWallArt(useStyle, s.w, s.h, kit.artTitle, kit.artSubtitle, pal);
      zip.file(`${s.name}.png`, buf);
      if (s.name === "ratio_4x5") mockupSrc = buf;
    }
    if (!mockupSrc) mockupSrc = renderWallArt(useStyle, 1600, 2000, kit.artTitle, kit.artSubtitle, pal);
    const mockup = await renderMockup(mockupSrc, pal);
    zip.file("mockup-preview.png", mockup);

    const listingTxt = [
      `[PRODUCT TITLE]\n${kit.productTitle}`,
      `[SEO TITLE]\n${kit.seoTitle}`,
      `[CATEGORY]\n${kit.category}`,
      `[MATERIALS]\n${kit.materials}`,
      `[TAGS (13)]\n${kit.tags.join(", ")}`,
      `[DESCRIPTION]\n${kit.description}`,
      `[FILE LIST]\n${kit.fileList.map((f) => "- " + f).join("\n")}`,
      `[DOWNLOAD INSTRUCTIONS]\n${kit.downloadInstructions}`,
      `[COMMERCIAL SCORE] ${kit.commercialScore}/100 — ${kit.commercialReason}`,
    ].join("\n\n");
    zip.file("ETSY-LISTING.txt", listingTxt);

    const zipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    return NextResponse.json({
      kit,
      style: useStyle,
      mockupB64: `data:image/png;base64,${mockup.toString("base64")}`,
      zipB64: `data:application/zip;base64,${zipBuf.toString("base64")}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
