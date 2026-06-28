"use client";

import { useState } from "react";

interface Sourced {
  no: string; origTitle: string; newTitle: string; thumb: string; url: string;
  supplyPrice: number; deliveryFee: number; freeShip: boolean;
  sellPrice: number; normalPrice: number; marginRate: number;
  inventory: number; origin: string; categoryDome: string; naverCategory: string;
  tags: string; description: string; model: string; titleOk: boolean;
}
interface Result {
  keyword: string; target: number; collected: number;
  rejected: { margin: number; banned: number; dup: number; stock: number };
  unmapped: number; noOrigin: number; aiUsed: boolean; items: Sourced[];
}

const won = (n: number) => n.toLocaleString() + "원";

function Copy({ text, label = "복사" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}
      className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200 shrink-0"
    >{done ? "복사됨" : label}</button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-[68px] shrink-0 text-[11px] text-zinc-500 pt-0.5">{label}</span>
      <span className="flex-1 text-sm text-zinc-200 break-words">{value || <span className="text-zinc-600">-</span>}</span>
      {value ? <Copy text={value} /> : null}
    </div>
  );
}

export default function Sourcing() {
  const [keyword, setKeyword] = useState("");
  const [target, setTarget] = useState(12);
  const [useAI, setUseAI] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    if (!keyword.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/sourcing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, target, useAI }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error("서버 응답 시간이 초과됐어요. 목표 개수를 줄이거나 잠시 후 다시 시도하세요."); }
      if (!res.ok) throw new Error(data.error || "소싱 실패");
      setResult(data);
    } catch (e: any) {
      setError(e.message || "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-zinc-100">
      <a href="/" className="text-sm text-zinc-500 hover:text-zinc-300">← 홈</a>
      <h1 className="mt-2 text-2xl font-bold">🛒 상품 소싱 (도매매 → 스마트스토어)</h1>
      <p className="mt-1 text-sm text-zinc-400">
        키워드로 도매매 상품을 수집하고 <b>마진·재고·금지어·중복 필터</b>를 통과한 상품만 골라
        네이버 SEO 상품명·태그·설명·모델명까지 자동 생성합니다. (검수용 — 자동 업로드 없음)
      </p>

      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="text-xs text-zinc-500">검색 키워드</span>
            <input
              value={keyword} onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="예: 강아지 간식"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </label>
          <label className="w-full sm:w-28">
            <span className="text-xs text-zinc-500">목표 개수</span>
            <input
              type="number" min={1} max={20} value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} />
            AI 재작성 (Gemini 무료) — 끄면 규칙기반으로 더 빠름
          </label>
          <button
            onClick={run} disabled={loading || !keyword.trim()}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
          >{loading ? "소싱 중…" : "상품 소싱"}</button>
        </div>
      </div>

      {loading && (
        <p className="mt-4 text-sm text-zinc-500">
          도매매 수집 → 필터 → {useAI ? "AI 재작성" : "규칙 재작성"} 중… (개수에 따라 20~60초 걸릴 수 있어요)
        </p>
      )}
      {error && <p className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}

      {result && (
        <div className="mt-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-zinc-300">
              <span>키워드 <b>{result.keyword}</b></span>
              <span>수집 {result.collected}개</span>
              <span className="text-emerald-400">통과 {result.items.length}개</span>
              <span className="text-zinc-500">
                제외 — 마진 {result.rejected.margin} / 금지어 {result.rejected.banned} / 중복 {result.rejected.dup} / 재고 {result.rejected.stock}
              </span>
              <span className="text-zinc-500">{result.aiUsed ? "AI 재작성됨" : "규칙 재작성"}</span>
            </div>
            {(result.unmapped > 0 || result.noOrigin > 0) && (
              <p className="mt-2 text-xs text-amber-400">
                ⚠ 카테고리 미매핑 {result.unmapped}개 · 원산지 누락 {result.noOrigin}개 — 등록 전 직접 확인하세요.
              </p>
            )}
          </div>

          {result.items.length === 0 && (
            <p className="mt-4 text-sm text-zinc-500">조건을 통과한 상품이 없어요. 키워드를 바꾸거나 목표 개수를 늘려보세요.</p>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {result.items.map((it) => (
              <div key={it.no} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="flex gap-3">
                  {it.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.thumb} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                  ) : <div className="h-20 w-20 shrink-0 rounded-lg bg-zinc-800" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-emerald-900/60 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">마진율 {it.marginRate}%</span>
                      <span className="text-[11px] text-zinc-500">재고 {it.inventory.toLocaleString()}</span>
                      <a href={it.url} target="_blank" rel="noreferrer" className="ml-auto text-[11px] text-sky-400 hover:underline">도매매 ↗</a>
                    </div>
                    <p className="mt-1 text-[12px] leading-snug text-zinc-300 line-clamp-2">{it.newTitle}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-zinc-500">
                      <span>도매 {won(it.supplyPrice)}</span>
                      <span>배송 {it.freeShip ? "무료" : won(it.deliveryFee)}</span>
                      <span className="text-zinc-300">판매 {won(it.sellPrice)}</span>
                      <span className="line-through">{won(it.normalPrice)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 border-t border-zinc-800 pt-3">
                  <p className="text-[11px] font-semibold text-zinc-400">스마트스토어 등록 입력값 (위→아래 순서대로 복붙)</p>
                  <Field label="카테고리" value={it.naverCategory} />
                  {!it.naverCategory && <p className="pl-[76px] text-[11px] text-amber-400">미매핑 — 도매매: {it.categoryDome || "-"} (직접 선택)</p>}
                  <Field label="상품명" value={it.newTitle} />
                  {!it.titleOk && <p className="pl-[76px] text-[11px] text-amber-400">상품명 길이 확인 필요 (50자)</p>}
                  <Field label="판매가" value={String(it.sellPrice)} />
                  <Field label="정상가" value={String(it.normalPrice)} />
                  <p className="pl-[76px] text-[11px] text-zinc-600">정상가 입력 후 즉시할인으로 판매가 만들기</p>
                  <Field label="재고수량" value={String(it.inventory)} />
                  <Field label="대표이미지" value={it.thumb} />
                  <Field label="상세설명" value={it.description} />
                  <Field label="모델명" value={it.model} />
                  <Field label="원산지" value={it.origin} />
                  {!it.origin && <p className="pl-[76px] text-[11px] text-amber-400">원산지 누락 — 도매매 상세에서 직접 확인</p>}
                  <Field label="검색태그" value={it.tags} />
                  <Field label="배송비" value={it.freeShip ? "0" : String(it.deliveryFee)} />
                </div>
              </div>
            ))}
          </div>

          {result.items.length > 0 && (
            <p className="mt-4 text-xs text-zinc-600">
              ※ 가격/마진/원산지/카테고리는 등록 전 반드시 직접 검수하세요. 대표이미지·상세페이지 자동 가공 및 자동 업로드는 하지 않습니다.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
