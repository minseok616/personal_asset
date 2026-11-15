"""
AssetVision PRO — Streamlit Community Cloud 개인 자산관리 대시보드 (app.py)

핵심 특징:
1. `st.secrets` 우선 조회 및 로컬 `.env` fallback 공통 헬퍼(`utils.secrets_helper`) 적용
2. Google Sheets(`gspread`) 인증: `st.secrets["gcp_service_account"]` (`Credentials.from_service_account_info`) 우선, 로컬 JSON 파일 fallback
3. KIS API 4대 계좌(위탁 `01`, ISA `01`, 연금저축 `22`, IRP `29`) 연동 및 `@st.cache_resource` 인메모리 토큰 캐싱(`utils.kis_client`) 적용
4. KIS API 자산은 읽기 전용(Read-Only)으로 보호하고, 비-KIS 수동 자산 4대 시트(`💰입출금통장`, `🌱예적금내역`, `🏠채권내역`, `🚗실물_기타자산`)는
   앱 UI(`st.data_editor` & 입력 폼)에서 직접 수정·추가 시 Apps Script 웹앱(`PORTFOLIO_API_URL`)의 `doPost`로 즉시 반영 (수식 열 인덱스 매핑 및 보존)
5. PC & 아이폰 Safari 상단 잘림 해결, `@media (max-width: 768px)` 모바일 반응형/터치 최적화(16px 자동확대 방지, 44px 터치 타겟, 탭 스와이프),
   탭 전환 시 물이 차오르듯 그려지는 60fps CSS `clip-path` & 게이지 애니메이션 적용
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import requests
import streamlit as st
import streamlit.components.v1 as components

from utils.gsheets_client import (
    FORMULA_PROTECTED_COLUMNS,
    SHEET_EDITABLE_COL_INDICES,
    SHEET_FORMULA_COL_INDICES,
    fetch_portfolio_raw_payload,
    fetch_portfolio_raw_payload_with_diagnostics,
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
# 1. 페이지 설정 (데스크톱: 왼쪽 사이드바 표시 / 아이폰 등 모바일: 자동 접힘)
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="AssetVision PRO — 개인 자산관리 포트폴리오",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="auto",
)

# ---------------------------------------------------------------------------
# 2. React 다크 핀테크 터미널 UI · 상단 잘림 해결 · 아이폰 Safari 반응형 · 차트 애니메이션 CSS
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
        overflow-x: hidden !important;
    }
    header[data-testid="stHeader"] {
        background-color: rgba(11, 17, 22, 0.85) !important;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
    }

    /* -------------------------------------------------------------------
       사이드바 (React Sidebar.tsx 다크 핀테크 터미널 스타일)
       ------------------------------------------------------------------- */
    [data-testid="stSidebar"] {
        background-color: #131C24 !important;
        border-right: 1px solid #1F2D3A !important;
    }
    [data-testid="stSidebar"] [data-testid="stSidebarContent"] {
        padding-top: 1rem !important;
        padding-bottom: 1.2rem !important;
    }
    [data-testid="stSidebar"] div[role="radiogroup"] {
        gap: 6px !important;
    }
    [data-testid="stSidebar"] div[role="radiogroup"] > label {
        background: rgba(11, 17, 22, 0.55) !important;
        border: 1px solid #1F2D3A !important;
        border-radius: 12px !important;
        padding: 10px 12px !important;
        min-height: 44px !important;
        margin: 0 !important;
        width: 100% !important;
        transition: all 0.18s ease !important;
        cursor: pointer !important;
    }
    [data-testid="stSidebar"] div[role="radiogroup"] > label:hover {
        border-color: rgba(0, 230, 118, 0.45) !important;
        background: rgba(25, 37, 48, 0.9) !important;
    }
    [data-testid="stSidebar"] div[role="radiogroup"] > label[data-checked="true"],
    [data-testid="stSidebar"] div[role="radiogroup"] > label:has(input:checked) {
        background: linear-gradient(135deg, rgba(0, 230, 118, 0.16), rgba(41, 121, 255, 0.08)) !important;
        border-color: #00E676 !important;
        box-shadow: 0 0 18px rgba(0, 230, 118, 0.14) !important;
    }
    [data-testid="stSidebar"] div[role="radiogroup"] > label p {
        font-size: 0.88rem !important;
        font-weight: 700 !important;
        color: #E2E8F0 !important;
    }
    [data-testid="stSidebar"] div[role="radiogroup"] > label:has(input:checked) p {
        color: #00E676 !important;
    }

    /* -------------------------------------------------------------------
       [1] 상단 잘림 현상 완벽 해결 (데스크톱 3.5rem / 모바일 safe-area 포함)
       ------------------------------------------------------------------- */
    .block-container,
    [data-testid="stMainBlockContainer"] {
        margin-top: 0 !important;
        padding-top: 3.5rem !important;
        padding-bottom: calc(3rem + env(safe-area-inset-bottom, 0px)) !important;
        padding-left: 1.35rem !important;
        padding-right: 1.35rem !important;
        max-width: 1520px !important;
    }

    /* -------------------------------------------------------------------
       [2] 차트 요소 자체 애니메이션 (원형 차트는 원이 그려지고, 막대는 0에서 쭉 차오름)
       ------------------------------------------------------------------- */
    @property --av-pie-sweep {
        syntax: '<angle>';
        inherits: false;
        initial-value: 360deg;
    }

    @keyframes avPieCircleSweep {
        0% {
            --av-pie-sweep: 0deg;
            transform: scale(0.94) rotate(-14deg);
            opacity: 0.25;
        }
        100% {
            --av-pie-sweep: 360deg;
            transform: scale(1) rotate(0deg);
            opacity: 1;
        }
    }

    @keyframes avBarGrowY {
        0% {
            transform: scaleY(0);
            opacity: 0.25;
        }
        100% {
            transform: scaleY(1);
            opacity: 1;
        }
    }

    @keyframes avBarGrowX {
        0% {
            transform: scaleX(0);
            opacity: 0.25;
        }
        100% {
            transform: scaleX(1);
            opacity: 1;
        }
    }

    @keyframes avBarTextFade {
        0%, 40% {
            opacity: 0;
        }
        100% {
            opacity: 1;
        }
    }

    @keyframes avLineSweepRight {
        0% {
            clip-path: inset(0 100% 0 0);
            -webkit-clip-path: inset(0 100% 0 0);
        }
        100% {
            clip-path: inset(0 0 0 0);
            -webkit-clip-path: inset(0 0 0 0);
        }
    }

    @keyframes gaugeFillRight {
        0% {
            transform: scaleX(0);
            opacity: 0.25;
        }
        100% {
            transform: scaleX(1);
            opacity: 1;
        }
    }

    /* 차트 컨테이너는 고정 */
    .stPlotlyChart,
    [data-testid="stPlotlyChart"] {
        max-width: 100% !important;
        overflow: hidden !important;
        border-radius: 14px;
        border: 1px solid #1F2D3A;
        background: #131C24;
    }

    /* (A) 원형/도넛 차트 */
    .stPlotlyChart g.pielayer,
    [data-testid="stPlotlyChart"] g.pielayer,
    [data-baseweb="tab-panel"]:not([hidden]) .stPlotlyChart g.pielayer,
    [data-baseweb="tab-panel"]:not([hidden]) [data-testid="stPlotlyChart"] g.pielayer {
        transform-box: fill-box;
        transform-origin: center center;
        will-change: mask-image, -webkit-mask-image;
    }

    /* (B) 세로 막대 그래프 */
    .stPlotlyChart g.barlayer g.trace g.points g.point path,
    [data-testid="stPlotlyChart"] g.barlayer g.trace g.points g.point path,
    [data-baseweb="tab-panel"]:not([hidden]) .stPlotlyChart g.barlayer g.trace g.points g.point path,
    [data-baseweb="tab-panel"]:not([hidden]) [data-testid="stPlotlyChart"] g.barlayer g.trace g.points g.point path {
        transform-box: fill-box;
        transform-origin: center bottom;
        animation: avBarGrowY 0.85s cubic-bezier(0.22, 1, 0.36, 1) both !important;
        will-change: transform, opacity;
    }

    /* (C) 가로 막대 그래프 */
    [data-testid="stElementContainer"]:has(.av-hbar-marker) + [data-testid="stElementContainer"] g.barlayer g.trace g.points g.point path,
    .stElementContainer:has(.av-hbar-marker) + .stElementContainer g.barlayer g.trace g.points g.point path {
        transform-box: fill-box;
        transform-origin: left center !important;
        animation: avBarGrowX 0.85s cubic-bezier(0.22, 1, 0.36, 1) both !important;
    }

    .stPlotlyChart g.barlayer g.points g.point:nth-child(2) path { animation-delay: 0.04s !important; }
    .stPlotlyChart g.barlayer g.points g.point:nth-child(3) path { animation-delay: 0.08s !important; }
    .stPlotlyChart g.barlayer g.points g.point:nth-child(4) path { animation-delay: 0.12s !important; }
    .stPlotlyChart g.barlayer g.points g.point:nth-child(5) path { animation-delay: 0.16s !important; }
    .stPlotlyChart g.barlayer g.points g.point:nth-child(6) path { animation-delay: 0.20s !important; }
    .stPlotlyChart g.barlayer g.points g.point:nth-child(7) path { animation-delay: 0.24s !important; }

    .stPlotlyChart g.barlayer g.trace g.points g.point text,
    [data-testid="stPlotlyChart"] g.barlayer g.trace g.points g.point text {
        animation: avBarTextFade 0.85s ease-out both !important;
    }

    /* (D) 선/영역 차트 & 스파크라인 */
    .stPlotlyChart g.scatterlayer,
    [data-testid="stPlotlyChart"] g.scatterlayer,
    [data-baseweb="tab-panel"]:not([hidden]) .stPlotlyChart g.scatterlayer,
    [data-baseweb="tab-panel"]:not([hidden]) [data-testid="stPlotlyChart"] g.scatterlayer,
    .av-sparkline-svg {
        animation: avLineSweepRight 0.95s cubic-bezier(0.22, 1, 0.36, 1) both !important;
    }

    /* 가로 비중 스택 바 세그먼트 & 게이지 바 */
    .av-stack-seg {
        transform-origin: left center;
        animation: avBarGrowX 0.85s cubic-bezier(0.22, 1, 0.36, 1) both !important;
        transition: filter 0.15s ease, opacity 0.15s ease;
    }
    .av-stack-seg:hover {
        filter: brightness(1.25);
    }
    .av-gauge-fill,
    [data-baseweb="tab-panel"]:not([hidden]) .av-gauge-fill {
        transform-origin: left center;
        animation: gaugeFillRight 0.9s cubic-bezier(0.22, 1, 0.36, 1) both !important;
        will-change: transform, opacity;
    }

    /* -------------------------------------------------------------------
       React 스타일 다크 터미널 헤더 · KPI 카드 · 계좌 비중 스택 바 · 범례
       ------------------------------------------------------------------- */
    .av-header-shell {
        background: rgba(19, 28, 36, 0.92);
        border: 1px solid #1F2D3A;
        border-radius: 14px;
        padding: 14px 18px;
        margin-bottom: 12px;
        box-shadow: 0 8px 26px rgba(0, 0, 0, 0.35);
    }
    .av-kpi-card {
        background: #131C24;
        border: 1px solid #1F2D3A;
        border-radius: 14px;
        padding: 16px 16px 10px 16px;
        margin-bottom: 10px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.36);
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        min-height: 176px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .av-kpi-mint:hover {
        border-color: rgba(0, 230, 118, 0.55);
        box-shadow: 0 8px 28px rgba(0, 230, 118, 0.12);
    }
    .av-kpi-purple:hover {
        border-color: rgba(156, 39, 176, 0.55);
        box-shadow: 0 8px 28px rgba(156, 39, 176, 0.14);
    }
    .av-kpi-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        margin-bottom: 6px;
    }
    .av-kpi-title {
        color: #7A8B9A;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }
    .av-kpi-icon-mint {
        width: 26px;
        height: 26px;
        border-radius: 8px;
        background: rgba(0, 230, 118, 0.12);
        border: 1px solid rgba(0, 230, 118, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.78rem;
        color: #00E676;
        flex-shrink: 0;
    }
    .av-kpi-icon-purple {
        width: 26px;
        height: 26px;
        border-radius: 8px;
        background: rgba(156, 39, 176, 0.15);
        border: 1px solid rgba(156, 39, 176, 0.42);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.78rem;
        color: #E07BFF;
        flex-shrink: 0;
    }
    .av-kpi-subrow {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(31, 45, 58, 0.8);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        flex-wrap: wrap;
        font-size: 0.74rem;
        font-variant-numeric: tabular-nums;
    }
    .av-stack-card {
        background: #131C24;
        border: 1px solid #1F2D3A;
        border-radius: 14px;
        padding: 16px 18px;
        margin-bottom: 14px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    }
    .av-stacked-track {
        width: 100%;
        height: 20px;
        background: #0B1116;
        border: 1px solid #1F2D3A;
        border-radius: 10px;
        padding: 2px;
        display: flex;
        gap: 2px;
        overflow: hidden;
    }
    .av-legend-grid {
        margin-top: 12px;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
    }
    .av-legend-pill {
        background: rgba(11, 17, 22, 0.72);
        border: 1px solid #1F2D3A;
        border-radius: 10px;
        padding: 9px 10px;
        font-variant-numeric: tabular-nums;
        transition: border-color 0.15s ease, background 0.15s ease;
    }
    .av-legend-pill:hover {
        border-color: rgba(0, 230, 118, 0.48);
        background: #18232E;
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
    .av-card-purple {
        background: linear-gradient(145deg, rgba(156,39,176,0.10), #131C24);
        border: 1px solid rgba(156, 39, 176, 0.38);
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
        font-size: 1.48rem;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        line-height: 1.25;
        letter-spacing: -0.02em;
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
    .av-badge-purple {
        display: inline-block;
        background: rgba(156, 39, 176, 0.18);
        color: #E07BFF;
        border: 1px solid rgba(156, 39, 176, 0.42);
        border-radius: 999px;
        padding: 2px 9px;
        font-size: 0.72rem;
        font-weight: 700;
    }

    /* -------------------------------------------------------------------
       탭 메뉴 좌우 터치 스와이프 & 스크롤바 숨김 (PC & 모바일 공통)
       ------------------------------------------------------------------- */
    [data-baseweb="tab-list"] {
        gap: 8px !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        -webkit-overflow-scrolling: touch !important;
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
        padding-bottom: 6px !important;
        flex-wrap: nowrap !important;
    }
    [data-baseweb="tab-list"]::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
    }
    [data-baseweb="tab"] {
        background-color: #131C24 !important;
        border: 1px solid #1F2D3A !important;
        border-radius: 10px !important;
        padding: 10px 15px !important;
        min-height: 44px !important;
        color: #7A8B9A !important;
        font-size: 0.86rem !important;
        font-weight: 700 !important;
        white-space: nowrap !important;
        flex-shrink: 0 !important;
        transition: all 0.2s ease !important;
    }
    [aria-selected="true"][data-baseweb="tab"] {
        background-color: rgba(0, 230, 118, 0.14) !important;
        border-color: #00E676 !important;
        color: #00E676 !important;
        box-shadow: 0 0 14px rgba(0, 230, 118, 0.18) !important;
    }

    /* 버튼 최소 터치 영역 44px 보장 */
    .stButton > button,
    .stFormSubmitButton > button,
    .stLinkButton > a {
        min-height: 44px !important;
        border-radius: 10px !important;
        font-weight: 700 !important;
    }

    /* -------------------------------------------------------------------
       [3] 아이폰(모바일 Safari <= 768px) 전용 반응형 레이아웃 & 터치 최적화
       ------------------------------------------------------------------- */
    @media (max-width: 768px) {
        .block-container,
        [data-testid="stMainBlockContainer"] {
            margin-top: 0 !important;
            padding-top: calc(3.6rem + env(safe-area-inset-top, 0px)) !important;
            padding-bottom: calc(3.2rem + env(safe-area-inset-bottom, 0px)) !important;
            padding-left: 0.75rem !important;
            padding-right: 0.75rem !important;
        }

        /* 다중 열(st.columns)을 모바일 세로 화면에서 찌그러짐 없이 1열 세로 스택으로 전환 */
        [data-testid="stHorizontalBlock"] {
            flex-direction: column !important;
            gap: 0.6rem !important;
        }
        [data-testid="stHorizontalBlock"] > [data-testid="column"],
        [data-testid="stHorizontalBlock"] > [data-testid="stColumn"] {
            width: 100% !important;
            flex: 1 1 100% !important;
            min-width: 100% !important;
        }

        .av-legend-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        /* 아이폰 Safari 입력 포커스 시 자동 화면 확대(Auto-Zoom) 방지: 최소 16px */
        input,
        select,
        textarea,
        .stTextInput input,
        .stNumberInput input,
        .stDateInput input,
        .stChatInput textarea,
        [data-baseweb="input"] input,
        [data-baseweb="select"] div,
        [data-baseweb="select"] span,
        [data-baseweb="textarea"] textarea {
            font-size: 16px !important;
        }

        /* 모바일 터치 타겟 최소 44px 보장 */
        .stButton > button,
        .stFormSubmitButton > button,
        .stLinkButton > a,
        [data-baseweb="select"] > div,
        [data-baseweb="input"] > div {
            min-height: 44px !important;
        }

        .av-value {
            font-size: 1.28rem !important;
        }
        .av-kpi-card {
            min-height: 152px !important;
        }
        .av-card, .av-card-mint, .av-card-coral, .av-card-purple, .av-stack-card {
            padding: 13px !important;
            margin-bottom: 8px !important;
        }

        /* 차트와 표가 모바일 가로폭을 절대 넘지 않도록 강제 */
        .stPlotlyChart,
        [data-testid="stPlotlyChart"],
        [data-testid="stDataFrame"],
        [data-testid="stDataEditor"] {
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: auto !important;
        }
    }
    </style>
    """,
    unsafe_allow_html=True,
)


