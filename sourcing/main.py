"""
도매매 → 스마트스토어 소싱 파이프라인
1단계: 수집 (도매매 오픈 API → SQLite)

사용법:
  python main.py collect                 # 키워드(.env SEARCH_KEYWORD)로 후보 수집
  python main.py collect --kw "차량용 거치대" --target 60
  python main.py show                     # 수집된 상품 요약 보기

다음 단계(미구현): filter / rewrite / build (검수 HTML)
"""
import argparse
import json
import math
import re
import sqlite3
import sys
import time
from datetime import datetime
from difflib import SequenceMatcher

import requests

import config

# Windows 콘솔(cp949)에서 한글/특수문자 출력 깨짐 방지
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass


# ---------------- 도매매 API ----------------
def api(params: dict) -> dict:
    if not config.DOMEGGOOK_API_KEY:
        sys.exit("[오류] DOMEGGOOK_API_KEY 가 없습니다. .env 를 확인하세요 (.env.example 참고).")
    p = {"aid": config.DOMEGGOOK_API_KEY, "om": "json", **params}
    r = requests.get(config.DOMEGGOOK_BASE, params=p, timeout=20)
    r.raise_for_status()
    d = r.json()
    if isinstance(d, dict) and d.get("errors"):
        raise RuntimeError(f"도매매 API 오류: {d['errors'].get('message')} ({d['errors'].get('dcode')})")
    return d


def get_item_list(keyword: str, page: int):
    return api({"ver": "4.1", "mode": "getItemList", "market": config.MARKET,
                "sz": config.PER_PAGE, "kw": keyword, "so": "rd", "pg": page})


def get_item_view(no: str):
    return api({"ver": "4.4", "mode": "getItemView", "no": no})


