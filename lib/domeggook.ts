// 도매매(도매꾹) 오픈 API — 공급사 상품 소싱
const BASE = "https://domeggook.com/ssl/api/";

export interface SupplyItem {
  no: string;
  title: string;
  thumb: string;
  supplyPrice: number; // 공급가
  deliveryFee: number; // 배송비
  freeShip: boolean; // 무료배송 여부
  url: string;
}

export interface SupplySearch {
  total: number;
  items: SupplyItem[];
}

// 공급사(위탁판매) 상품 검색
export async function searchSupply(keyword: string, size = 12): Promise<SupplySearch> {
  const key = process.env.DOMEGGOOK_API_KEY;
  if (!key) throw new Error("도매매 API 키가 없습니다 (.env.local의 DOMEGGOOK_API_KEY).");
  const url =
    `${BASE}?ver=4.1&mode=getItemList&aid=${key}&market=supply&om=json` +
    `&sz=${size}&kw=${encodeURIComponent(keyword)}&sort=rd`;
  const res = await fetch(url);
  const d = await res.json();
  if (d.errors) throw new Error(`도매매 검색 실패: ${d.errors.message || d.errors.dmessage}`);
  const header = d.domeggook?.header;
  const raw = d.domeggook?.list?.item;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const items: SupplyItem[] = arr.map((i: any) => {
    const fee = parseInt(i.deli?.fee || "0", 10) || 0;
    return {
      no: String(i.no),
      title: i.title || "",
      thumb: i.thumb || "",
      supplyPrice: parseInt(i.price || "0", 10) || 0,
      deliveryFee: fee,
      freeShip: fee === 0,
      url: i.url || "",
    };
  });
  return { total: header?.numberOfItems || items.length, items };
}

export interface SupplyDetail {
  inventory: number;
  origin: string;        // detail.country
  manufacturer: string;
  categoryPath: string;  // 도매매 카테고리 경로
  categoryCode: string;
  status: string;        // 판매상태
  keywordsDome: string[];// basis.keywords.kw
}

// 상품 상세 (재고/원산지/카테고리/키워드) — 필터 통과 상위 상품에만 호출
export async function getSupplyDetail(no: string): Promise<SupplyDetail> {
  const key = process.env.DOMEGGOOK_API_KEY;
  if (!key) throw new Error("도매매 API 키가 없습니다.");
  const res = await fetch(`${BASE}?ver=4.4&mode=getItemView&aid=${key}&no=${no}&om=json`);
  const j = await res.json();
  if (j.errors) throw new Error(`도매매 상세 실패: ${j.errors.message || j.errors.dmessage}`);
  const d = j.domeggook || j;
  const cat = d.category || {};
  const parents = (cat.parents?.elem || []).map((e: any) => e.name).filter(Boolean);
  const curName = cat.current?.name;
  const path = [...parents, ...(curName ? [curName] : [])].filter(Boolean).join(" > ");
  const kw = d.basis?.keywords?.kw;
  return {
    inventory: parseInt(d.qty?.inventory || "0", 10) || 0,
    origin: d.detail?.country || "",
    manufacturer: d.detail?.manufacturer || "",
    categoryPath: path,
    categoryCode: cat.current?.code || "",
    status: d.basis?.status || "",
    keywordsDome: Array.isArray(kw) ? kw : [],
  };
}
