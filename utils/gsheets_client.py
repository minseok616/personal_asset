"""
Google Sheets (gspread) 및 Apps Script JSON API 양방향(Read/Write) 연동 모듈 (utils/gsheets_client.py)

핵심 기능:
1. 읽기(Read):
   - 1순위: `st.secrets["sheets"]["PORTFOLIO_API_URL"]` (Apps Script `doGet`)
   - 2순위: `st.secrets["gcp_service_account"]` (`Credentials.from_service_account_info`) 또는 로컬 JSON 파일을 통한 `gspread` 직접 조회
2. 쓰기(Write — 비-KIS 수동 관리 자산 4대 시트 전용):
   - KIS API 자동연동 자산은 읽기 전용(Read-Only)으로 보호
   - `💰입출금통장`, `🌱예적금내역`, `🏠채권내역`, `🚗실물_기타자산`에 대해
     `PORTFOLIO_API_URL`의 `doPost`로 `{ action, sheetName, row, updates, preserveFormulaColumns, token }` JSON POST 전송
   - 수식 열(예: `💰입출금통장` B열 `총합계`, `🌱예적금내역` `만기수령액`, `🏠채권내역` `총 납입액`)은 덮어쓰지 않고 보존/복사하도록 필터링
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

# 시트별 수식 보호 열 정의 (앱에서 수정·저장 시 절대 덮어쓰지 않고 시트 수식을 유지/복사할 컬럼)
FORMULA_PROTECTED_COLUMNS: Dict[str, List[str]] = {
    "💰입출금통장": ["총합계"],
    "🌱예적금내역": [
        "만기일",
        "만기수령액(세전)",
        "만기수령액(세후)",
        "만기수령액",
        "세전이자",
        "세후이자",
    ],
    "🏠채권내역": ["총 납입액"],
    "🚗실물_기타자산": [],
}


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

    return None, "미연결 (Apps Script API 연동 모드)"


def strip_formula_columns(
    sheet_name: str, record: Dict[str, Any]
) -> Dict[str, Any]:
    """
    수식 보호 열(`FORMULA_PROTECTED_COLUMNS`)에 해당하는 키를 전송 페이로드에서 제외하여
    구글 시트의 기존 수식(예: B열 `총합계`, `만기수령액`, `총 납입액`)이 덮어써지지 않도록 보장합니다.
    """
    protected = set(FORMULA_PROTECTED_COLUMNS.get(sheet_name, []))
    return {k: v for k, v in record.items() if k not in protected}


def post_sheet_write_action(
    action: str,
    sheet_name: str,
    row: Optional[Dict[str, Any]] = None,
    updates: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Google Apps Script 웹앱(`PORTFOLIO_API_URL`)의 `doPost(e)`로 비-KIS 수동 관리 자산의
    수정/추가 요청을 JSON POST로 전송합니다.

    전송 스키마:
    {
        "action": "updateRows" | "appendRow" | "upsertByDate",
        "sheetName": "💰입출금통장" | "🌱예적금내역" | "🏠채권내역" | "🚗실물_기타자산",
        "row": { ... },                 # 단일 행 추가/수정 시 (수식 열 제외됨)
        "updates": [ { ... }, ... ],    # 테이블 전체/다중 행 수정 시 (수식 열 제외됨)
        "preserveFormulaColumns": [...],# 덮어쓰지 않고 보존/복사할 수식 열 목록
        "copyFormulaFromPrevRow": True, # 새 행 추가 시 이전 행 수식 자동 복사 플래그
        "token": "<API_TOKEN>"          # st.secrets["sheets"]["API_TOKEN"]
    }

    성공 시 `st.cache_data.clear()`를 호출하여 최신 시트 데이터가 즉시 다시 로드되도록 합니다.
    """
    cfg = get_sheets_config()
    api_url = cfg.get("portfolio_api_url", "")
    api_token = cfg.get("api_token", "")

    if not api_url:
        return (
            False,
            "PORTFOLIO_API_URL이 설정되지 않았습니다. `.streamlit/secrets.toml` 또는 `.env`의 `[sheets]` 섹션을 확인해 주세요.",
            {},
        )

    protected_cols = FORMULA_PROTECTED_COLUMNS.get(sheet_name, [])
    sanitized_row = strip_formula_columns(sheet_name, row) if row else None
    sanitized_updates = (
        [strip_formula_columns(sheet_name, r) for r in updates]
        if updates is not None
        else None
    )

    payload: Dict[str, Any] = {
        "action": action,
        "sheetName": sheet_name,
        "preserveFormulaColumns": protected_cols,
        "copyFormulaFromPrevRow": True,
        "token": api_token,
    }
    if sanitized_row is not None:
        payload["row"] = sanitized_row
    if sanitized_updates is not None:
        payload["updates"] = sanitized_updates

    try:
        resp = requests.post(
            api_url,
            json=payload,
            headers={"Content-Type": "application/json; charset=utf-8"},
            allow_redirects=True,
            timeout=25,
        )
        resp.raise_for_status()

        # JSON 응답 파싱 시도 (Apps Script ContentService JSON 응답)
        resp_json: Dict[str, Any] = {}
        try:
            resp_json = resp.json()
        except Exception:
            resp_json = {"status": "ok", "rawText": resp.text[:300]}

        if isinstance(resp_json, dict) and resp_json.get("result") == "error":
            err_msg = resp_json.get("message") or resp_json.get("error") or "Apps Script 처리 오류"
            return False, f"구글 시트 저장 실패: {err_msg}", resp_json

        # 캐시 즉시 초기화하여 대시보드 총자산 및 차트가 최신 데이터로 갱신되도록 처리
        st.cache_data.clear()
        return (
            True,
            f"✅ `{sheet_name}` 시트에 성공적으로 반영되었습니다! (수식 열 {protected_cols or '없음'} 보존됨)",
            resp_json,
        )
    except Exception as exc:
        return False, f"Apps Script POST 전송 중 오류 발생: {exc}", {}


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
        "checkingAccounts": ["💰입출금통장", "입출금통장"],
        "savings": ["🌱예적금내역", "예적금내역"],
        "bonds": ["🏠채권내역", "채권내역"],
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

    if api_url:
        try:
            resp = requests.get(api_url, timeout=15, headers={"Accept": "application/json"})
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict) and data:
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

    client, auth_label = get_gspread_client()
    if client is not None:
        gspread_data = _read_records_from_gspread(client)
        if gspread_data:
            return gspread_data, f"gspread Direct ({auth_label})"

    return get_default_fallback_payload(), "Fallback Snapshot (오프라인 안전 모드)"


