import OpenAI, { toFile } from "openai";
import { GoogleGenAI } from "@google/genai";
import { sanitizePng } from "./png";

export type ProviderId = "openai" | "gemini";

export interface ImageProvider {
  id: ProviderId;
  /** 업로드한 사진으로부터 스타일화된 캐릭터 베이스 1장 생성 (PNG Buffer) */
  generateCharacter(photo: Buffer, mime: string, prompt: string): Promise<Buffer>;
  /** 베이스 캐릭터를 같은 캐릭터로 유지하며 표정/포즈만 변형 (PNG Buffer, 대사 텍스트 없음) */
  editCharacter(base: Buffer, prompt: string): Promise<Buffer>;
  /** 투명 배경을 모델이 직접 만들어주는지 여부 */
  nativeTransparency: boolean;
}

// ---------------- OpenAI (gpt-image-1) ----------------
class OpenAIProvider implements ImageProvider {
  id: ProviderId = "openai";
  nativeTransparency = true;
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  private async edit(image: Buffer, name: string, prompt: string): Promise<Buffer> {
    const file = await toFile(image, name, { type: "image/png" });
    const res = await this.client.images.edit({
      model: "gpt-image-1",
      image: file,
      prompt,
      size: "1024x1024",
      background: "transparent",
      // 비용 절감: 스티커/이모티콘은 단순 그림이라 low 품질로 충분(토큰·요금 대폭↓)
      quality: "low",
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI 이미지 응답이 비어 있습니다.");
    return sanitizePng(Buffer.from(b64, "base64"));
  }

  generateCharacter(photo: Buffer, mime: string, prompt: string) {
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    return this.edit(photo, `photo.${ext}`, prompt);
  }

  editCharacter(base: Buffer, prompt: string) {
    return this.edit(base, "character.png", prompt);
  }
}

// ---------------- Gemini (2.5 flash image) ----------------
// 키/리전마다 사용 가능한 이미지 생성 모델명이 달라서 후보를 순서대로 시도.
// 한 번 성공한 모델명은 모듈 레벨에 캐시해 이후 요청에서 재사용.
const GEMINI_IMAGE_MODELS = [
  "gemini-2.5-flash-image", // 확인됨: 안정 이미지 편집 모델(Nano Banana)
  "gemini-3.1-flash-image",
  "gemini-3-pro-image",
  "gemini-2.5-flash-image-preview",
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.0-flash-exp-image-generation",
];
let cachedGeminiModel: string | null = null;

class GeminiProvider implements ImageProvider {
  id: ProviderId = "gemini";
  nativeTransparency = false; // 투명배경 미보장 → 후처리로 보정
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  private async generateWith(model: string, parts: any[]) {
    return this.client.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      // 이미지 출력 모달리티 명시 (미지정 시 텍스트만 반환될 수 있음)
      config: { responseModalities: ["IMAGE", "TEXT"] as any },
    });
  }

  private async run(parts: any[]): Promise<Buffer> {
    // 캐시된 모델 우선, 없으면 후보 전체 시도
    const candidates = cachedGeminiModel
      ? [cachedGeminiModel, ...GEMINI_IMAGE_MODELS.filter((m) => m !== cachedGeminiModel)]
      : GEMINI_IMAGE_MODELS;

    let lastErr: any = null;
    for (const model of candidates) {
      try {
        const res = await this.generateWith(model, parts);
        const imgPart = res.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
        const data = imgPart?.inlineData?.data;
        if (!data) throw new Error("Gemini 이미지 응답이 비어 있습니다.");
        cachedGeminiModel = model; // 성공 모델 기억
        return sanitizePng(Buffer.from(data, "base64"));
      } catch (e: any) {
        lastErr = e;
        const msg = (e?.message || "").toLowerCase();
        // 모델 없음(404/NOT_FOUND)이면 다음 후보로, 그 외 오류면 즉시 중단
        if (msg.includes("not found") || msg.includes("404") || msg.includes("not supported")) continue;
        throw e;
      }
    }
    throw lastErr || new Error("사용 가능한 Gemini 이미지 모델을 찾지 못했습니다.");
  }

  generateCharacter(photo: Buffer, mime: string, prompt: string) {
    return this.run([
      { inlineData: { mimeType: mime, data: photo.toString("base64") } },
      { text: prompt + " Put the character on a plain solid pure-white (#FFFFFF) background." },
    ]);
  }

  editCharacter(base: Buffer, prompt: string) {
    return this.run([
      { inlineData: { mimeType: "image/png", data: base.toString("base64") } },
      { text: prompt + " Keep a plain solid pure-white (#FFFFFF) background." },
    ]);
  }
}

// apiKey가 주어지면(화면 입력) 그것을 우선 사용하고, 없으면 .env.local 값으로 폴백.
export function getProvider(id: ProviderId, apiKey?: string): ImageProvider {
  const key = (apiKey && apiKey.trim()) || undefined;
  if (id === "openai") {
    const k = key || process.env.OPENAI_API_KEY;
    if (!k) throw new Error("OpenAI API 키가 없습니다. 화면의 키 입력란에 입력하거나 .env.local에 설정하세요.");
    return new OpenAIProvider(k);
  }
  if (id === "gemini") {
    const k = key || process.env.GEMINI_API_KEY;
    if (!k) throw new Error("Gemini API 키가 없습니다. 화면의 키 입력란에 입력하거나 .env.local에 설정하세요.");
    return new GeminiProvider(k);
  }
  throw new Error(`알 수 없는 provider: ${id}`);
}