# ---------------------------------------------------------------------------
# 3. 숫자/날짜 파싱 · 기초자산 분류 · React 호환 UI 헬퍼 유틸리티
# ---------------------------------------------------------------------------
KST = timezone(timedelta(hours=9))


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
        usd = krw_val / (usd_rate if usd_rate > 0 else 1335.32)
        return f"${usd:,.2f}"
    return f"₩{krw_val:,.0f}"


def fmt_compact_curr(krw_val: float, currency: str, usd_rate: float) -> str:
    """React formatCompactCurrency 호환 요약 금액 표기."""
    if currency == "USD":
        usd = krw_val / (usd_rate if usd_rate > 0 else 1335.32)
        if abs(usd) >= 1000:
            return f"${usd / 1000:,.1f}K"
        return f"${usd:,.0f}"
    abs_v = abs(krw_val)
    sign = "-" if krw_val < 0 else ""
    if abs_v >= 100_000_000:
        return f"{sign}₩{abs_v / 100_000_000:.2f}억"
    if abs_v >= 10_000:
        return f"{sign}₩{round(abs_v / 10_000):,}만"
    return f"{sign}₩{abs_v:,.0f}"


def classify_kis_account(row: Dict[str, Any]) -> str:
    """KIS 행의 계좌구분/시장구분/종목코드를 표준 계좌명으로 매핑합니다."""
    raw = f"{row.get('계좌구분', '')} {row.get('시장구분', '')} {row.get('종목명', '')} {row.get('종목코드', '')}".upper()
    if "ISA" in raw or "43783213" in raw:
        return "ISA중개형"
    if "연금저축" in raw or "47223092" in raw:
        return "연금저축"
    if "IRP" in raw or "퇴직연금" in raw or "43469117" in raw:
        return "퇴직연금(IRP)"
    if "토스" in raw or "NAS" in raw or "NYS" in raw or "AMS" in raw:
        return "토스증권"
    return "위탁계좌"


def is_pure_bond_etf(row: Dict[str, Any]) -> bool:
    """순수 채권/국채 ETF 여부를 판별합니다 (채권혼합형 ETF 제외)."""
    name = str(row.get("종목명", ""))
    return ("국채" in name or "채권" in name) and "혼합" not in name


def build_svg_sparkline(values: List[float], stroke_color: str, grad_id: str) -> str:
    """KPI 카드 하단용 반응형 네온 스파크라인 SVG 마크업을 생성합니다."""
    pts = [float(v) for v in values if v is not None]
    if len(pts) < 2:
        pts = [1.0, 1.04, 1.02, 1.08, 1.12]
    v_min = min(pts)
    v_max = max(pts)
    span = (v_max - v_min) if (v_max - v_min) > 1e-6 else 1.0
    w, h = 240.0, 44.0
    pad_y = 4.0
    step_x = w / max(1, len(pts) - 1)
    coords = []
    for idx, val in enumerate(pts):
        x = idx * step_x
        norm_y = (val - v_min) / span
        y = h - pad_y - norm_y * (h - pad_y * 2)
        coords.append((round(x, 2), round(y, 2)))
    line_path = "M " + " L ".join(f"{x},{y}" for x, y in coords)
    area_path = f"{line_path} L {w},{h} L 0,{h} Z"
    return (
        f'<svg class="av-sparkline-svg" viewBox="0 0 240 44" preserveAspectRatio="none" '
        f'style="width:100%; height:44px; display:block; margin-top:8px;">'
        f"<defs><linearGradient id='{grad_id}' x1='0' y1='0' x2='0' y2='1'>"
        f"<stop offset='0%' stop-color='{stroke_color}' stop-opacity='0.36'/>"
        f"<stop offset='100%' stop-color='{stroke_color}' stop-opacity='0.0'/>"
        f"</linearGradient></defs>"
        f"<path d='{area_path}' fill='url(#{grad_id})'/>"
        f"<path d='{line_path}' fill='none' stroke='{stroke_color}' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/>"
        f"</svg>"
    )


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

raw_payload_fetched, data_source_label, fetch_diagnostics = (
    fetch_portfolio_raw_payload_with_diagnostics()
)
raw_payload: Dict[str, Any] = (
    dict(raw_payload_fetched) if isinstance(raw_payload_fetched, dict) else {}
)
for k_ov, v_ov in st.session_state["sheet_overrides"].items():
    raw_payload[k_ov] = v_ov

section_warnings: List[str] = []

_, gspread_status = get_gspread_client()
kis_token, kis_token_status = get_kis_access_token()
kis_cfg = get_kis_config()
configured_kis_accounts = get_configured_kis_accounts()

# KIS 4대 계좌(위탁, ISA, 연금저축, IRP) 직접 조회 설정 시 실시간 잔고 보강 (읽기 전용)
if kis_token and configured_kis_accounts and not raw_payload.get("kisRealtime"):
    try:
        direct_rows = fetch_all_kis_accounts_balance()
        if direct_rows:
            raw_payload["kisRealtime"] = direct_rows
    except Exception as kis_exc:
        section_warnings.append(f"[KIS OpenAPI 실시간 잔고 조회] {type(kis_exc).__name__}: {kis_exc}")

summary_raw_obj = raw_payload.get("summary")
summary_raw: Dict[str, Any] = summary_raw_obj if isinstance(summary_raw_obj, dict) else {}

integrated_raw_obj = raw_payload.get("integratedSummary")
if isinstance(integrated_raw_obj, dict):
    integrated_raw: Dict[str, Any] = integrated_raw_obj
