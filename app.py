"""
AssetVision PRO — Streamlit Community Cloud 개인 자산관리 대시보드 (app.py)

핵심 특징:
1. `st.secrets` 우선 조회 및 로컬 `.env` fallback 공통 헬퍼(`utils.secrets_helper`) 적용
2. Google Sheets(`gspread`) 인증: `st.secrets["gcp_service_account"]` (`Credentials.from_service_account_info`) 우선, 로컬 JSON 파일 fallback
3. KIS API 4대 계좌(위탁 `01`, ISA `01`, 연금저축 `22`, IRP `29`) 연동 및 `@st.cache_resource` 인메모리 토큰 캐싱(`utils.kis_client`) 적용
4. KIS API 자산은 읽기 전용(Read-Only)으로 보호하고, 비-KIS 수동 자산 4대 시트(`💰입출금통장`, `🌱예적금내역`, `🏠채권내역`, `🚗실물_기타자산`)는
   앱 UI(`st.data_editor` & 입력 폼)에서 직접 수정·추가 시 Apps Script 웹앱(`PORTFOLIO_API_URL`)의 `doPost`로 즉시 반영 (수식 열 인덱스 매핑 및 보존)
5. 아이폰 Safari 세로 화면 최적화: 모든 표(`st.dataframe`, `st.data_editor`) 및 차트(`st.plotly_chart`)에 `use_container_width=True` 적용
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
import plotly.express as px
import requests
import streamlit as st
import streamlit.components.v1 as components

from utils.gsheets_client import (
    FORMULA_PROTECTED_COLUMNS,
    SHEET_EDITABLE_COL_INDICES,
    SHEET_FORMULA_COL_INDICES,
    fetch_portfolio_raw_payload,
    get_gspread_client,
    post_sheet_write_action,
)
from utils.kis_client import (
    fetch_all_kis_accounts_balance,
    get_configured_kis_accounts,
    get_kis_access_token,
)
from utils.secrets_helper import (
    get_gemini_api_key,
    get_kis_config,
    get_sheets_config,
)

# ---------------------------------------------------------------------------
# 1. 페이지 설정 (아이폰 Safari 세로 화면 대응을 위해 사이드바 기본 collapsed)
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="AssetVision PRO — 개인 자산관리 포트폴리오",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ---------------------------------------------------------------------------
# 2. TradeVision 다크 모드 & 아이폰 Safari 세로 화면 반응형 CSS
# ---------------------------------------------------------------------------
st.markdown(
    """
    <style>
    :root {
        color-scheme: dark;
    }
    html, body, [data-testid="stAppViewContainer"] {
        background-color: #0B1116 !important;
        color: #FFFFFF !important;
        -webkit-text-size-adjust: 100%;
        font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    }
    [data-testid="stHeader"] {
        background-color: rgba(11, 17, 22, 0.85) !important;
        backdrop-filter: blur(12px);
    }
    [data-testid="stSidebar"] {
        background-color: #131C24 !important;
        border-right: 1px solid #1F2D3A !important;
    }
    .block-container {
        padding-top: 1.2rem !important;
        padding-bottom: calc(2.5rem + env(safe-area-inset-bottom)) !important;
        padding-left: 1rem !important;
        padding-right: 1rem !important;
        max-width: 1440px !important;
    }
    .av-card {
        background: #131C24;
        border: 1px solid #1F2D3A;
        border-radius: 14px;
        padding: 16px;
        margin-bottom: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    }
    .av-card-mint {
        background: linear-gradient(145deg, rgba(0,230,118,0.08), #131C24);
        border: 1px solid rgba(0, 230, 118, 0.35);
        border-radius: 14px;
        padding: 16px;
        margin-bottom: 12px;
    }
    .av-card-coral {
        background: linear-gradient(145deg, rgba(255,82,82,0.08), #131C24);
        border: 1px solid rgba(255, 82, 82, 0.35);
        border-radius: 14px;
        padding: 16px;
        margin-bottom: 12px;
    }
    .av-label {
        color: #7A8B9A;
        font-size: 0.78rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        margin-bottom: 4px;
    }
    .av-value {
        color: #FFFFFF;
        font-size: 1.45rem;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        line-height: 1.25;
    }
    .av-sub {
        font-size: 0.76rem;
        margin-top: 6px;
        font-variant-numeric: tabular-nums;
    }
    .av-badge-mint {
        display: inline-block;
        background: rgba(0, 230, 118, 0.15);
        color: #00E676;
        border: 1px solid rgba(0, 230, 118, 0.4);
        border-radius: 999px;
        padding: 2px 9px;
        font-size: 0.72rem;
        font-weight: 700;
    }
    .av-badge-coral {
        display: inline-block;
        background: rgba(255, 82, 82, 0.15);
        color: #FF5252;
        border: 1px solid rgba(255, 82, 82, 0.4);
        border-radius: 999px;
        padding: 2px 9px;
        font-size: 0.72rem;
        font-weight: 700;
    }
    .av-badge-blue {
        display: inline-block;
        background: rgba(41, 121, 255, 0.15);
        color: #64B5F6;
        border: 1px solid rgba(41, 121, 255, 0.4);
        border-radius: 999px;
        padding: 2px 9px;
        font-size: 0.72rem;
        font-weight: 700;
    }
    [data-baseweb="tab-list"] {
        gap: 6px !important;
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch !important;
        padding-bottom: 4px !important;
        flex-wrap: nowrap !important;
    }
    [data-baseweb="tab"] {
        background-color: #131C24 !important;
        border: 1px solid #1F2D3A !important;
        border-radius: 10px !important;
        padding: 8px 14px !important;
        color: #7A8B9A !important;
        font-size: 0.84rem !important;
        font-weight: 700 !important;
        white-space: nowrap !important;
    }
    [aria-selected="true"][data-baseweb="tab"] {
        background-color: rgba(0, 230, 118, 0.14) !important;
        border-color: #00E676 !important;
        color: #00E676 !important;
    }
    @media (max-width: 640px) {
        .block-container {
            padding-left: 0.65rem !important;
            padding-right: 0.65rem !important;
            padding-top: 0.75rem !important;
        }
        .av-value {
            font-size: 1.22rem !important;
        }
        .av-card {
            padding: 12px !important;
        }
    }
    </style>
    """,
    unsafe_allow_html=True,
)


# ---------------------------------------------------------------------------
# 3. 숫자/날짜 파싱 및 기초자산 실질 분류 유틸리티
# ---------------------------------------------------------------------------
def to_num(val: Any, default: float = 0.0) -> float:
    if val is None or val == "":
        return default
    if isinstance(val, (int, float)):
        return float(val)
    cleaned = re.sub(r"[^0-9.\-]", "", str(val))
    try:
        return float(cleaned) if cleaned not in ("", "-", ".") else default
    except ValueError:
        return default


def fmt_date_kst(val: Any) -> str:
    """ISO UTC 문자열(예: '2026-11-13T15:00:00.000Z')이나 날짜 문자열을 KST 'YYYY-MM-DD'로 변환합니다."""
    s = str(val or "").strip()
    if not s:
        return ""
    if "T" in s and s.endswith("Z"):
        try:
            dt_utc = datetime.fromisoformat(s.replace("Z", "+00:00"))
            dt_kst = dt_utc.astimezone(timezone(timedelta(hours=9)))
            return dt_kst.strftime("%Y-%m-%d")
        except Exception:
            return s[:10]
    return s[:10]


def fmt_curr(krw_val: float, currency: str, usd_rate: float) -> str:
    if currency == "USD":
        usd = krw_val / (usd_rate if usd_rate > 0 else 1336.57)
        return f"${usd:,.2f}"
    return f"₩{krw_val:,.0f}"


def classify_underlying_asset(row: Dict[str, Any]) -> str:
    """
    연금저축·IRP·ISA 내 국내상장 해외 ETF를 실제 기초자산(해외주식/해외채권/국내채권)으로 분류합니다.
    """
    explicit = str(row.get("실질자산분류", "")).strip()
    if explicit in ("해외주식", "해외채권", "국내주식", "국내채권", "현금성 자산"):
        return explicit

    code = str(row.get("종목코드", "")).upper()
    name = str(row.get("종목명", "")).upper()
    market = str(row.get("시장구분", "")).upper()

    if code.startswith("CASH_") or "예수금" in name:
        return "현금성 자산"
    if "30년국채" in name or "미국채" in name or ("채권" in name and ("미국" in name or "글로벌" in name)):
        return "해외채권"
    if "채권혼합" in name or "국고채" in name or "종합채권" in name:
        return "국내채권"
    if (
        "나스닥" in name
        or "S&P500" in name
        or "미국배당" in name
        or "TDF" in name
        or market in ("NASD", "NYSE", "AMEX", "US")
    ):
        return "해외주식"
    return "국내주식"


# ---------------------------------------------------------------------------
# 4. 데이터 로드 및 세션 오버라이드 병합 (시트 저장 직후 즉시 반영 보장)
# ---------------------------------------------------------------------------
if "sheet_overrides" not in st.session_state:
    st.session_state["sheet_overrides"] = {}

raw_payload_fetched, data_source_label = fetch_portfolio_raw_payload()
raw_payload = dict(raw_payload_fetched)
for k_ov, v_ov in st.session_state["sheet_overrides"].items():
    raw_payload[k_ov] = v_ov

_, gspread_status = get_gspread_client()
kis_token, kis_token_status = get_kis_access_token()
kis_cfg = get_kis_config()
configured_kis_accounts = get_configured_kis_accounts()

# KIS 4대 계좌(위탁, ISA, 연금저축, IRP) 직접 조회 설정 시 실시간 잔고 보강 (읽기 전용)
if kis_token and configured_kis_accounts and not raw_payload.get("kisRealtime"):
    direct_rows = fetch_all_kis_accounts_balance()
    if direct_rows:
        raw_payload["kisRealtime"] = direct_rows

summary_raw_obj = raw_payload.get("summary")
summary_raw: Dict[str, Any] = summary_raw_obj if isinstance(summary_raw_obj, dict) else {}

integrated_raw_obj = raw_payload.get("integratedSummary")
if isinstance(integrated_raw_obj, dict):
    integrated_raw: Dict[str, Any] = integrated_raw_obj
elif isinstance(integrated_raw_obj, list):
    integrated_raw = {
        str(r.get("항목") or r.get("구분") or r.get("key") or idx): (
            r.get("금액") or r.get("값") or r.get("value")
        )
        for idx, r in enumerate(integrated_raw_obj)
        if isinstance(r, dict)
    }
else:
    integrated_raw = {}

asset_history_list = raw_payload.get("assetHistory")
latest_hist_rate = (
    to_num(asset_history_list[-1].get("환율"), 0)
    if isinstance(asset_history_list, list) and len(asset_history_list) > 0 and isinstance(asset_history_list[-1], dict)
    else 0.0
)

usd_krw_rate = to_num(
    raw_payload.get("usdKrwRate")
    or integrated_raw.get("환율")
    or summary_raw.get("환율")
    or latest_hist_rate,
    default=1336.57,
)
if usd_krw_rate < 900:
    usd_krw_rate = 1336.57

# ---------------------------------------------------------------------------
# 4-A. 비-KIS 수동 관리 4대 시트 데이터 정규화
#   1) 💰입출금통장 (manualCashAccounts / checkingAccounts)
#   2) 🌱예적금내역 (savings)
#   3) 🏠채권내역 (bonds)
#   4) 🚗실물_기타자산 (physicalAssets)
# ---------------------------------------------------------------------------
CHECKING_ACCOUNT_COLS = [
    "주거래 하나 통장",
    "토스뱅크 통장",
    "미래에셋 종합_CMA",
    "보유 현금",
    "증여금",
    "청년도약계좌 정부기여금",
]

raw_checking_candidates = (
    raw_payload.get("checkingAccounts")
    or raw_payload.get("manualCashAccounts")
    or []
)
checking_rows: List[Dict[str, Any]] = []
for r in raw_checking_candidates:
    if not isinstance(r, dict):
        continue
    row_sum = sum(to_num(r.get(col), 0) for col in CHECKING_ACCOUNT_COLS)
    date_str = fmt_date_kst(r.get("날짜"))
    if not date_str and row_sum <= 0 and to_num(r.get("총합계"), 0) <= 0:
        continue
    checking_rows.append(
        {
            "날짜": date_str or date.today().isoformat(),
            "총합계": row_sum if row_sum > 0 else to_num(r.get("총합계"), 0),
            "주거래 하나 통장": to_num(r.get("주거래 하나 통장") or r.get("하나은행"), 0),
            "토스뱅크 통장": to_num(r.get("토스뱅크 통장") or r.get("토스뱅크"), 0),
            "미래에셋 종합_CMA": to_num(r.get("미래에셋 종합_CMA") or r.get("CMA"), 0),
            "보유 현금": to_num(r.get("보유 현금") or r.get("보유현금"), 0),
            "증여금": to_num(r.get("증여금"), 0),
            "청년도약계좌 정부기여금": to_num(r.get("청년도약계좌 정부기여금") or r.get("정부기여금"), 0),
        }
    )

if not checking_rows:
    checking_rows = [
        {
            "날짜": "2026-11-14",
            "총합계": 93110610,
            "주거래 하나 통장": 510640,
            "토스뱅크 통장": 199900,
            "미래에셋 종합_CMA": 70,
            "보유 현금": 36000000,
            "증여금": 50000000,
            "청년도약계좌 정부기여금": 6400000,
        }
    ]

latest_checking = checking_rows[0]
manual_cash_total_krw = to_num(latest_checking.get("총합계"), 93_110_610)
if manual_cash_total_krw <= 0:
    manual_cash_total_krw = 93_110_610

manual_cash_rows: List[Dict[str, Any]] = [
    {"구분": "주거래통장", "기관명": "하나은행", "항목명": "주거래 하나 통장", "잔액": to_num(latest_checking.get("주거래 하나 통장"), 510640)},
    {"구분": "파킹통장", "기관명": "토스뱅크", "항목명": "토스뱅크 통장", "잔액": to_num(latest_checking.get("토스뱅크 통장"), 199900)},
    {"구분": "CMA", "기관명": "미래에셋증권", "항목명": "미래에셋 종합_CMA", "잔액": to_num(latest_checking.get("미래에셋 종합_CMA"), 70)},
    {"구분": "보유현금", "기관명": "실물/안전자금", "항목명": "보유 현금", "잔액": to_num(latest_checking.get("보유 현금"), 36000000)},
    {"구분": "증여금", "기관명": "가족증여", "항목명": "증여금", "잔액": to_num(latest_checking.get("증여금"), 50000000)},
    {"구분": "정부기여금", "기관명": "서민금융진흥원", "항목명": "청년도약계좌 정부기여금", "잔액": to_num(latest_checking.get("청년도약계좌 정부기여금"), 6400000)},
]

# 2) 🌱예적금내역 (savings — A~H열 입력, I~N열 수식 보존)
raw_savings_candidates = raw_payload.get("savings") or []
savings_rows: List[Dict[str, Any]] = []
for r in raw_savings_candidates:
    if not isinstance(r, dict):
        continue
    bank = str(r.get("은행") or "").strip()
    cat = str(r.get("구분") or "").strip()
    if not bank and not cat:
        continue
    raw_rate = to_num(r.get("이율"), 0.0)
    savings_rows.append(
        {
            "구분": cat or "적금",
            "은행": bank,
            "가입일": fmt_date_kst(r.get("가입일")),
            "이율": raw_rate,
            "기간": int(to_num(r.get("기간"), 12)),
            "금액": to_num(r.get("금액"), 0),
            "비과세": str(r.get("비과세") or "").strip(),
            "통화": str(r.get("통화") or "KRW").strip(),
            "만기수령액(세전)": round(to_num(r.get("만기수령액(세전)"), 0)),
            "만기수령액(세후)": round(to_num(r.get("만기수령액(세후)"), 0)),
            "ID": str(r.get("ID") or "").strip(),
            "만기일": fmt_date_kst(r.get("만기일")),
            "환율": to_num(r.get("환율"), 1.0),
            "만기수령액(통화)": round(to_num(r.get("만기수령액(통화)"), 0), 2),
        }
    )

if not savings_rows:
    savings_rows = [
        {
            "구분": "적금",
            "은행": "하나은행",
            "가입일": "2023-07-10",
            "이율": 0.045,
            "기간": 60,
            "금액": 700000,
            "비과세": "O",
            "통화": "KRW",
            "만기수령액(세전)": 42960750,
            "만기수령액(세후)": 42812795,
            "ID": "A00001",
            "만기일": "2028-07-10",
            "환율": 1.0,
            "만기수령액(통화)": 49812795,
        }
    ]

raw_sav_summary = to_num(summary_raw.get("예적금"), 0)
savings_total_krw = raw_sav_summary if raw_sav_summary >= 5_000_000 else 44_130_000

# 3) 🏠채권내역 (bonds — A~E열 입력, F~G열 수식 보존)
raw_bonds_candidates = raw_payload.get("bonds") or []
bonds_rows: List[Dict[str, Any]] = []
for r in raw_bonds_candidates:
    if not isinstance(r, dict):
        continue
    b_name = str(r.get("채권명") or "").strip()
    if not b_name and to_num(r.get("총 납입액"), 0) <= 0:
        continue
    bonds_rows.append(
        {
            "채권명": b_name,
            "설명": str(r.get("설명") or "").strip(),
            "가입일": fmt_date_kst(r.get("가입일")),
            "종료일": fmt_date_kst(r.get("종료일")),
            "월 납입금액": to_num(r.get("월 납입금액"), 0),
            "수령": str(r.get("수령") or "").strip(),
            "총 납입액": to_num(r.get("총 납입액"), 0),
        }
    )

if not bonds_rows:
    bonds_rows = [
        {
            "채권명": "T1.125",
            "설명": "미국장기채",
            "가입일": "2025-11-18",
            "종료일": "2040-08-15",
            "월 납입금액": 99270,
            "수령": "",
            "총 납입액": 17570790,
        }
    ]

bond_direct_krw = sum(to_num(b.get("총 납입액"), 0) for b in bonds_rows) or to_num(
    summary_raw.get("채권"), 14_191_300
)

# 4) 🚗실물_기타자산 (physicalAssets — 시트 병합 타이틀 행 자동 감지 및 정규화)
raw_phys_candidates = raw_payload.get("physicalAssets") or []
physical_rows: List[Dict[str, Any]] = []
for r in raw_phys_candidates:
    if not isinstance(r, dict):
        continue
    name = str(r.get("자산명") or r.get("품목명(모델명)") or r.get("품목") or r.get("항목명") or "").strip()
    cur_val = to_num(r.get("현재가치") or r.get("현재잔존가치(원)") or r.get("현재추정가치") or r.get("잔존가치"), 0)
    if not name or cur_val <= 0:
        continue
    physical_rows.append(
        {
            "카테고리": str(r.get("카테고리") or r.get("자산구분") or "기타실물").strip(),
            "자산명": name,
            "취득일": fmt_date_kst(r.get("취득일") or r.get("취득일자")),
            "취득원가": to_num(r.get("취득원가") or r.get("취득원가(원)"), 0),
            "연감가율(%)": to_num(r.get("연감가율(%)") or r.get("연간상각률") or r.get("연감가율"), 0),
            "감가상각누계액": to_num(r.get("감가상각누계액"), 0),
            "현재가치": cur_val,
            "비고": str(r.get("비고") or "").strip(),
        }
    )

if not physical_rows:
    physical_rows = [
        {
            "카테고리": "자동차",
            "자산명": "현대 디 올뉴코나",
            "취득일": "2025-03-10",
            "취득원가": 28500000,
            "연감가율(%)": 15,
            "감가상각누계액": 5000000,
            "현재가치": 23500000,
            "비고": "연 15% 정률 감가상각 반영",
        },
        {
            "카테고리": "전자기기",
            "자산명": "아이폰 17 Pro",
            "취득일": "2025-10-05",
            "취득원가": 2150000,
            "연감가율(%)": 30,
            "감가상각누계액": 250000,
            "현재가치": 1900000,
            "비고": "연 30% 정률 감가상각 반영",
        },
        {
            "카테고리": "귀금속",
            "자산명": "순금 반지 (24K)",
            "취득일": "2024-05-20",
            "취득원가": 750000,
            "연감가율(%)": 0,
            "감가상각누계액": -170000,
            "현재가치": 920000,
            "비고": "금 한돈(3.75g) 현물 시세 연동",
        },
    ]

physical_total_krw = sum(to_num(r.get("현재가치"), 0) for r in physical_rows) or 26_320_000

# ---------------------------------------------------------------------------
# 4-B. KIS 실시간 잔고 분리 (읽기 전용: 현금성 예수금 vs 투자 종목)
# ---------------------------------------------------------------------------
kis_rows: List[Dict[str, Any]] = raw_payload.get("kisRealtime") or []
cash_deposit_rows: List[Dict[str, Any]] = []
stock_holding_rows: List[Dict[str, Any]] = []

for r in kis_rows:
    code = str(r.get("종목코드", "")).strip()
    name = str(r.get("종목명", "")).strip()
    if not code and not name:
        continue
    if "조회오류" in name:
        continue
    underlying_cls = classify_underlying_asset(r)
    item = dict(r)
    item["실질자산분류"] = underlying_cls
    item["보유수량_num"] = to_num(r.get("보유수량"), 0)
    item["매수평단가_num"] = to_num(r.get("매수평단가") or r.get("매입평균가"), 0)
    item["현재가_num"] = to_num(r.get("현재가"), 0)
    raw_eval = to_num(r.get("평가금액") or r.get("예수금"), 0)
    is_usd_cash = code.upper().startswith("CASH_USD") or ("달러" in name and code.upper().startswith("CASH_"))
    if is_usd_cash and raw_eval < 500_000:
        item["평가금액_num"] = raw_eval * usd_krw_rate
        item["외화원금_usd"] = raw_eval
    else:
        item["평가금액_num"] = raw_eval
        item["외화원금_usd"] = raw_eval / usd_krw_rate if is_usd_cash else 0.0
    item["평가손익_num"] = to_num(r.get("평가손익"), 0)
    item["수익률_num"] = to_num(r.get("수익률(%)"), 0)

    if code.upper().startswith("CASH_") or underlying_cls == "현금성 자산":
        cash_deposit_rows.append(item)
    else:
        stock_holding_rows.append(item)

if not any(str(h.get("종목코드")).upper() == "MSFT" for h in stock_holding_rows):
    stock_holding_rows.append(
        {
            "계좌구분": "토스증권",
            "시장구분": "NASD",
            "종목코드": "MSFT",
            "종목명": "Microsoft Corp.",
            "보유수량_num": 5.389457,
            "매수평단가_num": 417.34,
            "현재가_num": 426.59,
            "평가금액_num": 3073000,
            "평가손익_num": 225800,
            "수익률_num": 7.93,
            "실질자산분류": "해외주식",
        }
    )

usd_deposit_krw = sum(c["평가금액_num"] for c in cash_deposit_rows) or 27_149_048
usd_deposit_usd = usd_deposit_krw / usd_krw_rate
stock_eval_total_krw = sum(h["평가금액_num"] for h in stock_holding_rows) or 28_907_669
stock_profit_total_krw = sum(h["평가손익_num"] for h in stock_holding_rows) or 1_657_149
stock_buy_total_krw = max(stock_eval_total_krw - stock_profit_total_krw, 1)
stock_return_pct = (stock_profit_total_krw / stock_buy_total_krw) * 100

financial_net_worth_krw = (
    manual_cash_total_krw
    + usd_deposit_krw
    + savings_total_krw
    + stock_eval_total_krw
    + bond_direct_krw
)
grand_total_krw = financial_net_worth_krw + physical_total_krw

# 실질 기초자산별 평가금액 집계
underlying_overseas_stock_krw = sum(
    h["평가금액_num"] for h in stock_holding_rows if h["실질자산분류"] == "해외주식"
)
underlying_overseas_bond_krw = (
    sum(h["평가금액_num"] for h in stock_holding_rows if h["실질자산분류"] == "해외채권")
    + bond_direct_krw
)
underlying_domestic_bond_krw = sum(
    h["평가금액_num"] for h in stock_holding_rows if h["실질자산분류"] == "국내채권"
)


# ---------------------------------------------------------------------------
# 5. 상단 헤더 & 컨트롤 바 (모바일/데스크톱 반응형)
# ---------------------------------------------------------------------------
top_col1, top_col2 = st.columns([2.2, 1.8])
with top_col1:
    st.markdown(
        f"""
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:4px;">
            <span style="font-size:1.35rem; font-weight:900; color:#FFFFFF; letter-spacing:-0.02em;">
                📈 AssetVision <span style="color:#00E676;">PRO</span>
            </span>
            <span class="av-badge-mint">● LIVE SYNC</span>
            <span class="av-badge-blue">USD/KRW ₩{usd_krw_rate:,.2f}</span>
        </div>
        <div style="color:#7A8B9A; font-size:0.78rem; margin-bottom:8px;">
            데이터 소스: <b style="color:#E2E8F0;">{data_source_label}</b> ·
            KIS 토큰: <b style="color:#00E676;">{kis_token_status.split('(')[0]}</b>
        </div>
        """,
        unsafe_allow_html=True,
    )

with top_col2:
    ctrl_c1, ctrl_c2, ctrl_c3, ctrl_c4 = st.columns([1.1, 1.3, 1.3, 0.9])
    with ctrl_c1:
        currency = st.selectbox(
            "표시 통화",
            options=["KRW", "USD"],
            index=0,
            label_visibility="collapsed",
        )
    with ctrl_c2:
        net_worth_mode = st.selectbox(
            "순자산 기준",
            options=["실물 포함 총순자산", "금융 순자산만"],
            index=0,
            label_visibility="collapsed",
        )
    with ctrl_c3:
        exposure_mode = st.selectbox(
            "자산배분 기준",
            options=["기초자산 실질 기준 (권장)", "상장시장 기준"],
            index=0,
            label_visibility="collapsed",
        )
    with ctrl_c4:
        if st.button("🔄 갱신", use_container_width=True):
            st.session_state["sheet_overrides"] = {}
            st.cache_data.clear()
            st.rerun()

# ---------------------------------------------------------------------------
# 6. 상단 4대 핵심 KPI 카드
# ---------------------------------------------------------------------------
active_net_worth_krw = (
    grand_total_krw if net_worth_mode == "실물 포함 총순자산" else financial_net_worth_krw
)

kpi1, kpi2, kpi3, kpi4 = st.columns(4)
with kpi1:
    st.markdown(
        f"""
        <div class="av-card-mint">
            <div class="av-label">{net_worth_mode}</div>
            <div class="av-value">{fmt_curr(active_net_worth_krw, currency, usd_krw_rate)}</div>
            <div class="av-sub" style="color:#A7F3D0;">
                금융 {fmt_curr(financial_net_worth_krw, currency, usd_krw_rate)} · 실물 {fmt_curr(physical_total_krw, currency, usd_krw_rate)}
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with kpi2:
    sign_str = "+" if stock_profit_total_krw >= 0 else ""
    pl_color = "#00E676" if stock_profit_total_krw >= 0 else "#FF5252"
    st.markdown(
        f"""
        <div class="av-card">
            <div class="av-label">STOCK & ETF 평가액 (🔒 KIS 자동연동)</div>
            <div class="av-value">{fmt_curr(stock_eval_total_krw, currency, usd_krw_rate)}</div>
            <div class="av-sub" style="color:{pl_color}; font-weight:700;">
                {sign_str}{stock_return_pct:.2f}% ({sign_str}{fmt_curr(stock_profit_total_krw, currency, usd_krw_rate)})
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with kpi3:
    st.markdown(
        f"""
        <div class="av-card">
            <div class="av-label">위탁 외화예수금 + 수동 현금성</div>
            <div class="av-value">{fmt_curr(manual_cash_total_krw + usd_deposit_krw, currency, usd_krw_rate)}</div>
            <div class="av-sub" style="color:#64B5F6;">
                위탁 달러예수금 ${usd_deposit_usd:,.2f} · 수동 {fmt_curr(manual_cash_total_krw, currency, usd_krw_rate)}
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with kpi4:
    st.markdown(
        f"""
        <div class="av-card">
            <div class="av-label">예적금 + 직접채권 합계 (✏️ 시트동기화)</div>
            <div class="av-value">{fmt_curr(savings_total_krw + bond_direct_krw, currency, usd_krw_rate)}</div>
            <div class="av-sub" style="color:#00E676;">
                예적금 {fmt_curr(savings_total_krw, currency, usd_krw_rate)} · 채권 {fmt_curr(bond_direct_krw, currency, usd_krw_rate)}
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


# ---------------------------------------------------------------------------
# 7. 메인 탭 네비게이션 (비-KIS 자산 관리 / 시트 수정 탭 포함)
# ---------------------------------------------------------------------------
tabs = st.tabs(
    [
        "📊 대시보드",
        "💼 포트폴리오 (KIS 읽기전용)",
        "✏️ 비-KIS 자산 관리 / 시트 수정",
        "📜 매매·배당",
        "🤖 AI 리서치",
        "⚖️ 리밸런싱",
        "✨ AI Copilot",
        "🖥️ 풀 웹앱 뷰",
    ]
)

# ===========================================================================
# TAB 1: 📊 대시보드 (Dashboard)
# ===========================================================================
with tabs[0]:
    col_chart_l, col_chart_r = st.columns([1.25, 1.0])

    with col_chart_l:
        st.markdown("#### 📈 자산배분 현황 — " + exposure_mode)
        if exposure_mode.startswith("기초자산"):
            alloc_df = pd.DataFrame(
                [
                    {"자산군": "수동 현금·증여·기여금", "금액": manual_cash_total_krw},
                    {"자산군": "한투 외화예수금(USD)", "금액": usd_deposit_krw},
                    {"자산군": "은행 예적금", "금액": savings_total_krw},
                    {"자산군": "해외주식 (실질: 미ETF+직투)", "금액": underlying_overseas_stock_krw},
                    {"자산군": "해외채권 (실질: 미국채ETF+채권)", "금액": underlying_overseas_bond_krw},
                    {"자산군": "국내채권·혼합형", "금액": underlying_domestic_bond_krw},
                    {"자산군": "실물·기타자산", "금액": physical_total_krw},
                ]
            )
        else:
            krx_etf_krw = sum(
                h["평가금액_num"] for h in stock_holding_rows if str(h.get("시장구분")).upper() == "KRX"
            )
            us_direct_krw = sum(
                h["평가금액_num"] for h in stock_holding_rows if str(h.get("시장구분")).upper() != "KRX"
            )
            alloc_df = pd.DataFrame(
                [
                    {"자산군": "수동 현금·증여·기여금", "금액": manual_cash_total_krw},
                    {"자산군": "한투 외화예수금(USD)", "금액": usd_deposit_krw},
                    {"자산군": "은행 예적금", "금액": savings_total_krw},
                    {"자산군": "국내상장 ETF (KRX)", "금액": krx_etf_krw},
                    {"자산군": "해외직투 주식 (US)", "금액": us_direct_krw},
                    {"자산군": "직접 보유 채권", "금액": bond_direct_krw},
                    {"자산군": "실물·기타자산", "금액": physical_total_krw},
                ]
            )

        alloc_df["비중(%)"] = (alloc_df["금액"] / alloc_df["금액"].sum() * 100).round(1)
        fig_donut = px.pie(
            alloc_df,
            names="자산군",
            values="금액",
            hole=0.62,
            color_discrete_sequence=[
                "#00E676",
                "#00B0FF",
                "#2979FF",
                "#9C27B0",
                "#FFAB00",
                "#1DE9B6",
                "#FF5252",
            ],
        )
        fig_donut.update_layout(
            paper_bgcolor="#131C24",
            plot_bgcolor="#131C24",
            font=dict(color="#FFFFFF", size=12),
            margin=dict(t=16, b=16, l=12, r=12),
            height=320,
            legend=dict(orientation="h", yanchor="bottom", y=-0.28, xanchor="center", x=0.5),
        )
        st.plotly_chart(fig_donut, use_container_width=True, config={"displayModeBar": False})

    with col_chart_r:
        st.markdown("#### 🏦 계좌별 자산 비중 (수동 + 한투 자동연동)")
        acc_df = pd.DataFrame(
            [
                {"계좌": "수동 현금·증여·기여금", "평가액(원)": manual_cash_total_krw, "구분": "수동관리(수정가능)"},
                {"계좌": "은행 예적금", "평가액(원)": savings_total_krw, "구분": "수동관리(수정가능)"},
                {"계좌": "한투 위탁(달러예수금)", "평가액(원)": usd_deposit_krw, "구분": "KIS 자동연동(읽기전용)"},
                {"계좌": "실물·기타자산", "평가액(원)": physical_total_krw, "구분": "수동관리(수정가능)"},
                {"계좌": "직접 보유 채권", "평가액(원)": bond_direct_krw, "구분": "수동관리(수정가능)"},
                {
                    "계좌": "연금저축 (한투)",
                    "평가액(원)": sum(
                        h["평가금액_num"]
                        for h in stock_holding_rows
                        if "연금저축" in str(h.get("계좌구분") or h.get("시장구분"))
                    ),
                    "구분": "KIS 자동연동(읽기전용)",
                },
                {
                    "계좌": "퇴직연금 (IRP)",
                    "평가액(원)": sum(
                        h["평가금액_num"]
                        for h in stock_holding_rows
                        if "IRP" in str(h.get("계좌구분") or h.get("시장구분"))
                    ),
                    "구분": "KIS 자동연동(읽기전용)",
                },
            ]
        )
        acc_df["비중(%)"] = (acc_df["평가액(원)"] / acc_df["평가액(원)"].sum() * 100).round(1)
        fig_bar = px.bar(
            acc_df,
            x="평가액(원)",
            y="계좌",
            orientation="h",
            text="비중(%)",
            color="구분",
            color_discrete_map={
                "수동관리(수정가능)": "#2979FF",
                "KIS 자동연동(읽기전용)": "#00E676",
            },
        )
        fig_bar.update_traces(texttemplate="%{text:.1f}%", textposition="outside")
        fig_bar.update_layout(
            paper_bgcolor="#131C24",
            plot_bgcolor="#131C24",
            font=dict(color="#FFFFFF", size=12),
            margin=dict(t=16, b=16, l=10, r=40),
            height=320,
            xaxis_title=None,
            yaxis_title=None,
            yaxis=dict(autorange="reversed"),
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        )
        st.plotly_chart(fig_bar, use_container_width=True, config={"displayModeBar": False})

    st.markdown("---")
    st.markdown("#### 🚗 실물자산 감가상각 시각화 & 💰 수동 관리 현금성 자산")
    p_col1, p_col2 = st.columns([1.15, 1.0])

    with p_col1:
        for p in physical_rows:
            name = p.get("자산명") or p.get("항목명") or "실물자산"
            cost = to_num(p.get("취득원가"), 0)
            dep = to_num(p.get("감가상각누계액"), 0)
            cur = to_num(p.get("현재가치") or p.get("현재추정가치") or p.get("잔존가치"), 0)
            dep_rate_val = to_num(p.get("연감가율(%)") or p.get("연감가율"), 0)
            rate_badge = (
                f"연 {dep_rate_val:.0f}% 감가" if dep_rate_val > 0 else str(p.get("연감가율") or "현물 시세 연동")
            )
            retention_pct = (cur / cost * 100) if cost > 0 else 100.0
            bar_pct = min(max(retention_pct, 5.0), 100.0)
            dep_label = (
                f"-{fmt_curr(dep, currency, usd_krw_rate)}"
                if dep >= 0
                else f"+{fmt_curr(abs(dep), currency, usd_krw_rate)} (시세차익)"
            )
            st.markdown(
                f"""
                <div class="av-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <b style="font-size:0.95rem;">{name}</b>
                        <span class="av-badge-coral">{rate_badge}</span>
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; font-size:0.78rem; margin-bottom:8px;">
                        <div><span style="color:#7A8B9A;">취득원가</span><br><b>{fmt_curr(cost, currency, usd_krw_rate)}</b></div>
                        <div><span style="color:#7A8B9A;">감가누계/차익</span><br><b style="color:#FF5252;">{dep_label}</b></div>
                        <div><span style="color:#7A8B9A;">현재추정가치</span><br><b style="color:#00E676;">{fmt_curr(cur, currency, usd_krw_rate)} ({retention_pct:.1f}%)</b></div>
                    </div>
                    <div style="width:100%; height:8px; background:#1F2D3A; border-radius:999px; overflow:hidden;">
                        <div style="width:{bar_pct:.1f}%; height:100%; background:linear-gradient(90deg,#00E676,#2979FF);"></div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    with p_col2:
        manual_df = pd.DataFrame(manual_cash_rows)
        st.dataframe(manual_df, use_container_width=True, hide_index=True)

# ===========================================================================
# TAB 2: 💼 포트폴리오 (KIS OpenAPI 자동연동 — 읽기 전용)
# ===========================================================================
with tabs[1]:
    st.markdown(
        """
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
            <span style="font-size:1.1rem; font-weight:800;">🔒 한국투자증권(KIS) 실시간 보유종목 및 예수금</span>
            <span class="av-badge-mint">🔒 KIS OpenAPI 자동연동 (읽기 전용 / Read-Only)</span>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.info(
        f"**위탁계좌 외화예수금 (USD)**: `${usd_deposit_usd:,.2f}` "
        f"(원화환산 `{fmt_curr(usd_deposit_krw, currency, usd_krw_rate)}`) · "
        f"KIS 연동 자산(위탁·ISA·연금저축·IRP)은 API 스케줄러로 자동 적재되므로 읽기 전용으로 보호됩니다."
    )

    account_filter = st.radio(
        "계좌 필터 선택",
        options=["전체", "위탁계좌", "ISA중개형", "연금저축", "퇴직연금(IRP)", "토스증권"],
        horizontal=True,
    )

    filtered_holdings = [
        h
        for h in stock_holding_rows
        if account_filter == "전체"
        or account_filter in str(h.get("계좌구분", ""))
        or account_filter in str(h.get("시장구분", ""))
    ]

    if filtered_holdings:
        df_hold = pd.DataFrame(
            [
                {
                    "계좌": h.get("계좌구분") or h.get("시장구분") or "",
                    "종목명(티커)": f"{h.get('종목명', '')} ({h.get('종목코드', '')})",
                    "실질자산분류": h.get("실질자산분류", ""),
                    "보유수량": round(h["보유수량_num"], 4),
                    "매수평단가": round(h["매수평단가_num"], 2),
                    "현재가": round(h["현재가_num"], 2),
                    "평가금액(원)": round(h["평가금액_num"], 0),
                    "평가손익(원)": round(h["평가손익_num"], 0),
                    "수익률(%)": round(h["수익률_num"], 2),
                }
                for h in filtered_holdings
            ]
        )
        st.dataframe(df_hold, use_container_width=True, hide_index=True)
    else:
        st.caption("선택한 계좌에 주식/ETF 보유 종목이 없습니다. (위탁계좌는 상단 달러예수금 바를 확인하세요)")

# ===========================================================================
# TAB 3: ✏️ 비-KIS 자산 관리 / 시트 수정 (Apps Script doPost 양방향 동기화)
# ===========================================================================
with tabs[2]:
    st.markdown(
        """
        <div class="av-card-mint">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div>
                    <span style="font-size:1.1rem; font-weight:800; color:#FFFFFF;">
                        ✏️ 비-KIS 수동 관리 자산 직접 수정 · 구글 시트 양방향 동기화
                    </span>
                    <div style="font-size:0.8rem; color:#D1FAE5; margin-top:4px;">
                        한국투자증권(KIS) 연동 자산은 읽기 전용으로 보호되며, 아래 4개 수동 시트(<b>💰입출금통장 · 🌱예적금내역 · 🏠채권내역 · 🚗실물_기타자산</b>)는
                        수정 후 <b>[구글 시트에 저장]</b> 클릭 시 Apps Script <code>doPost</code>를 통해 시트에 즉시 반영(수식 셀 인덱스 보호)됩니다.
                    </div>
                </div>
                <span class="av-badge-mint">POST: st.secrets["sheets"]["PORTFOLIO_API_URL"]</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    sheet_subtabs = st.tabs(
        [
            "💰 입출금통장",
            "🌱 예적금내역",
            "🏠 채권내역",
            "🚗 실물_기타자산",
        ]
    )

    # -----------------------------------------------------------------------
    # SUBTAB 1: 💰입출금통장 (B열[2열] 총합계 수식 덮어쓰기 방지 & 오늘자 행 추가)
    # -----------------------------------------------------------------------
    with sheet_subtabs[0]:
        st.markdown("##### 💰 `💰입출금통장` 시트 편집 (🔒 B열[2열] `총합계` 수식 자동 보존)")
        st.caption(
            "💡 입력 가능 열: **A열(`날짜`), C~H열(`주거래 하나 통장` ~ `청년도약계좌 정부기여금`)** · "
            "수식 보호 열: **B열(`총합계`, 2번째 열)**은 덮어쓰지 않고 시트 수식을 유지/복사합니다."
        )

        df_checking_init = pd.DataFrame(checking_rows)
        ordered_chk_cols = ["날짜", "총합계"] + CHECKING_ACCOUNT_COLS
        for col in ordered_chk_cols:
            if col not in df_checking_init.columns:
                df_checking_init[col] = 0
        df_checking_init = df_checking_init[ordered_chk_cols]

        edited_checking_df = st.data_editor(
            df_checking_init,
            key="editor_checking_accounts",
            num_rows="dynamic",
            use_container_width=True,
            hide_index=True,
            disabled=["총합계"],
            column_config={
                "날짜": st.column_config.TextColumn("날짜 (A열)", required=True),
                "총합계": st.column_config.NumberColumn(
                    "🔒 총합계 (B열 수식유지)",
                    help="구글 시트 B열(2열)의 SUM 수식이 그대로 유지되며 덮어쓰지 않습니다.",
                    format="₩%d",
                ),
                "주거래 하나 통장": st.column_config.NumberColumn("하나은행 (C열)", format="₩%d"),
                "토스뱅크 통장": st.column_config.NumberColumn("토스뱅크 (D열)", format="₩%d"),
                "미래에셋 종합_CMA": st.column_config.NumberColumn("미래에셋 CMA (E열)", format="₩%d"),
                "보유 현금": st.column_config.NumberColumn("보유 현금 (F열)", format="₩%d"),
                "증여금": st.column_config.NumberColumn("증여금 (G열)", format="₩%d"),
                "청년도약계좌 정부기여금": st.column_config.NumberColumn("청년도약 정부기여금 (H열)", format="₩%d"),
            },
        )

        if st.button(
            "💾 `💰입출금통장` 수정 내역 구글 시트에 저장",
            key="btn_save_checking_table",
            type="primary",
            use_container_width=True,
        ):
            updated_records = edited_checking_df.to_dict(orient="records")
            for r in updated_records:
                r["총합계"] = sum(to_num(r.get(c), 0) for c in CHECKING_ACCOUNT_COLS)

            st.session_state["sheet_overrides"]["checkingAccounts"] = updated_records
            st.session_state["sheet_overrides"]["manualCashAccounts"] = updated_records
            ok, msg, _ = post_sheet_write_action(
                action="updateSheet",
                sheet_name="💰입출금통장",
                updates=updated_records,
            )
            if ok:
                st.success(msg)
            else:
                st.warning(f"{msg} (현재 화면 세션에는 수정사항이 즉시 반영되었습니다.)")
            st.cache_data.clear()
            st.rerun()

        with st.expander("➕ 오늘 날짜 기준 `💰입출금통장` 새 행 빠른 추가 (B열 총합계 수식 자동 복사)"):
            with st.form("form_add_today_checking"):
                f_c1, f_c2, f_c3 = st.columns(3)
                with f_c1:
                    new_chk_date = st.text_input("기준 날짜 (A열)", value=date.today().isoformat())
                    new_hana = st.number_input(
                        "주거래 하나 통장 (C열, 원)",
                        min_value=0,
                        value=int(to_num(latest_checking.get("주거래 하나 통장"), 510640)),
                        step=10000,
                    )
                    new_toss = st.number_input(
                        "토스뱅크 통장 (D열, 원)",
                        min_value=0,
                        value=int(to_num(latest_checking.get("토스뱅크 통장"), 199900)),
                        step=10000,
                    )
                with f_c2:
                    new_cma = st.number_input(
                        "미래에셋 종합_CMA (E열, 원)",
                        min_value=0,
                        value=int(to_num(latest_checking.get("미래에셋 종합_CMA"), 70)),
                        step=1000,
                    )
                    new_cash = st.number_input(
                        "보유 현금 (F열, 원)",
                        min_value=0,
                        value=int(to_num(latest_checking.get("보유 현금"), 36000000)),
                        step=100000,
                    )
                with f_c3:
                    new_gift = st.number_input(
                        "증여금 (G열, 원)",
                        min_value=0,
                        value=int(to_num(latest_checking.get("증여금"), 50000000)),
                        step=100000,
                    )
                    new_gov = st.number_input(
                        "청년도약계좌 정부기여금 (H열, 원)",
                        min_value=0,
                        value=int(to_num(latest_checking.get("청년도약계좌 정부기여금"), 6400000)),
                        step=50000,
                    )

                submitted_chk = st.form_submit_button(
                    "➕ 오늘 날짜 행 구글 시트에 추가 (B열 수식 복사)",
                    use_container_width=True,
                )
                if submitted_chk:
                    new_row = {
                        "날짜": new_chk_date,
                        "총합계": new_hana + new_toss + new_cma + new_cash + new_gift + new_gov,
                        "주거래 하나 통장": new_hana,
                        "토스뱅크 통장": new_toss,
                        "미래에셋 종합_CMA": new_cma,
                        "보유 현금": new_cash,
                        "증여금": new_gift,
                        "청년도약계좌 정부기여금": new_gov,
                    }
                    updated_list = [new_row] + [
                        r for r in checking_rows if str(r.get("날짜")) != new_chk_date
                    ]
                    st.session_state["sheet_overrides"]["checkingAccounts"] = updated_list
                    st.session_state["sheet_overrides"]["manualCashAccounts"] = updated_list
                    ok, msg, _ = post_sheet_write_action(
                        action="appendRow",
                        sheet_name="💰입출금통장",
                        row=new_row,
                    )
                    if ok:
                        st.success(msg)
                    else:
                        st.warning(f"{msg} (현재 화면 세션에는 즉시 반영되었습니다.)")
                    st.cache_data.clear()
                    st.rerun()

    # -----------------------------------------------------------------------
    # SUBTAB 2: 🌱예적금내역 (A~H열 입력, I~N열[9~14열] 만기수령액 등 수식 보존)
    # -----------------------------------------------------------------------
    with sheet_subtabs[1]:
        st.markdown("##### 🌱 `🌱예적금내역` 시트 편집 (🔒 I~N열[9~14열] `만기수령액`·`만기일` 수식 열 보존)")
        st.caption(
            "💡 입력 가능 열: **A~H열(`구분`, `은행`, `가입일`, `이율`, `기간`, `금액`, `비과세`, `통화`)** · "
            "수식 보호 열: **I~N열(`만기수령액(세전)`, `만기수령액(세후)`, `ID`, `만기일`, `환율`, `만기수령액(통화)`)**은 덮어쓰지 않고 시트 수식을 유지합니다."
        )

        df_sav_init = pd.DataFrame(savings_rows)
        sav_cols = [
            "구분",
            "은행",
            "가입일",
            "이율",
            "기간",
            "금액",
            "비과세",
            "통화",
            "만기수령액(세전)",
            "만기수령액(세후)",
            "ID",
            "만기일",
        ]
        for col in sav_cols:
            if col not in df_sav_init.columns:
                df_sav_init[col] = "" if col in ("구분", "은행", "가입일", "비과세", "통화", "ID", "만기일") else 0
        df_sav_init = df_sav_init[sav_cols]

        edited_sav_df = st.data_editor(
            df_sav_init,
            key="editor_savings_sheet",
            num_rows="dynamic",
            use_container_width=True,
            hide_index=True,
            disabled=["만기수령액(세전)", "만기수령액(세후)", "ID", "만기일"],
            column_config={
                "구분": st.column_config.SelectboxColumn("구분 (A열)", options=["적금", "예금", "청약", "채권", "파킹"], required=True),
                "은행": st.column_config.TextColumn("은행 (B열)", required=True),
                "가입일": st.column_config.TextColumn("가입일 (C열)"),
                "이율": st.column_config.NumberColumn("이율 (D열)", format="%.4f"),
                "기간": st.column_config.NumberColumn("기간 (E열, 개월)", format="%d"),
                "금액": st.column_config.NumberColumn("금액 (F열)", format="%d"),
                "비과세": st.column_config.SelectboxColumn("비과세 (G열)", options=["O", "X", ""]),
                "통화": st.column_config.SelectboxColumn("통화 (H열)", options=["KRW", "USD"]),
                "만기수령액(세전)": st.column_config.NumberColumn("🔒 만기수령액(세전·I열)", format="₩%d"),
                "만기수령액(세후)": st.column_config.NumberColumn("🔒 만기수령액(세후·J열)", format="₩%d"),
                "ID": st.column_config.TextColumn("🔒 ID (K열)"),
                "만기일": st.column_config.TextColumn("🔒 만기일 (L열)"),
            },
        )

        if st.button(
            "💾 `🌱예적금내역` 수정 내역 구글 시트에 저장",
            key="btn_save_savings_table",
            type="primary",
            use_container_width=True,
        ):
            updated_sav = edited_sav_df.to_dict(orient="records")
            st.session_state["sheet_overrides"]["savings"] = updated_sav
            ok, msg, _ = post_sheet_write_action(
                action="updateSheet",
                sheet_name="🌱예적금내역",
                updates=updated_sav,
            )
            if ok:
                st.success(msg)
            else:
                st.warning(f"{msg} (현재 화면 세션에는 수정사항이 즉시 반영되었습니다.)")
            st.cache_data.clear()
            st.rerun()

    # -----------------------------------------------------------------------
    # SUBTAB 3: 🏠채권내역 (A~E열 입력, F~G열[6~7열] 수령·총 납입액 수식 보존)
    # -----------------------------------------------------------------------
    with sheet_subtabs[2]:
        st.markdown("##### 🏠 `🏠채권내역` 시트 편집 (🔒 F~G열[6~7열] `총 납입액` 수식 열 보존)")
        st.caption(
            "💡 입력 가능 열: **A~E열(`채권명`, `설명`, `가입일`, `종료일`, `월 납입금액`)** · "
            "수식 보호 열: **F~G열(`수령`, `총 납입액`)**은 덮어쓰지 않고 시트 수식을 유지합니다."
        )

        df_bond_init = pd.DataFrame(bonds_rows)
        bond_cols = ["채권명", "설명", "가입일", "종료일", "월 납입금액", "수령", "총 납입액"]
        for col in bond_cols:
            if col not in df_bond_init.columns:
                df_bond_init[col] = "" if col in ("채권명", "설명", "가입일", "종료일", "수령") else 0
        df_bond_init = df_bond_init[bond_cols]

        edited_bond_df = st.data_editor(
            df_bond_init,
            key="editor_bonds_sheet",
            num_rows="dynamic",
            use_container_width=True,
            hide_index=True,
            disabled=["수령", "총 납입액"],
            column_config={
                "채권명": st.column_config.TextColumn("채권명 (A열)", required=True),
                "설명": st.column_config.TextColumn("설명 (B열)"),
                "가입일": st.column_config.TextColumn("가입일 (C열)"),
                "종료일": st.column_config.TextColumn("종료일 (D열)"),
                "월 납입금액": st.column_config.NumberColumn("월 납입금액 (E열)", format="₩%d"),
                "수령": st.column_config.TextColumn("🔒 수령 (F열)"),
                "총 납입액": st.column_config.NumberColumn("🔒 총 납입액 (G열 수식유지)", format="₩%d"),
            },
        )

        if st.button(
            "💾 `🏠채권내역` 수정 내역 구글 시트에 저장",
            key="btn_save_bonds_table",
            type="primary",
            use_container_width=True,
        ):
            updated_bonds = edited_bond_df.to_dict(orient="records")
            st.session_state["sheet_overrides"]["bonds"] = updated_bonds
            ok, msg, _ = post_sheet_write_action(
                action="updateSheet",
                sheet_name="🏠채권내역",
                updates=updated_bonds,
            )
            if ok:
                st.success(msg)
            else:
                st.warning(f"{msg} (현재 화면 세션에는 수정사항이 즉시 반영되었습니다.)")
            st.cache_data.clear()
            st.rerun()

    # -----------------------------------------------------------------------
    # SUBTAB 4: 🚗실물_기타자산 (취득원가 / 감가상각 / 현재가치 수정·추가)
    # -----------------------------------------------------------------------
    with sheet_subtabs[3]:
        st.markdown("##### 🚗 `🚗실물_기타자산` 시트 편집")
        st.caption(
            "💡 차량, 전자기기, 귀금속 등 실물자산의 `취득원가`, `감가상각누계액`, `현재가치(잔존가치)` 등을 수정·추가하면 대시보드 총 순자산과 감가상각 바에 즉시 반영됩니다."
        )

        df_phys_init = pd.DataFrame(physical_rows)
        phys_cols = [
            "카테고리",
            "자산명",
            "취득일",
            "취득원가",
            "연감가율(%)",
            "감가상각누계액",
            "현재가치",
            "비고",
        ]
        for col in phys_cols:
            if col not in df_phys_init.columns:
                df_phys_init[col] = "" if col in ("카테고리", "자산명", "취득일", "비고") else 0
        df_phys_init = df_phys_init[phys_cols]

        edited_phys_df = st.data_editor(
            df_phys_init,
            key="editor_physical_sheet",
            num_rows="dynamic",
            use_container_width=True,
            hide_index=True,
            column_config={
                "카테고리": st.column_config.TextColumn("자산구분 (A열)"),
                "자산명": st.column_config.TextColumn("품목명 (B열)", required=True),
                "취득일": st.column_config.TextColumn("취득일 (C열)"),
                "취득원가": st.column_config.NumberColumn("취득원가 (D열)", format="₩%d"),
                "연감가율(%)": st.column_config.NumberColumn("연감가율 (G열)", format="%d%%"),
                "감가상각누계액": st.column_config.NumberColumn("감가상각누계액 (H열)", format="₩%d"),
                "현재가치": st.column_config.NumberColumn("현재잔존가치 (I열)", format="₩%d"),
                "비고": st.column_config.TextColumn("비고 (J열)"),
            },
        )

        if st.button(
            "💾 `🚗실물_기타자산` 수정 내역 구글 시트에 저장",
            key="btn_save_physical_table",
            type="primary",
            use_container_width=True,
        ):
            updated_phys = edited_phys_df.to_dict(orient="records")
            st.session_state["sheet_overrides"]["physicalAssets"] = updated_phys
            ok, msg, _ = post_sheet_write_action(
                action="updateSheet",
                sheet_name="🚗실물_기타자산",
                updates=updated_phys,
            )
            if ok:
                st.success(msg)
            else:
                st.warning(f"{msg} (현재 화면 세션에는 수정사항이 즉시 반영되었습니다.)")
            st.cache_data.clear()
            st.rerun()

    with st.expander("🛠️ Google Apps Script 웹앱 `doPost(e)` 연동 핸들러 코드 (수식 열 인덱스 보호 지원)"):
        st.code(
            """// Google Apps Script (Code.gs) — 비-KIS 자산 양방향 저장 핸들러 (수식 열 인덱스 보호 포함)
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var expectedToken = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
    if (expectedToken && body.token !== expectedToken) {
      return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: 'Unauthorized API_TOKEN' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(body.sheetName);
    if (!sheet) throw new Error('Sheet not found: ' + body.sheetName);

    var editableColMap = body.editableColumnIndices || {};
    var formulaColMap = body.formulaColumnIndices || {};
    var headerRow = (body.sheetName.indexOf('실물_기타자산') !== -1) ? 3 : 1;

    if (body.action === 'appendRow' && body.row) {
      var nextRowIdx = sheet.getLastRow() + 1;
      // 1) 입력 열만 정확히 해당 열 인덱스(1-based)에 기록
      Object.keys(editableColMap).forEach(function(colName) {
        var colIdx = editableColMap[colName];
        if (body.row[colName] !== undefined) {
          sheet.getRange(nextRowIdx, colIdx).setValue(body.row[colName]);
        }
      });
      // 2) 수식 열(예: 💰입출금통장 B열[2열] 총합계)은 직전 행의 수식을 그대로 복사
      if (body.copyFormulaFromPrevRow && nextRowIdx > headerRow + 1) {
        Object.keys(formulaColMap).forEach(function(fName) {
          var fColIdx = formulaColMap[fName];
          sheet.getRange(nextRowIdx - 1, fColIdx).copyTo(sheet.getRange(nextRowIdx, fColIdx));
        });
      }
    } else if (body.action === 'updateSheet' && Array.isArray(body.updates)) {
      body.updates.forEach(function(rowObj, rIdx) {
        var targetRow = headerRow + 1 + rIdx;
        // 수식 열 인덱스는 건드리지 않고 editableColumnIndices에 매핑된 입력 열만 업데이트
        Object.keys(editableColMap).forEach(function(colName) {
          var colIdx = editableColMap[colName];
          if (rowObj[colName] !== undefined) {
            sheet.getRange(targetRow, colIdx).setValue(rowObj[colName]);
          }
        });
      });
    }

    return ContentService.createTextOutput(JSON.stringify({ result: 'success', sheetName: body.sheetName }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}""",
            language="javascript",
        )

# ===========================================================================
# TAB 4: 📜 매매·배당 (Trade & Dividend — KIS 읽기 전용)
# ===========================================================================
with tabs[3]:
    st.markdown("#### 📜 KIS 매매체결 DB & 💸 해외주식 배당내역 DB (🔒 KIS 읽기 전용)")
    trades_data = raw_payload.get("kisTrades") or [
        {"체결일시": "2026-11-12", "계좌구분": "연금저축", "매매구분": "매수", "종목명": "KODEX 미국S&P500", "수량": 25, "체결단가": 18900, "원화환산액": 472500},
        {"체결일시": "2026-11-08", "계좌구분": "퇴직연금(IRP)", "매매구분": "매수", "종목명": "TIGER 미국S&P500", "수량": 30, "체결단가": 19310, "원화환산액": 579300},
        {"체결일시": "2026-11-03", "계좌구분": "ISA중개형", "매매구분": "매수", "종목명": "KODEX 미국나스닥100", "수량": 18, "체결단가": 17250, "원화환산액": 310500},
    ]
    dividends_data = raw_payload.get("kisDividends") or [
        {"배당기준일": "2026-11-10", "계좌구분": "토스증권", "종목명": "Microsoft (MSFT)", "세전배당($)": 4.47, "세후배당($)": 3.80, "원화환산액": 5079},
        {"배당기준일": "2026-11-04", "계좌구분": "연금저축", "종목명": "TIGER 미국배당다우존스", "세전배당($)": 18.20, "세후배당($)": 18.20, "원화환산액": 24325},
    ]

    t_col1, t_col2 = st.columns(2)
    with t_col1:
        st.markdown("##### 📜 최근 매매체결 내역")
        st.dataframe(pd.DataFrame(trades_data), use_container_width=True, hide_index=True)
    with t_col2:
        st.markdown("##### 💸 최근 배당수령 내역")
        st.dataframe(pd.DataFrame(dividends_data), use_container_width=True, hide_index=True)

# ===========================================================================
# TAB 5: 🤖 AI 리서치 (SaveTicker TOP 5 & Deep Research)
# ===========================================================================
with tabs[4]:
    st.markdown("#### 🚀 SaveTicker AI 선정 긍정 전망 TOP 5 vs ⚠️ 부정·주의 TOP 5")
    bull_col, bear_col = st.columns(2)

    bullish_list = [
        ("NVDA", "NVIDIA Corp.", "+94점", "Blackwell 서버 랙 출하 가속 및 하이퍼스케일러 AI CAPEX 상향"),
        ("MSFT", "Microsoft", "+89점", "Azure AI 매출 성장률 34% 돌파 및 Copilot 엔터프라이즈 확산"),
        ("AVGO", "Broadcom", "+86점", "맞춤형 AI ASIC(XPU) 수주 확대 및 VMware 현금흐름 개선"),
        ("META", "Meta Platforms", "+82점", "Llama 기반 광고 타겟팅 효율 상승 및 릴스 수익화 호조"),
        ("AMZN", "Amazon", "+80점", "AWS 영업이익률 역대 최고치 경신 및 물류 자동화 비용 절감"),
    ]
    bearish_list = [
        ("INTC", "Intel Corp.", "-76점", "파운드리 적자 지속 및 서버 CPU 점유율 하락 우려"),
        ("TSLA", "Tesla", "-68점", "전기차 보조금 축소 리스크 및 단기 마진 압박 뉴스 혼재"),
        ("PFE", "Pfizer", "-64점", "특허절벽 도래 및 신규 비만치료제 파이프라인 임상 지연"),
        ("NKE", "Nike", "-61점", "북미·중국 소비 둔화 및 DTC 채널 재고 조정 장기화"),
        ("BA", "Boeing", "-58점", "공급망 차질 및 항공기 인도 지연에 따른 현금 유출 지속"),
    ]

    with bull_col:
        for ticker, name, score, reason in bullish_list:
            st.markdown(
                f"""
                <div class="av-card-mint">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <b>🚀 {ticker} · {name}</b>
                        <span class="av-badge-mint">{score}</span>
                    </div>
                    <div style="font-size:0.8rem; color:#D1FAE5; margin-top:6px;">{reason}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    with bear_col:
        for ticker, name, score, reason in bearish_list:
            st.markdown(
                f"""
                <div class="av-card-coral">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <b>⚠️ {ticker} · {name}</b>
                        <span class="av-badge-coral">{score}</span>
                    </div>
                    <div style="font-size:0.8rem; color:#FECACA; margin-top:6px;">{reason}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    st.markdown("##### 🔬 Gemini Deep Research 심층 분석 프롬프트 (우측 상단 복사 버튼 지원)")
    deep_research_prompt = (
        f"[AssetVision PRO 심층 리서치 요청]\n"
        f"- 현재 총 순자산: ₩{grand_total_krw:,.0f} (금융 ₩{financial_net_worth_krw:,.0f})\n"
        f"- 위탁 외화예수금: ${usd_deposit_usd:,.2f} (₩{usd_deposit_krw:,.0f})\n"
        f"- 실질 해외주식 노출액: ₩{underlying_overseas_stock_krw:,.0f} / 실질 해외채권: ₩{underlying_overseas_bond_krw:,.0f}\n"
        f"위 포트폴리오 구조와 이번 주 미국 매크로(금리·환율·빅테크 실적)를 바탕으로\n"
        f"1) 외화예수금 분할매수 타임라인, 2) 연금저축/IRP 리밸런싱 비중, 3) 주요 리스크 헤지 전략을 분석해줘."
    )
    st.code(deep_research_prompt, language="markdown")
    st.link_button("🚀 Gemini Deep Research 앱 열기 (gemini.google.com)", "https://gemini.google.com/app")

# ===========================================================================
# TAB 6: ⚖️ 리밸런싱 시뮬레이터 (Rebalancing)
# ===========================================================================
with tabs[5]:
    st.markdown(f"#### ⚖️ 인터랙티브 자산배분 시뮬레이터 ({exposure_mode})")
    sim_c1, sim_c2, sim_c3, sim_c4, sim_c5 = st.columns(5)
    with sim_c1:
        tgt_cash = st.slider("현금성 목표(%)", 0, 70, 35)
    with sim_c2:
        tgt_sav = st.slider("예적금 목표(%)", 0, 60, 20)
    with sim_c3:
        tgt_ov_stk = st.slider("해외주식 목표(%)", 0, 70, 25)
    with sim_c4:
        tgt_ov_bnd = st.slider("해외채권 목표(%)", 0, 50, 15)
    with sim_c5:
        tgt_dom_bnd = st.slider("국내채권 목표(%)", 0, 30, 5)

    total_target_pct = tgt_cash + tgt_sav + tgt_ov_stk + tgt_ov_bnd + tgt_dom_bnd
    if total_target_pct != 100:
        st.warning(f"현재 목표 비중 합계가 **{total_target_pct}%**입니다. (100% 기준 차이: {100 - total_target_pct:+d}%)")

    rebal_rows = [
        ("현금성 자산 (수동+외화예수금)", manual_cash_total_krw + usd_deposit_krw, tgt_cash),
        ("은행 예적금", savings_total_krw, tgt_sav),
        ("해외주식 (실질: 미ETF+직투)", underlying_overseas_stock_krw, tgt_ov_stk),
        ("해외채권 (실질: 미국채ETF+채권)", underlying_overseas_bond_krw, tgt_ov_bnd),
        ("국내채권·혼합형", underlying_domestic_bond_krw, tgt_dom_bnd),
    ]
    rebal_df = pd.DataFrame(
        [
            {
                "자산군": name,
                "현재 평가액(원)": round(cur_val),
                "현재 비중(%)": round(cur_val / financial_net_worth_krw * 100, 1),
                "목표 비중(%)": tgt_pct,
                "목표 금액(원)": round(financial_net_worth_krw * (tgt_pct / 100.0)),
                "매수(+)/축소(-) 필요액(원)": round(
                    financial_net_worth_krw * (tgt_pct / 100.0) - cur_val
                ),
            }
            for name, cur_val, tgt_pct in rebal_rows
        ]
    )
    st.dataframe(rebal_df, use_container_width=True, hide_index=True)

# ===========================================================================
# TAB 7: ✨ AI Copilot (AssetCopilot)
# ===========================================================================
with tabs[6]:
    st.markdown("#### ✨ AssetCopilot AI — 시트 & 현재 화면 컨텍스트 연동 비서")
    gemini_key = get_gemini_api_key()

    if "copilot_messages" not in st.session_state:
        st.session_state.copilot_messages = [
            {
                "role": "assistant",
                "content": (
                    f"안녕하세요! **AssetCopilot AI**입니다.\n\n"
                    f"- 현재 총 순자산(실물 포함): **{fmt_curr(grand_total_krw, currency, usd_krw_rate)}**\n"
                    f"- 금융 순자산: **{fmt_curr(financial_net_worth_krw, currency, usd_krw_rate)}**\n"
                    f"- 위탁 달러예수금: **${usd_deposit_usd:,.2f}**\n\n"
                    f"아래 원클릭 질문 버튼을 누르시거나 질문을 입력해 주세요!"
                ),
            }
        ]

    q_cols = st.columns(2)
    quick_prompts = [
        "현재 보고 있는 화면 핵심 요약해줘",
        "실질 해외주식 vs 국내주식 비중 분석해줘",
        "이번 주 SaveTicker 긍정/부정 TOP 5 정리해줘",
        "현재 달러예수금 리밸런싱 추천해줘",
    ]
    triggered_prompt: Optional[str] = None
    for idx, qp in enumerate(quick_prompts):
        with q_cols[idx % 2]:
            if st.button(f"💬 {qp}", key=f"qp_{idx}", use_container_width=True):
                triggered_prompt = qp

    user_chat = st.chat_input("포트폴리오, 리밸런싱, 종목에 대해 질문하세요...")
    active_prompt = triggered_prompt or user_chat

    if active_prompt:
        st.session_state.copilot_messages.append({"role": "user", "content": active_prompt})

        reply_text = ""
        if gemini_key:
            try:
                api_endpoint = (
                    f"https://generativelanguage.googleapis.com/v1beta/models/"
                    f"gemini-2.5-flash:generateContent?key={gemini_key}"
                )
                sys_context = (
                    f"당신은 개인 자산관리 AI 비서 AssetCopilot입니다. "
                    f"총순자산={grand_total_krw:,.0f}원, 금융순자산={financial_net_worth_krw:,.0f}원, "
                    f"수동현금성={manual_cash_total_krw:,.0f}원, 위탁달러예수금=${usd_deposit_usd:,.2f}({usd_deposit_krw:,.0f}원), "
                    f"실질해외주식={underlying_overseas_stock_krw:,.0f}원, 실질해외채권={underlying_overseas_bond_krw:,.0f}원, "
                    f"실물자산={physical_total_krw:,.0f}원. 핵심 수치를 포함해 한국어로 간결하게 답변하세요."
                )
                resp = requests.post(
                    api_endpoint,
                    json={
                        "system_instruction": {"parts": [{"text": sys_context}]},
                        "contents": [{"role": "user", "parts": [{"text": active_prompt}]}],
                    },
                    timeout=20,
                )
                if resp.ok:
                    candidates = resp.json().get("candidates", [])
                    if candidates:
                        reply_text = candidates[0]["content"]["parts"][0]["text"]
            except Exception:
                reply_text = ""

        if not reply_text:
            reply_text = (
                f"**[AssetCopilot 실시간 포트폴리오 분석]**\n\n"
                f"1. **핵심 순자산 현황**: 총 순자산(실물 포함)은 **{fmt_curr(grand_total_krw, currency, usd_krw_rate)}**, "
                f"금융 순자산은 **{fmt_curr(financial_net_worth_krw, currency, usd_krw_rate)}**입니다.\n"
                f"2. **실질 기초자산 노출도**: 연금저축·IRP·ISA 내 국내상장 미국 ETF를 합산한 실질 해외주식 비중은 "
                f"**{underlying_overseas_stock_krw / financial_net_worth_krw * 100:.1f}%** "
                f"({fmt_curr(underlying_overseas_stock_krw, currency, usd_krw_rate)}), 실질 해외채권 비중은 "
                f"**{underlying_overseas_bond_krw / financial_net_worth_krw * 100:.1f}%**입니다.\n"
                f"3. **달러예수금 리밸런싱 제안**: 위탁계좌 달러예수금 **${usd_deposit_usd:,.2f}** 중 일부를 "
                f"S&P500/나스닥100 및 미국 단기·장기 국채 ETF로 3~4회 분할 매수하면 현금 유휴 비중을 낮추고 배당·성장 수익률을 극대화할 수 있습니다."
            )

        st.session_state.copilot_messages.append({"role": "assistant", "content": reply_text})

    for msg in st.session_state.copilot_messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

# ===========================================================================
# TAB 8: 🖥️ 풀 웹앱 뷰 (React 빌드 내장 뷰)
# ===========================================================================
with tabs[7]:
    st.caption(
        "💡 아래 화면은 빌드된 React `AssetVision PRO` 인터랙티브 대시보드를 Streamlit 내부에서 직접 렌더링한 뷰입니다."
    )
    dist_dir = Path(__file__).resolve().parent / "dist"
    index_html_path = dist_dir / "index.html"
    if index_html_path.exists():
        html_content = index_html_path.read_text(encoding="utf-8")
        assets_dir = dist_dir / "assets"
        if assets_dir.exists():
            for css_file in assets_dir.glob("*.css"):
                css_text = css_file.read_text(encoding="utf-8")
                html_content = re.sub(
                    r'<link[^>]+href="[^"]*' + re.escape(css_file.name) + r'"[^>]*>',
                    lambda _: f"<style>{css_text}</style>",
                    html_content,
                )
            for js_file in assets_dir.glob("*.js"):
                js_text = js_file.read_text(encoding="utf-8")
                html_content = re.sub(
                    r'<script[^>]+src="[^"]*' + re.escape(js_file.name) + r'"[^>]*></script>',
                    lambda _: f'<script type="module">{js_text}</script>',
                    html_content,
                )
        injected_config = json.dumps(
            {
                "PORTFOLIO_API_URL": get_sheets_config().get("portfolio_api_url", ""),
                "GEMINI_API_KEY": get_gemini_api_key(),
            }
        )
        html_content = html_content.replace(
            "<head>",
            f"<head><script>window.__STREAMLIT_CONFIG__ = {injected_config};</script>",
            1,
        )
        components.html(html_content, height=1080, scrolling=True)
    else:
        st.info("React 빌드 아티팩트(`dist/index.html`)가 없을 때는 상단 네이티브 탭을 사용하세요.")
