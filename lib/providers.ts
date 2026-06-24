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
class GeminiProvider implements ImageProvider {
  id: ProviderId = "gemini";
  nativeTransparency = false; // 투명배경 미보장 → 후처리로 보정
  private client: GoogleGenAI;
  private model = "gemini-2.5-flash-image-preview";

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  private async run(parts: any[]): Promise<Buffer> {
    const res = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts }],
    });
    const cand = res.candidates?.[0];
    const imgPart = cand?.content?.parts?.find((p: any) => p.inlineData?.data);
    const data = imgPart?.inlineData?.data;
    if (!data) throw new Error("Gemini 이미지 응답이 비어 있습니다.");
    return sanitizePng(Buffer.from(data, "base64"));
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

export function getProvider(id: ProviderId): ImageProvider {
  if (id === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY 가 설정되지 않았습니다 (.env.local).");
    return new OpenAIProvider(key);
  }
  if (id === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY 가 설정되지 않았습니다 (.env.local).");
    return new GeminiProvider(key);
  }
  throw new Error(`알 수 없는 provider: ${id}`);
}
