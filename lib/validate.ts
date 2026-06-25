import { OGQ_SPEC } from "./constants";

export interface PngInfo {
  width: number;
  height: number;
  hasTransparent: boolean;
  bytes: number;
}

export interface CheckResult {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface ValidationReport {
  score: number;
  submittable: boolean;
  checks: CheckResult[];
}

// 24장 스티커 + 대표 + 탭 검수
export function validate(stickers: PngInfo[], main?: PngInfo, tab?: PngInfo): ValidationReport {
  const checks: CheckResult[] = [];
  const S = OGQ_SPEC.sticker;

  // 1. 개수
  checks.push({
    label: "스티커 24개 충족",
    ok: stickers.length === S.count,
    detail: `${stickers.length}/${S.count}`,
  });

  // 2. 해상도(740x640)
  const wrongSize = stickers.filter((s) => s.width !== S.width || s.height !== S.height);
  checks.push({
    label: `해상도 ${S.width}x${S.height}`,
    ok: wrongSize.length === 0,
    detail: wrongSize.length ? `${wrongSize.length}장 규격 불일치` : "전부 일치",
  });

  // 3. 투명 배경
  const opaque = stickers.filter((s) => !s.hasTransparent);
  checks.push({
    label: "투명 배경",
    ok: opaque.length === 0,
    detail: opaque.length ? `${opaque.length}장 배경 불투명` : "전부 투명",
  });

  // 4. 용량 (각 1MB 이하)
  const tooBig = stickers.filter((s) => s.bytes > OGQ_SPEC.maxFileBytes);
  checks.push({
    label: "파일당 1MB 이하",
    ok: tooBig.length === 0,
    detail: tooBig.length ? `${tooBig.length}장 용량 초과` : "전부 적정",
  });

  // 5. 손상/빈 파일
  const broken = stickers.filter((s) => s.bytes < 1000 || s.width === 0);
  checks.push({
    label: "손상 파일 없음",
    ok: broken.length === 0,
    detail: broken.length ? `${broken.length}장 의심` : "이상 없음",
  });

  // 6. 대표 이미지 규격
  checks.push({
    label: `대표 이미지 ${OGQ_SPEC.main.width}x${OGQ_SPEC.main.height}`,
    ok: !!main && main.width === OGQ_SPEC.main.width && main.height === OGQ_SPEC.main.height,
    detail: main ? `${main.width}x${main.height}` : "없음",
  });

  // 7. 탭 이미지 규격
  checks.push({
    label: `탭 이미지 ${OGQ_SPEC.tab.width}x${OGQ_SPEC.tab.height}`,
    ok: !!tab && tab.width === OGQ_SPEC.tab.width && tab.height === OGQ_SPEC.tab.height,
    detail: tab ? `${tab.width}x${tab.height}` : "없음",
  });

  const passed = checks.filter((c) => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  const submittable = checks.every((c) => c.ok);
  return { score, submittable, checks };
}

import { KAKAO_SPEC } from "./constants";

// 카카오 이모티콘 검수 (360x360, 선택 개수, 투명, 150KB, 썸네일)
export function validateKakao(items: PngInfo[], count: number, thumb?: PngInfo): ValidationReport {
  const checks: CheckResult[] = [];
  const K = KAKAO_SPEC.item;

  checks.push({ label: `이모티콘 ${count}개 충족`, ok: items.length === count, detail: `${items.length}/${count}` });

  const wrongSize = items.filter((s) => s.width !== K.width || s.height !== K.height);
  checks.push({
    label: `해상도 ${K.width}x${K.height}`,
    ok: wrongSize.length === 0,
    detail: wrongSize.length ? `${wrongSize.length}장 불일치` : "전부 일치",
  });

  const opaque = items.filter((s) => !s.hasTransparent);
  checks.push({ label: "투명 배경", ok: opaque.length === 0, detail: opaque.length ? `${opaque.length}장 불투명` : "전부 투명" });

  const tooBig = items.filter((s) => s.bytes > KAKAO_SPEC.maxFileBytes);
  checks.push({
    label: "파일당 150KB 이하",
    ok: tooBig.length === 0,
    detail: tooBig.length ? `${tooBig.length}장 초과` : "전부 적정",
  });

  const broken = items.filter((s) => s.bytes < 500 || s.width === 0);
  checks.push({ label: "손상 파일 없음", ok: broken.length === 0, detail: broken.length ? `${broken.length}장 의심` : "이상 없음" });

  checks.push({
    label: `썸네일 ${KAKAO_SPEC.thumb.width}x${KAKAO_SPEC.thumb.height}`,
    ok: !!thumb && thumb.width === KAKAO_SPEC.thumb.width && thumb.height === KAKAO_SPEC.thumb.height,
    detail: thumb ? `${thumb.width}x${thumb.height}` : "없음",
  });

  const passed = checks.filter((c) => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  const submittable = checks.every((c) => c.ok);
  return { score, submittable, checks };
}
