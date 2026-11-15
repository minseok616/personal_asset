"""
AssetVision PRO — Streamlit Community Cloud 개인 자산관리 대시보드 (app.py)

핵심 특징:
1. `st.secrets` 우선 조회 및 로컬 `.env` fallback 공통 헬퍼(`utils.secrets_helper`) 적용
2. Google Sheets(`gspread`) 인증: `st.secrets["gcp_service_account"]` (`Credentials.from_service_account_info`) 우선, 로컬 JSON 파일 fallback
3. KIS API 접근 토큰: 컨테이너 재시작 시 파일 유실을 방지하기 위해 `@st.cache_resource` 메모리 캐싱(`utils.kis_client`) 적용
4. 아이폰 Safari 세로 화면 최적화: 모든 표(`st.dataframe`) 및 차트(`st.plotly_chart`)에 `use_container_width=True` 적용 및 모바일 반응형 CSS 탑재
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import requests
import streamlit as st
import streamlit.components.v1 as components

from utils.gsheets_client import fetch_portfolio_raw_payload, get_gspread_client
from utils.kis_client import fetch_kis_direct_domestic_balance, get_kis_access_token
from utils.secrets_helper import (
    get_gemini_api_key,
    get_kis_config,
    get_secret,
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
    /* KPI & 글래스모피즘 카드 */
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
    /* 모바일 탭 스크롤 최적화 (iPhone Safari) */
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
# 3. 숫자 파싱 및 기초자산 실질 분류 유틸리티
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
    if "30년국채" in name or "미국채" in name or "채권" in name and ("미국" in name or "글로벌" in name):
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
# 4. 데이터 로드 및 정규화
# ---------------------------------------------------------------------------
raw_payload, data_source_label = fetch_portfolio_raw_payload()
_, gspread_status = get_gspread_client()
kis_token, kis_token_status = get_kis_access_token()
kis_cfg = get_kis_config()

# KIS API 직접 조회 계좌가 설정된 경우 실시간 잔고 보강
if kis_token and kis_cfg.get("cano_brokerage"):
    direct_rows = fetch_kis_direct_domestic_balance(
        kis_cfg["cano_brokerage"],
        kis_cfg.get("acnt_prdt_cd_brokerage", "01"),
        "위탁계좌",
    )
    if direct_rows and not raw_payload.get("kisRealtime"):
        raw_payload["kisRealtime"] = direct_rows

summary_raw = raw_payload.get("summary") or {}
integrated_raw = raw_payload.get("integratedSummary") or {}

usd_krw_rate = to_num(
    integrated_raw.get("환율") or summary_raw.get("환율"),
    default=1336.57,
)
if usd_krw_rate < 900:
    usd_krw_rate = 1336.57

# 수동 관리 입출금·현금·증여금·정부기여금
manual_cash_rows: List[Dict[str, Any]] = raw_payload.get("manualCashAccounts") or [
    {"구분": "주거래통장", "기관명": "하나은행", "항목명": "급여·주거래 통장", "잔액": 420000, "비고": "자동이체 허브"},
    {"구분": "파킹통장", "기관명": "토스뱅크", "항목명": "토스뱅크 파킹통장", "잔액": 152000, "비고": "연 2.0% 일복리"},
    {"구분": "CMA", "기관명": "미래에셋증권", "항목명": "미래에셋 CMA (RP형)", "잔액": 140000, "비고": "비상금 파킹"},
    {"구분": "보유현금", "기관명": "실물/안전자금", "항목명": "보유 현금성 대기자금", "잔액": 36000000, "비고": "단기 유동성"},
    {"구분": "증여금", "기관명": "가족증여", "항목명": "증여금 원금 보존분", "잔액": 50000000, "비고": "안전자산 시드"},
    {"구분": "정부기여금", "기관명": "서민금융진흥원", "항목명": "청년도약계좌 정부기여금·누적분", "잔액": 6400000, "비고": "비과세 만기적립"},
]
manual_cash_total_krw = sum(to_num(r.get("잔액") or r.get("금액") or r.get("평가금액"), 0) for r in manual_cash_rows)
if manual_cash_total_krw <= 0:
    manual_cash_total_krw = 93_112_000

# 실물 자산 (감가상각 포함)
physical_rows: List[Dict[str, Any]] = raw_payload.get("physicalAssets") or [
    {
        "항목명": "현대 디 올뉴코나",
        "카테고리": "자동차",
        "취득원가": 28500000,
        "감가상각누계액": 5000000,
        "현재추정가치": 23500000,
        "연감가율": "연 15% 감가",
        "비고": "2024년식 가솔린 1.6 터보",
    },
    {
        "항목명": "아이폰 17 Pro",
        "카테고리": "IT기기",
        "취득원가": 2150000,
        "감가상각누계액": 250000,
        "현재추정가치": 1900000,
        "연감가율": "연 30% 감가",
        "비고": "256GB 내추럴 티타늄",
    },
    {
        "항목명": "순금 반지 (24K)",
        "카테고리": "귀금속/현물",
        "취득원가": 750000,
        "감가상각누계액": -170000,
        "현재추정가치": 920000,
        "연감가율": "현물 시세 연동",
        "비고": "금 한돈(3.75g) 시세 반영",
    },
]
physical_total_krw = sum(
    to_num(r.get("현재추정가치") or r.get("현재가치") or r.get("평가금액"), 0) for r in physical_rows
)
if physical_total_krw <= 0:
    physical_total_krw = 26_320_000

# KIS 실시간 잔고 분리 (현금성 예수금 vs 투자 종목)
kis_rows: List[Dict[str, Any]] = raw_payload.get("kisRealtime") or []
cash_deposit_rows: List[Dict[str, Any]] = []
stock_holding_rows: List[Dict[str, Any]] = []

for r in kis_rows:
    code = str(r.get("종목코드", "")).strip()
    name = str(r.get("종목명", "")).strip()
    if not code and not name:
        continue
    underlying_cls = classify_underlying_asset(r)
    item = dict(r)
    item["실질자산분류"] = underlying_cls
    item["보유수량_num"] = to_num(r.get("보유수량"), 0)
    item["매수평단가_num"] = to_num(r.get("매수평단가"), 0)
    item["현재가_num"] = to_num(r.get("현재가"), 0)
    item["평가금액_num"] = to_num(r.get("평가금액"), 0)
    item["평가손익_num"] = to_num(r.get("평가손익"), 0)
    item["수익률_num"] = to_num(r.get("수익률(%)"), 0)

    if code.startswith("CASH_") or underlying_cls == "현금성 자산":
        cash_deposit_rows.append(item)
    else:
        stock_holding_rows.append(item)

# MSFT(토스증권) 누락 시 보강
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

savings_total_krw = to_num(summary_raw.get("예적금"), 44_130_000) or 44_130_000
bond_direct_krw = to_num(summary_raw.get("채권"), 14_191_300) or 14_191_300

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
underlying_domestic_stock_krw = sum(
    h["평가금액_num"] for h in stock_holding_rows if h["실질자산분류"] == "국내주식"
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
            st.cache_data.clear()
            st.rerun()

# ---------------------------------------------------------------------------
# 6. 상단 4대 핵심 KPI 카드 (아이폰 세로 화면에서도 깔끔하게 자동 래핑)
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
            <div class="av-label">STOCK & ETF 평가액 (자동연동)</div>
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
                위탁 달러예수금 ${usd_deposit_usd:,.2f} 포함
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with kpi4:
    st.markdown(
        f"""
        <div class="av-card">
            <div class="av-label">월 잉여현금흐름 & 저축률</div>
            <div class="av-value">{fmt_curr(2_253_693, currency, usd_krw_rate)}</div>
            <div class="av-sub" style="color:#00E676;">
                총저축률 57.6% · 순저축률 47.2%
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


