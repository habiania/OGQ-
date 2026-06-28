"""설정값. 민감정보는 .env 로만 관리하고 여기엔 하드코딩하지 않는다."""
import os
from dotenv import load_dotenv

load_dotenv()

# ---- 비밀키 (.env) ----
DOMEGGOOK_API_KEY = os.getenv("DOMEGGOOK_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ---- 수집 ----
SEARCH_KEYWORD = os.getenv("SEARCH_KEYWORD", "강아지 간식")  # 쉼표로 여러 키워드
DAILY_TARGET = 20          # 하루 검수 통과 목표 수량
CANDIDATE_MULTIPLIER = 3   # 후보 = 목표 × 배수
PER_PAGE = 50              # 도매매 getItemList 페이지당 개수

# ---- 가격/마진 ----
FEE_RATE = 0.06               # 판매 수수료율 (예: 스마트스토어 6%)
TARGET_MARGIN_RATE = 0.30     # 목표 마진율 (판매가 책정)
NORMAL_PRICE_MULTIPLIER = 3.0 # 정상가 = 도매가 × 배수 (할인 연출용)
# 판매가 = (도매가 + 배송비) / (1 - 수수료율 - 목표마진율), 100원 단위 반올림

# ---- 경로 ----
DB_PATH = os.path.join(os.path.dirname(__file__), "sourcing.db")
BANNED_KEYWORDS_FILE = os.path.join(os.path.dirname(__file__), "banned_keywords.txt")
CATEGORY_MAP_FILE = os.path.join(os.path.dirname(__file__), "category_map.csv")

# ---- 도매매 API ----
DOMEGGOOK_BASE = "https://domeggook.com/ssl/api/"
MARKET = "supply"  # 공급사(위탁판매)용
