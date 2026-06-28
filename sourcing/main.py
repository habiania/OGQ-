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
import sqlite3
import sys
import time
from datetime import datetime

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


def db():
    conn = sqlite3.connect(config.DB_PATH)
    conn.execute(SCHEMA)
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


def show():
    conn = db()
    rows = conn.execute("SELECT item_no, orig_title, dome_price, delivery_fee, inventory, origin, category_dome FROM products ORDER BY collected_at DESC LIMIT 50").fetchall()
    conn.close()
    if not rows:
        print("저장된 상품이 없습니다. 먼저 'python main.py collect' 실행.")
        return
    print(f"\n저장된 상품 {len(rows)}개 (최근순, 최대 50):\n")
    for r in rows:
        print(f"- {r[0]} | {r[1][:30]} | 도매 {r[2]}원 + 배송 {r[3]}원 | 재고 {r[4]} | {r[5] or '원산지미확인'} | {r[6] or '카테고리없음'}")


def main():
    ap = argparse.ArgumentParser(description="도매매 → 스마트스토어 소싱 파이프라인")
    sub = ap.add_subparsers(dest="cmd")

    c = sub.add_parser("collect", help="1단계: 도매매 상품 수집 → SQLite")
    c.add_argument("--kw", default=config.SEARCH_KEYWORD, help="검색 키워드(쉼표로 여러개)")
    c.add_argument("--target", type=int, default=config.DAILY_TARGET * config.CANDIDATE_MULTIPLIER,
                   help="수집할 후보 수 (기본 DAILY_TARGET×CANDIDATE_MULTIPLIER)")

    sub.add_parser("show", help="수집된 상품 요약 출력")

    for name in ("filter", "rewrite", "build"):
        sub.add_parser(name, help=f"(다음 단계) {name}")

    args = ap.parse_args()
    if args.cmd == "collect":
        collect(args.kw, args.target)
    elif args.cmd == "show":
        show()
    elif args.cmd in ("filter", "rewrite", "build"):
        print(f"'{args.cmd}' 단계는 아직 구현 전입니다. 1단계(collect) 확인 후 순서대로 진행합니다.")
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
