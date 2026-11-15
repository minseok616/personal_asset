"""
Google Sheets (gspread) 및 Apps Script JSON API 연동 모듈 (utils/gsheets_client.py)

인증 우선순위:
1. `st.secrets["gcp_service_account"]`가 존재하면 `Credentials.from_service_account_info`로 인증
2. 없으면 `.env`의 `GOOGLE_SERVICE_ACCOUNT_FILE` (또는 `GOOGLE_APPLICATION_CREDENTIALS`) 로컬 JSON 파일 경로로 인증
3. `PORTFOLIO_API_URL`이 설정된 경우 Apps Script JSON API 응답과 병합/폴백 지원
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import gspread
import requests
import streamlit as st
from google.oauth2.service_account import Credentials

from utils.secrets_helper import get_secret_section, get_sheets_config

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
]


@st.cache_resource(show_spinner=False)
def get_gspread_client() -> Tuple[Optional[gspread.Client], str]:
    """
    Google Sheets `gspread.Client` 인스턴스를 `@st.cache_resource`로 메모리에 캐싱하여 반환합니다.
    반환값: (client, auth_source_label)
    """
    # 1순위: Streamlit Cloud `st.secrets["gcp_service_account"]`
    gcp_sa_info = get_secret_section("gcp_service_account")
    if gcp_sa_info and gcp_sa_info.get("private_key") and gcp_sa_info.get("client_email"):
        try:
            # private_key 내 이스케이프된 \n 복원 처리
            sa_dict = dict(gcp_sa_info)
            if isinstance(sa_dict.get("private_key"), str):
                sa_dict["private_key"] = sa_dict["private_key"].replace("\\n", "\n")
            creds = Credentials.from_service_account_info(sa_dict, scopes=SCOPES)
            client = gspread.authorize(creds)
            return client, "st.secrets[gcp_service_account]"
        except Exception as exc:
            return None, f"gcp_service_account 인증 오류: {exc}"

    # 2순위: 로컬 JSON 서비스 계정 파일 경로 (.env fallback)
    sheets_cfg = get_sheets_config()
    sa_file = sheets_cfg.get("service_account_file", "")
    if sa_file:
        sa_path = Path(sa_file).expanduser()
        if not sa_path.is_absolute():
            sa_path = Path(__file__).resolve().parent.parent / sa_path
        if sa_path.exists() and sa_path.is_file():
            try:
                creds = Credentials.from_service_account_file(str(sa_path), scopes=SCOPES)
                client = gspread.authorize(creds)
                return client, f"Local JSON ({sa_path.name})"
            except Exception as exc:
                return None, f"로컬 JSON 인증 오류: {exc}"

    return None, "미연결 (Apps Script API 또는 기본 스냅샷 사용)"


def _read_records_from_gspread(client: gspread.Client) -> Optional[Dict[str, Any]]:
    """
    gspread 클라이언트로 구글 스프레드시트의 핵심 시트들을 직접 읽어 JSON 구조로 반환합니다.
    """
    cfg = get_sheets_config()
    sheet_id = cfg.get("spreadsheet_id", "")
    sheet_name = cfg.get("spreadsheet_name", "")

    if not sheet_id and not sheet_name:
        return None

    try:
        sh = client.open_by_key(sheet_id) if sheet_id else client.open(sheet_name)
    except Exception:
        return None

    sheet_map = {
        "manualCashAccounts": ["💰입출금통장", "입출금통장"],
        "physicalAssets": ["🚗실물_기타자산", "실물_기타자산"],
        "kisRealtime": ["💾KIS_실시간잔고", "KIS_실시간잔고"],
        "kisActivity": ["💸KIS_배당및체결내역", "KIS_배당및체결내역"],
        "kisTrades": ["📜KIS_매매체결DB", "KIS_매매체결DB"],
        "kisDividends": ["💸KIS_배당내역DB", "KIS_배당내역DB"],
        "watchlistResearch": ["🔍관심종목_리서치", "관심종목_리서치"],
        "geminiWeeklyReports": ["🤖Gemini_주간리포트DB", "Gemini_주간리포트DB"],
        "saveTickerNews": ["📰SaveTicker_뉴스스크랩DB", "SaveTicker_뉴스스크랩DB"],
    }

    available_titles = {ws.title: ws for ws in sh.worksheets()}
    payload: Dict[str, Any] = {}

    for key, candidate_names in sheet_map.items():
        for name in candidate_names:
            if name in available_titles:
                try:
                    payload[key] = available_titles[name].get_all_records()
                except Exception:
                    payload[key] = []
                break

    return payload if payload else None


@st.cache_data(ttl=300, show_spinner=False)
def fetch_portfolio_raw_payload() -> Tuple[Dict[str, Any], str]:
    """
    5분(300초) TTL로 캐싱되는 포트폴리오 데이터 로더입니다.
    1순위: `PORTFOLIO_API_URL` (Apps Script JSON API) 호출
    2순위: `gspread` 서비스 계정(`st.secrets["gcp_service_account"]` 또는 로컬 JSON) 직접 조회
    3순위: 안전한 내장 폴백 데이터 반환
    """
    sheets_cfg = get_sheets_config()
    api_url = sheets_cfg.get("portfolio_api_url", "")

    # 1) Apps Script JSON API가 설정되어 있으면 호출
    if api_url:
        try:
            resp = requests.get(api_url, timeout=15, headers={"Accept": "application/json"})
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict) and data:
                # gspread 서비스 계정도 연결되어 있다면 보완 시트 병합 가능
                client, auth_label = get_gspread_client()
                if client is not None:
                    gspread_data = _read_records_from_gspread(client)
                    if gspread_data:
                        for k, v in gspread_data.items():
                            if k not in data or not data.get(k):
                                data[k] = v
                        return data, f"Apps Script Live + {auth_label}"
                return data, "Google Sheets Apps Script API (Live)"
        except Exception:
            pass

    # 2) gspread 서비스 계정으로 직접 시트 조회
    client, auth_label = get_gspread_client()
    if client is not None:
        gspread_data = _read_records_from_gspread(client)
        if gspread_data:
            return gspread_data, f"gspread Direct ({auth_label})"

    # 3) 안전한 기본 스냅샷 반환 (오프라인/초기 설정 전에도 에러 없이 렌더링)
    return get_default_fallback_payload(), "Fallback Snapshot (오프라인 안전 모드)"


def get_default_fallback_payload() -> Dict[str, Any]:
    """API 또는 시트 미연결 시에도 앱이 깨지지 않도록 보장하는 기본 포트폴리오 스냅샷입니다."""
    return {
        "summary": {
            "기준일": "2026-11-15",
            "합계": 237029405,
            "현금": 93112000,
            "예적금": 44130000,
            "주식": 28907669,
            "채권": 14191300,
        },
        "integratedSummary": {
            "총순자산_실물포함": 263349405,
            "금융순자산": 237029405,
            "수동관리현금성": 93112000,
            "실물자산합계": 26320000,
            "환율": 1336.57,
        },
        "manualCashAccounts": [
            {"구분": "주거래통장", "기관명": "하나은행", "항목명": "급여·주거래 통장", "잔액": 420000, "비고": "자동이체 허브"},
            {"구분": "파킹통장", "기관명": "토스뱅크", "항목명": "토스뱅크 파킹통장", "잔액": 152000, "비고": "연 2.0% 일복리"},
            {"구분": "CMA", "기관명": "미래에셋증권", "항목명": "미래에셋 CMA (RP형)", "잔액": 140000, "비고": "비상금 파킹"},
            {"구분": "보유현금", "기관명": "실물/안전자금", "항목명": "보유 현금성 대기자금", "잔액": 36000000, "비고": "단기 유동성"},
            {"구분": "증여금", "기관명": "가족증여", "항목명": "증여금 원금 보존분", "잔액": 50000000, "비고": "안전자산 시드"},
            {"구분": "정부기여금", "기관명": "서민금융진흥원", "항목명": "청년도약계좌 정부기여금·누적분", "잔액": 6400000, "비고": "비과세 만기적립"},
        ],
        "physicalAssets": [
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
        ],
        "kisRealtime": [
            {
                "기준시각": "2026-11-15 09:00",
                "시장구분": "USD",
                "계좌구분": "위탁계좌",
                "종목코드": "CASH_USD",
                "종목명": "위탁 외화예수금 (USD)",
                "보유수량": 20312.48,
                "매수평단가": 1330.0,
                "현재가": 1336.57,
                "평가금액": 27149048,
                "평가손익": 133452,
                "수익률(%)": 0.49,
                "실질자산분류": "현금성 자산",
            },
            {
                "기준시각": "2026-11-15 09:00",
                "시장구분": "NASD",
                "계좌구분": "토스증권",
                "종목코드": "MSFT",
                "종목명": "Microsoft Corp.",
                "보유수량": 5.389457,
                "매수평단가": 417.34,
                "현재가": 426.59,
                "평가금액": 3073000,
                "평가손익": 225800,
                "수익률(%)": 7.93,
                "실질자산분류": "해외주식",
            },
            {
                "기준시각": "2026-11-15 09:00",
                "시장구분": "KRX",
                "계좌구분": "ISA중개형",
                "종목코드": "379810",
                "종목명": "KODEX 미국나스닥100",
                "보유수량": 18,
                "매수평단가": 17250,
                "현재가": 19120,
                "평가금액": 344160,
                "평가손익": 33660,
                "수익률(%)": 10.84,
                "실질자산분류": "해외주식",
            },
            {
                "기준시각": "2026-11-15 09:00",
                "시장구분": "KRX",
                "계좌구분": "연금저축",
                "종목코드": "379800",
                "종목명": "KODEX 미국S&P500",
                "보유수량": 340,
                "매수평단가": 16890,
                "현재가": 18950,
                "평가금액": 6443000,
                "평가손익": 700400,
                "수익률(%)": 12.20,
                "실질자산분류": "해외주식",
            },
            {
                "기준시각": "2026-11-15 09:00",
                "시장구분": "KRX",
                "계좌구분": "연금저축",
                "종목코드": "133690",
                "종목명": "TIGER 미국나스닥100",
                "보유수량": 42,
                "매수평단가": 108500,
                "현재가": 121300,
                "평가금액": 5094600,
                "평가손익": 537600,
                "수익률(%)": 11.80,
                "실질자산분류": "해외주식",
            },
            {
                "기준시각": "2026-11-15 09:00",
                "시장구분": "KRX",
                "계좌구분": "연금저축",
                "종목코드": "458730",
                "종목명": "TIGER 미국배당다우존스",
                "보유수량": 295,
                "매수평단가": 11250,
                "현재가": 12050,
                "평가금액": 3554750,
                "평가손익": 236000,
                "수익률(%)": 7.11,
                "실질자산분류": "해외주식",
            },
            {
                "기준시각": "2026-11-15 09:00",
                "시장구분": "KRX",
                "계좌구분": "퇴직연금(IRP)",
                "종목코드": "360750",
                "종목명": "TIGER 미국S&P500",
                "보유수량": 215,
                "매수평단가": 17420,
                "현재가": 19380,
                "평가금액": 4166700,
                "평가손익": 421400,
                "수익률(%)": 11.25,
                "실질자산분류": "해외주식",
            },
            {
                "기준시각": "2026-11-15 09:00",
                "시장구분": "KRX",
                "계좌구분": "퇴직연금(IRP)",
                "종목코드": "453850",
                "종목명": "ACE 미국30년국채액티브(H)",
                "보유수량": 320,
                "매수평단가": 8690,
                "현재가": 7897,
                "평가금액": 2527040,
                "평가손익": -253760,
                "수익률(%)": -9.13,
                "실질자산분류": "해외채권",
            },
            {
                "기준시각": "2026-11-15 09:00",
                "시장구분": "KRX",
                "계좌구분": "퇴직연금(IRP)",
                "종목코드": "448300",
                "종목명": "KODEX TDF2050액티브",
                "보유수량": 135,
                "매수평단가": 13100,
                "현재가": 14420,
                "평가금액": 1946700,
                "평가손익": 178200,
                "수익률(%)": 10.08,
                "실질자산분류": "해외주식",
            },
            {
                "기준시각": "2026-11-15 09:00",
                "시장구분": "KRX",
                "계좌구분": "퇴직연금(IRP)",
                "종목코드": "276990",
                "종목명": "KODEX 코리아배당성장채권혼합",
                "보유수량": 165,
                "매수평단가": 10850,
                "현재가": 11140,
                "평가금액": 1838100,
                "평가손익": 47850,
                "수익률(%)": 2.67,
                "실질자산분류": "국내채권",
            },
        ],
    }
