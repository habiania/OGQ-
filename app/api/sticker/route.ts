import { NextRequest, NextResponse } from "next/server";
import { getProvider, ProviderId } from "@/lib/providers";
import { EMOTIONS } from "@/lib/constants";
import { emotionPrompt } from "@/lib/prompts";
import { readFile, saveFile } from "@/lib/storage";
import { composeSticker } from "@/lib/imaging";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { jobId, provider: providerId, emotionIndex } = (await req.json()) as {
      jobId: string;
      provider: ProviderId;
      emotionIndex: number;
    };

    const emotion = EMOTIONS[emotionIndex];
    if (!jobId || !emotion) {
      return NextResponse.json({ error: "요청 값이 올바르지 않습니다." }, { status: 400 });
    }

    const provider = getProvider(providerId);
    const character = await readFile(jobId, "character.png");

    // 같은 캐릭터로 표정/포즈만 변형 (대사 텍스트 없음)
    const art = await provider.editCharacter(character, emotionPrompt(emotion));

    // OGQ 규격으로 합성 + 한글 대사 오버레이
    const sticker = await composeSticker(art, {
      caption: emotion.ko,
      removeWhite: !provider.nativeTransparency,
    });

    const name = String(emotion.n).padStart(2, "0") + ".png";
    await saveFile(jobId, `stickers/${name}`, sticker);

    return NextResponse.json({
      index: emotionIndex,
      n: emotion.n,
      ko: emotion.ko,
      stickerB64: `data:image/png;base64,${sticker.toString("base64")}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "스티커 생성 실패" }, { status: 500 });
  }
}
