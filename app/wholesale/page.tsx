"use client";

import { useState } from "react";

interface ShopItem {
  title: string;
  link: string;
  price: number;
  mall: string;
}
interface Analysis {
  keyword: string;
  total: number;
  competition: { level: string; note: string };
  price: { min: number; avg: number; max: number; count: number };
  topItems: ShopItem[];
  trendNote: string;
}
interface Listing {
  productName: string;
  shortDesc: string;
  detail: string;
  metaDescription: string;
  tags: string[];
  keywords: string[];
  promo: string;
  points: string[];
  faq: { q: string; a: string }[];
}

function won(n: number) {
  return n.toLocaleString() + "원";
}

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
    >
      {done ? "복사됨" : "복사"}
    </button>
  );
}

export default function Wholesale() {
  const [keyword, setKeyword] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState<"" | "analyze" | "listing">("");
  const [error, setError] = useState("");

  async function runAnalyze() {
    if (!keyword.trim()) return;
    setLoading("analyze");
    setError("");
    setAnalysis(null);
    setListing(null);
    try {
      const res = await fetch("/api/wholesale/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "분석 실패");
      setAnalysis(data.analysis);
    } catch (e: any) {
      setError(e?.message || "오류");
    } finally {
      setLoading("");
    }
  }

  async function runListing() {
    if (!analysis) return;
    setLoading("listing");
    setError("");
    try {
      const res = await fetch("/api/wholesale/listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "리스팅 생성 실패");
      setListing(data.listing);
    } catch (e: any) {
      setError(e?.message || "오류");
    } finally {
      setLoading("");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <a href="/" className="mb-4 inline-block text-xs text-zinc-500 hover:text-zinc-300">← 홈으로</a>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">🛒 AI 위탁판매 최적화</h1>
        <p className="mt-1 text-sm text-zinc-400">키워드 → 네이버 경쟁·가격·트렌드 분석 → AI 상품 리스팅 생성</p>
      </header>

      {/* 키워드 입력 */}
      <div className="flex gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runAnalyze()}
          placeholder="예: 강아지 간식, 차량용 거치대"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
        />
        <button
          onClick={runAnalyze}
          disabled={!keyword.trim() || loading !== ""}
          className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-40"
        >
          {loading === "analyze" ? "분석 중…" : "분석"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {/* 분석 결과 */}
      {analysis && (
        <section className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="text-xs text-zinc-400">경쟁상품 수</div>
              <div className="mt-1 text-xl font-bold">{analysis.total.toLocaleString()}</div>
              <div className="mt-1 text-xs text-amber-300">경쟁도 {analysis.competition.level}</div>
              <div className="mt-1 text-[11px] text-zinc-500">{analysis.competition.note}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="text-xs text-zinc-400">가격대 (상위 노출 기준)</div>
              <div className="mt-1 text-sm">최저 <b className="text-emerald-300">{won(analysis.price.min)}</b></div>
              <div className="text-sm">평균 {won(analysis.price.avg)}</div>
              <div className="text-sm">최고 {won(analysis.price.max)}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="text-xs text-zinc-400">트렌드 (최근 1년)</div>
              <div className="mt-1 text-sm text-zinc-200">{analysis.trendNote}</div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-2 text-xs font-semibold text-zinc-300">상위 노출 경쟁상품</div>
            <ul className="space-y-1.5">
              {analysis.topItems.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-xs">
                  <a href={it.link} target="_blank" rel="noreferrer" className="truncate text-zinc-300 hover:text-sky-300">
                    {it.title}
                  </a>
                  <span className="shrink-0 text-zinc-500">{won(it.price)} · {it.mall}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={runListing}
            disabled={loading !== ""}
            className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-40"
          >
            {loading === "listing" ? "AI 생성 중…" : "🤖 AI 상품 리스팅 생성"}
          </button>
        </section>
      )}

      {/* AI 리스팅 */}
      {listing && (
        <section className="mt-6 space-y-3">
          <Field label="상품명 (스마트스토어)" value={listing.productName} />
          <Field label="짧은 설명" value={listing.shortDesc} />
          <Field label="상세설명" value={listing.detail} multiline />
          <Field label="홍보문구" value={listing.promo} />
          <Field label="Meta Description" value={listing.metaDescription} />
          <ChipField label="검색태그" items={listing.tags} />
          <ChipField label="검색키워드" items={listing.keywords} />
          <ChipField label="구매포인트" items={listing.points} />
          {listing.faq?.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="mb-2 text-xs font-semibold text-zinc-300">FAQ</div>
              <ul className="space-y-2">
                {listing.faq.map((f, i) => (
                  <li key={i} className="text-xs">
                    <div className="text-zinc-200">Q. {f.q}</div>
                    <div className="text-zinc-400">A. {f.a}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-300">{label}</span>
        <Copy text={value} />
      </div>
      <p className={`text-sm text-zinc-200 ${multiline ? "whitespace-pre-wrap" : ""}`}>{value}</p>
    </div>
  );
}

function ChipField({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-300">{label}</span>
        <Copy text={items.join(", ")} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t, i) => (
          <span key={i} className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300">{t}</span>
        ))}
      </div>
    </div>
  );
}
