"use client";

import { useState } from "react";

interface Meta {
  title: string; subtitle: string; language: string; tone: string; length: string; options: string[];
}
interface KdpMeta { title: string; subtitle: string; keywords: string[]; categories: string[]; description: string }
interface Ch { title: string; content: string; imageB64?: string | null }

const TONES = ["Professional", "Friendly", "Educational", "Storytelling", "Travel Guide", "Academic"];
const LENGTHS = ["짧게", "보통", "길게"];
const PAGES = ["A4", "LETTER", "6x9", "7x10"];
const STYLES = ["flat minimal", "watercolor", "cartoon", "isometric", "sketch"];
const OPTIONS = ["사실 기반 작성", "AI 표현 최소화", "자연스러운 문체", "초보자도 이해 가능", "표 추가", "체크리스트 추가", "FAQ 생성", "요약 생성"];

export default function Kdp() {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [language, setLanguage] = useState("ko");
  const [tone, setTone] = useState("Educational");
  const [length, setLength] = useState("보통");
  const [pageSize, setPageSize] = useState("A4");
  const [options, setOptions] = useState<string[]>(["자연스러운 문체", "요약 생성"]);
  const [toc, setToc] = useState("");
  const [withImage, setWithImage] = useState(false);
  const [imageStyle, setImageStyle] = useState("flat minimal");

  const [phase, setPhase] = useState<"idle" | "writing" | "meta" | "pdf" | "done">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [kdpMeta, setKdpMeta] = useState<KdpMeta | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [researchOn, setResearchOn] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  const busy = phase !== "idle" && phase !== "done";
  function toggle(o: string) { setOptions((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o])); }

  async function run() {
    const chapters = toc.split("\n").map((l) => l.replace(/^chapter\s*\d+[:.]?\s*/i, "").trim()).filter(Boolean);
    if (!title.trim() || chapters.length === 0) { setError("제목과 목차(한 줄에 하나)를 입력하세요."); return; }
    setError(""); setKdpMeta(null); setPdfUrl(""); setResearchOn(null);
    const meta: Meta = { title, subtitle, language, tone, length, options };

    try {
      setPhase("writing"); setProgress({ done: 0, total: chapters.length });
      const built: Ch[] = [];
      let allSources: string[] = [];
      for (let i = 0; i < chapters.length; i++) {
        const res = await fetch("/api/kdp/chapter", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meta, chapterTitle: chapters[i], withImage, imageStyle }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `${i + 1}번 챕터 생성 실패`);
        built.push({ title: chapters[i], content: data.content, imageB64: data.imageB64 });
        if (data.sources?.length) allSources = allSources.concat(data.sources);
        if (i === 0) setResearchOn(data.researchEnabled);
        setProgress({ done: i + 1, total: chapters.length });
      }

      setPhase("meta");
      const mRes = await fetch("/api/kdp/metadata", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta, chapterTitles: chapters }),
      });
      const mData = await mRes.json();
      if (mRes.ok) setKdpMeta(mData.metadata);

      setPhase("pdf");
      const bRes = await fetch("/api/kdp/build", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, subtitle, chapters: built, metadata: mData.metadata,
          sources: Array.from(new Set(allSources)), pageSize,
        }),
      });
      const bData = await bRes.json();
      if (!bRes.ok) throw new Error(bData.error || "PDF 생성 실패");
      setPdfUrl(bData.pdfB64);
      setPhase("done");
    } catch (e: any) { setError(e?.message || "오류"); setPhase("idle"); }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <a href="/" className="mb-4 inline-block text-xs text-zinc-500 hover:text-zinc-300">← 홈으로</a>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">📚 AI KDP 북 스튜디오</h1>
        <p className="mt-1 text-sm text-zinc-400">목차 입력 → AI 집필 → PDF 다운로드 (KDP 업로드용)</p>
      </header>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="책 제목" disabled={busy}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-zinc-500" />
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="부제 (선택)" disabled={busy}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-zinc-500" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Select label="언어" value={language} onChange={setLanguage} opts={[["ko", "한국어"], ["en", "English"]]} disabled={busy} />
          <Select label="톤" value={tone} onChange={setTone} opts={TONES.map((t) => [t, t])} disabled={busy} />
          <Select label="분량" value={length} onChange={setLength} opts={LENGTHS.map((t) => [t, t])} disabled={busy} />
          <Select label="페이지" value={pageSize} onChange={setPageSize} opts={PAGES.map((t) => [t, t])} disabled={busy} />
        </div>

        <div>
          <div className="mb-1.5 text-xs text-zinc-400">AI 생성 옵션</div>
          <div className="flex flex-wrap gap-1.5">
            {OPTIONS.map((o) => (
              <button key={o} onClick={() => toggle(o)} disabled={busy}
                className={`rounded-full border px-3 py-1 text-xs ${options.includes(o) ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>
                {o}
              </button>
            ))}
          </div>
          {options.includes("사실 기반 작성") && (
            <p className="mt-1 text-[11px] text-amber-400/80">※ 사실조사(출처)는 PERPLEXITY_API_KEY 설정 시 활성화됩니다.</p>
          )}
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={withImage} disabled={busy} onChange={(e) => setWithImage(e.target.checked)} />
          챕터 삽화 생성 (OpenAI 충전 필요 · 없으면 자동으로 글만)
          {withImage && (
            <select value={imageStyle} onChange={(e) => setImageStyle(e.target.value)} disabled={busy}
              className="ml-2 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs">
              {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </label>

        <div>
          <div className="mb-1.5 text-xs text-zinc-400">목차 (한 줄에 한 챕터)</div>
          <textarea value={toc} onChange={(e) => setToc(e.target.value)} rows={7} disabled={busy}
            placeholder={"Chapter1 Why Japan?\nChapter2 Tokyo\nChapter3 Osaka\nChapter4 Travel Tips"}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-zinc-500" />
        </div>

        <div className="flex items-center gap-3">
          <button onClick={run} disabled={busy}
            className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-40">
            {busy ? "생성 중…" : "📖 전자책 생성"}
          </button>
          {busy && (
            <span className="text-xs text-zinc-400">
              {phase === "writing" && `챕터 집필 ${progress.done}/${progress.total}…`}
              {phase === "meta" && "KDP 메타데이터 생성…"}
              {phase === "pdf" && "PDF 생성…"}
            </span>
          )}
          {researchOn === false && options.includes("사실 기반 작성") && (
            <span className="text-[11px] text-amber-400/80">(Perplexity 키 없음 → 사실조사 생략)</span>
          )}
        </div>

        {error && <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>}
      </div>

      {kdpMeta && (
        <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="mb-2 text-sm font-semibold text-zinc-300">KDP 메타데이터 (복사해서 업로드)</h2>
          <Row label="제목" v={kdpMeta.title} />
          <Row label="부제" v={kdpMeta.subtitle} />
          <Row label="카테고리" v={kdpMeta.categories.join(", ")} />
          <Row label="키워드(7)" v={kdpMeta.keywords.join(", ")} />
          <div className="mt-2 text-xs text-zinc-400">책 소개</div>
          <p className="text-sm text-zinc-200">{kdpMeta.description}</p>
        </section>
      )}

      {pdfUrl && (
        <section className="mt-6">
          <a href={pdfUrl} download={`${title || "book"}.pdf`}
            className="inline-block rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-zinc-950">
            ⬇ PDF 다운로드 (KDP 업로드용)
          </a>
        </section>
      )}
    </main>
  );
}

function Select({ label, value, onChange, opts, disabled }: { label: string; value: string; onChange: (v: string) => void; opts: [string, string][]; disabled?: boolean }) {
  return (
    <label className="text-xs text-zinc-400">
      {label}
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-200">
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
function Row({ label, v }: { label: string; v: string }) {
  return (
    <div className="mt-1.5 flex gap-2 text-sm">
      <span className="w-20 shrink-0 text-xs text-zinc-500">{label}</span>
      <span className="text-zinc-200">{v}</span>
    </div>
  );
}
