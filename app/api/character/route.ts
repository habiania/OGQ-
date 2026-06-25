import { NextRequest, NextResponse } from "next/server";
import { getProvider, ProviderId } from "@/lib/providers";
import { STYLES, GenMode } from "@/lib/constants";
import { characterPrompt, kakaoCharacterPrompt } from "@/lib/prompts";
import { newJobId, ensureJob, saveFile } from "@/lib/storage";
import { humanizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const photo = form.get("photo") as File | null;
    const providerId = (form.get("provider") as string) as ProviderId;
    const styleId = form.get("style") as string;
    const mode = ((form.get("mode") as string) || "ogq") as GenMode;
    const apiKey = (form.get("apiKey") as string) || undefined;

    if (!photo) return NextResponse.json({ error: "사진이 없습니다." }, { status: 400 });
    const style = STYLES.find((s) => s.id === styleId);
    if (!style) return NextResponse.json({ error: "스타일이 올바르지 않습니다." }, { status: 400 });

    const provider = getProvider(providerId, apiKey);
    const buf = Buffer.from(await photo.arrayBuffer());
    const mime = photo.type || "image/png";

    const prompt = mode === "kakao" ? kakaoCharacterPrompt(style) : characterPrompt(style);
    const character = await provider.generateCharacter(buf, mime, prompt);

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
    return NextResponse.json({ error: humanizeError(e) }, { status: 500 });
  }
}
