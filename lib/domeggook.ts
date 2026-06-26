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
