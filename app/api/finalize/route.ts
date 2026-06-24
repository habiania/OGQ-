import { NextRequest, NextResponse } from "next/server";
import { getProvider, ProviderId } from "@/lib/providers";
import { STYLES } from "@/lib/constants";
import { readFile, saveFile, listStickers } from "@/lib/storage";
import { makeMain, makeTab, inspectPng } from "@/lib/imaging";
import { validate, PngInfo } from "@/lib/validate";
import { generateMeta } from "@/lib/meta";
import { buildZip } from "@/lib/zip";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { jobId, provider: providerId, styleId, subject, title } = (await req.json()) as {
      jobId: string;
      provider: ProviderId;
      styleId: string;
      subject?: string;
      title?: string;
    };

    const style = STYLES.find((s) => s.id === styleId);
    if (!jobId || !style) {
      return NextResponse.json({ error: "요청 값이 올바르지 않습니다." }, { status: 400 });
    }

    const provider = getProvider(providerId);
    const removeWhite = !provider.nativeTransparency;

    // 대표/탭 이미지는 캐릭터 베이스에서 생성
    const character = await readFile(jobId, "character.png");
    const main = await makeMain(character, removeWhite);
    const tab = await makeTab(character, removeWhite);
    await saveFile(jobId, "main.png", main);
    await saveFile(jobId, "tab.png", tab);

    // 저장된 스티커 24장 로드 + 검수
    const files = await listStickers(jobId);
    const stickers: { name: string; data: Buffer }[] = [];
    const infos: PngInfo[] = [];
    for (const name of files) {
      const data = await readFile(jobId, `stickers/${name}`);
      stickers.push({ name, data });
      infos.push(await inspectPng(data));
    }

    const report = validate(infos, await inspectPng(main), await inspectPng(tab));
    const meta = generateMeta(style, subject);
    if (title && title.trim()) meta.title = title.trim();

    const zip = await buildZip({ stickers, main, tab, meta, report, style: style.name });
    await saveFile(jobId, "sticker-pack.zip", zip);

    return NextResponse.json({ report, meta, downloadUrl: `/api/download?jobId=${jobId}` });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "마무리 처리 실패" }, { status: 500 });
  }
}