elif isinstance(integrated_raw_obj, list):
    integrated_raw = {
        str(r.get("항목") or r.get("구분") or r.get("자산 대분류") or r.get("key") or idx): (
            r.get("금액") or r.get("평가금액 (KRW)") or r.get("값") or r.get("value")
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
try:
    if isinstance(raw_checking_candidates, list):
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
except Exception as chk_exc:
    section_warnings.append(f"[💰입출금통장 파싱] {type(chk_exc).__name__}: {chk_exc}")

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
try:
    if isinstance(raw_savings_candidates, list):
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
except Exception as sav_exc:
    section_warnings.append(f"[🌱예적금내역 파싱] {type(sav_exc).__name__}: {sav_exc}")

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

raw_sav_integrated = to_num(integrated_raw.get("은행 예적금"), 0)
raw_sav_summary = to_num(summary_raw.get("예적금"), 0)
savings_total_krw = (
    raw_sav_integrated
    if raw_sav_integrated >= 5_000_000
    else (raw_sav_summary if raw_sav_summary >= 5_000_000 else 44_127_594)
)

# 예적금 만기 D-Day 및 진행률 계산 (사이드바 하단 & Savings 메뉴 공용)
today_kst = datetime.now(KST).date()
enriched_savings: List[Dict[str, Any]] = []
for s in savings_rows:
    s_copy = dict(s)
    start_str = fmt_date_kst(s.get("가입일"))
    end_str = fmt_date_kst(s.get("만기일"))
    months_term = int(to_num(s.get("기간"), 12))
    d_day_val: Optional[int] = None
    progress_pct = 0.0
    try:
        start_dt = datetime.strptime(start_str[:10], "%Y-%m-%d").date() if len(start_str) >= 10 else None
        if len(end_str) >= 10:
            end_dt = datetime.strptime(end_str[:10], "%Y-%m-%d").date()
        elif start_dt is not None:
            end_dt = start_dt + timedelta(days=round(months_term * 30.4375))
            end_str = end_dt.strftime("%Y-%m-%d")
        else:
            end_dt = None
        if end_dt is not None:
            d_day_val = (end_dt - today_kst).days
            if start_dt is not None and end_dt > start_dt:
                total_days = (end_dt - start_dt).days
                elapsed_days = max(0, min(total_days, (today_kst - start_dt).days))
                progress_pct = round((elapsed_days / total_days) * 100.0, 1)
    except Exception:
        pass
    raw_rate = to_num(s.get("이율"), 0)
    rate_pct = raw_rate * 100.0 if 0 < raw_rate < 1 else raw_rate
    s_copy["만기일"] = end_str
    s_copy["d_day"] = d_day_val
    s_copy["progress_pct"] = progress_pct
    s_copy["rate_pct"] = round(rate_pct, 2)
    s_copy["after_tax_krw"] = round(
        to_num(s.get("만기수령액(세후)"), 0) or to_num(s.get("만기수령액(통화)"), 0)
    )
    enriched_savings.append(s_copy)

savings_rows = enriched_savings
active_savings = [s for s in savings_rows if s.get("d_day") is not None and s["d_day"] >= 0]
nearest_savings: Optional[Dict[str, Any]] = (
    min(active_savings, key=lambda x: x["d_day"])
    if active_savings
    else (savings_rows[0] if savings_rows else None)
)

# 3) 🏠채권내역 (bonds — A~E열 입력, F~G열 수식 보존)
raw_bonds_candidates = raw_payload.get("bonds") or []
bonds_rows: List[Dict[str, Any]] = []
try:
    if isinstance(raw_bonds_candidates, list):
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
except Exception as bnd_exc:
    section_warnings.append(f"[🏠채권내역 파싱] {type(bnd_exc).__name__}: {bnd_exc}")

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
    summary_raw.get("채권"), 17_570_790
)

# 4) 🚗실물_기타자산 (physicalAssets — 시트 병합 타이틀/합계 행 자동 감지 및 정규화)
raw_phys_candidates = raw_payload.get("physicalAssets") or []
physical_rows: List[Dict[str, Any]] = []
try:
    if isinstance(raw_phys_candidates, list):
        for r in raw_phys_candidates:
            if not isinstance(r, dict):
                continue
            cat_raw = str(r.get("자산구분") or r.get("카테고리") or "기타실물").strip()
            name = str(r.get("자산명") or r.get("품목명(모델명)") or r.get("품목") or r.get("항목명") or "").strip()
            if not name or cat_raw == "합계" or "실물자산 총" in name:
                continue
            cur_val = to_num(
                r.get("현재평가액(원)") or r.get("현재가치") or r.get("현재잔존가치(원)") or r.get("현재추정가치") or r.get("잔존가치"),
                0,
            )
            if cur_val <= 0:
                continue
            purchase_val = to_num(r.get("취득원가(원)") or r.get("취득원가"), 0)
            accum_dep = to_num(r.get("감가상각누계액(원)") or r.get("감가상각누계액"), 0)
            years_val = r.get("내용연수(년)", "-")
            res_ratio = to_num(r.get("잔존가치율"), 0)
            if to_num(years_val, 0) > 0:
                est_rate = round(((1 - (res_ratio / 100.0 if res_ratio > 1 else res_ratio)) / to_num(years_val, 1)) * 100)
            else:
                est_rate = to_num(r.get("연감가율(%)") or r.get("연간상각률") or r.get("연감가율"), 0)
            physical_rows.append(
                {
                    "자산구분": cat_raw,
                    "카테고리": cat_raw,
                    "자산명": name,
                    "취득일": fmt_date_kst(r.get("취득일") or r.get("취득일자")),
                    "취득원가(원)": purchase_val,
                    "취득원가": purchase_val,
                    "내용연수(년)": years_val,
                    "잔존가치율": res_ratio,
                    "감가상각방법": str(r.get("감가상각방법") or "정액법").strip(),
                    "경과월수(개월)": r.get("경과월수(개월)", "-"),
                    "연감가율(%)": est_rate,
                    "감가상각누계액(원)": accum_dep,
                    "감가상각누계액": accum_dep,
                    "현재평가액(원)": cur_val,
                    "현재가치": cur_val,
                    "비고 및 감가상각 설명": str(r.get("비고 및 감가상각 설명") or r.get("비고") or "").strip(),
                    "비고": str(r.get("비고 및 감가상각 설명") or r.get("비고") or "").strip(),
                }
            )
except Exception as phys_exc:
    section_warnings.append(f"[🚗실물_기타자산 파싱] {type(phys_exc).__name__}: {phys_exc}")

if not physical_rows:
    physical_rows = [
        {
            "자산구분": "자동차",
            "카테고리": "자동차",
            "자산명": "현대 디 올뉴코나 1.6 터보",
            "취득일": "2026-04-01",
            "취득원가(원)": 28000000,
            "취득원가": 28000000,
            "내용연수(년)": 5,
            "잔존가치율": 0.1,
            "감가상각방법": "정액법 (5년)",
            "경과월수(개월)": 7,
            "연감가율(%)": 18,
            "감가상각누계액(원)": 2940000,
            "감가상각누계액": 2940000,
            "현재평가액(원)": 25060000,
            "현재가치": 25060000,
            "비고 및 감가상각 설명": "차량 감가상각률 연 18% (내용연수 60개월, 잔존가치 10%)",
            "비고": "차량 감가상각률 연 18% (내용연수 60개월, 잔존가치 10%)",
        },
        {
            "자산구분": "전자기기",
            "카테고리": "전자기기",
            "자산명": "아이폰 17 프로",
            "취득일": "2026-01-01",
            "취득원가(원)": 1550000,
            "취득원가": 1550000,
            "내용연수(년)": 3,
            "잔존가치율": 0.0,
            "감가상각방법": "정액법 (3년)",
            "경과월수(개월)": 10,
            "연감가율(%)": 33,
            "감가상각누계액(원)": 430556,
            "감가상각누계액": 430556,
            "현재평가액(원)": 1119444,
            "현재가치": 1119444,
            "비고 및 감가상각 설명": "스마트폰 감가상각 (내용연수 36개월, 잔존가치 0%)",
            "비고": "스마트폰 감가상각 (내용연수 36개월, 잔존가치 0%)",
        },
        {
            "자산구분": "귀금속",
            "카테고리": "귀금속",
            "자산명": "금반지 (순금 1돈)",
            "취득일": "2026-08-01",
            "취득원가(원)": 300000,
            "취득원가": 300000,
            "내용연수(년)": "-",
            "잔존가치율": 1.0,
            "감가상각방법": "비상각(시세반영)",
            "경과월수(개월)": "-",
            "연감가율(%)": 0,
            "감가상각누계액(원)": 0,
            "감가상각누계액": 0,
            "현재평가액(원)": 300000,
            "현재가치": 300000,
            "비고 및 감가상각 설명": "귀금속 자산가치 보존 (비감가상각 대상)",
            "비고": "귀금속 자산가치 보존 (비감가상각 대상)",
        },
    ]

physical_total_krw = sum(to_num(r.get("현재평가액(원)") or r.get("현재가치"), 0) for r in physical_rows) or 26_479_444

# ---------------------------------------------------------------------------
# 4-B. KIS 실시간 잔고 분리 (읽기 전용: 현금성 예수금 vs 투자 종목)
# ---------------------------------------------------------------------------
kis_rows_raw = raw_payload.get("kisRealtime") or []
kis_rows: List[Dict[str, Any]] = kis_rows_raw if isinstance(kis_rows_raw, list) else []
cash_deposit_rows: List[Dict[str, Any]] = []
stock_holding_rows: List[Dict[str, Any]] = []

try:
    for r in kis_rows:
        if not isinstance(r, dict):
            continue
        code = str(r.get("종목코드", "")).strip()
        name = str(r.get("종목명", "")).strip()
        if not code and not name:
            continue
        if "조회오류" in name:
            continue
        underlying_cls = classify_underlying_asset(r)
        acc_name = classify_kis_account(r)
        item = dict(r)
        item["계좌명"] = acc_name
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
except Exception as kis_parse_exc:
    section_warnings.append(f"[💾KIS_실시간잔고 파싱] {type(kis_parse_exc).__name__}: {kis_parse_exc}")

# 한투 예수금 전 계좌 합산 (위탁 KRW/USD + ISA + 연금저축 + IRP) — React dataParser.ts와 100% 동일 기준
kis_cash_total_krw = sum(c["평가금액_num"] for c in cash_deposit_rows)
if kis_cash_total_krw <= 0 and not kis_rows:
    kis_cash_total_krw = 27_183_155

kis_usd_rows = [
    c
    for c in cash_deposit_rows
    if str(c.get("종목코드", "")).upper().startswith("CASH_USD") or "달러" in str(c.get("종목명", ""))
]
usd_deposit_krw = sum(c["평가금액_num"] for c in kis_usd_rows) if kis_usd_rows else kis_cash_total_krw
usd_deposit_usd = (
    sum(c.get("외화원금_usd", 0.0) for c in kis_usd_rows)
    if kis_usd_rows
    else (usd_deposit_krw / usd_krw_rate)
)
kis_krw_cash_total = max(0.0, kis_cash_total_krw - usd_deposit_krw)
total_cash_asset_krw = manual_cash_total_krw + kis_cash_total_krw

stock_eval_total_krw = sum(h["평가금액_num"] for h in stock_holding_rows)
if stock_eval_total_krw <= 0 and not kis_rows:
    stock_eval_total_krw = 25_834_505
stock_profit_total_krw = sum(h["평가손익_num"] for h in stock_holding_rows)
if stock_profit_total_krw == 0 and not stock_holding_rows and not kis_rows:
    stock_profit_total_krw = 1_438_220
stock_buy_total_krw = max(stock_eval_total_krw - stock_profit_total_krw, 1)
stock_return_pct = (stock_profit_total_krw / stock_buy_total_krw) * 100

# 통합 순자산 (금융 순자산 = 수동현금 + KIS예수금전체 + 예적금 + 주식/ETF평가액 + 직접보유채권)
financial_net_worth_krw = (
    manual_cash_total_krw
    + kis_cash_total_krw
    + savings_total_krw
    + stock_eval_total_krw
    + bond_direct_krw
)
grand_total_krw = financial_net_worth_krw + physical_total_krw

# 실질 기초자산별 & 상장시장 기준 평가금액 집계 (React dataParser.ts와 동일)
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
kis_bond_etf_krw = sum(h["평가금액_num"] for h in stock_holding_rows if is_pure_bond_etf(h))
domestic_etf_krw = sum(
    h["평가금액_num"]
    for h in stock_holding_rows
    if not is_pure_bond_etf(h) and ("KRX" in str(h.get("시장구분", "")).upper() or "국내" in str(h.get("시장구분", "")))
)
overseas_direct_krw = max(0.0, stock_eval_total_krw - kis_bond_etf_krw - domestic_etf_krw)

# 계좌별 통합 비중 집계 (React AccountStackedBar 8대 계좌와 1:1 일치 — 합계 = grand_total_krw)
def _calc_kis_acc_bucket(acc_label: str) -> Dict[str, float]:
    h_rows = [h for h in stock_holding_rows if h.get("계좌명") == acc_label]
    c_rows = [c for c in cash_deposit_rows if c.get("계좌명") == acc_label]
    ev = sum(h["평가금액_num"] for h in h_rows)
    pf = sum(h["평가손익_num"] for h in h_rows)
    cs = sum(c["평가금액_num"] for c in c_rows)
    buy = ev - pf
    return {
        "eval": ev,
        "cash": cs,
        "total": ev + cs,
        "profit": pf,
        "ret": (pf / buy * 100.0) if buy > 0 else 0.0,
    }

_acc_witak = _calc_kis_acc_bucket("위탁계좌")
_acc_pension = _calc_kis_acc_bucket("연금저축")
_acc_irp = _calc_kis_acc_bucket("퇴직연금(IRP)")
_acc_isa = _calc_kis_acc_bucket("ISA중개형")
_acc_toss = _calc_kis_acc_bucket("토스증권")

account_breakdown: List[Dict[str, Any]] = [
    {
        "name": "수동 현금·증여·기여금",
        "sub": "증여 5천만 · 현금 3,600만 · 기여금 640만 · 은행",
        "total": manual_cash_total_krw,
        "profit": 0.0,
        "ret": 0.0,
        "color": "#00E676",
    },
    {
        "name": "은행 예적금",
        "sub": "하나 청년도약 · 신한 적금 · 청약",
        "total": savings_total_krw,
        "profit": 0.0,
        "ret": 4.85,
        "color": "#2979FF",
    },
    {
        "name": "한투 위탁(달러예수금)",
        "sub": f"외화예수금 ${usd_deposit_usd:,.2f} 포함",
        "total": _acc_witak["total"],
        "profit": _acc_witak["profit"],
        "ret": _acc_witak["ret"],
        "color": "#64B5F6",
    },
    {
        "name": "실물·기타자산",
        "sub": "현대 코나 · 아이폰 · 금 (감가상각)",
        "total": physical_total_krw,
        "profit": 0.0,
        "ret": 0.0,
        "color": "#FF5252",
    },
    {
        "name": "미래에셋 해외채권",
        "sub": "미국장기채 T1.125 직접 보유",
        "total": bond_direct_krw,
        "profit": 0.0,
        "ret": 0.0,
        "color": "#00B0FF",
    },
    {
        "name": "한투 연금저축",
        "sub": "S&P500 · 나스닥100 · TDF2050",
        "total": _acc_pension["total"],
        "profit": _acc_pension["profit"],
        "ret": _acc_pension["ret"],
        "color": "#9C27B0",
    },
    {
        "name": "한투 IRP (퇴직연금)",
        "sub": "미국지수 · 배당성장 · 채권혼합",
        "total": _acc_irp["total"],
        "profit": _acc_irp["profit"],
        "ret": _acc_irp["ret"],
        "color": "#FFAB00",
    },
    {
        "name": "ISA중개형 (한투)",
        "sub": "ACE 미국30년국채 · 예수금",
        "total": _acc_isa["total"],
        "profit": _acc_isa["profit"],
        "ret": _acc_isa["ret"],
        "color": "#1DE9B6",
    },
]
if _acc_toss["total"] > 0:
    account_breakdown.append(
        {
            "name": "토스증권",
            "sub": "해외 직투 종목",
            "total": _acc_toss["total"],
            "profit": _acc_toss["profit"],
            "ret": _acc_toss["ret"],
            "color": "#E07BFF",
        }
    )
account_breakdown = [a for a in account_breakdown if a["total"] > 0]
_acc_sum = sum(a["total"] for a in account_breakdown) or 1.0
for _ab in account_breakdown:
    _ab["weight"] = (_ab["total"] / _acc_sum) * 100.0

# 4-C. 월간 현금흐름 (monthlyCashflow / monthlySavingsDist) 및 자산 추이 동기화
raw_cf_candidates = raw_payload.get("monthlyCashflow") or []
if not isinstance(raw_cf_candidates, list) or len(raw_cf_candidates) == 0:
    raw_cf_candidates = [
        {"Category": "잔액", "Amount": 403693},
        {"Category": "저축 ", "Amount": 1850000},
        {"Category": "지출", "Amount": 1662307},
    ]

cf_balance_krw = 0.0
cf_savings_flow_krw = 0.0
cf_expense_krw = 0.0
for _cf_row in raw_cf_candidates:
    if not isinstance(_cf_row, dict):
        continue
    _cf_cat = str(_cf_row.get("Category") or _cf_row.get("구분") or "").strip()
    _cf_amt = to_num(_cf_row.get("Amount") if "Amount" in _cf_row else _cf_row.get("금액"), 0)
    if "잔액" in _cf_cat:
        cf_balance_krw += _cf_amt
    elif "저축" in _cf_cat:
        cf_savings_flow_krw += _cf_amt
    elif "지출" in _cf_cat:
        cf_expense_krw += _cf_amt

cf_total_income_krw = cf_balance_krw + cf_savings_flow_krw + cf_expense_krw
cf_surplus_krw = cf_savings_flow_krw + cf_balance_krw
cf_savings_rate_pct = (cf_surplus_krw / cf_total_income_krw * 100.0) if cf_total_income_krw > 0 else 0.0
cf_pure_savings_rate_pct = (cf_savings_flow_krw / cf_total_income_krw * 100.0) if cf_total_income_krw > 0 else 0.0

raw_dist_candidates = raw_payload.get("monthlySavingsDist") or []
if not isinstance(raw_dist_candidates, list) or len(raw_dist_candidates) == 0:
    raw_dist_candidates = [
        {"저축 분류": "IRP & 연금 저축", "IRP & 연금 저축": 750000},
        {"저축 분류": "전세금 상환 저축액", "전세금 상환 저축액": 300000},
        {"저축 분류": "주택청약저축", "주택청약저축": 100000},
        {"저축 분류": "청년도약계좌 (28년 8월 만기)", "청년도약계좌 (28년 8월 만기)": 700000},
    ]

_dist_palette = ["#00E676", "#2979FF", "#9C27B0", "#00B0FF", "#651FFF", "#1DE9B6"]
savings_dist_rows: List[Dict[str, Any]] = []
for _d_idx, _d_row in enumerate(raw_dist_candidates):
    if not isinstance(_d_row, dict):
        continue
    _l_key = next((k for k in _d_row.keys() if "저축 분류" in str(k) or "저축 분야" in str(k) or "분류" in str(k)), None)
    _d_label = str(_d_row.get(_l_key, "")).strip() if _l_key else ""
    if not _d_label:
        continue
    _d_val = to_num(_d_row.get(_d_label), 0)
    if _d_val == 0:
        for _k, _v in _d_row.items():
            if _k != _l_key and _v not in ("", None) and to_num(_v, 0) > 0:
                _d_val = to_num(_v, 0)
                break
    _short_nm = (
        _d_label.replace(" (28년 8월 만기)", "").replace(" 상환 저축액", "").replace(" & 연금 저축", "/연금")
    )
    savings_dist_rows.append(
        {
            "항목": _d_label,
            "약칭": _short_nm,
            "금액": _d_val,
            "구분": "저축/투자",
            "색상": _dist_palette[_d_idx % len(_dist_palette)],
            "비중(%)": (_d_val / cf_total_income_krw * 100.0) if cf_total_income_krw > 0 else 0.0,
        }
    )
savings_dist_rows.sort(key=lambda x: x["금액"], reverse=True)
combined_cashflow_bars: List[Dict[str, Any]] = [d for d in savings_dist_rows if d["금액"] > 0] + [
    {
        "항목": "월 생활비/지출",
        "약칭": "지출 (소비)",
        "금액": cf_expense_krw,
        "구분": "지출",
        "색상": "#FF5252",
        "비중(%)": (cf_expense_krw / cf_total_income_krw * 100.0) if cf_total_income_krw > 0 else 0.0,
    },
    {
        "항목": "월 잉여 잔액",
        "약칭": "잉여 잔액",
        "금액": cf_balance_krw,
        "구분": "잉여잔액",
        "색상": "#2979FF",
        "비중(%)": (cf_balance_krw / cf_total_income_krw * 100.0) if cf_total_income_krw > 0 else 0.0,
    },
]

# 자산 추이 마지막 포인트를 실시간 순자산과 일치시킴 (React dataParser.ts 동기화 규칙)
synced_hist_rows: List[Dict[str, Any]] = []
if isinstance(asset_history_list, list):
    for h_row in asset_history_list:
        if isinstance(h_row, dict):
            dt_s = fmt_date_kst(h_row.get("날짜"))
            fin_v = to_num(h_row.get("총합계(원)"), 0)
            sav_v = to_num(h_row.get("예적금합계(원)"), 0)
            if dt_s and fin_v > 0:
                synced_hist_rows.append({"날짜": dt_s, "금융총액": fin_v, "실물포함총액": fin_v, "예적금누계": sav_v})
if synced_hist_rows:
    synced_hist_rows[-1]["금융총액"] = round(financial_net_worth_krw)
    synced_hist_rows[-1]["실물포함총액"] = round(grand_total_krw)
    synced_hist_rows[-1]["예적금누계"] = round(savings_total_krw)

_prev_fin_val = synced_hist_rows[-2]["금융총액"] if len(synced_hist_rows) >= 2 else financial_net_worth_krw
mom_change_krw = financial_net_worth_krw - _prev_fin_val
mom_change_pct = (mom_change_krw / _prev_fin_val * 100.0) if _prev_fin_val > 0 else 0.0

net_worth_spark = [r["실물포함총액"] for r in synced_hist_rows[-8:]] or [financial_net_worth_krw * 0.9, financial_net_worth_krw]
pl_spark = [
    stock_eval_total_krw * 0.94,
    stock_eval_total_krw * 0.96,
    stock_eval_total_krw * 0.95,
    stock_eval_total_krw * 0.99,
    stock_eval_total_krw,
]
surplus_spark = [cf_savings_flow_krw, cf_surplus_krw * 0.95, cf_surplus_krw * 1.02, cf_surplus_krw]
savings_rate_spark = [42.0, 47.2, 51.5, 54.0, round(cf_savings_rate_pct, 1)]


# ---------------------------------------------------------------------------
# 5. 왼쪽 사이드바 네비게이션 (React Sidebar 스타일 · 모바일 자동 접힘)
# ---------------------------------------------------------------------------
MENU_ITEMS = [
    "Dashboard",
    "Portfolio",
    "Trade & Dividend",
    "AI Research",
    "Rebalancing",
    "Cashflow",
    "Savings",
    "비-KIS 시트 수정",
]
MENU_LABELS = {
    "Dashboard": "📊  Dashboard",
    "Portfolio": "💼  Portfolio",
    "Trade & Dividend": "📜  Trade & Dividend",
    "AI Research": "🤖  AI Research",
    "Rebalancing": "⚖️  Rebalancing",
    "Cashflow": "💸  Cashflow",
    "Savings": "🌱  Savings",
    "비-KIS 시트 수정": "✏️  비-KIS 시트 수정",
}
MENU_SUBTITLES = {
    "Dashboard": ("Portfolio Command Center", "실시간 KIS · 구글 시트 통합 순자산 브리핑"),
    "Portfolio": ("Holdings & Deposit Vault", "한투 OpenAPI 4대 계좌 읽기 전용 정밀 잔고"),
    "Trade & Dividend": ("Execution & Dividend Ledger", "최근 매매체결 내역 및 배당금 현금흐름"),
    "AI Research": ("Deep Research & Copilot", "SaveTicker TOP 5 · 관심종목 Bull/Bear · AI 비서"),
    "Rebalancing": ("Allocation Simulator", "목표 비중 대비 현재 괴리도 및 리밸런싱 계산기"),
    "Cashflow": ("Monthly Cashflow Analytics", "월 수입 대비 저축·투자 비중 및 지출 구조"),
    "Savings": ("Savings Maturity Tracker", "예적금 만기 D-Day 진행률 및 채권 적립 현황"),
    "비-KIS 시트 수정": ("Google Sheets Two-Way Sync", "수동 관리 4대 시트 실시간 수정 및 행 추가"),
}

if "active_menu" not in st.session_state or st.session_state["active_menu"] not in MENU_ITEMS:
    st.session_state["active_menu"] = "Dashboard"
if "_nav_sidebar_radio" not in st.session_state:
    st.session_state["_nav_sidebar_radio"] = st.session_state["active_menu"]
if "_nav_mobile_select" not in st.session_state:
    st.session_state["_nav_mobile_select"] = st.session_state["active_menu"]
if "show_ai_copilot_panel" not in st.session_state:
    st.session_state["show_ai_copilot_panel"] = False


def _sync_menu_from_sidebar() -> None:
    st.session_state["active_menu"] = st.session_state["_nav_sidebar_radio"]
    st.session_state["_nav_mobile_select"] = st.session_state["_nav_sidebar_radio"]


def _sync_menu_from_mobile() -> None:
    st.session_state["active_menu"] = st.session_state["_nav_mobile_select"]
    st.session_state["_nav_sidebar_radio"] = st.session_state["_nav_mobile_select"]


with st.sidebar:
    st.markdown(
        """
        <div style="display:flex; align-items:center; gap:10px; padding:6px 4px 12px 4px; border-bottom:1px solid #1F2D3A; margin-bottom:10px;">
            <div style="width:36px; height:36px; border-radius:10px; background:rgba(0,230,118,0.12); border:1px solid rgba(0,230,118,0.38); display:flex; align-items:center; justify-content:center; font-size:1.1rem;">📈</div>
            <div>
                <div style="font-size:0.98rem; font-weight:900; color:#FFFFFF; letter-spacing:-0.01em;">
                    AssetVision <span style="color:#00E676;">PRO</span>
                </div>
                <div style="font-size:0.65rem; font-weight:700; color:#7A8B9A; letter-spacing:0.06em;">WEALTH TERMINAL v3.2</div>
            </div>
        </div>
        <div style="font-size:0.68rem; font-weight:800; color:#7A8B9A; letter-spacing:0.08em; text-transform:uppercase; padding:0 4px 4px 4px;">
            Terminal Menu
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.radio(
        "메뉴 선택",
        options=MENU_ITEMS,
        format_func=lambda m: MENU_LABELS.get(m, m),
        key="_nav_sidebar_radio",
        on_change=_sync_menu_from_sidebar,
        label_visibility="collapsed",
    )

    st.markdown(
        "<div style='border-top:1px solid #1F2D3A; margin:12px 0 8px 0;'></div>",
        unsafe_allow_html=True,
    )
    if st.button(
        "✨ AssetCopilot AI 열기/닫기" if not st.session_state["show_ai_copilot_panel"] else "✕ AssetCopilot AI 닫기",
        use_container_width=True,
        key="btn_sidebar_copilot_toggle",
    ):
        st.session_state["show_ai_copilot_panel"] = not st.session_state["show_ai_copilot_panel"]

    if nearest_savings is not None:
        _ns_bank = str(nearest_savings.get("은행") or "은행 예적금")
        _ns_dday = nearest_savings.get("d_day")
        _ns_dday_str = f"D-{_ns_dday:,}" if isinstance(_ns_dday, int) and _ns_dday >= 0 else "만기확인"
        _ns_after_tax = float(nearest_savings.get("after_tax_krw") or 0)
        _ns_prog = float(nearest_savings.get("progress_pct") or 0)
        _ns_mat_date = str(nearest_savings.get("만기일") or "-")
        st.markdown(
            f"""
            <div style="margin-top:12px; background:linear-gradient(145deg, rgba(0,230,118,0.08), #131C24); border:1px solid #1F2D3A; border-radius:12px; padding:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="font-size:0.68rem; font-weight:800; color:#7A8B9A; text-transform:uppercase;">최단기 만기 예정</span>
                    <span style="font-size:0.72rem; font-weight:800; color:#00E676; background:rgba(0,230,118,0.14); padding:2px 7px; border-radius:6px;">{_ns_dday_str}</span>
                </div>
                <div style="font-size:0.84rem; font-weight:700; color:#FFFFFF; margin-bottom:2px;">{_ns_bank} · {nearest_savings.get('구분', '적금')}</div>
                <div style="font-size:0.96rem; font-weight:800; color:#00E676; font-variant-numeric:tabular-nums;">
                    ₩{_ns_after_tax:,.0f} <span style="font-size:0.68rem; color:#7A8B9A; font-weight:600;">(세후 예상)</span>
                </div>
                <div style="width:100%; height:6px; background:#0B1116; border-radius:999px; overflow:hidden; margin-top:8px;">
                    <div class="av-gauge-fill" style="width:{min(100.0, max(2.0, _ns_prog)):.1f}%; height:100%; background:#00E676; border-radius:999px;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.68rem; color:#7A8B9A; margin-top:5px;">
                    <span>진행률 {_ns_prog:.1f}%</span>
                    <span>만기 {_ns_mat_date}</span>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

active_menu: str = st.session_state["active_menu"]
_menu_title, _menu_desc = MENU_SUBTITLES.get(active_menu, ("Portfolio Command Center", ""))


# ---------------------------------------------------------------------------
# 5-A. 상단 React 스타일 터미널 헤더 & 컨트롤 바 (상단 잘림 방지 + 모바일 빠른 메뉴)
# ---------------------------------------------------------------------------
st.markdown(
    """
    <style>
    @media (min-width: 769px) {
        div[data-testid="stVerticalBlock"] > div:has(.av-mobile-anchor),
        div[data-testid="stVerticalBlock"] > div:has(.av-mobile-anchor) + div {
            display: none !important;
        }
    }
    </style>
    """,
    unsafe_allow_html=True,
)

top_col1, top_col2 = st.columns([2.15, 1.85])
with top_col1:
    st.markdown(
        f"""
        <div class="av-header-shell">
            <div style="display:flex; align-items:center; gap:9px; flex-wrap:wrap;">
                <span style="font-size:1.30rem; font-weight:900; color:#FFFFFF; letter-spacing:-0.02em;">
                    {_menu_title}
                </span>
                <span class="av-badge-mint">● API LIVE</span>
                <span class="av-badge-blue">USD/KRW ₩{usd_krw_rate:,.2f}</span>
            </div>
            <div style="color:#7A8B9A; font-size:0.77rem; margin-top:5px;">
                {_menu_desc} · 소스: <b style="color:#E2E8F0;">{data_source_label}</b> ·
                KIS 토큰: <b style="color:#00E676;">{kis_token_status.split('(')[0]}</b>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with top_col2:
    ctrl_c1, ctrl_c2, ctrl_c3, ctrl_c4 = st.columns([1.05, 1.35, 1.35, 0.85])
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

# 모바일 전용 빠른 메뉴 전환 (데스크톱 >=769px에서는 자동 숨김)
st.markdown('<div class="av-mobile-anchor"></div>', unsafe_allow_html=True)
st.selectbox(
    "📱 메뉴 이동 (모바일 빠른 전환)",
    options=MENU_ITEMS,
    format_func=lambda m: MENU_LABELS.get(m, m),
    key="_nav_mobile_select",
    on_change=_sync_menu_from_mobile,
    label_visibility="collapsed",
)

# ---------------------------------------------------------------------------
# 5-B. 데이터 로드 예외 및 부분 파싱 경고 상단 노출 (원인 숨김 방지)
# ---------------------------------------------------------------------------
_sec_diag = fetch_diagnostics.get("secrets", {}) if isinstance(fetch_diagnostics, dict) else {}
_failed_stage = fetch_diagnostics.get("failed_stage") if isinstance(fetch_diagnostics, dict) else None
_error_msg = fetch_diagnostics.get("error_message") if isinstance(fetch_diagnostics, dict) else ""
_gspread_err = fetch_diagnostics.get("gspread_error") if isinstance(fetch_diagnostics, dict) else ""

if "Fallback" in data_source_label or _failed_stage or _error_msg:
    with st.container():
        st.error(
            f"**⚠️ 실시간 시트 연동 실패 — 오프라인 안전 모드(`{data_source_label}`)로 전환되었습니다.**\n\n"
            f"- **실패 단계**: `{_failed_stage or '알 수 없음'}`\n"
            f"- **예외 원인**: `{_error_msg or '상세 예외 정보 없음'}`\n"
            f"- **Secrets 확인 (`PORTFOLIO_API_URL`)**: 출처=`{_sec_diag.get('url_source', '미확인')}`, "
            f"상태=`{_sec_diag.get('url_configured', 'MISSING')}`, 대상=`{_sec_diag.get('url_masked', '-')}`\n"
            f"- **Secrets 확인 (`API_TOKEN`)**: 출처=`{_sec_diag.get('token_source', '미확인')}`, "
            f"상태=`{_sec_diag.get('token_configured', 'MISSING')}`\n"
            f"- **gspread 대체 조회**: `{_gspread_err or '미사용'}`"
        )
        if st.button("🔁 캐시 초기화 후 실시간 시트 다시 연결", key="btn_retry_live_sync"):
            st.cache_data.clear()
            st.rerun()
elif section_warnings:
    st.warning(
        "**⚠️ 일부 시트 항목 정규화 경고 (나머지 실시간 시트 데이터는 정상 반영됨):**\n\n"
        + "\n".join(f"- {w}" for w in section_warnings)
    )

# ---------------------------------------------------------------------------
# 6. React 스타일 상단 4대 핵심 KPI 카드 (네온 스파크라인 & 하단 메타바)
# ---------------------------------------------------------------------------
active_net_worth_krw = (
    grand_total_krw if net_worth_mode == "실물 포함 총순자산" else financial_net_worth_krw
)
_spark_nw = build_svg_sparkline(net_worth_spark, "#00E676", "gradNwSpark")
_spark_pl = build_svg_sparkline(pl_spark, "#00E676" if stock_profit_total_krw >= 0 else "#FF5252", "gradPlSpark")
_spark_cf = build_svg_sparkline(surplus_spark, "#9C27B0", "gradCfSpark")
_spark_sr = build_svg_sparkline(savings_rate_spark, "#9C27B0", "gradSrSpark")

kpi1, kpi2, kpi3, kpi4 = st.columns(4)
with kpi1:
    _mom_sign = "+" if mom_change_krw >= 0 else ""
    _mom_color = "#00E676" if mom_change_krw >= 0 else "#FF5252"
    st.markdown(
        f"""
        <div class="av-kpi-card av-kpi-mint">
            <div>
                <div class="av-kpi-top">
                    <span class="av-kpi-title">{'총 순자산 (실물 포함)' if net_worth_mode == '실물 포함 총순자산' else '금융 순자산 합계'}</span>
                    <span class="av-kpi-icon-mint">💰</span>
                </div>
                <div class="av-value">{fmt_curr(active_net_worth_krw, currency, usd_krw_rate)}</div>
                <div style="font-size:0.76rem; color:{_mom_color}; font-weight:700; margin-top:4px;">
                    {_mom_sign}{mom_change_pct:.2f}% · 금융 {fmt_compact_curr(financial_net_worth_krw, currency, usd_krw_rate)}
                </div>
            </div>
            {_spark_nw}
            <div class="av-kpi-subrow">
                <span style="color:#7A8B9A;">실물 {fmt_compact_curr(physical_total_krw, currency, usd_krw_rate)}</span>
                <span style="color:#00E676; font-weight:700;">예적금 {fmt_compact_curr(savings_total_krw, currency, usd_krw_rate)}</span>
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
        <div class="av-kpi-card av-kpi-mint">
            <div>
                <div class="av-kpi-top">
                    <span class="av-kpi-title">STOCK & ETF P/L · 🔒 KIS</span>
                    <span class="av-kpi-icon-mint">📈</span>
                </div>
                <div class="av-value">{fmt_curr(stock_eval_total_krw, currency, usd_krw_rate)}</div>
                <div style="color:{pl_color}; font-size:0.78rem; font-weight:700; margin-top:4px;">
                    {sign_str}{stock_return_pct:.2f}% ({sign_str}{fmt_curr(stock_profit_total_krw, currency, usd_krw_rate)})
                </div>
            </div>
            {_spark_pl}
            <div class="av-kpi-subrow">
                <span style="color:#7A8B9A;">보유 {len(stock_holding_rows)}종목</span>
                <span style="color:#64B5F6; font-weight:700;">예수금 {fmt_compact_curr(kis_cash_total_krw, currency, usd_krw_rate)}</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with kpi3:
    st.markdown(
        f"""
        <div class="av-kpi-card av-kpi-purple">
            <div>
                <div class="av-kpi-top">
                    <span class="av-kpi-title">MONTHLY SURPLUS · 잉여현금</span>
                    <span class="av-kpi-icon-purple">⚡</span>
                </div>
                <div class="av-value">{fmt_curr(cf_surplus_krw, currency, usd_krw_rate)}</div>
                <div style="color:#E07BFF; font-size:0.77rem; font-weight:700; margin-top:4px;">
                    월 수입 {fmt_curr(cf_total_income_krw, currency, usd_krw_rate)}
                </div>
            </div>
            {_spark_cf}
            <div class="av-kpi-subrow">
                <span style="color:#7A8B9A;">고정저축 {fmt_compact_curr(cf_savings_flow_krw, currency, usd_krw_rate)}</span>
                <span style="color:#FF5252; font-weight:700;">지출 {fmt_compact_curr(cf_expense_krw, currency, usd_krw_rate)}</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with kpi4:
    st.markdown(
        f"""
        <div class="av-kpi-card av-kpi-purple">
            <div>
                <div class="av-kpi-top">
                    <span class="av-kpi-title">SAVINGS RATE · 월 저축률</span>
                    <span class="av-kpi-icon-purple">🎯</span>
                </div>
                <div class="av-value">{cf_savings_rate_pct:.1f}%</div>
                <div style="color:#00E676; font-size:0.77rem; font-weight:700; margin-top:4px;">
                    순 저축비율 {cf_pure_savings_rate_pct:.1f}% · 채권 {fmt_compact_curr(bond_direct_krw, currency, usd_krw_rate)}
                </div>
            </div>
            {_spark_sr}
            <div class="av-kpi-subrow">
                <span style="color:#7A8B9A;">총 현금성 {fmt_compact_curr(total_cash_asset_krw, currency, usd_krw_rate)}</span>
                <span style="color:#E07BFF; font-weight:700;">달러 ${usd_deposit_usd:,.0f}</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

# ---------------------------------------------------------------------------
# 6-B. React AccountStackedBar 스타일 계좌별 비중 가로 스택 바 & 8대 계좌 범례 그리드
# ---------------------------------------------------------------------------
_segments_html = "".join(
    f'<div class="av-stack-seg" title="{a["name"]}: {fmt_curr(a["total"], currency, usd_krw_rate)} ({a["weight"]:.1f}%)" '
    f'style="width:{max(a["weight"], 0.6):.2f}%; background:{a["color"]}; height:100%; border-radius:4px;"></div>'
    for a in account_breakdown
)
_legend_cards_html = "".join(
    f"""
    <div class="av-legend-pill">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:4px;">
            <span style="display:flex; align-items:center; gap:6px; font-size:0.76rem; font-weight:700; color:#E2E8F0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                <span style="width:8px; height:8px; border-radius:999px; background:{a["color"]}; flex-shrink:0;"></span>
                {a["name"]}
            </span>
            <span style="font-size:0.72rem; font-weight:800; color:#7A8B9A;">{a["weight"]:.1f}%</span>
        </div>
        <div style="font-size:0.86rem; font-weight:800; color:#FFFFFF;">{fmt_compact_curr(a["total"], currency, usd_krw_rate)}</div>
        <div style="font-size:0.68rem; color:#7A8B9A; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{a["sub"]}</div>
    </div>
    """
    for a in account_breakdown
)
st.markdown(
    f"""
    <div class="av-stack-card">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:0.90rem; font-weight:800; color:#FFFFFF;">🏛️ 계좌별 통합 자산 비중 (8대 계좌)</span>
                <span class="av-badge-mint">실시간 동기화 합계 {fmt_curr(grand_total_krw, currency, usd_krw_rate)}</span>
            </div>
            <span style="font-size:0.73rem; color:#7A8B9A;">총자산 100.0% · 4계좌 KIS + 수동 4대 시트</span>
        </div>
        <div class="av-stacked-track">{_segments_html}</div>
        <div class="av-legend-grid">{_legend_cards_html}</div>
    </div>
    """,
    unsafe_allow_html=True,
)


# ---------------------------------------------------------------------------
# 7. 메인 뷰 라우터 (왼쪽 사이드바 / 모바일 빠른 전환 메뉴 기반)
# ---------------------------------------------------------------------------
if st.session_state.get("show_ai_copilot_panel", False):
    with st.expander("✨ AssetCopilot AI — 자산 어드바이저 드로어 (사이드바에서 닫기 가능)", expanded=True):
        st.caption(
            f"실시간 순자산({fmt_curr(active_net_worth_krw, currency, usd_krw_rate)})과 "
            f"한투/수동 시트 데이터를 바탕으로 Gemini AI가 즉시 분석합니다."
        )
        quick_col1, quick_col2, quick_col3 = st.columns(3)
        _qp: Optional[str] = None
        if quick_col1.button("내 실질 미국/채권 비중 진단", use_container_width=True, key="drawer_qp1"):
            _qp = "현재 포트폴리오에서 해외주식, 해외채권, 현금/예적금의 실질 비중을 분석하고 개선 방향을 제안해 줘."
        if quick_col2.button("위탁 달러예수금 활용 전략", use_container_width=True, key="drawer_qp2"):
            _qp = f"위탁계좌 달러예수금 ${usd_deposit_usd:,.2f}를 어떤 자산군으로 분할 투자하면 좋을지 제안해 줘."
        if quick_col3.button("2.5억 목표 달성 브리핑", use_container_width=True, key="drawer_qp3"):
            _qp = "현재 2.5억 목표 대비 달성률과 향후 6개월 저축·투자 전략을 요약해 줘."

        _drawer_q = st.text_input("AI 비서에게 질문하기", placeholder="예: IRP와 연금저축 ETF 비중 조정 의견 알려줘", key="drawer_copilot_q")
        _final_drawer_q = _qp or (_drawer_q.strip() if _drawer_q else "")
        if _final_drawer_q and (_qp or st.button("질문 전송", type="primary", key="drawer_copilot_send")):
            gemini_key_d = get_gemini_api_key()
            if not gemini_key_d:
                st.warning("Gemini API Key가 설정되지 않았습니다. (`[gemini]` 섹션 확인)")
            else:
                ctx_d = {
                    "총순자산_실물포함": round(grand_total_krw),
                    "금융순자산": round(financial_net_worth_krw),
                    "수동현금": round(manual_cash_total_krw),
                    "KIS_예수금": round(kis_cash_total_krw),
                    "은행예적금": round(savings_total_krw),
                    "KIS_주식ETF평가액": round(stock_eval_total_krw),
                    "직접보유채권": round(bond_direct_krw),
                    "실물자산": round(physical_total_krw),
                    "저축률(%)": round(cf_savings_rate_pct, 1),
                }
                with st.spinner("AssetCopilot AI 분석 중..."):
                    try:
                        resp_d = requests.post(
                            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key_d}",
                            json={
                                "contents": [
                                    {
                                        "parts": [
                                            {
                                                "text": (
                                                    f"당신은 한국어 자산관리 AI 비서 AssetCopilot입니다.\n"
                                                    f"포트폴리오 요약: {json.dumps(ctx_d, ensure_ascii=False)}\n\n"
                                                    f"질문: {_final_drawer_q}"
                                                )
                                            }
                                        ]
                                    }
                                ]
                            },
                            timeout=25,
                        )
                        if resp_d.status_code == 200:
                            ans_d = (
                                resp_d.json()
                                .get("candidates", [{}])[0]
                                .get("content", {})
                                .get("parts", [{}])[0]
                                .get("text", "응답 없음")
                            )
                            st.markdown(ans_d)
                        else:
                            st.error(f"Gemini API 오류: {resp_d.status_code}")
                    except Exception as exc_d:
                        st.error(f"AI 호출 오류: {exc_d}")

# ===========================================================================
# VIEW 1: 📊 Dashboard — 2.5억 목표 게이지, 도넛, 계좌 비중, 순자산 추이 & 감가상각
# ===========================================================================
if active_menu == "Dashboard":
    # 2.5억 순자산 목표 달성률 배너 (React AssetAllocationAndGoal 스타일)
    goal_target_krw = 250_000_000.0
    goal_pct = min(100.0, (active_net_worth_krw / goal_target_krw) * 100.0) if goal_target_krw > 0 else 0.0
    goal_rem_krw = max(0.0, goal_target_krw - active_net_worth_krw)
    st.markdown(
        f"""
        <div class="av-card" style="padding:14px 18px; margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:0.92rem; font-weight:800; color:#FFFFFF;">🎯 순자산 2.5억 달성 목표 진행률</span>
                    <span class="av-badge-mint">{goal_pct:.1f}% 달성</span>
                </div>
                <span style="font-size:0.78rem; color:#7A8B9A; font-variant-numeric:tabular-nums;">
                    목표까지 잔여 <b style="color:#E2E8F0;">{fmt_curr(goal_rem_krw, currency, usd_krw_rate)}</b>
                </span>
            </div>
            <div style="width:100%; height:10px; background:#0B1116; border:1px solid #1F2D3A; border-radius:999px; overflow:hidden;">
                <div class="av-gauge-fill" style="width:{goal_pct:.1f}%; height:100%; background:linear-gradient(90deg, #00E676, #00B0FF); border-radius:999px;"></div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    col_chart_l, col_chart_r = st.columns([1.05, 1.15])

    with col_chart_l:
        st.markdown("#### 📈 자산배분 현황 — " + exposure_mode)
        if exposure_mode.startswith("기초자산"):
            alloc_df = pd.DataFrame(
                [
                    {"자산군": "현금성 (수동+KIS예수금)", "금액": total_cash_asset_krw},
                    {"자산군": "은행 예적금", "금액": savings_total_krw},
                    {"자산군": "해외주식 (실질: 미ETF+직투)", "금액": underlying_overseas_stock_krw},
                    {"자산군": "해외채권 (실질: 미국채ETF+채권)", "금액": underlying_overseas_bond_krw},
                    {"자산군": "국내채권·혼합형", "금액": underlying_domestic_bond_krw},
                    {"자산군": "국내주식 (실질)", "금액": underlying_domestic_stock_krw},
                    {"자산군": "실물·기타자산", "금액": physical_total_krw},
                ]
            )
        else:
            alloc_df = pd.DataFrame(
                [
                    {"자산군": "현금성 (수동+KIS예수금)", "금액": total_cash_asset_krw},
                    {"자산군": "은행 예적금", "금액": savings_total_krw},
                    {"자산군": "국내상장 ETF (주식/혼합)", "금액": domestic_etf_krw},
                    {"자산군": "해외직투 주식 (US)", "금액": overseas_direct_krw},
                    {"자산군": "해외채권 (직접채권+채권ETF)", "금액": bond_direct_krw + kis_bond_etf_krw},
                    {"자산군": "실물·기타자산", "금액": physical_total_krw},
                ]
            )

        alloc_df = alloc_df[alloc_df["금액"] > 0].reset_index(drop=True)
        alloc_df["비중(%)"] = (alloc_df["금액"] / alloc_df["금액"].sum() * 100).round(1)
        fig_donut = px.pie(
            alloc_df,
            names="자산군",
            values="금액",
            hole=0.62,
            color_discrete_sequence=[
                "#00E676",
                "#2979FF",
                "#9C27B0",
                "#00B0FF",
                "#FFAB00",
                "#1DE9B6",
                "#FF5252",
            ],
        )
        fig_donut.update_layout(
            paper_bgcolor="#131C24",
            plot_bgcolor="#131C24",
            font=dict(color="#FFFFFF", size=11),
            margin=dict(t=12, b=12, l=8, r=8),
            height=310,
            transition=dict(duration=750, easing="cubic-in-out"),
            legend=dict(orientation="h", yanchor="bottom", y=-0.34, xanchor="center", x=0.5),
        )
        st.plotly_chart(fig_donut, use_container_width=True, config={"displayModeBar": False})

    with col_chart_r:
        st.markdown('#### 🏦 8대 계좌별 평가액 & 비중<span class="av-hbar-marker"></span>', unsafe_allow_html=True)
        acc_df = pd.DataFrame(
            [
                {
                    "계좌": a["name"],
                    "평가액(원)": round(a["total"]),
                    "비중(%)": round(a["weight"], 1),
                    "구분": "KIS 자동연동(읽기전용)" if "한투" in a["name"] or "ISA" in a["name"] or "토스" in a["name"] else "수동관리(수정가능)",
                }
                for a in account_breakdown
            ]
        )
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
            font=dict(color="#FFFFFF", size=11),
            margin=dict(t=12, b=12, l=8, r=42),
            height=310,
            transition=dict(duration=750, easing="cubic-in-out"),
            xaxis_title=None,
            yaxis_title=None,
            yaxis=dict(autorange="reversed"),
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        )
        st.plotly_chart(fig_bar, use_container_width=True, config={"displayModeBar": False})

    # 순자산 성장 추이 차트 (마지막 포인트 실시간 순자산 동기화 적용)
    st.markdown("#### 📊 순자산 성장 추이 (금융 순자산 vs 실물 포함 총순자산)")
    hist_records = [
        {
            "기준일": r["날짜"],
            "금융 순자산": r["금융총액"],
            "실물 포함 총순자산": r["실물포함총액"],
        }
        for r in synced_hist_rows[-12:]
    ]
    if len(hist_records) < 2:
        hist_records = [
            {"기준일": "2026-07-15", "금융 순자산": 168_500_000, "실물 포함 총순자산": 194_979_444},
            {"기준일": "2026-08-15", "금융 순자산": 176_100_000, "실물 포함 총순자산": 202_579_444},
            {"기준일": "2026-09-15", "금융 순자산": 185_900_000, "실물 포함 총순자산": 212_379_444},
            {"기준일": "2026-10-15", "금융 순자산": 195_400_000, "실물 포함 총순자산": 221_879_444},
            {"기준일": today_kst.strftime("%Y-%m-%d"), "금융 순자산": round(financial_net_worth_krw), "실물 포함 총순자산": round(grand_total_krw)},
        ]
    df_hist = pd.DataFrame(hist_records)
    fig_area = go.Figure()
    fig_area.add_trace(
        go.Scatter(
            x=df_hist["기준일"],
            y=df_hist["실물 포함 총순자산"],
            mode="lines+markers",
            name="실물 포함 총순자산",
            line=dict(color="#00E676", width=3),
            fill="tozeroy",
            fillcolor="rgba(0, 230, 118, 0.14)",
        )
    )
    fig_area.add_trace(
        go.Scatter(
            x=df_hist["기준일"],
            y=df_hist["금융 순자산"],
            mode="lines+markers",
            name="금융 순자산",
            line=dict(color="#2979FF", width=2.5, dash="dot"),
            fill="tozeroy",
            fillcolor="rgba(41, 121, 255, 0.10)",
        )
    )
    fig_area.update_layout(
        paper_bgcolor="#131C24",
        plot_bgcolor="#131C24",
        font=dict(color="#FFFFFF", size=11),
        margin=dict(t=14, b=12, l=8, r=12),
        height=265,
        transition=dict(duration=800, easing="cubic-in-out"),
        xaxis=dict(showgrid=False),
        yaxis=dict(gridcolor="#1F2D3A", zeroline=False),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    st.plotly_chart(fig_area, use_container_width=True, config={"displayModeBar": False})

    st.markdown("---")
    st.markdown("#### 🚗 실물자산 감가상각 시각화 & 💰 수동 관리 현금성 자산")
    p_col1, p_col2 = st.columns([1.15, 1.0])

    with p_col1:
        for p in physical_rows:
            name = p.get("자산명") or p.get("항목명") or "실물자산"
            cost = to_num(p.get("취득원가(원)") or p.get("취득원가"), 0)
            dep = to_num(p.get("감가상각누계액(원)") or p.get("감가상각누계액"), 0)
            cur = to_num(p.get("현재평가액(원)") or p.get("현재가치") or p.get("현재추정가치") or p.get("잔존가치"), 0)
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
                    <div style="width:100%; height:9px; background:#1F2D3A; border-radius:999px; overflow:hidden;">
                        <div class="av-gauge-fill" style="width:{bar_pct:.1f}%; height:100%; background:linear-gradient(90deg,#00E676,#2979FF); border-radius:999px;"></div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    with p_col2:
        manual_df = pd.DataFrame(manual_cash_rows)
        st.dataframe(manual_df, use_container_width=True, hide_index=True)

# ===========================================================================
# VIEW 2: 💼 Portfolio (KIS OpenAPI 자동연동 — 읽기 전용)
# ===========================================================================
elif active_menu == "Portfolio":
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
        f"**전 계좌 KIS 예수금 합계**: `{fmt_curr(kis_cash_total_krw, currency, usd_krw_rate)}` "
        f"(위탁 USD `${usd_deposit_usd:,.2f}` · 원화예수금 `{fmt_curr(kis_krw_cash_total, currency, usd_krw_rate)}`) · "
        f"KIS 4계좌(위탁·ISA·연금저축·IRP) 자산은 API 스케줄러로 자동 동기화되므로 읽기 전용으로 보호됩니다."
    )

    if cash_deposit_rows:
        dep_cols = st.columns(min(4, len(cash_deposit_rows)))
        for idx_c, crow in enumerate(cash_deposit_rows[:4]):
            with dep_cols[idx_c]:
                orig_label = (
                    f"${crow.get('외화원금_usd', 0.0):,.2f}"
                    if crow.get("외화원금_usd", 0.0) > 0
                    else f"₩{crow['평가금액_num']:,.0f}"
                )
                st.markdown(
                    f"""
                    <div class="av-card" style="padding:11px 13px; margin-bottom:10px;">
                        <div style="font-size:0.72rem; color:#7A8B9A; font-weight:700;">{crow.get('계좌명', 'KIS')}</div>
                        <div style="font-size:0.84rem; color:#E2E8F0; font-weight:700; margin-top:2px;">{crow.get('종목명', '예수금')}</div>
                        <div style="font-size:1.05rem; color:#00E676; font-weight:800; margin-top:4px;">{orig_label}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

    account_filter = st.radio(
        "계좌 필터 선택",
        options=["전체", "위탁계좌", "ISA중개형", "연금저축", "퇴직연금(IRP)"],
        horizontal=True,
    )

    filtered_holdings = [
        h
        for h in stock_holding_rows
        if account_filter == "전체"
        or h.get("계좌명") == account_filter
        or account_filter in str(h.get("계좌구분", ""))
        or account_filter in str(h.get("시장구분", ""))
    ]

    if filtered_holdings:
        df_hold = pd.DataFrame(
            [
                {
                    "계좌": h.get("계좌명") or h.get("계좌구분") or h.get("시장구분") or "",
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

        fig_hold = px.bar(
            df_hold,
            x="종목명(티커)",
            y="평가금액(원)",
            color="실질자산분류",
            text="수익률(%)",
            color_discrete_map={
                "해외주식": "#00E676",
                "해외채권": "#2979FF",
                "국내채권": "#FFAB00",
                "국내주식": "#9C27B0",
            },
        )
        fig_hold.update_traces(texttemplate="%{text:+.2f}%", textposition="outside")
        fig_hold.update_layout(
            paper_bgcolor="#131C24",
            plot_bgcolor="#131C24",
            font=dict(color="#FFFFFF", size=11),
            margin=dict(t=18, b=12, l=8, r=8),
            height=290,
            transition=dict(duration=750, easing="cubic-in-out"),
            xaxis_title=None,
            yaxis_title=None,
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        )
        st.plotly_chart(fig_hold, use_container_width=True, config={"displayModeBar": False})
    else:
        st.caption("선택한 계좌에 주식/ETF 보유 종목이 없습니다. (위탁계좌는 상단 달러예수금 카드를 확인하세요)")

# ===========================================================================
# VIEW 3: ✏️ 비-KIS 시트 수정 (Apps Script doPost 양방향 동기화)
# ===========================================================================
elif active_menu == "비-KIS 시트 수정":
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
        sav_text_cols = ("구분", "은행", "가입일", "비과세", "통화", "ID", "만기일")
        for col in sav_cols:
            if col not in df_sav_init.columns:
                df_sav_init[col] = "" if col in sav_text_cols else 0
            if col in sav_text_cols:
                df_sav_init[col] = df_sav_init[col].fillna("").astype(str)
            else:
                df_sav_init[col] = pd.to_numeric(df_sav_init[col], errors="coerce").fillna(0)
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
        bond_text_cols = ("채권명", "설명", "가입일", "종료일", "수령")
        for col in bond_cols:
            if col not in df_bond_init.columns:
                df_bond_init[col] = "" if col in bond_text_cols else 0
            if col in bond_text_cols:
                df_bond_init[col] = df_bond_init[col].fillna("").astype(str)
            else:
                df_bond_init[col] = pd.to_numeric(df_bond_init[col], errors="coerce").fillna(0)
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
            "자산구분",
            "자산명",
            "취득일",
            "취득원가(원)",
            "내용연수(년)",
            "잔존가치율",
            "감가상각방법",
            "경과월수(개월)",
            "감가상각누계액(원)",
            "현재평가액(원)",
            "비고 및 감가상각 설명",
        ]
        phys_text_cols = (
            "자산구분",
            "자산명",
            "취득일",
            "내용연수(년)",
            "감가상각방법",
            "경과월수(개월)",
            "비고 및 감가상각 설명",
        )
        for col in phys_cols:
            if col not in df_phys_init.columns:
                df_phys_init[col] = "" if col in phys_text_cols else 0
            if col in phys_text_cols:
                df_phys_init[col] = df_phys_init[col].fillna("").astype(str)
            else:
                df_phys_init[col] = pd.to_numeric(df_phys_init[col], errors="coerce").fillna(0)
        df_phys_init = df_phys_init[phys_cols]

        edited_phys_df = st.data_editor(
            df_phys_init,
            key="editor_physical_sheet",
            num_rows="dynamic",
            use_container_width=True,
            hide_index=True,
            disabled=["경과월수(개월)", "감가상각누계액(원)", "현재평가액(원)"],
            column_config={
                "자산구분": st.column_config.TextColumn("자산구분 (A열)"),
                "자산명": st.column_config.TextColumn("자산명 (B열)", required=True),
                "취득일": st.column_config.TextColumn("취득일 (C열)"),
                "취득원가(원)": st.column_config.NumberColumn("취득원가 (D열)", format="₩%d"),
                "내용연수(년)": st.column_config.TextColumn("내용연수 (E열)"),
                "잔존가치율": st.column_config.NumberColumn("잔존가치율 (F열)", format="%.2f"),
                "감가상각방법": st.column_config.TextColumn("감가상각방법 (G열)"),
                "경과월수(개월)": st.column_config.TextColumn("🔒 경과월수 (H열 수식유지)"),
                "감가상각누계액(원)": st.column_config.NumberColumn("🔒 감가상각누계액 (I열 수식유지)", format="₩%d"),
                "현재평가액(원)": st.column_config.NumberColumn("🔒 현재평가액 (J열 수식유지)", format="₩%d"),
                "비고 및 감가상각 설명": st.column_config.TextColumn("비고 (K열)"),
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
    var formulaCols = Array.isArray(body.formulaCols) ? body.formulaCols : (body.preserveFormulaColumns || []);
    var headerRow = (body.sheetName.indexOf('실물_기타자산') !== -1) ? 3 : 1;
    var headers = sheet.getRange(headerRow, 1, 1, sheet.getLastColumn()).getValues()[0];

    if (body.action === 'appendRow' && body.row) {
      var nextRowIdx = sheet.getLastRow() + 1;
      Object.keys(editableColMap).forEach(function(colName) {
        var colIdx = editableColMap[colName];
        if (body.row[colName] !== undefined) {
          sheet.getRange(nextRowIdx, colIdx).setValue(body.row[colName]);
        }
      });
      if (body.copyFormulaFromPrevRow && nextRowIdx > headerRow + 1) {
        Object.keys(formulaColMap).forEach(function(fName) {
          var fColIdx = formulaColMap[fName];
          sheet.getRange(nextRowIdx - 1, fColIdx).copyTo(sheet.getRange(nextRowIdx, fColIdx));
        });
      }
    } else if (body.action === 'updateSheet' && Array.isArray(body.updates)) {
      body.updates.forEach(function(rowObj, rIdx) {
        var targetRow = headerRow + 1 + rIdx;
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
# VIEW 4: 📜 Trade & Dividend (KIS 읽기 전용)
# ===========================================================================
elif active_menu == "Trade & Dividend":
    st.markdown("#### 📜 KIS 매매체결 DB & 💸 해외주식 배당내역 DB (🔒 KIS 읽기 전용)")
    raw_trades = raw_payload.get("kisTrades") or [
        {
            "체결일시": "20261112 142210",
            "계좌구분": "연금저축",
            "매매구분": "매수",
            "시장": "KRX",
            "종목코드": "379810",
            "종목명": "KODEX 미국나스닥100",
            "체결수량": 18,
            "체결단가": 24915,
            "체결총액": 448470,
            "통화": "KRW",
            "원화환산액": 448470,
        },
        {
            "체결일시": "20261108 101544",
            "계좌구분": "퇴직연금(IRP)",
            "매매구분": "매수",
            "시장": "KRX",
            "종목코드": "360750",
            "종목명": "TIGER 미국S&P500",
            "체결수량": 12,
            "체결단가": 25120,
            "체결총액": 301440,
            "통화": "KRW",
            "원화환산액": 301440,
        },
        {
            "체결일시": "20261103 151033",
            "계좌구분": "ISA중개형",
            "매매구분": "매수",
            "시장": "KRX",
            "종목코드": "453850",
            "종목명": "ACE 미국30년국채액티브(H)",
            "체결수량": 44,
            "체결단가": 6960,
            "체결총액": 306240,
            "통화": "KRW",
            "원화환산액": 306240,
        },
    ]
    trades_data = []
    for tr in raw_trades:
        if not isinstance(tr, dict):
            continue
        raw_dt = str(tr.get("체결일시") or "").strip()
        fmt_dt = re.sub(
            r"^(\d{4})(\d{2})(\d{2})\s+(\d{2})(\d{2})(\d{2})$",
            r"\1-\2-\3 \4:\5:\6",
            raw_dt,
        )
        trades_data.append(
            {
                "체결일시": fmt_dt,
                "계좌구분": str(tr.get("계좌구분") or ""),
                "매매구분": str(tr.get("매매구분") or ""),
                "시장": str(tr.get("시장") or tr.get("시장구분") or ""),
                "종목코드": str(tr.get("종목코드") or ""),
                "종목명": str(tr.get("종목명") or ""),
                "체결수량": to_num(tr.get("체결수량") or tr.get("수량"), 0),
                "체결단가": round(to_num(tr.get("체결단가"), 0), 2),
                "체결총액": round(to_num(tr.get("체결총액") or tr.get("체결금액"), 0), 2),
                "통화": str(tr.get("통화") or "KRW"),
                "원화환산액": round(to_num(tr.get("원화환산액"), 0)),
            }
        )

    dividends_data = raw_payload.get("kisDividends") or [
        {
            "배당기준일": "2026-11-12",
            "계좌구분": "퇴직연금(IRP)",
            "종목명": "TIGER 미국배당다우존스",
            "세전배당($)": 7.05,
            "세후배당($)": 7.05,
            "원화환산액": 9420,
        },
        {
            "배당기준일": "2026-11-04",
            "계좌구분": "ISA중개형",
            "종목명": "ACE 미국30년국채액티브(H)",
            "세전배당($)": 0.99,
            "세후배당($)": 0.99,
            "원화환산액": 1320,
        },
    ]

    td_m1, td_m2, td_m3 = st.columns(3)
    _trade_sum_krw = sum(to_num(t.get("원화환산액") or t.get("체결총액"), 0) for t in trades_data)
    _div_sum_krw = sum(
        to_num(d.get("원화환산액"), 0) or (to_num(d.get("세후배당($)"), 0) * usd_krw_rate)
        for d in dividends_data
        if isinstance(d, dict)
    )
    td_m1.metric("최근 체결 건수", f"{len(trades_data):,}건")
    td_m2.metric("누적 매매체결액(환산)", fmt_curr(_trade_sum_krw, currency, usd_krw_rate))
    td_m3.metric("배당수령액(환산)", fmt_curr(_div_sum_krw, currency, usd_krw_rate))

    t_col1, t_col2 = st.columns(2)
    with t_col1:
        st.markdown("##### 📜 최근 매매체결 내역")
        st.dataframe(pd.DataFrame(trades_data), use_container_width=True, hide_index=True)
    with t_col2:
        st.markdown("##### 💸 최근 배당수령 내역")
        st.dataframe(pd.DataFrame(dividends_data), use_container_width=True, hide_index=True)

# ===========================================================================
# VIEW 5: 🤖 AI Research (SaveTicker TOP 5 · Deep Research · AssetCopilot)
# ===========================================================================
elif active_menu == "AI Research":
    st.markdown("#### 🚀 SaveTicker AI 선정 긍정 전망 TOP 5 vs ⚠️ 부정·주의 TOP 5")
    bull_col, bear_col = st.columns(2)

    bullish_list = [
        ("NVDA", "NVIDIA Corp.", "+94점", "Blackwell 서버 랙 출하 가속 및 하이퍼스케일러 AI CAPEX 상향"),
        ("AVGO", "Broadcom", "+91점", "맞춤형 AI ASIC(XPU) 수주 확대 및 VMware 현금흐름 개선"),
        ("GOOGL", "Alphabet A", "+86점", "Gemini 검색 AI 광고 전환율 상승 및 클라우드 영업이익률 개선"),
        ("META", "Meta Platforms", "+84점", "Llama 기반 광고 타겟팅 효율 상승 및 릴스 수익화 호조"),
        ("AMZN", "Amazon", "+82점", "AWS 영업이익률 역대 최고치 경신 및 물류 자동화 비용 절감"),
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

    st.markdown("---")
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
                    f"총현금성={total_cash_asset_krw:,.0f}원, 위탁달러예수금=${usd_deposit_usd:,.2f}({usd_deposit_krw:,.0f}원), "
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
# VIEW 6: ⚖️ Rebalancing (비교 차트 & 계산표 — 기초자산 실질/상장시장 기준 연동)
# ===========================================================================
elif active_menu == "Rebalancing":
    st.markdown(f"#### ⚖️ 인터랙티브 자산배분 시뮬레이터 ({exposure_mode})")
    sim_c1, sim_c2, sim_c3, sim_c4, sim_c5 = st.columns(5)
    if exposure_mode.startswith("기초자산"):
        with sim_c1:
            tgt_cash = st.slider("현금성 목표(%)", 0, 70, 25)
        with sim_c2:
            tgt_sav = st.slider("예적금 목표(%)", 0, 60, 25)
        with sim_c3:
            tgt_ov_stk = st.slider("해외주식 목표(%)", 0, 70, 37)
        with sim_c4:
            tgt_ov_bnd = st.slider("해외채권 목표(%)", 0, 50, 10)
        with sim_c5:
            tgt_dom_bnd = st.slider("국내채권·혼합(%)", 0, 30, 3)

        rebal_rows = [
            ("현금성 자산 (수동+KIS예수금)", total_cash_asset_krw, tgt_cash),
            ("은행 예적금", savings_total_krw, tgt_sav),
            ("해외주식 (실질: 미ETF+직투)", underlying_overseas_stock_krw, tgt_ov_stk),
            ("해외채권 (실질: 미국채ETF+채권)", underlying_overseas_bond_krw, tgt_ov_bnd),
            ("국내채권·혼합형", underlying_domestic_bond_krw + underlying_domestic_stock_krw, tgt_dom_bnd),
        ]
    else:
        with sim_c1:
            tgt_cash = st.slider("현금성 목표(%)", 0, 70, 20)
        with sim_c2:
            tgt_sav = st.slider("예적금 목표(%)", 0, 60, 30)
        with sim_c3:
            tgt_kr_etf = st.slider("국내상장ETF 목표(%)", 0, 70, 40)
        with sim_c4:
            tgt_us_dir = st.slider("해외직투 목표(%)", 0, 50, 0)
        with sim_c5:
            tgt_bnd = st.slider("해외채권 목표(%)", 0, 40, 10)
        tgt_ov_stk, tgt_ov_bnd, tgt_dom_bnd = tgt_kr_etf, tgt_us_dir, tgt_bnd

        rebal_rows = [
            ("현금성 자산 (수동+KIS예수금)", total_cash_asset_krw, tgt_cash),
            ("은행 예적금", savings_total_krw, tgt_sav),
            ("국내상장 해외ETF", domestic_etf_krw, tgt_kr_etf),
            ("해외직투 주식", overseas_direct_krw, tgt_us_dir),
            ("해외채권 (직접+ETF)", bond_direct_krw + kis_bond_etf_krw, tgt_bnd),
        ]

    total_target_pct = sum(t for _, _, t in rebal_rows)
    if total_target_pct != 100:
        st.warning(f"현재 목표 비중 합계가 **{total_target_pct}%**입니다. (100% 기준 차이: {100 - total_target_pct:+d}%)")

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

    fig_rebal = go.Figure()
    fig_rebal.add_trace(
        go.Bar(
            x=rebal_df["자산군"],
            y=rebal_df["현재 비중(%)"],
            name="현재 비중(%)",
            marker_color="#2979FF",
        )
    )
    fig_rebal.add_trace(
        go.Bar(
            x=rebal_df["자산군"],
            y=rebal_df["목표 비중(%)"],
            name="목표 비중(%)",
            marker_color="#00E676",
        )
    )
    fig_rebal.update_layout(
        barmode="group",
        paper_bgcolor="#131C24",
        plot_bgcolor="#131C24",
        font=dict(color="#FFFFFF", size=11),
        margin=dict(t=16, b=12, l=8, r=8),
        height=275,
        transition=dict(duration=750, easing="cubic-in-out"),
        xaxis_title=None,
        yaxis_title="비중(%)",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    st.plotly_chart(fig_rebal, use_container_width=True, config={"displayModeBar": False})
    st.dataframe(rebal_df, use_container_width=True, hide_index=True)

# ===========================================================================
# VIEW 7: 💸 Cashflow (월간 수입·저축·지출 구조 분석)
# ===========================================================================
elif active_menu == "Cashflow":
    st.markdown("#### 💸 월간 현금흐름 & 저축·투자 포트폴리오")
    cf1, cf2, cf3, cf4 = st.columns(4)
    cf1.metric("월 총수입", fmt_curr(cf_total_income_krw, currency, usd_krw_rate))
    cf2.metric("고정 저축/투자", fmt_curr(cf_savings_flow_krw, currency, usd_krw_rate), f"순저축률 {cf_pure_savings_rate_pct:.1f}%")
    cf3.metric("월 지출 (소비)", fmt_curr(cf_expense_krw, currency, usd_krw_rate))
    cf4.metric("월 잉여 잔액 포함 저축률", f"{cf_savings_rate_pct:.1f}%", fmt_curr(cf_balance_krw, currency, usd_krw_rate))

    cf_col_l, cf_col_r = st.columns([1.25, 1.0])
    with cf_col_l:
        st.markdown("##### 📊 월간 자금 배분 내역 (저축·지출·잉여잔액)")
        df_cf_bars = pd.DataFrame(combined_cashflow_bars)
        fig_cf_bar = px.bar(
            df_cf_bars,
            x="약칭",
            y="금액",
            color="구분",
            text="비중(%)",
            color_discrete_map={
                "저축/투자": "#00E676",
                "지출": "#FF5252",
                "잉여잔액": "#2979FF",
            },
        )
        fig_cf_bar.update_traces(texttemplate="%{text:.1f}%", textposition="outside")
        fig_cf_bar.update_layout(
            paper_bgcolor="#131C24",
            plot_bgcolor="#131C24",
            font=dict(color="#FFFFFF", size=11),
            margin=dict(t=16, b=12, l=8, r=8),
            height=300,
            transition=dict(duration=750, easing="cubic-in-out"),
            xaxis_title=None,
            yaxis_title=None,
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        )
        st.plotly_chart(fig_cf_bar, use_container_width=True, config={"displayModeBar": False})

    with cf_col_r:
        st.markdown("##### 🍩 저축 vs 소비 비중")
        df_cf_pie = pd.DataFrame(
            [
                {"항목": "고정 저축/투자", "금액": cf_savings_flow_krw},
                {"항목": "월 잉여 잔액", "금액": cf_balance_krw},
                {"항목": "월 생활비/지출", "금액": cf_expense_krw},
            ]
        )
        fig_cf_pie = px.pie(
            df_cf_pie,
            names="항목",
            values="금액",
            hole=0.60,
            color_discrete_sequence=["#00E676", "#2979FF", "#FF5252"],
        )
        fig_cf_pie.update_layout(
            paper_bgcolor="#131C24",
            plot_bgcolor="#131C24",
            font=dict(color="#FFFFFF", size=11),
            margin=dict(t=12, b=12, l=8, r=8),
            height=300,
            transition=dict(duration=750, easing="cubic-in-out"),
            legend=dict(orientation="h", yanchor="bottom", y=-0.22, xanchor="center", x=0.5),
        )
        st.plotly_chart(fig_cf_pie, use_container_width=True, config={"displayModeBar": False})

    st.dataframe(
        df_cf_bars[["항목", "구분", "금액", "비중(%)"]].assign(**{"비중(%)": lambda d: d["비중(%)"].round(1)}),
        use_container_width=True,
        hide_index=True,
    )

# ===========================================================================
# VIEW 8: 🌱 Savings (예적금 만기 트래커 · 채권 적립 · 수동 입출금 현황)
# ===========================================================================
elif active_menu == "Savings":
    st.markdown("#### 🌱 예적금 만기 D-Day 트래커 & 🏠 직접 보유 채권 현황")
    sav_cols = st.columns(2)
    for idx_s, sav in enumerate(savings_rows):
        with sav_cols[idx_s % 2]:
            d_day = sav.get("d_day")
            d_day_badge = f"D-{d_day:,}" if isinstance(d_day, int) and d_day >= 0 else "만기/확인"
            prog = float(sav.get("progress_pct") or 0.0)
            after_tax = float(sav.get("after_tax_krw") or 0.0)
            monthly_pay = to_num(sav.get("금액"), 0)
            rate_pct = float(sav.get("rate_pct") or 0.0)
            tax_free_badge = '<span class="av-badge-mint">비과세</span>' if str(sav.get("비과세", "")).strip().upper() == "O" else ""
            st.markdown(
                f"""
                <div class="av-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
                        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            <b style="font-size:0.96rem; color:#FFFFFF;">{sav.get('은행', '-')} · {sav.get('구분', '적금')}</b>
                            {tax_free_badge}
                        </div>
                        <span class="av-badge-blue">{d_day_badge}</span>
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; font-size:0.78rem; margin-bottom:8px;">
                        <div><span style="color:#7A8B9A;">월 납입액 / 금리</span><br><b>₩{monthly_pay:,.0f} ({rate_pct:.2f}%)</b></div>
                        <div><span style="color:#7A8B9A;">가입일 ~ 만기일</span><br><b>{sav.get('가입일', '-')} ~ {sav.get('만기일', '-')}</b></div>
                        <div><span style="color:#7A8B9A;">세후 만기수령액</span><br><b style="color:#00E676;">{fmt_curr(after_tax, currency, usd_krw_rate)}</b></div>
                    </div>
                    <div style="width:100%; height:9px; background:#1F2D3A; border-radius:999px; overflow:hidden;">
                        <div class="av-gauge-fill" style="width:{min(100.0, max(3.0, prog)):.1f}%; height:100%; background:linear-gradient(90deg,#00E676,#2979FF); border-radius:999px;"></div>
                    </div>
                    <div style="font-size:0.72rem; color:#7A8B9A; margin-top:5px;">만기 진행률 {prog:.1f}% · ID {sav.get('ID', '-')}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    st.markdown("##### 🏠 직접 보유 채권 (미래에셋 외) & 💰 수동 현금성 통장")
    b_col1, b_col2 = st.columns(2)
    with b_col1:
        st.dataframe(pd.DataFrame(bonds_rows), use_container_width=True, hide_index=True)
    with b_col2:
        st.dataframe(pd.DataFrame(manual_cash_rows), use_container_width=True, hide_index=True)

# ---------------------------------------------------------------------------
# 7-B. 선택형 React 빌드 내장 웹앱 뷰 (기존 dist/index.html 임베드 보존)
# ---------------------------------------------------------------------------
dist_dir = Path(__file__).resolve().parent / "dist"
index_html_path = dist_dir / "index.html"
if index_html_path.exists():
    with st.expander("🖥️ React 풀 웹앱 뷰 (`dist/index.html` 내장 렌더링)", expanded=False):
        st.caption(
            "💡 아래 화면은 빌드된 React `AssetVision PRO` 인터랙티브 대시보드를 Streamlit 내부에서 직접 렌더링한 뷰입니다."
        )
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

# ---------------------------------------------------------------------------
# 8. 메뉴/탭 전환 시 원형 차트(원 그리기) & 막대/게이지 애니메이션 재실행 브릿지
# ---------------------------------------------------------------------------
components.html(
    """
    <script>
    (function() {
        try {
            const doc = window.parent.document;
            if (doc.__avChartDrawBound) return;
            doc.__avChartDrawBound = true;

            function animatePieCircleSweep(pieLayer) {
                if (!pieLayer || pieLayer.dataset.avSwept === '1') return;
                pieLayer.dataset.avSwept = '1';
                if (pieLayer.__avRafId) {
                    cancelAnimationFrame(pieLayer.__avRafId);
                }
                const duration = 860;
                const start = performance.now();
                function step(now) {
                    const t = Math.min(1, Math.max(0, (now - start) / duration));
                    const eased = 1 - Math.pow(1 - t, 3);
                    const deg = eased * 360;
                    if (t < 1) {
                        const edge = Math.min(360, deg + 1.8);
                        const maskVal = `conic-gradient(from 0deg at 50% 50%, #000 0deg, #000 ${deg.toFixed(2)}deg, transparent ${edge.toFixed(2)}deg, transparent 360deg)`;
                        pieLayer.style.webkitMaskImage = maskVal;
                        pieLayer.style.maskImage = maskVal;
                        pieLayer.__avRafId = requestAnimationFrame(step);
                    } else {
                        pieLayer.style.webkitMaskImage = '';
                        pieLayer.style.maskImage = '';
                        pieLayer.__avRafId = null;
                    }
                }
                pieLayer.__avRafId = requestAnimationFrame(step);
            }

            function replayChartDrawAnimations(container, forcePieReset) {
                const root = container || doc;
                const pieLayers = root.querySelectorAll('.stPlotlyChart g.pielayer, [data-testid="stPlotlyChart"] g.pielayer');
                pieLayers.forEach((el) => {
                    if (forcePieReset) {
                        delete el.dataset.avSwept;
                    }
                    animatePieCircleSweep(el);
                });

                if (forcePieReset) {
                    const barAndGaugeEls = root.querySelectorAll(
                        '.stPlotlyChart g.barlayer g.points g.point path, ' +
                        '.stPlotlyChart g.barlayer g.points g.point text, ' +
                        '.stPlotlyChart g.scatterlayer, ' +
                        '.av-gauge-fill'
                    );
                    barAndGaugeEls.forEach((el) => {
                        el.style.animation = 'none';
                        void el.offsetHeight;
                        el.style.animation = '';
                    });
                }
            }

            setTimeout(() => replayChartDrawAnimations(doc, false), 45);

            // 사이드바 메뉴 또는 서브탭 전환 시 애니메이션 재생
            doc.addEventListener('click', function(e) {
                const trigger = e.target.closest('[data-baseweb="tab"], [data-testid="stSidebar"] label');
                if (trigger) {
                    setTimeout(() => replayChartDrawAnimations(doc, true), 65);
                }
            }, true);

            // 리런으로 새 Plotly 원형 차트가 마운트될 때마다 스윕 애니메이션 실행
            let obsTimer = null;
            const targetRoot = doc.querySelector('[data-testid="stAppViewContainer"]') || doc.body;
            if (targetRoot && window.MutationObserver) {
                const observer = new MutationObserver(() => {
                    if (obsTimer) clearTimeout(obsTimer);
                    obsTimer = setTimeout(() => replayChartDrawAnimations(doc, false), 70);
                });
                observer.observe(targetRoot, { childList: true, subtree: true });
            }
        } catch (err) {
            // cross-origin 환경에서는 CSS 애니메이션이 자동 동작
        }
    })();
    </script>
    """,
    height=0,
)
