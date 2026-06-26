// 네이버 오픈 API (쇼핑 검색 + 데이터랩 쇼핑인사이트)
const BASE = "https://openapi.naver.com/v1";

function headers() {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) throw new Error("네이버 API 키가 없습니다 (.env.local의 NAVER_CLIENT_ID/SECRET).");
  return { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret };
}

const stripTags = (s: string) => s.replace(/<\/?b>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

export interface ShopItem {
  title: string;
  link: string;
  price: number;
  mall: string;
  brand: string;
  category: string;
}

export interface ShopSearch {
  total: number; // 전체 경쟁상품 수
  items: ShopItem[];
}

// 쇼핑 검색 (경쟁상품 수 + 가격 + 상위 상품)
export async function searchShop(query: string, display = 20): Promise<ShopSearch> {
  const url = `${BASE}/search/shop.json?query=${encodeURIComponent(query)}&display=${display}&sort=sim`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`네이버 검색 실패 (${res.status}): ${t.slice(0, 120)}`);
  }
  const d = await res.json();
  const items: ShopItem[] = (d.items || []).map((i: any) => ({
    title: stripTags(i.title || ""),
    link: i.link || "",
    price: parseInt(i.lprice || "0", 10) || 0,
    mall: i.mallName || "",
    brand: i.brand || i.maker || "",
    category: [i.category1, i.category2, i.category3].filter(Boolean).join(" > "),
  }));
  return { total: d.total || 0, items };
}

// 데이터랩 쇼핑인사이트 — 키워드 월별 클릭 추이 (트렌드/계절성)
export interface TrendPoint {
  period: string;
  ratio: number;
}
export async function shoppingTrend(keyword: string, categoryId = "50000000"): Promise<TrendPoint[]> {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 11);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const body = {
    startDate: fmt(start),
    endDate: fmt(end),
    timeUnit: "month",
    category: categoryId,
    keyword: [{ name: keyword, param: [keyword] }],
    device: "",
    gender: "",
    ages: [],
  };
  const res = await fetch(`${BASE}/datalab/shopping/category/keywords`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return []; // 트렌드는 보조 — 실패해도 분석은 진행
  const d = await res.json();
  return (d.results?.[0]?.data || []).map((p: any) => ({ period: p.period, ratio: p.ratio }));
}
