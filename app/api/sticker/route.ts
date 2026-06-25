import { NextRequest, NextResponse } from "next/server";
import { getProvider, ProviderId } from "@/lib/providers";
import { getItems, GenMode, KAKAO_SPEC } from "@/lib/constants";
import { emotionPrompt, kakaoItemPrompt } from "@/lib/prompts";
import { readFile, saveFile } from "@/lib/storage";
import { composeSticker } from "@/lib/imaging";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { jobId, provider: providerId, emotionIndex, mode = "ogq", count = 24 } = (await req.json()) as {
      jobId: string;
      provider: ProviderId;
      emotionIndex: number;
      mode?: GenMode;
      count?: number;
    };

    const item = getItems(mode, count)[emotionIndex];
    if (!jobId || !item) {
      return NextResponse.json({ error: "요청 값이 올바르지 않습니다." }, { status: 400 });
    }

    const provider = getProvider(providerId);
    const character = await readFile(jobId, "character.png");

    // 같은 캐릭터로 표정/포즈만 변형 (대사 텍스트 없음)
    const prompt = mode === "kakao" ? kakaoItemPrompt(item) : emotionPrompt(item);
    const art = await provider.editCharacter(character, prompt);

    // 규격에 맞게 합성 + 한글 대사 오버레이 (카카오 360x360 / OGQ 740x640)
    const sticker = await composeSticker(art, {
      caption: item.ko,
      removeWhite: !provider.nativeTransparency,
      width: mode === "kakao" ? KAKAO_SPEC.item.width : undefined,
      height: mode === "kakao" ? KAKAO_SPEC.item.height : undefined,
    });

    // 카카오는 4자리(0001.png), OGQ는 2자리(01.png)
    const digits = mode === "kakao" ? 4 : 2;
    const name = String(item.n).padStart(digits, "0") + ".png";
    await saveFile(jobId, `stickers/${name}`, sticker);

    return NextResponse.json({
      index: emotionIndex,
      n: item.n,
      ko: item.ko,
      stickerB64: `data:image/png;base64,${sticker.toString("base64")}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "스티커 생성 실패" }, { status: 500 });
  }
}
