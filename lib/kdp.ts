import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { sanitizePng } from "./png";

// ===== KDP 전자책 AI 파이프라인 =====
// 각 외부 단계는 해당 키가 있을 때만 동작(없으면 graceful skip).

export interface BookMeta {
  title: string;
  subtitle: string;
  language: string; // ko | en
  tone: string; // Professional | Friendly | Educational | Storytelling | Travel Guide ...
  length: string; // 짧게 | 보통 | 길게
  options: string[]; // 표 추가, FAQ 생성, 요약 생성, 체크리스트 추가, AI 표현 최소화 ...
}

export interface ResearchResult {
  notes: string; // 사실 기반 요약
  sources: string[]; // 출처 URL
  enabled: boolean; // Perplexity 사용 여부
}

const gemini = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY 가 없습니다 (전자책 본문 생성에 필요).");
  return new GoogleGenAI({ apiKey: key });
};

async function geminiText(prompt: string, json = false): Promise<string> {
  const ai = gemini();
  let lastErr: any = null;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: json ? { responseMimeType: "application/json" } : {},
      });
      return res.text || "";
    } catch (e: any) {
      lastErr = e;
      const m = (e?.message || "").toLowerCase();
      if (!(m.includes("503") || m.includes("overload") || m.includes("unavailable") || m.includes("429")) || i === 2) break;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

// STEP1: Perplexity 사실조사 (키 있으면) — 최신 정보·출처 수집
export async function research(topic: string, chapterTitle: string): Promise<ResearchResult> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return { notes: "", sources: [], enabled: false };
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are a research assistant. Provide concise, factual, up-to-date information with key facts and statistics for a book chapter." },
          { role: "user", content: `Book topic: ${topic}\nChapter: ${chapterTitle}\nGive 5-8 key factual points (with numbers/dates where relevant) to write this chapter accurately.` },
        ],
      }),
    });
    const d = await res.json();
    const notes = d.choices?.[0]?.message?.content || "";
    const sources: string[] = d.citations || d.search_results?.map((s: any) => s.url) || [];
    return { notes, sources, enabled: true };
  } catch {
    return { notes: "", sources: [], enabled: false }; // 조사 실패해도 집필은 진행
  }
}

// STEP2~4: 챕터 본문 작성 + 문체 개선 + 요약/TIP/FAQ (Gemini, 무료)
export async function writeChapter(meta: BookMeta, chapterTitle: string, research: ResearchResult): Promise<string> {
  const opt = meta.options;
  const lengthGuide = meta.length === "짧게" ? "약 400~600 단어" : meta.length === "길게" ? "약 1200~1800 단어" : "약 700~1000 단어";
  const extras = [
    opt.includes("요약 생성") ? "- 챕터 끝에 '핵심 요약' 3~5줄" : "",
    opt.includes("표 추가") ? "- 적절하면 정보를 '표:' 로 시작하는 줄로 표현(파이프 | 구분)" : "",
    opt.includes("체크리스트 추가") ? "- 실천 체크리스트 '체크:' 항목들" : "",
    opt.includes("FAQ 생성") ? "- 'FAQ' 섹션에 Q/A 2~3개" : "",
  ].filter(Boolean).join("\n");

  const factBlock = research.enabled && research.notes
    ? `다음 사실 자료를 반영하세요(출처 기반):\n${research.notes}\n`
    : "";

  const prompt = `당신은 전문 전자책 작가입니다. 아래 책의 한 챕터를 작성하세요.
책 제목: ${meta.title}
부제: ${meta.subtitle}
언어: ${meta.language === "en" ? "English" : "한국어"}
톤: ${meta.tone}
분량: ${lengthGuide}
${factBlock}
챕터 제목: ${chapterTitle}

작성 규칙:
- 소제목은 '## 소제목' 형식, 본문은 자연스러운 문단.
- ${opt.includes("AI 표현 최소화") ? "AI가 쓴 듯한 상투적 표현 금지, 사람이 쓴 듯 자연스럽게." : "읽기 쉽게."}
- ${opt.includes("초보자도 이해 가능") ? "초보자도 이해할 수 있게 쉬운 설명." : ""}
- 'TIP:' 로 시작하는 팁, '주의:' 로 시작하는 주의사항을 1~2개 넣어도 좋음.
${extras}

본문만 출력(마크다운). 챕터 제목은 다시 쓰지 마세요.`;

  return geminiText(prompt);
}

// KDP 메타데이터 자동 생성 (제목/부제/키워드7/카테고리/설명)
export interface KdpMetadata {
  title: string;
  subtitle: string;
  keywords: string[];
  categories: string[];
  description: string;
}
export async function generateKdpMetadata(meta: BookMeta, chapters: string[]): Promise<KdpMetadata> {
  const prompt = `아마존 KDP 전자책 메타데이터를 생성하세요.
책: ${meta.title} / 부제: ${meta.subtitle} / 언어: ${meta.language === "en" ? "English" : "한국어"}
목차: ${chapters.join(", ")}
JSON으로만: {"title":"","subtitle":"","keywords":["7개"],"categories":["2~3개"],"description":"책 소개 3~5문장"}`;
  const txt = await geminiText(prompt, true);
  const p = JSON.parse(txt || "{}");
  return {
    title: p.title || meta.title,
    subtitle: p.subtitle || meta.subtitle,
    keywords: (p.keywords || []).slice(0, 7),
    categories: p.categories || [],
    description: p.description || "",
  };
}

// STEP5: 챕터 삽화 (OpenAI, 키+크레딧 있을 때만)
export async function chapterImage(chapterTitle: string, style: string): Promise<Buffer | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const client = new OpenAI({ apiKey: key });
    const prompt = `Create an original illustration for a book chapter titled "${chapterTitle}". ${style} style. Book illustration, clean, white background, high resolution. Do not imitate any copyrighted character or brand. Original and unique.`;
    const res = await client.images.generate({ model: "gpt-image-1", prompt, size: "1024x1024", quality: "low" });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) return null;
    return sanitizePng(Buffer.from(b64, "base64"));
  } catch {
    return null; // 크레딧 없거나 실패 시 삽화 없이 진행
  }
}
