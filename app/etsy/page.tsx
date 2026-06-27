"use client";

import { useState } from "react";

type Type = "wallart" | "card" | "planner" | "stickersheet";
const PLANNER_PAGES: [string, string][] = [["daily", "데일리"], ["weekly", "위클리"], ["checklist", "체크리스트"], ["habit", "습관 트래커"]];
const CATEGORIES = ["Printable Wall Art", "Quote Art", "Nursery / Kids Art", "Affirmation Art", "Botanical Art", "Mid-Century Art", "Boho Decor", "Office / Motivational"];
const STYLES: [string, string][] = [["auto", "자동 추천"], ["boho", "보호/아치"], ["colorblock", "미드센추리"], ["lineart", "라인아트"], ["typographic", "타이포"]];

interface Kit {
  productTitle: string; seoTitle: string; description: string; tags: string[];
  materials: string; category: string; fileList: string[]; downloadInstructions: string;
  commercialScore: number; commercialReason: string;
}

export default function Etsy() {
  const [type, setType] = useState<Type>("wallart");
  const [theme, setTheme] = useState("");
  const [language, setLanguage] = useState("en");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [style, setStyle] = useState("auto");
  const [count, setCount] = useState(6);
  const [plannerPages, setPlannerPages] = useState<string[]>(["daily", "checklist"]);
  const [plannerTitle, setPlannerTitle] = useState("");
  const [cols, setCols] = useState(3);
  const [images, setImages] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [mockup, setMockup] = useState("");
  const [kit, setKit] = useState<Kit | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [zip, setZip] = useState("");
  const [pdf, setPdf] = useState("");
  const [error, setError] = useState("");

  function togglePage(p: string) { setPlannerPages((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p])); }
  function reset() { setMockup(""); setKit(null); setPreviews([]); setZip(""); setPdf(""); }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const arr: string[] = [];
    for (const f of Array.from(files).slice(0, 30)) {
      const bm = await createImageBitmap(f);
      const max = 500, sc = Math.min(1, max / Math.max(bm.width, bm.height));
      const cv = document.createElement("canvas"); cv.width = Math.round(bm.width * sc); cv.height = Math.round(bm.height * sc);
      cv.getContext("2d")!.drawImage(bm, 0, 0, cv.width, cv.height);
      arr.push(cv.toDataURL("image/png"));
    }
    setImages(arr);
  }

  async function run() {
    setError(""); reset(); setLoading(true);
    try {
      if (type === "wallart") {
        if (!theme.trim()) throw new Error("주제를 입력하세요.");
        const r = await (await fetch("/api/etsy/wallart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme, category, style, language }) })).json();
        if (r.error) throw new Error(r.error);
        setMockup(r.mockupB64); setKit(r.kit); setZip(r.zipB64);
      } else if (type === "card") {
        if (!theme.trim()) throw new Error("주제를 입력하세요.");
        const r = await (await fetch("/api/etsy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "card", theme, count, language }) })).json();
        if (r.error) throw new Error(r.error);
        setPreviews(r.previews || []); setZip(r.zipB64 || "");
      } else if (type === "planner") {
        if (!plannerPages.length) throw new Error("페이지 종류를 선택하세요.");
        const r = await (await fetch("/api/etsy/planner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: plannerTitle, pages: plannerPages, theme, language }) })).json();
        if (r.error) throw new Error(r.error);
        setPdf(r.pdfB64 || "");
      } else {
        if (!images.length) throw new Error("이미지를 올리세요.");
        const r = await (await fetch("/api/etsy/stickersheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images, cols }) })).json();
        if (r.error) throw new Error(r.error);
        setPdf(r.pdfB64 || "");
      }
    } catch (e: any) { setError(e?.message || "오류"); }
    finally { setLoading(false); }
  }

  const TYPES: [Type, string, string][] = [
    ["wallart", "🖼️ 프리미엄 월아트", "7사이즈+목업+리스팅"],
    ["card", "💬 인용구 카드", "1080 정사각"],
    ["planner", "🗓️ 플래너", "PDF 템플릿"],
    ["stickersheet", "🔖 스티커 시트", "이미지→PDF"],
  ];

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <a href="/" className="mb-4 inline-block text-xs text-zinc-500 hover:text-zinc-300">← 홈으로</a>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">🏷️ Etsy 디지털 상품 메이커</h1>
        <p className="mt-1 text-sm text-zinc-400">판매 잘되는 상품 위주 · 프리미엄 디자인 + 인쇄 사이즈 + Etsy 리스팅 자동</p>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TYPES.map(([t, label, sub]) => (
          <button key={t} onClick={() => { setType(t); reset(); }} disabled={loading}
            className={`rounded-lg border px-3 py-3 text-center text-sm ${type === t ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>
            <div>{label}</div><div className="mt-0.5 text-[10px] text-zinc-500">{sub}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {type === "wallart" && (
          <>
            <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="주제/콘셉트 (예: boho minimalist motivation, 신생아 방, 커피)" disabled={loading}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-zinc-500" />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-zinc-400">카테고리
                <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={loading} className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-400">스타일
                <select value={style} onChange={(e) => setStyle(e.target.value)} disabled={loading} className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200">
                  {STYLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <LangSel language={language} setLanguage={setLanguage} loading={loading} />
            </div>
            <p className="text-[11px] text-zinc-500">생성 시 A4·A3·US Letter·2:3·3:4·4:5·11x14 전 사이즈 + 액자 목업 + Etsy 리스팅(.txt)을 ZIP으로 묶어줍니다.</p>
          </>
        )}

        {type === "card" && (
          <>
            <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="주제 (예: 동기부여, 사랑, 커피)" disabled={loading}
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
            <input value={plannerTitle} onChange={(e) => setPlannerTitle(e.target.value)} placeholder="플래너 제목" disabled={loading}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-zinc-500" />
            <div className="flex flex-wrap gap-1.5">
              {PLANNER_PAGES.map(([v, l]) => (
                <button key={v} onClick={() => togglePage(v)} disabled={loading}
                  className={`rounded-full border px-3 py-1 text-xs ${plannerPages.includes(v) ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>{l}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="주제(선택) — AI가 체크리스트·습관 항목 채움" disabled={loading}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500" />
              <LangSel language={language} setLanguage={setLanguage} loading={loading} />
            </div>
          </>
        )}

        {type === "stickersheet" && (
          <>
            <input type="file" accept="image/png,image/jpeg" multiple disabled={loading} onChange={(e) => onFiles(e.target.files)}
              className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200" />
            {images.length > 0 && <p className="text-xs text-zinc-500">{images.length}개 선택됨</p>}
            <label className="flex items-center gap-2 text-xs text-zinc-400">한 줄 개수
              <select value={cols} onChange={(e) => setCols(+e.target.value)} disabled={loading} className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200">
                {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </>
        )}

        <button onClick={run} disabled={loading} className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-40">
          {loading ? "생성 중…" : "🎨 생성하기"}
        </button>
        {error && <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>}
      </div>

      {/* 월아트 결과: 목업 + 리스팅 풀세트 */}
      {mockup && kit && (
        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mockup} alt="mockup" className="w-full rounded-xl border border-zinc-800" />
            {zip && <a href={zip} download="etsy-wallart.zip" className="mt-3 block rounded-lg bg-sky-500 px-4 py-2.5 text-center text-sm font-semibold text-zinc-950">⬇ 전체 ZIP (7사이즈+목업+리스팅)</a>}
            <div className="mt-2 text-center text-xs text-amber-300">상업성 {kit.commercialScore}/100 · {kit.commercialReason}</div>
          </div>
          <div className="space-y-2 text-sm">
            <Kv label="상품 제목" v={kit.productTitle} />
            <Kv label="SEO 제목" v={kit.seoTitle} />
            <Kv label="카테고리" v={kit.category} />
            <Kv label="소재" v={kit.materials} />
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-zinc-400"><span>태그 13</span><Copy text={kit.tags.join(", ")} /></div>
              <div className="flex flex-wrap gap-1">{kit.tags.map((t, i) => <span key={i} className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">{t}</span>)}</div>
            </div>
            <Kv label="설명" v={kit.description} multi />
            <Kv label="파일 목록" v={kit.fileList.join("\n")} multi />
            <Kv label="다운로드 안내" v={kit.downloadInstructions} multi />
          </div>
        </section>
      )}

      {previews.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">미리보기</h2>
            {zip && <a href={zip} download="etsy-card.zip" className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-zinc-950">⬇ ZIP</a>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {previews.map((p, i) => <img key={i} src={p} alt={`p${i}`} className="w-full rounded-lg border border-zinc-800" />)}
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

function Copy({ text }: { text: string }) {
  const [d, setD] = useState(false);
  return <button onClick={async () => { await navigator.clipboard.writeText(text); setD(true); setTimeout(() => setD(false), 1200); }}
    className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200">{d ? "복사됨" : "복사"}</button>;
}
function Kv({ label, v, multi }: { label: string; v: string; multi?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
      <div className="mb-0.5 flex items-center justify-between"><span className="text-xs text-zinc-400">{label}</span><Copy text={v} /></div>
      <div className={`text-[13px] text-zinc-200 ${multi ? "whitespace-pre-wrap" : ""}`}>{v}</div>
    </div>
  );
}
function LangSel({ language, setLanguage, loading }: { language: string; setLanguage: (v: string) => void; loading: boolean }) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-400">언어
      <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={loading} className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200">
        <option value="en">English</option><option value="ko">한국어</option>
      </select>
    </label>
  );
}
