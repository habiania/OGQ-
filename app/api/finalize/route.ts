import { NextRequest, NextResponse } from "next/server";
import { getProvider, ProviderId } from "@/lib/providers";
import { STYLES, GenMode, KAKAO_SPEC } from "@/lib/constants";
import { readFile, saveFile, listStickers } from "@/lib/storage";
import { makeMain, makeTab, makeThumbnail, inspectPng } from "@/lib/imaging";
import { validate, validateKakao, PngInfo } from "@/lib/validate";
import { generateMeta } from "@/lib/meta";
import { buildZip, buildKakaoZip } from "@/lib/zip";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { jobId, provider: providerId, styleId, subject, title, mode = "ogq", count = 24, apiKey } =
      (await req.json()) as {
        jobId: string;
        provider: ProviderId;
        styleId: string;
        subject?: string;
        title?: string;
        mode?: GenMode;
        count?: number;
        apiKey?: string;
      };

    const style = STYLES.find((s) => s.id === styleId);
    if (!jobId || !style) {
      return NextResponse.json({ error: "요청 값이 올바르지 않습니다." }, { status: 400 });
    }

    const provider = getProvider(providerId, apiKey);
    const removeWhite = !provider.nativeTransparency;
    const character = await readFile(jobId, "character.png");

    // 저장된 결과물 로드
    const files = await listStickers(jobId);
    const items: { name: string; data: Buffer }[] = [];
    const infos: PngInfo[] = [];
    for (const name of files) {
      const data = await readFile(jobId, `stickers/${name}`);
      items.push({ name, data });
      infos.push(await inspectPng(data));
    }

    const meta = generateMeta(style, subject);
    if (title && title.trim()) meta.title = title.trim();

    if (mode === "kakao") {
      // 카카오: 썸네일/프리뷰(360x360) + 150KB 검수 + 0001.png ZIP
      const thumbnail = await makeThumbnail(character, KAKAO_SPEC.thumb.width, KAKAO_SPEC.thumb.height, removeWhite);
      const preview = thumbnail;
      await saveFile(jobId, "thumbnail.png", thumbnail);
      await saveFile(jobId, "preview.png", preview);

      const report = validateKakao(infos, count, await inspectPng(thumbnail));
      const zip = await buildKakaoZip({
        items: items.map((it) => ({ data: it.data })),
        thumbnail,
        preview,
        meta,
        report,
        style: style.name,
      });
      await saveFile(jobId, "sticker-pack.zip", zip);
      return NextResponse.json({ report, meta, downloadUrl: `/api/download?jobId=${jobId}` });
    }

    // OGQ: 대표/탭 이미지 + 검수 + ZIP
    const main = await makeMain(character, removeWhite);
    const tab = await makeTab(character, removeWhite);
    await saveFile(jobId, "main.png", main);
    await saveFile(jobId, "tab.png", tab);

    const report = validate(infos, await inspectPng(main), await inspectPng(tab));
    const zip = await buildZip({ stickers: items, main, tab, meta, report, style: style.name });
    await saveFile(jobId, "sticker-pack.zip", zip);

    return NextResponse.json({ report, meta, downloadUrl: `/api/download?jobId=${jobId}` });
  } catch (e: any) {
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
