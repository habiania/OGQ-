"use client";

import { useState } from "react";

type Type = "poster" | "card";

export default function Etsy() {
  const [type, setType] = useState<Type>("poster");
  const [theme, setTheme] = useState("");
  const [count, setCount] = useState(4);
  const [language, setLanguage] = useState("ko");
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const [zip, setZip] = useState("");
  const [error, setError] = useState("");

  async function run() {
    if (!theme.trim()) { setError("주제를 입력하세요."); return; }
    setLoading(true); setError(""); setPreviews([]); setZip("");
    try {
      const res = await fetch("/api/etsy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, theme, count, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성 실패");
      setPreviews(data.previews || []);
      setZip(data.zipB64 || "");
    } catch (e: any) { setError(e?.message || "오류"); }
    finally { setLoading(false); }
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <a href="/" className="mb-4 inline-block text-xs text-zinc-500 hover:text-zinc-300">← 홈으로</a>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">🏷️ Etsy 디지털 상품 메이커</h1>
        <p className="mt-1 text-sm text-zinc-400">주제 입력 → AI가 문구 생성 → 인쇄/판매용 이미지 자동 디자인 → ZIP 다운로드</p>
      </header>

      <div className="space-y-4">
        <div className="flex gap-2">
          <button onClick={() => setType("poster")} disabled={loading}
            className={`flex-1 rounded-lg border px-4 py-3 text-sm ${type === "poster" ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>
            🖼️ 명언/월아트 포스터 <span className="text-[11px] text-zinc-500">A4 인쇄용</span>
          </button>
          <button onClick={() => setType("card")} disabled={loading}
            className={`flex-1 rounded-lg border px-4 py-3 text-sm ${type === "card" ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>
            💬 소셜 인용구 카드 <span className="text-[11px] text-zinc-500">1080 정사각</span>
          </button>
        </div>

        <input value={theme} onChange={(e) => setTheme(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="주제 (예: 동기부여, 사랑, 미니멀 라이프, 커피)" disabled={loading}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-zinc-500" />

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            개수
            <select value={count} onChange={(e) => setCount(+e.target.value)} disabled={loading}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200">
              {[4, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            언어
            <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={loading}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200">
              <option value="ko">한국어</option><option value="en">English</option>
            </select>
          </label>
          <button onClick={run} disabled={loading}
            className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-40">
            {loading ? "생성 중…" : "🎨 생성하기"}
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>}
      </div>

      {previews.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">미리보기</h2>
            {zip && (
              <a href={zip} download={`etsy-${type}.zip`}
                className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-zinc-950">⬇ 전체 ZIP 다운로드</a>
            )}
          </div>
          <div className={`grid gap-3 ${type === "card" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-4"}`}>
            {previews.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p} alt={`preview-${i}`} className="w-full rounded-lg border border-zinc-800" />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">※ 미리보기는 최대 4개. ZIP에는 생성한 전체가 들어있습니다.</p>
        </section>
      )}
    </main>
  );
}
