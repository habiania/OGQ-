// 위탁판매 가격/마진 계산
export interface MarginInput {
  supplyPrice: number; // 도매 공급가
  deliveryFee: number; // 배송비(공급가에 포함되지 않는 경우)
  feeRate: number; // 판매 수수료 % (스마트스토어 등, 예: 6)
  marginRate: number; // 목표 마진 % (예: 30)
  includeShipInPrice: boolean; // 무료배송으로 판매가에 배송비 포함할지
}

export interface MarginResult {
  cost: number; // 원가(공급가 + 포함배송비)
  sellingPrice: number; // 판매가(권장)
  listPrice: number; // 정상가(할인 전 표시가)
  shippingCharge: number; // 고객 청구 배송비(유료배송 시)
  fee: number; // 판매 수수료액
  netProfit: number; // 예상 순이익
  marginRate: number; // 실제 마진율 %
}

// 판매가 = (원가) / (1 - 수수료율 - 목표마진율)  → 수수료·마진 확보
export function calcMargin(input: MarginInput): MarginResult {
  const includedShip = input.includeShipInPrice ? input.deliveryFee : 0;
  const cost = input.supplyPrice + includedShip;
  const f = input.feeRate / 100;
  const m = input.marginRate / 100;
  const denom = Math.max(0.01, 1 - f - m);
  let selling = Math.ceil((cost / denom) / 100) * 100; // 100원 단위 반올림
  const fee = Math.round(selling * f);
  const shippingCharge = input.includeShipInPrice ? 0 : input.deliveryFee;
  const netProfit = selling - cost - fee;
  const listPrice = Math.ceil((selling * 1.25) / 100) * 100; // 정상가 = 판매가 +25% (할인 연출)
  return {
    cost,
    sellingPrice: selling,
    listPrice,
    shippingCharge,
    fee,
    netProfit,
    marginRate: Math.round((netProfit / selling) * 100),
  };
}
