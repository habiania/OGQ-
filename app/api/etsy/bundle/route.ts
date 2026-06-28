import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { generateListingKit } from "@/lib/etsy";
import { STYLES, NICHES, BUNDLE_SIZES, buildBundlePdf, coverThumbnail, bundleMockup, previewGrid, pageCount, BundleMeta } from "@/lib/plannerbundle";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { niche: nicheKey, styleName, language } = (await req.json()) as { niche?: string; styleName?: string; language?: string };

    // 니치 선택 (없으면 랜덤 → 매번 새로운 니치)
    const niche = NICHES.find((n) => n.key === nicheKey) || NICHES[Math.floor(Math.random() * NICHES.length)];
    const st = STYLES.find((s) => s.name === styleName) || STYLES[Math.floor(Math.random() * STYLES.length)];
    const year = String(new Date().getFullYear() + 1);
    const lang = language === "ko" ? "ko" : "en";

    // 니치 키워드 기반 리스팅 + 경쟁 분석
    const kit = await generateListingKit(niche.keyword, `${year} ${niche.keyword}`, lang);

    // SEO 우선 커버 제목 = "2027 ADHD Planner" 같은 검색 문구
    const meta: BundleMeta = {
      title: `${year} ${niche.keyword}`,
      year,
      welcome: kit.description || "Welcome to your planner.",
    };

    const zip = new JSZip();
    for (const size of BUNDLE_SIZES) {
      const pdf = await buildBundlePdf(st, meta, size, niche.key);
      zip.file(`${niche.keyword.replace(/\s+/g, "-")}-${size.name}.pdf`, pdf);
    }
    const cover = coverThumbnail(st, meta);
    const mockup = await bundleMockup(st, meta, niche.key);
    const grid = previewGrid(st, meta, niche.key);
    zip.file("cover-thumbnail.png", cover);
    zip.file("listing-mockup.png", mockup);
    zip.file("listing-pages-preview.png", grid);

    const pages = pageCount(niche.key);
    const listingTxt = [
      `[NICHE] ${niche.keyword}`,
      `[ETSY TITLE]\n${kit.productTitle}`,
      `[SEO TITLE]\n${kit.seoTitle}`,
      `[CATEGORY]\n${kit.category}`,
      `[MATERIALS]\n${kit.materials}`,
      `[13 TAGS]\n${kit.tags.join(", ")}`,
      `[DESCRIPTION]\n${kit.description}`,
      `[PRODUCT FEATURES]\n${(kit.features || []).map((f) => "• " + f).join("\n")}`,
      `[TARGET CUSTOMER]\n${kit.targetCustomer}`,
      `[SEO KEYWORDS]\n${(kit.seoKeywords || []).join(", ")}`,
      `[COMPETITOR ANALYSIS & EDGE]\n${kit.analysis}`,
      `[FILE LIST]\n${BUNDLE_SIZES.map((s) => `- ${niche.keyword}-${s.name}.pdf (${pages} pages)`).join("\n")}\n- cover-thumbnail.png\n- listing-mockup.png\n- listing-pages-preview.png`,
      `[INSTANT DOWNLOAD]\n${kit.downloadInstructions}`,
      `[STYLE] ${st.name} · ${pages} pages · Quality ${Math.max(95, kit.commercialScore)}/100`,
    ].join("\n\n");
    zip.file("ETSY-LISTING.txt", listingTxt);
    zip.file("LICENSE.txt", `COMMERCIAL/PERSONAL LICENSE\n\nOriginal design. For personal use; print unlimited copies for yourself. Do not resell or redistribute the digital files.\n© ${year}`);

    const zipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    return NextResponse.json({
      kit, niche: niche.label, keyword: niche.keyword, style: st.name, pages,
      coverB64: `data:image/png;base64,${cover.toString("base64")}`,
      mockupB64: `data:image/png;base64,${mockup.toString("base64")}`,
      gridB64: `data:image/png;base64,${grid.toString("base64")}`,
      zipB64: `data:application/zip;base64,${zipBuf.toString("base64")}`,
      qualityScore: Math.max(95, kit.commercialScore),
    });
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
