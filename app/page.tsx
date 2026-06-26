import Link from "next/link";

// 도구를 추가하려면 이 배열에 항목만 추가하면 됩니다.
interface Tool {
  href: string;
  icon: string;
  title: string;
  desc: string;
  status: "ready" | "soon";
}

const TOOLS: Tool[] = [
  {
    href: "/sticker",
    icon: "🎨",
    title: "AI 스티커 / 이모티콘 메이커",
    desc: "사진 한 장으로 OGQ 스티커·카카오 이모티콘 세트를 자동 생성하고 ZIP으로 받기",
    status: "ready",
  },
  {
    href: "/wholesale",
    icon: "🛒",
    title: "AI 위탁판매 최적화",
    desc: "키워드 → 네이버 경쟁·가격·트렌드 분석 → AI 상품명/상세페이지/SEO 리스팅 생성",
    status: "ready",
  },
  {
    href: "/kdp",
    icon: "📚",
    title: "AI KDP 북 스튜디오",
    desc: "목차 입력 → AI 집필 → KDP 메타데이터 → PDF 다운로드 (아마존 전자책)",
    status: "ready",
  },
];

export default function Hub() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold">⚡ AI 툴박스</h1>
        <p className="mt-2 text-sm text-zinc-400">필요한 도구를 골라 쓰세요. 도구는 계속 추가됩니다.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map((t) =>
          t.status === "ready" ? (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 transition hover:border-emerald-500/60 hover:bg-zinc-900"
            >
              <div className="mb-3 text-3xl">{t.icon}</div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-100">{t.title}</h2>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  사용 가능
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{t.desc}</p>
              <span className="mt-4 inline-block text-xs text-emerald-400 group-hover:translate-x-0.5">
                열기 →
              </span>
            </Link>
          ) : (
            <div
              key={t.href}
              className="cursor-not-allowed rounded-2xl border border-zinc-800/60 bg-zinc-900/20 p-6 opacity-60"
            >
              <div className="mb-3 text-3xl grayscale">{t.icon}</div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-300">{t.title}</h2>
                <span className="rounded-full bg-zinc-700/40 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                  준비중
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{t.desc}</p>
            </div>
          )
        )}
      </div>

      <footer className="mt-12 text-center text-[11px] text-zinc-600">개인용 · 로그인 필요</footer>
    </main>
  );
}