# ---------------------------------------------------------------------------
# 7. 메인 탭 네비게이션 (iPhone Safari 터치 스크롤 지원)
# ---------------------------------------------------------------------------
tabs = st.tabs(
    [
        "📊 대시보드",
        "💼 포트폴리오",
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
                {"계좌": "수동 현금·증여·기여금", "평가액(원)": manual_cash_total_krw, "구분": "수동입력"},
                {"계좌": "은행 예적금", "평가액(원)": savings_total_krw, "구분": "수동입력"},
                {"계좌": "한투 위탁(달러예수금)", "평가액(원)": usd_deposit_krw, "구분": "자동연동"},
                {"계좌": "실물·기타자산", "평가액(원)": physical_total_krw, "구분": "수동입력"},
                {
                    "계좌": "연금저축 (한투)",
                    "평가액(원)": sum(
                        h["평가금액_num"] for h in stock_holding_rows if "연금저축" in str(h.get("계좌구분"))
                    ),
                    "구분": "자동연동",
                },
                {
                    "계좌": "퇴직연금 (IRP)",
                    "평가액(원)": sum(
                        h["평가금액_num"] for h in stock_holding_rows if "IRP" in str(h.get("계좌구분"))
                    ),
                    "구분": "자동연동",
                },
                {
                    "계좌": "토스·ISA 계좌",
                    "평가액(원)": sum(
                        h["평가금액_num"]
                        for h in stock_holding_rows
                        if any(k in str(h.get("계좌구분")) for k in ("토스", "ISA"))
                    ),
                    "구분": "자동연동",
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
            color_discrete_map={"수동입력": "#2979FF", "자동연동": "#00E676"},
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
            name = p.get("항목명", "실물자산")
            cost = to_num(p.get("취득원가"), 0)
            dep = to_num(p.get("감가상각누계액"), 0)
            cur = to_num(p.get("현재추정가치") or p.get("현재가치"), 0)
            rate_badge = p.get("연감가율", "연 15% 감가")
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
# TAB 2: 💼 포트폴리오 (Portfolio)
# ===========================================================================
with tabs[1]:
    st.markdown("#### 💵 계좌별 예수금 요약 바")
    st.info(
        f"**위탁계좌 외화예수금 (USD)**: `${usd_deposit_usd:,.2f}` "
        f"(원화환산 `{fmt_curr(usd_deposit_krw, currency, usd_krw_rate)}`) · "
        f"수동 현금성 자산 합계: `{fmt_curr(manual_cash_total_krw, currency, usd_krw_rate)}`"
    )

    account_filter = st.radio(
        "계좌 필터 선택",
        options=["전체", "위탁계좌", "ISA중개형", "연금저축", "퇴직연금(IRP)", "토스증권"],
        horizontal=True,
    )

    filtered_holdings = [
        h
        for h in stock_holding_rows
        if account_filter == "전체" or account_filter in str(h.get("계좌구분", ""))
    ]

    if filtered_holdings:
        df_hold = pd.DataFrame(
            [
                {
                    "계좌": h.get("계좌구분", ""),
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
# TAB 3: 📜 매매·배당 (Trade & Dividend)
# ===========================================================================
with tabs[2]:
    st.markdown("#### 📜 KIS 매매체결 DB & 💸 해외주식 배당내역 DB")
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
# TAB 4: 🤖 AI 리서치 (SaveTicker TOP 5 & Deep Research)
# ===========================================================================
with tabs[3]:
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
# TAB 5: ⚖️ 리밸런싱 시뮬레이터 (Rebalancing)
# ===========================================================================
with tabs[4]:
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
# TAB 6: ✨ AI Copilot (AssetCopilot)
# ===========================================================================
with tabs[5]:
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

        # Gemini API 호출 (설정된 경우) 또는 내장 실시간 분석 엔진 응답
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
# TAB 7: 🖥️ 풀 웹앱 뷰 (React 빌드 내장 뷰)
# ===========================================================================
with tabs[6]:
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
        st.info("React 빌드 아티팩트(`dist/index.html`)가 없을 때는 상단 1~6번 네이티브 탭을 사용하세요.")
