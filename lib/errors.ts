// 제공자(OpenAI/Gemini) API 오류를 사용자용 한국어 안내로 변환
export function humanizeError(e: any): string {
  const raw = (e?.message || String(e) || "").toString();
  const m = raw.toLowerCase();

  if (m.includes("billing hard limit") || m.includes("budget")) {
    return "OpenAI 결제 한도(billing limit)에 도달했습니다. platform.openai.com → Settings → Limits에서 한도를 올리거나 잔액을 충전하세요.";
  }
  if (m.includes("insufficient_quota") || m.includes("quota") || m.includes("exceeded your current quota")) {
    return "API 사용 한도/크레딧이 부족합니다. 결제 잔액 또는 사용량 한도를 확인하세요.";
  }
  if (m.includes("incorrect api key") || m.includes("invalid api key") || m.includes("api key not valid") || m.includes("401") || m.includes("unauthorized") || m.includes("permission")) {
    return "API 키가 올바르지 않거나 권한이 없습니다. 화면의 키 입력란에 올바른 키를 넣었는지 확인하세요.";
  }
  if (m.includes("must be verified") || m.includes("organization must be verified")) {
    return "이 모델(gpt-image-1) 사용에는 OpenAI 조직 인증이 필요합니다. platform.openai.com에서 조직 인증을 완료하세요.";
  }
  if (m.includes("rate limit") || m.includes("429") || m.includes("too many requests")) {
    return "요청이 너무 많습니다(rate limit). 잠시 후 다시 시도하거나 동시 생성 수를 줄여보세요.";
  }
  if (m.includes("safety") || m.includes("blocked") || m.includes("content policy")) {
    return "이미지가 안전/콘텐츠 정책에 걸려 거부됐습니다. 다른 사진이나 스타일로 시도해보세요.";
  }
  if (m.includes("timeout") || m.includes("etimedout") || m.includes("network") || m.includes("fetch failed")) {
    return "네트워크 오류 또는 응답 지연입니다. 인터넷 연결을 확인하고 다시 시도하세요.";
  }
  // 키 미설정 등 우리가 던진 메시지는 그대로 노출
  return raw || "알 수 없는 오류가 발생했습니다.";
}
