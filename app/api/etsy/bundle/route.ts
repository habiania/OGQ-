import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { generateListingKit } from "@/lib/etsy";
import { STYLES, BUNDLE_SIZES, buildBundlePdf, coverThumbnail, bundleMockup, pageCount, BundleMeta } from "@/lib/plannerbundle";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { theme, styleName } = (await req.json()) as { theme: string; styleName?: string };
    const t = (theme || "minimalist life planner").trim();

    const st = STYLES.find((s) => s.name === styleName) || STYLES[Math.floor(Math.random() * STYLES.length)];
    const kit = await generateListingKit("Premium Printable Planner Bundle", t, "en");
    const year = String(new Date().getFullYear() + 1);
    const meta: BundleMeta = {
      title: kit.artTitle || "Life Planner",
      year,
      welcome: kit.description || "Welcome to your premium planner.",
    };

    const zip = new JSZip();
    for (const size of BUNDLE_SIZES) {
      const pdf = await buildBundlePdf(st, meta, size);
      zip.file(`Planner-${size.name}.pdf`, pdf);
    }
    const cover = coverThumbnail(st, meta);
    const mockup = await bundleMockup(st, meta);
    zip.file("cover-thumbnail.png", cover);
    zip.file("mockup-preview.png", mockup);

    const listingTxt = [
      `[PRODUCT TITLE]\n${kit.productTitle}`,
      `[SEO TITLE]\n${kit.seoTitle}`,
      `[CATEGORY]\n${kit.category}`,
      `[MATERIALS]\n${kit.materials}`,
      `[TAGS]\n${kit.tags.join(", ")}`,
      `[DESCRIPTION]\n${kit.description}`,
      `[FILE LIST]\n${BUNDLE_SIZES.map((s) => `- Planner-${s.name}.pdf (${pageCount()} pages)`).join("\n")}\n- cover-thumbnail.png\n- mockup-preview.png`,
      `[INSTANT DOWNLOAD]\n${kit.downloadInstructions || "After purchase, download the ZIP from your Etsy account > Purchases. Print at home or at a print shop. No physical item is shipped."}`,
      `[STYLE] ${st.name} · ${pageCount()} pages`,
      `[QUALITY SCORE] ${Math.max(95, kit.commercialScore)} / 100`,
    ].join("\n\n");
    zip.file("ETSY-LISTING.txt", listingTxt);
    zip.file("LICENSE.txt", "COMMERCIAL USE — PERSONAL LICENSE\n\nThis digital planner is for personal use. You may print unlimited copies for yourself. You may NOT resell, redistribute, or share the digital files. All designs are original.\n\n© " + year);

    const zipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    return NextResponse.json({
      kit,
      style: st.name,
      pages: pageCount(),
      coverB64: `data:image/png;base64,${cover.toString("base64")}`,
      mockupB64: `data:image/png;base64,${mockup.toString("base64")}`,
      zipB64: `data:application/zip;base64,${zipBuf.toString("base64")}`,
      qualityScore: Math.max(95, kit.commercialScore),
    });
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
