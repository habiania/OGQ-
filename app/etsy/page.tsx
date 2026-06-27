"use client";

import { useState } from "react";

type Type = "poster" | "card" | "planner" | "stickersheet";
const PLANNER_PAGES: [string, string][] = [["daily", "데일리"], ["weekly", "위클리"], ["checklist", "체크리스트"], ["habit", "습관 트래커"]];

export default function Etsy() {
  const [type, setType] = useState<Type>("poster");
  const [theme, setTheme] = useState("");
  const [count, setCount] = useState(4);
  const [language, setLanguage] = useState("ko");
  const [plannerPages, setPlannerPages] = useState<string[]>(["daily", "checklist"]);
  const [plannerTitle, setPlannerTitle] = useState("");
  const [cols, setCols] = useState(3);
  const [images, setImages] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const [zip, setZip] = useState("");
  const [pdf, setPdf] = useState("");
  const [error, setError] = useState("");

  function togglePage(p: string) { setPlannerPages((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p])); }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const arr: string[] = [];
    for (const f of Array.from(files).slice(0, 30)) {
      const bitmap = await createImageBitmap(f);
      const max = 500, sc = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const cv = document.createElement("canvas"); cv.width = Math.round(bitmap.width * sc); cv.height = Math.round(bitmap.height * sc);
      cv.getContext("2d")!.drawImage(bitmap, 0, 0, cv.width, cv.height);
      arr.push(cv.toDataURL("image/png"));
    }
    setImages(arr);
  }

  async function run() {
    setError(""); setPreviews([]); setZip(""); setPdf("");
    setLoading(true);
    try {
      if (type === "poster" || type === "card") {
        if (!theme.trim()) throw new Error("주제를 입력하세요.");
        const r = await (await fetch("/api/etsy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, theme, count, language }) })).json();
        if (r.error) throw new Error(r.error);
        setPreviews(r.previews || []); setZip(r.zipB64 || "");
      } else if (type === "planner") {
        if (!plannerPages.length) throw new Error("페이지 종류를 선택하세요.");
        const r = await (await fetch("/api/etsy/planner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: plannerTitle, pages: plannerPages, theme, language }) })).json();
        if (r.error) throw new Error(r.error);
        setPdf(r.pdfB64 || "");
      } else if (type === "stickersheet") {
        if (!images.length) throw new Error("이미지를 올리세요.");
        const r = await (await fetch("/api/etsy/stickersheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images, cols }) })).json();
        if (r.error) throw new Error(r.error);
        setPdf(r.pdfB64 || "");
      }
    } catch (e: any) { setError(e?.message || "오류"); }
    finally { setLoading(false); }
  }

  const TYPES: [Type, string, string][] = [
    ["poster", "🖼️ 포스터", "명언/월아트 A4"],
    ["card", "💬 인용구 카드", "1080 정사각"],
    ["planner", "🗓️ 플래너", "데일리·체크리스트 PDF"],
    ["stickersheet", "🔖 스티커 시트", "이미지→인쇄 PDF"],
  ];

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <a href="/" className="mb-4 inline-block text-xs text-zinc-500 hover:text-zinc-300">← 홈으로</a>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">🏷️ Etsy 디지털 상품 메이커</h1>
        <p className="mt-1 text-sm text-zinc-400">주제/이미지 → 인쇄·판매용 디지털 상품 자동 생성 → 다운로드</p>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TYPES.map(([t, label, sub]) => (
          <button key={t} onClick={() => setType(t)} disabled={loading}
            className={`rounded-lg border px-3 py-3 text-center text-sm ${type === t ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>
            <div>{label}</div><div className="mt-0.5 text-[10px] text-zinc-500">{sub}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {(type === "poster" || type === "card") && (
          <>
            <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="주제 (예: 동기부여, 사랑, 커피, 미니멀)" disabled={loading}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-zinc-500" />
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-zinc-400">개수
                <select value={count} onChange={(e) => setCount(+e.target.value)} disabled={loading} className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200">
                  {[4, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <LangSel language={language} setLanguage={setLanguage} loading={loading} />
            </div>
          </>
        )}

        {type === "planner" && (
          <>
            <input value={plannerTitle} onChange={(e) => setPlannerTitle(e.target.value)} placeholder="플래너 제목 (예: 2026 데일리 플래너)" disabled={loading}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-zinc-500" />
            <div className="flex flex-wrap gap-1.5">
              {PLANNER_PAGES.map(([v, l]) => (
                <button key={v} onClick={() => togglePage(v)} disabled={loading}
                  className={`rounded-full border px-3 py-1 text-xs ${plannerPages.includes(v) ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>{l}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="주제(선택) — 넣으면 AI가 체크리스트·습관 항목 채움" disabled={loading}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500" />
              <LangSel language={language} setLanguage={setLanguage} loading={loading} />
            </div>
          </>
        )}

        {type === "stickersheet" && (
          <>
            <input type="file" accept="image/png,image/jpeg" multiple disabled={loading} onChange={(e) => onFiles(e.target.files)}
              className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200" />
            {images.length > 0 && <p className="text-xs text-zinc-500">{images.length}개 이미지 선택됨</p>}
            <label className="flex items-center gap-2 text-xs text-zinc-400">한 줄 개수
              <select value={cols} onChange={(e) => setCols(+e.target.value)} disabled={loading} className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200">
                {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </>
        )}

        <button onClick={run} disabled={loading}
          className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-40">
          {loading ? "생성 중…" : "🎨 생성하기"}
        </button>
        {error && <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>}
      </div>

      {previews.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">미리보기</h2>
            {zip && <a href={zip} download={`etsy-${type}.zip`} className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-zinc-950">⬇ 전체 ZIP</a>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {previews.map((p, i) => (<img key={i} src={p} alt={`p${i}`} className="w-full rounded-lg border border-zinc-800" />))}
          </div>
        </section>
      )}

      {pdf && (
        <section className="mt-8">
          <a href={pdf} download={`etsy-${type}.pdf`} className="inline-block rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-zinc-950">⬇ PDF 다운로드</a>
        </section>
      )}
    </main>
  );
}

function LangSel({ language, setLanguage, loading }: { language: string; setLanguage: (v: string) => void; loading: boolean }) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-400">언어
      <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={loading} className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200">
        <option value="ko">한국어</option><option value="en">English</option>
      </select>
    </label>
  );
}
