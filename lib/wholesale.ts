import { ShopItem, ShopSearch, TrendPoint } from "./naver";

export interface PriceStats {
  min: number;
  avg: number;
  max: number;
  count: number;
}

export interface Analysis {
  keyword: string;
  total: number; // 경쟁상품 수
  competition: { level: "낮음" | "보통" | "높음" | "매우높음"; note: string };
  price: PriceStats;
  topItems: ShopItem[];
  trend: TrendPoint[];
  trendNote: string;
}

function priceStats(items: ShopItem[]): PriceStats {
  const prices = items.map((i) => i.price).filter((p) => p > 0);
  if (!prices.length) return { min: 0, avg: 0, max: 0, count: 0 };
  const sum = prices.reduce((a, b) => a + b, 0);
  return {
    min: Math.min(...prices),
    avg: Math.round(sum / prices.length),
    max: Math.max(...prices),
    count: prices.length,
  };
}

function competition(total: number) {
  if (total < 1000) return { level: "낮음" as const, note: "경쟁이 적어 진입하기 좋습니다." };
  if (total < 50000) return { level: "보통" as const, note: "적절한 경쟁 수준입니다." };
  if (total < 500000) return { level: "높음" as const, note: "경쟁이 치열합니다. 차별화가 필요합니다." };
  return { level: "매우높음" as const, note: "포화 시장입니다. 세부 키워드(롱테일)를 노리세요." };
}

function trendNote(trend: TrendPoint[]): string {
  if (trend.length < 2) return "트렌드 데이터 없음";
  const first = trend[0].ratio;
  const last = trend[trend.length - 1].ratio;
  const peak = trend.reduce((a, b) => (b.ratio > a.ratio ? b : a));
  const dir = last > first * 1.15 ? "상승세 📈" : last < first * 0.85 ? "하락세 📉" : "보합";
  return `최근 추이 ${dir} · 최고점 ${peak.period}`;
}

export function analyze(keyword: string, search: ShopSearch, trend: TrendPoint[]): Analysis {
  return {
    keyword,
    total: search.total,
    competition: competition(search.total),
    price: priceStats(search.items),
    topItems: search.items.slice(0, 8),
    trend,
    trendNote: trendNote(trend),
  };
}
