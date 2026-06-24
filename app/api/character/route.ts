import { NextRequest, NextResponse } from "next/server";
import { getProvider, ProviderId } from "@/lib/providers";
import { STYLES } from "@/lib/constants";
import { characterPrompt } from "@/lib/prompts";
import { newJobId, ensureJob, saveFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const photo = form.get("photo") as File | null;
    const providerId = (form.get("provider") as string) as ProviderId;
    const styleId = form.get("style") as string;

    if (!photo) return NextResponse.json({ error: "사진이 없습니다." }, { status: 400 });
    const style = STYLES.find((s) => s.id === styleId);
    if (!style) return NextResponse.json({ error: "스타일이 올바르지 않습니다." }, { status: 400 });

    const provider = getProvider(providerId);
    const buf = Buffer.from(await photo.arrayBuffer());
    const mime = photo.type || "image/png";

    const character = await provider.generateCharacter(buf, mime, characterPrompt(style));

    const jobId = newJobId();
    await ensureJob(jobId);
    await saveFile(jobId, "character.png", character);
    await saveFile(jobId, `source.${mime.includes("png") ? "png" : "jpg"}`, buf);

    return NextResponse.json({
      jobId,
      characterB64: `data:image/png;base64,${character.toString("base64")}`,
      nativeTransparency: provider.nativeTransparency,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "캐릭터 생성 실패" }, { status: 500 });
  }
}
