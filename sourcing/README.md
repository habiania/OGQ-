# 도매매 → 스마트스토어 소싱 파이프라인

도매매(도매꾹) 오픈 API로 상품을 수집 → 필터 → 네이버 SEO 상품명 재작성 →
**검수용 정적 HTML 대시보드**로 출력하는 파이프라인. (자동 업로드 없음 — 검수까지만)

## 단계
1. **수집(collect)** ✅ 구현됨 — 도매매 상품을 SQLite에 저장
2. 필터(filter) — 마진/재고/금지키워드/중복 (다음 단계)
3. 상품명 재작성(rewrite) — 네이버 SEO 규칙 (다음 단계)
4. 검수 HTML(build) — `review_YYYYMMDD.html` (다음 단계)

## 설치
```bash
cd sourcing
python -m venv venv && venv\Scripts\activate   # (선택) 가상환경
pip install -r requirements.txt
cp .env.example .env        # Windows: copy .env.example .env
# .env 에 DOMEGGOOK_API_KEY 입력
```

## 실행 (1단계)
```bash
python main.py collect                          # .env의 SEARCH_KEYWORD로 수집
python main.py collect --kw "차량용 거치대" --target 60
python main.py show                             # 수집 결과 확인
```

## 저장 필드 (도매매 실제 API 응답 기준, 검증됨)
상품번호·원본상품명·도매가(`price.supply`)·배송비(`deli.supply.fee`)·재고(`qty.inventory`)·
옵션(`selectOpt`)·카테고리(`category`)·원산지(`detail.country`)·이미지URL(`thumb`)·
상세설명(`desc.contents`)·도매매 키워드(`basis.keywords.kw`)·판매상태

## 설정 (config.py)
- `DAILY_TARGET=20`, `CANDIDATE_MULTIPLIER=3` (후보 = 목표×3)
- `FEE_RATE`(수수료율), `TARGET_MARGIN_RATE`(목표마진), `NORMAL_PRICE_MULTIPLIER`(정상가 배수)

## 파일
- `main.py` — 단계별 실행
- `config.py` — 설정 (비밀키는 .env)
- `.env.example` — 환경변수 템플릿
- `banned_keywords.txt` — 금지 키워드
- `category_map.csv` — 도매매→네이버 카테고리 매핑
- `requirements.txt`

## 안 하는 것 (의도적)
- 스마트스토어 자동 업로드 / 대표이미지·상세페이지 자동 가공 / API 키 하드코딩