# ---------------- DB ----------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
  item_no TEXT PRIMARY KEY,         -- 도매매 상품ID
  orig_title TEXT,                  -- 원본 상품명
  dome_price INTEGER,               -- 도매가(공급가)
  delivery_fee INTEGER,             -- 배송비
  delivery_type TEXT,               -- 배송비 유형
  inventory INTEGER,                -- 재고
  options TEXT,                     -- 옵션 요약
  category_dome TEXT,               -- 도매매 카테고리 경로
  category_code TEXT,               -- 도매매 카테고리 코드
  origin TEXT,                      -- 원산지(detail.country)
  manufacturer TEXT,                -- 제조사
  image_url TEXT,                   -- 썸네일 URL
  dome_url TEXT,                    -- 도매매 상세 URL
  detail_html TEXT,                 -- 상세설명 HTML
  dome_keywords TEXT,               -- 도매매 제공 키워드(JSON)
  status TEXT,                      -- 판매상태
  keyword_src TEXT,                 -- 수집에 쓴 키워드
  collected_at TEXT
);
"""


# 2단계(필터/가격)에서 채우는 컬럼 — 기존 DB에도 안전하게 추가
EXTRA_COLS = {
    "sell_price": "INTEGER", "normal_price": "INTEGER", "fee_amount": "INTEGER",
    "margin": "INTEGER", "margin_rate": "REAL", "free_shipping": "INTEGER",
    "passed": "INTEGER", "recommended": "INTEGER", "reject_reason": "TEXT",
    # 3단계(재작성) + 6/7/8
    "new_title": "TEXT", "title_len": "INTEGER", "title_ok": "INTEGER",
    "search_tags": "TEXT", "description": "TEXT", "model_name": "TEXT",
    "naver_category": "TEXT",
}


def db():
    conn = sqlite3.connect(config.DB_PATH)
    conn.execute(SCHEMA)
    for col, typ in EXTRA_COLS.items():
        try:
            conn.execute(f"ALTER TABLE products ADD COLUMN {col} {typ}")
        except sqlite3.OperationalError:
            pass  # 이미 존재
    return conn


def upsert(conn, rec: dict):
    cols = ",".join(rec.keys())
    ph = ",".join(["?"] * len(rec))
    conn.execute(f"INSERT OR REPLACE INTO products ({cols}) VALUES ({ph})", list(rec.values()))


# ---------------- 추출 ----------------
def to_int(v, default=0):
    try:
        return int(float(str(v).replace(",", "")))
    except Exception:
        return default


def summarize_options(select_opt) -> str:
    """selectOpt(JSON 문자열 또는 객체) → 사람이 읽는 요약."""
    if not select_opt:
        return "옵션 없음"
    data = select_opt
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except Exception:
            return "옵션 있음(파싱불가)"
    try:
        sets = data.get("set", [])
        names = []
        for s in sets:
            names += [o for o in s.get("opts", []) if o]
        if not names:
            return "옵션 없음"
        head = ", ".join(names[:6])
        more = f" 외 {len(names) - 6}개" if len(names) > 6 else ""
        return f"{data.get('type', '')} 옵션 {len(names)}종: {head}{more}".strip()
    except Exception:
        return "옵션 있음"


def category_path(category) -> tuple[str, str]:
    try:
        parents = [e.get("name", "") for e in category.get("parents", {}).get("elem", [])]
        cur = category.get("current", {})
        names = parents + ([cur.get("name", "")] if cur.get("name") else [])
        return " > ".join([n for n in names if n]), cur.get("code", "")
    except Exception:
        return "", ""


def extract(list_item: dict, view: dict, keyword: str) -> dict:
    d = view.get("domeggook", view)
    basis = d.get("basis", {})
    price = d.get("price", {})
    deli = d.get("deli", {})
    qty = d.get("qty", {})
    detail = d.get("detail", {})
    desc = d.get("desc", {})
    # 배송비: supply 우선, 없으면 dome
    supply_deli = deli.get("supply") or {}
    dome_deli = deli.get("dome") or {}
    fee = to_int(supply_deli.get("fee", dome_deli.get("fee", 0)))
    dtype = supply_deli.get("type") or dome_deli.get("type") or ""
    cat_path, cat_code = category_path(d.get("category", {}))
    kw = basis.get("keywords", {}).get("kw", []) if isinstance(basis.get("keywords"), dict) else []
    # desc.contents 가 dict/list 로 올 수 있어 문자열로 강제
    contents = desc.get("contents", "") if isinstance(desc, dict) else ""
    if isinstance(contents, (dict, list)):
        contents = json.dumps(contents, ensure_ascii=False)
    rec = {
        "item_no": str(basis.get("no", list_item.get("no", ""))),
        "orig_title": basis.get("title", list_item.get("title", "")),
        "dome_price": to_int(price.get("supply", price.get("dome", list_item.get("price", 0)))),
        "delivery_fee": fee,
        "delivery_type": dtype,
        "inventory": to_int(qty.get("inventory", 0)),
        "options": summarize_options(d.get("selectOpt")),
        "category_dome": cat_path,
        "category_code": cat_code,
        "origin": detail.get("country", ""),
        "manufacturer": detail.get("manufacturer", ""),
        "image_url": list_item.get("thumb", ""),
        "dome_url": list_item.get("url", f"https://domeggook.com/{basis.get('no', '')}"),
        "detail_html": str(contents or ""),
        "dome_keywords": json.dumps(kw, ensure_ascii=False),
        "status": basis.get("status", ""),
        "keyword_src": keyword,
        "collected_at": datetime.now().isoformat(timespec="seconds"),
    }
    # 모든 값이 sqlite 바인딩 가능하도록 dict/list 는 문자열화
    for k, v in rec.items():
        if isinstance(v, (dict, list)):
            rec[k] = json.dumps(v, ensure_ascii=False)
    return rec


# ---------------- 1단계: 수집 ----------------
def collect(keyword: str, target: int):
    keywords = [k.strip() for k in keyword.split(",") if k.strip()]
    conn = db()
    total_saved = 0
    for kw in keywords:
        need = target
        print(f"\n[수집] '{kw}' - 목표 {need}개")
        gathered = []
        page = 1
        while len(gathered) < need:
            data = get_item_list(kw, page)
            header = data.get("domeggook", {}).get("header", {})
            lst = data.get("domeggook", {}).get("list", {}).get("item", [])
            if isinstance(lst, dict):
                lst = [lst]
            if not lst:
                break
            gathered += lst
            pages = to_int(header.get("numberOfPages", 1), 1)
            print(f"  - 목록 페이지 {page}/{pages} ({len(gathered)}개 누적)")
            if page >= pages:
                break
            page += 1
            time.sleep(0.2)
        gathered = gathered[:need]

        for i, it in enumerate(gathered, 1):
            no = it.get("no")
            try:
                view = get_item_view(no)
                rec = extract(it, view, kw)
                upsert(conn, rec)
                total_saved += 1
                print(f"  [{i}/{len(gathered)}] {rec['orig_title'][:28]} | 도매 {rec['dome_price']}원 재고 {rec['inventory']} 원산지 {rec['origin'] or '미확인'}")
            except Exception as e:
                print(f"  [{i}] 상세 수집 실패 (상품 {no}): {e}")
            time.sleep(0.2)
        conn.commit()
    conn.close()
    print(f"\n[완료] 총 {total_saved}개 저장 → {config.DB_PATH}")
    print("다음 단계: python main.py filter  (아직 미구현 - 확인 후 진행)")


# ---------------- 가격 산출 (5단계 일부, 필터에서 사용) ----------------
def ceil100(x: float) -> int:
    return int(math.ceil(x / 100.0)) * 100


def compute_price(dome: int, fee: int):
    if config.PRICING_METHOD == "margin":
        denom = max(0.05, 1 - config.FEE_RATE - config.TARGET_MARGIN_RATE)
        sell = ceil100((dome + fee) / denom)
    else:  # multiplier
        sell = ceil100(dome * config.SELL_MULTIPLIER)
    fee_amt = round(sell * config.FEE_RATE)
    margin = sell - dome - fee - fee_amt
    rate = (margin / sell) if sell else 0.0
    normal = max(ceil100(dome * config.NORMAL_PRICE_MULTIPLIER), ceil100(sell * 1.25))
    return sell, normal, fee_amt, margin, rate


# ---------------- 2단계: 필터 ----------------
def load_banned():
    try:
        with open(config.BANNED_KEYWORDS_FILE, encoding="utf-8") as f:
            return [ln.strip() for ln in f if ln.strip() and not ln.strip().startswith("#")]
    except FileNotFoundError:
        return []


def norm_title(t: str) -> str:
    return re.sub(r"[^0-9a-z가-힣]", "", (t or "").lower())


def filter_products():
    banned = load_banned()
    conn = db()
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM products").fetchall()
    if not rows:
        print("수집된 상품이 없습니다. 먼저 'python main.py collect'.")
        return

    seen_norm: list[str] = []
    counts = {"재고없음": 0, "금지키워드": 0, "마진미달": 0, "중복": 0, "통과": 0}
    for r in rows:
        dome, fee = r["dome_price"] or 0, r["delivery_fee"] or 0
        sell, normal, fee_amt, margin, rate = compute_price(dome, fee)
        reason = None
        if (r["inventory"] or 0) <= 0 or "품절" in (r["status"] or ""):
            reason = "재고없음"
        elif any(b in (r["orig_title"] or "") for b in banned):
            reason = "금지키워드"
        elif rate < config.MIN_MARGIN_RATE:
            reason = "마진미달"
        else:
            n = norm_title(r["orig_title"])
            if any(SequenceMatcher(None, n, s).ratio() >= config.DEDUP_SIMILARITY for s in seen_norm):
                reason = "중복"
            else:
                seen_norm.append(n)
        passed = 1 if reason is None else 0
        counts[reason or "통과"] += 1
        conn.execute(
            "UPDATE products SET sell_price=?, normal_price=?, fee_amount=?, margin=?, margin_rate=?, free_shipping=?, passed=?, recommended=0, reject_reason=? WHERE item_no=?",
            (sell, normal, fee_amt, margin, round(rate, 4), 1 if fee == 0 else 0, passed, reason, r["item_no"]),
        )
    conn.commit()

    # 통과분 중 마진율 상위 DAILY_TARGET → 오늘 등록 추천
    top = conn.execute(
        "SELECT item_no FROM products WHERE passed=1 ORDER BY margin_rate DESC, margin DESC LIMIT ?",
        (config.DAILY_TARGET,),
    ).fetchall()
    for t in top:
        conn.execute("UPDATE products SET recommended=1 WHERE item_no=?", (t["item_no"],))
    conn.commit()
    conn.close()

    print(f"\n[필터 결과] 가격방식={config.PRICING_METHOD}, 최소마진율={int(config.MIN_MARGIN_RATE*100)}%")
    print(f"  통과 {counts['통과']} / 제외: 재고없음 {counts['재고없음']}, 금지키워드 {counts['금지키워드']}, 마진미달 {counts['마진미달']}, 중복 {counts['중복']}")
    print(f"  → '오늘 등록 추천' {len(top)}개 선정 (마진율 상위)")
    print("다음 단계: python main.py rewrite (상품명 재작성) — 확인 후 진행")


# ---------------- 3단계: 상품명 재작성 (+태그/디스크립션/모델명) ----------------
def sanitize_title(t: str, remove_words: list[str]) -> str:
    """네이버 SEO 하드 규칙 강제: 공급사/홍보어 제거, 허용 특수문자만, 중복단어 제거, 50자."""
    t = t or ""
    for w in remove_words:
        if w:
            t = re.sub(re.escape(w), " ", t, flags=re.IGNORECASE)
    t = "".join(ch for ch in t if ch.isalnum() or ch in config.ALLOWED_TITLE_CHARS)
    words, seen, out = t.split(), set(), []
    for w in words:
        lw = w.lower()
        if lw and lw not in seen:
            seen.add(lw)
            out.append(w)
    t = re.sub(r"\s+", " ", " ".join(out)).strip()
    if len(t) > config.TITLE_MAX_LEN:
        cut = t[:config.TITLE_MAX_LEN]
        t = cut[:cut.rfind(" ")] if " " in cut else cut
    return t.strip()


def gemini_json(prompt: str) -> dict:
    key = config.GEMINI_API_KEY
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"responseMimeType": "application/json"}}
    last = None
    for attempt in range(4):  # 429(레이트리밋) 점증 재시도
        r = requests.post(url, json=body, timeout=40)
        if r.status_code == 429:
            last = "429 rate limit"
            time.sleep(3 * (attempt + 1))
            continue
        r.raise_for_status()
        txt = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(txt)
    raise RuntimeError(last or "Gemini 호출 실패")


def rewrite(force_rule: bool = False):
    use_gemini = bool(config.GEMINI_API_KEY) and not force_rule
    promo = load_banned()
    conn = db()
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM products WHERE passed=1 ORDER BY recommended DESC, margin_rate DESC").fetchall()
    if not rows:
        print("통과 상품이 없습니다. 먼저 'python main.py filter'.")
        return
    print(f"[재작성] {len(rows)}개 · 방식={'Gemini(무료)' if use_gemini else '규칙기반'}")
    for i, r in enumerate(rows, 1):
        orig = r["orig_title"] or ""
        remove_words = promo + [r["manufacturer"] or ""]
        title = tags = desc = model = ""
        if use_gemini:
            try:
                kw = ", ".join(json.loads(r["dome_keywords"] or "[]")[:10])
                prompt = (
                    "너는 네이버 스마트스토어 SEO 전문가다. 아래 도매 원본 상품명을 네이버 규칙에 맞게 재작성하라.\n"
                    f"원본: {orig}\n참고 키워드: {kw}\n카테고리: {r['category_dome']}\n\n"
                    "규칙: 50자 이내, 핵심키워드를 앞쪽에. 홍보문구(특가/최저가/무료배송/사은품/이벤트) 금지. "
                    "공급사/브랜드명 제거. 키워드 도배 금지. 구조=핵심키워드+세부키워드+핵심속성.\n"
                    "또한 상품명에 못 넣은 연관 검색태그 최대 10개, 2~3문장 상품 설명, 스토어 전용 모델명(공급사코드 금지)도 생성.\n"
                    'JSON으로만: {"title":"","tags":["",""],"description":"","model":""}'
                )
                p = gemini_json(prompt)
                title = sanitize_title(p.get("title", orig), remove_words)
                tags = ", ".join((p.get("tags") or [])[:10])
                desc = p.get("description", "")
                model = p.get("model", "")
            except Exception as e:
                print(f"  [{i}] Gemini 실패 → 규칙기반 ({e})")
        if not title:  # 규칙기반(기본/폴백)
            title = sanitize_title(orig, remove_words)
            tags = ", ".join(json.loads(r["dome_keywords"] or "[]")[:10])
            desc = f"{title} 상품입니다. 실용적이고 활용도가 높습니다."
            model = f"ST-{(r['item_no'] or '')[-6:]}"
        ok = 1 if (0 < len(title) <= config.TITLE_MAX_LEN) else 0
        conn.execute(
            "UPDATE products SET new_title=?, title_len=?, title_ok=?, search_tags=?, description=?, model_name=? WHERE item_no=?",
            (title, len(title), ok, tags, desc, model, r["item_no"]),
        )
        print(f"  [{i}/{len(rows)}] {orig[:22]} → {title} ({len(title)}자)")
        if use_gemini:
            time.sleep(0.3)
    conn.commit()
    conn.close()
    print("다음 단계: python main.py build (검수 HTML) — 확인 후 진행")


def show(recommended_only: bool = False):
    conn = db()
    conn.row_factory = sqlite3.Row
    where = "WHERE recommended=1" if recommended_only else ""
    rows = conn.execute(f"SELECT * FROM products {where} ORDER BY recommended DESC, margin_rate DESC, collected_at DESC LIMIT 60").fetchall()
    conn.close()
    if not rows:
        print("표시할 상품이 없습니다. collect / filter 를 먼저 실행하세요.")
        return
    print(f"\n상품 {len(rows)}개:\n")
    for r in rows:
        sell = r["sell_price"]
        price_part = f"판매 {sell}원(마진 {int((r['margin_rate'] or 0)*100)}%)" if sell else f"도매 {r['dome_price']}원"
        flag = "⭐추천 " if r["recommended"] else ("❌" + (r["reject_reason"] or "") + " " if r["reject_reason"] else "")
        print(f"- {flag}{r['item_no']} | {r['orig_title'][:26]} | {price_part} | 재고 {r['inventory']} | {r['origin'] or '원산지미확인'}")


def main():
    ap = argparse.ArgumentParser(description="도매매 → 스마트스토어 소싱 파이프라인")
    sub = ap.add_subparsers(dest="cmd")

    c = sub.add_parser("collect", help="1단계: 도매매 상품 수집 → SQLite")
    c.add_argument("--kw", default=config.SEARCH_KEYWORD, help="검색 키워드(쉼표로 여러개)")
    c.add_argument("--target", type=int, default=config.DAILY_TARGET * config.CANDIDATE_MULTIPLIER,
                   help="수집할 후보 수 (기본 DAILY_TARGET×CANDIDATE_MULTIPLIER)")

    sp = sub.add_parser("show", help="상품 요약 출력")
    sp.add_argument("--rec", action="store_true", help="오늘 등록 추천만 보기")

    sub.add_parser("filter", help="2단계: 필터 + 가격 산출")
    rw = sub.add_parser("rewrite", help="3단계: 상품명/태그/설명/모델명 재작성")
    rw.add_argument("--rule", action="store_true", help="Gemini 대신 규칙기반만 사용")
    sub.add_parser("build", help="4단계: 검수 HTML (다음 단계)")

    args = ap.parse_args()
    if args.cmd == "collect":
        collect(args.kw, args.target)
    elif args.cmd == "show":
        show(args.rec)
    elif args.cmd == "filter":
        filter_products()
    elif args.cmd == "rewrite":
        rewrite(args.rule)
    elif args.cmd == "build":
        print("'build'(검수 HTML) 단계는 다음에 구현합니다.")
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
