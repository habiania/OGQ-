"use client";

import { useState } from "react";
import { STYLES, getItems, KAKAO_SPEC, type GenMode } from "@/lib/constants";

type Provider = "openai" | "gemini";
type Phase = "idle" | "character" | "stickers" | "finalizing" | "done";

interface StickerItem {
  n: number;
  ko: string;
  b64: string;
}
interface Check {
  label: string;
  ok: boolean;
  detail?: string;
}
interface Report {
  score: number;
  submittable: boolean;
  checks: Check[];
}

export default function StickerTool() {
  const [mode, setMode] = useState<GenMode>("ogq");
  const [count, setCount] = useState<number>(24); // 카카오 전용 (24/32/40)
  const [provider] = useState<Provider>("openai");
  const apiKey = ""; // 키는 .env.local에서 사용 (UI 입력칸 제거)
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [styleId, setStyleId] = useState<string>("cute");
  const [subject, setSubject] = useState<string>("");

  const itemCount = mode === "kakao" ? count : 24;
  const square = mode === "kakao"; // 카카오는 360x360 정사각

  const [phase, setPhase] = useState<Phase>("idle");
  const [jobId, setJobId] = useState<string>("");
  const [character, setCharacter] = useState<string>("");
  const [stickers, setStickers] = useState<StickerItem[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [meta, setMeta] = useState<{ title: string; keywords: string[] } | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [regenN, setRegenN] = useState<number | null>(null);
  const busy = phase !== "idle" && phase !== "done";
  const done = stickers.length;

  // 이상하게 나온 스티커 1장만 다시 생성 (다리 5개 등)
  async function regenerate(n: number) {
    if (!jobId || regenN !== null) return;
    setRegenN(n);
    setError("");
    try {
      const res = await fetch("/api/sticker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, provider, emotionIndex: n - 1, mode, count, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "재생성 실패");
      setStickers((prev) =>
        prev.map((s) => (s.n === n ? { n: data.n, ko: data.ko, b64: data.stickerB64 } : s))
      );
    } catch (e: any) {
      setError(e?.message || "재생성 중 오류");
    } finally {
      setRegenN(null);
    }
  }

  function pickFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : "");
  }

  // 업로드 전 브라우저에서 축소 (긴 변 max px). 폰 원본 사진 용량/한도 문제 방지.
  async function downscale(f: File, max = 1280): Promise<Blob> {
    const bitmap = await createImageBitmap(f);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 변환 실패"))), "image/jpeg", 0.9)
    );
  }

  function reset() {
    setPhase("idle");
    setJobId("");
    setCharacter("");
    setStickers([]);
    setReport(null);
    setMeta(null);
    setDownloadUrl("");
    setError("");
  }

  async function run() {
    if (!file) return;
    reset();
    setError("");
    try {
      // 1) 캐릭터 베이스 생성
      setPhase("character");
      const resized = await downscale(file);
      const fd = new FormData();
      fd.append("photo", resized, "photo.jpg");
      fd.append("provider", provider);
      fd.append("style", styleId);
      fd.append("mode", mode);
      fd.append("apiKey", apiKey);
      const cRes = await fetch("/api/character", { method: "POST", body: fd });
      const cData = await cRes.json();
      if (!cRes.ok) throw new Error(cData.error || "캐릭터 생성 실패");
      setJobId(cData.jobId);
      setCharacter(cData.characterB64);

      // 2) 24종 스티커 생성 (병렬 3개 + 1회 재시도)
      setPhase("stickers");
      const collected: StickerItem[] = [];
      const CONCURRENCY = 3;

      const genOne = async (i: number, retry = true): Promise<StickerItem> => {
        const sRes = await fetch("/api/sticker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: cData.jobId, provider, emotionIndex: i, mode, count, apiKey }),
        });
        const sData = await sRes.json();
        if (!sRes.ok) {
          if (retry) return genOne(i, false); // 일시적 실패 1회 재시도
          throw new Error(sData.error || `${i + 1}번 생성 실패`);
        }
        return { n: sData.n, ko: sData.ko, b64: sData.stickerB64 };
      };

      let cursor = 0;
      const worker = async () => {
        while (cursor < itemCount) {
          const i = cursor++;
          const item = await genOne(i);
          collected.push(item);
          collected.sort((a, b) => a.n - b.n); // 완료 순서 무관하게 번호순 표시
          setStickers([...collected]);
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

      // 3) 검수 + 메타 + ZIP
      setPhase("finalizing");
      const fRes = await fetch("/api/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: cData.jobId, provider, styleId, subject, mode, count, apiKey }),
      });
      const fData = await fRes.json();
      if (!fRes.ok) throw new Error(fData.error || "마무리 처리 실패");
      setReport(fData.report);
      setMeta(fData.meta);
      setDownloadUrl(fData.downloadUrl);
      setPhase("done");
    } catch (e: any) {
      setError(e?.message || "오류가 발생했습니다.");
      setPhase("idle");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <a href="/" className="mb-4 inline-block text-xs text-zinc-500 hover:text-zinc-300">← 홈으로</a>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">🎨 AI 스티커 / 이모티콘 메이커</h1>
        <p className="mt-1 text-sm text-zinc-400">
          사진 한 장 → 캐릭터화 →{" "}
          {mode === "kakao"
            ? `${count}종 카카오 이모티콘 → 검수 → ZIP`
            : "24종 감정 스티커 → OGQ 검수 → ZIP"}{" "}
          (개인용)
        </p>
      </header>

      {/* 모드 선택 */}
      <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">생성 모드</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => setMode("ogq")}
              className={`rounded-lg border px-4 py-2 text-sm ${
                mode === "ogq"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              OGQ 스티커 <span className="text-[11px] text-zinc-500">740×640·24종</span>
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setMode("kakao");
                setCount(32);
              }}
              className={`rounded-lg border px-4 py-2 text-sm ${
                mode === "kakao"
                  ? "border-amber-500 bg-amber-500/10 text-amber-300"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              카카오 이모티콘 <span className="text-[11px] text-zinc-500">360×360·SD·과장표정</span>
            </button>
          </div>

          {mode === "kakao" && (
            <div className="flex items-center gap-2 sm:ml-auto">
              <span className="text-xs text-zinc-400">개수</span>
              {KAKAO_SPEC.counts.map((c) => (
                <button
                  key={c}
                  disabled={busy}
                  onClick={() => setCount(c)}
                  className={`rounded-lg border px-3 py-1.5 text-xs ${
                    count === c
                      ? "border-amber-500 bg-amber-500/10 text-amber-300"
                      : "border-zinc-700 text-zinc-400"
                  }`}
                >
                  {c}종{c === 32 ? " (제안표준)" : ""}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 설정 영역 */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">1. 사진 업로드</h2>
          <label className="checker flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-zinc-700">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="preview" className="h-full w-full object-contain" />
            ) : (
              <span className="text-sm text-zinc-500">클릭해서 사진 선택</span>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={busy}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">2. 스타일 선택</h2>
          <div className="grid grid-cols-4 gap-2">
            {STYLES.map((s) => (
              <button
                key={s.id}
                disabled={busy}
                onClick={() => setStyleId(s.id)}
                className={`rounded-lg border px-2 py-3 text-center text-xs transition ${
                  styleId === s.id
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                <div className="font-semibold">{s.name}</div>
                <div className="mt-0.5 text-[10px] text-zinc-500">{s.desc}</div>
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {/* AI는 OpenAI(GPT) 고정, 키는 .env.local 사용 (UI 입력칸 제거) */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
              AI 제공자: <span className="text-sky-300">GPT (OpenAI · 투명배경 ✓)</span>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">주제/이름 (제목 자동생성용, 선택)</label>
              <input
                value={subject}
                disabled={busy}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="예: 콩이, 우리 강아지"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 실행 */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={run}
          disabled={!file || busy}
          className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-40"
        >
          {busy ? "생성 중…" : mode === "kakao" ? `이모티콘 ${count}종 생성하기` : "스티커 세트 생성하기"}
        </button>
        {phase !== "idle" && (
          <button onClick={reset} disabled={busy} className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40">
            초기화
          </button>
        )}
        {busy && (
          <span className="text-xs text-zinc-400">
            {phase === "character" && "캐릭터 생성 중…"}
            {phase === "stickers" && `${done}/${itemCount} 생성 중…`}
            {phase === "finalizing" && "검수 및 ZIP 생성 중…"}
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* 캐릭터 미리보기 */}
      {character && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-zinc-300">캐릭터 베이스</h2>
          <div className="checker inline-block rounded-lg p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={character} alt="character" className="h-40 w-40 object-contain" />
          </div>
        </section>
      )}

      {/* 스티커 그리드 */}
      {stickers.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">
            {mode === "kakao" ? "이모티콘" : "스티커"} ({done}/{itemCount})
          </h2>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
            {stickers.map((s) => (
              <div key={s.n} className="group checker relative rounded-lg p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.b64} alt={s.ko} className={`w-full object-contain ${square ? "aspect-square" : "aspect-[74/64]"}`} />
                {regenN === s.n ? (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-xs text-white">
                    다시 그리는 중…
                  </div>
                ) : (
                  <button
                    onClick={() => regenerate(s.n)}
                    disabled={busy || regenN !== null}
                    title="이 스티커만 다시 생성"
                    className="absolute right-1 top-1 hidden rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] text-white group-hover:block disabled:opacity-40"
                  >
                    🔄 다시
                  </button>
                )}
              </div>
            ))}
            {busy &&
              phase === "stickers" &&
              Array.from({ length: Math.max(0, itemCount - done) }).map((_, i) => (
                <div
                  key={`ph-${i}`}
                  className={`animate-pulse rounded-lg bg-zinc-800/50 ${square ? "aspect-square" : "aspect-[74/64]"}`}
                />
              ))}
          </div>
        </section>
      )}

      {/* 검수 결과 + 다운로드 */}
      {report && meta && (
        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-300">{mode === "kakao" ? "카카오 검수" : "OGQ 검수"}</h2>
              <span
                className={`text-2xl font-bold ${
                  report.submittable ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {report.score}점
              </span>
            </div>
            <p className={`mt-1 text-xs ${report.submittable ? "text-emerald-400" : "text-amber-400"}`}>
              {report.submittable
                ? mode === "kakao"
                  ? "✅ 카카오 제안 규격 충족"
                  : "✅ OGQ 제출 가능"
                : "⚠️ 일부 항목 점검 필요"}
            </p>
            <ul className="mt-3 space-y-1.5">
              {report.checks.map((c) => (
                <li key={c.label} className="flex items-center justify-between text-xs">
                  <span className={c.ok ? "text-zinc-300" : "text-amber-300"}>
                    {c.ok ? "✓" : "✕"} {c.label}
                  </span>
                  <span className="text-zinc-500">{c.detail}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="text-sm font-semibold text-zinc-300">메타데이터 & 다운로드</h2>
            <div className="mt-3 text-sm">
              <div className="text-xs text-zinc-400">제목</div>
              <div className="font-medium">{meta.title}</div>
            </div>
            <div className="mt-3">
              <div className="text-xs text-zinc-400">키워드</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {meta.keywords.map((k) => (
                  <span key={k} className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300">
                    {k}
                  </span>
                ))}
              </div>
            </div>
            {downloadUrl && (
              <a
                href={downloadUrl}
                className="mt-5 inline-block rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-zinc-950"
              >
                ⬇ ZIP 다운로드
              </a>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