def get_default_fallback_payload() -> Dict[str, Any]:
    """API 또는 시트 미연결 시에도 앱이 깨지지 않도록 보장하는 기본 포트폴리오 스냅샷입니다."""
    return {
        "summary": {
            "기준일": "2026-11-15",
            "합계": 237029405,
            "현금": 93110610,
            "예적금": 44130000,
            "주식": 28907669,
            "채권": 14191300,
        },
        "integratedSummary": {
            "총순자산_실물포함": 263349405,
            "금융순자산": 237029405,
            "수동관리현금성": 93110610,
            "실물자산합계": 26320000,
            "환율": 1336.57,
        },
        "checkingAccounts": [
            {
                "날짜": "2026-11-15",
                "총합계": 93110610,
                "주거래 하나 통장": 510640,
                "토스뱅크 통장": 199900,
                "미래에셋 종합_CMA": 70,
                "보유 현금": 36000000,
                "증여금": 50000000,
                "청년도약계좌 정부기여금": 6400000,
            },
            {
                "날짜": "2026-10-15",
                "총합계": 92450000,
                "주거래 하나 통장": 450000,
                "토스뱅크 통장": 180000,
                "미래에셋 종합_CMA": 70,
                "보유 현금": 35620000,
                "증여금": 50000000,
                "청년도약계좌 정부기여금": 6200000,
            },
        ],
        "savings": [
            {
                "구분": "적금",
                "은행": "하나은행 (청년도약계좌)",
                "가입일": "2023-07-10",
                "만기일": "2028-07-10",
                "이율": 4.5,
                "기간": 60,
                "금액": 700000,
                "비과세": "O",
                "통화": "KRW",
                "만기수령액(세전)": 42812795,
                "만기수령액(세후)": 42812795,
            },
            {
                "구분": "적금",
                "은행": "신한은행 (청년처음적금)",
                "가입일": "2025-02-15",
                "만기일": "2027-02-15",
                "이율": 5.0,
                "기간": 24,
                "금액": 300000,
                "비과세": "X",
                "통화": "KRW",
                "만기수령액(세전)": 7575000,
                "만기수령액(세후)": 7517250,
            },
            {
                "구분": "청약",
                "은행": "주택청약종합저축",
                "가입일": "2021-03-01",
                "만기일": "2030-03-01",
                "이율": 3.1,
                "기간": 108,
                "금액": 100000,
                "비과세": "O",
                "통화": "KRW",
                "만기수령액(세전)": 12300000,
                "만기수령액(세후)": 12300000,
            },
        ],
        "bonds": [
            {
                "채권명": "미국 국채 30년 (TLT/직투)",
                "설명": "장기 금리 인하 사이클 듀레이션 베팅 및 달러 월배당",
                "가입일": "2024-06-01",
                "종료일": "2028-06-01",
                "월 납입금액": 300000,
                "총 납입액": 8700000,
            },
            {
                "채권명": "국고채 및 우량 회사채 적립",
                "설명": "안전자산 인컴 캐시플로우 확보용",
                "가입일": "2025-01-10",
                "종료일": "2027-12-31",
                "월 납입금액": 250000,
                "총 납입액": 5491300,
            },
        ],
        "physicalAssets": [
            {
                "자산명": "현대 디 올뉴코나",
                "카테고리": "자동차",
                "취득일": "2025-03-10",
                "취득원가": 28500000,
                "연감가율(%)": 15,
                "감가상각누계액": 5000000,
                "현재가치": 23500000,
                "비고": "연 15% 정률 감가상각 반영",
            },
            {
                "자산명": "아이폰 17 Pro",
                "카테고리": "IT기기",
                "취득일": "2025-10-05",
                "취득원가": 2150000,
                "연감가율(%)": 30,
                "감가상각누계액": 250000,
                "현재가치": 1900000,
                "비고": "연 30% 정률 감가상각 반영",
            },
            {
                "자산명": "순금 반지 (24K)",
                "카테고리": "귀금속/현물",
                "취득일": "2024-05-20",
                "취득원가": 750000,
                "연감가율(%)": 0,
                "감가상각누계액": -170000,
                "현재가치": 920000,
                "비고": "금 한돈(3.75g) 현물 시세 연동",
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
