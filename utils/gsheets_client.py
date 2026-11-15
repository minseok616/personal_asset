"""
Google Sheets (gspread) 및 Apps Script JSON API 양방향(Read/Write) 연동 모듈 (utils/gsheets_client.py)

핵심 기능:
1. 읽기(Read):
   - 1순위: `st.secrets["sheets"]["PORTFOLIO_API_URL"]` (Apps Script `doGet`)
   - 2순위: `st.secrets["gcp_service_account"]` (`Credentials.from_service_account_info`) 또는 로컬 JSON 파일을 통한 `gspread` 직접 조회
2. 쓰기(Write — 비-KIS 수동 관리 자산 4대 시트 전용):
   - KIS API 자동연동 자산은 읽기 전용(Read-Only)으로 보호
   - `💰입출금통장`, `🌱예적금내역`, `🏠채권내역`, `🚗실물_기타자산`에 대해
     `PORTFOLIO_API_URL`의 `doPost`로 `{ token, action, sheetName, row, updates, formulaCols, preserveFormulaColumns, formulaColumnIndices, editableColumnIndices }` JSON POST 전송
   - 수식 열(예: `💰입출금통장` B열[2열] `총합계`, `🌱예적금내역` I~N열[9~14열] `만기수령액` 등, `🏠채권내역` F~G열[6~7열] `총 납입액`)은
     열 이름과 1-based 열 인덱스를 모두 매핑하여 절대 덮어쓰지 않도록 보호
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import gspread
import requests
import streamlit as st
from google.oauth2.service_account import Credentials

from utils.secrets_helper import (
    get_secret_section,
    get_sheets_config,
    get_sheets_secrets_diagnostics,
)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
]

# 1) 시트별 수식 보호 열 이름 정의 (앱에서 수정·저장 시 절대 덮어쓰지 않고 시트 수식을 유지/복사할 컬럼)
FORMULA_PROTECTED_COLUMNS: Dict[str, List[str]] = {
    "💰입출금통장": ["총합계"],
    "🌱예적금내역": [
        "만기수령액(세전)",
        "만기수령액(세후)",
        "ID",
        "만기일",
        "환율",
        "만기수령액(통화)",
        "만기수령액",
        "세전이자",
        "세후이자",
    ],
    "🏠채권내역": ["수령", "총 납입액"],
    "🚗실물_기타자산": ["경과월수(개월)", "감가상각누계액(원)", "현재평가액(원)"],
}

# 2) 시트별 실제 구글 시트 1-based 열 인덱스 매핑 (수식 셀 덮어쓰기 원천 차단용)
SHEET_FORMULA_COL_INDICES: Dict[str, Dict[str, int]] = {
    "💰입출금통장": {"총합계": 2},  # B열 (2번째 열) 수식 보호
    "🌱예적금내역": {
        "만기수령액(세전)": 9,   # I열
        "만기수령액(세후)": 10,  # J열
        "ID": 11,                # K열
        "만기일": 12,            # L열
        "환율": 13,              # M열
        "만기수령액(통화)": 14,  # N열
    },
    "🏠채권내역": {
        "수령": 6,        # F열
        "총 납입액": 7,   # G열
    },
    "🚗실물_기타자산": {
        "경과월수(개월)": 8,       # H열
        "감가상각누계액(원)": 9,   # I열
        "현재평가액(원)": 10,      # J열
    },
}

SHEET_EDITABLE_COL_INDICES: Dict[str, Dict[str, int]] = {
    "💰입출금통장": {
        "날짜": 1,                      # A열
        # B열(2열: 총합계)은 수식 열이므로 제외
        "주거래 하나 통장": 3,          # C열
        "토스뱅크 통장": 4,             # D열
        "미래에셋 종합_CMA": 5,         # E열
        "보유 현금": 6,                 # F열
        "증여금": 7,                    # G열
        "청년도약계좌 정부기여금": 8,   # H열
    },
    "🌱예적금내역": {
        "구분": 1,    # A열
        "은행": 2,    # B열
        "가입일": 3,  # C열
        "이율": 4,    # D열
        "기간": 5,    # E열
        "금액": 6,    # F열
        "비과세": 7,  # G열
        "통화": 8,    # H열
        # I~N열(9~14열)은 수식 열이므로 제외
    },
    "🏠채권내역": {
        "채권명": 1,        # A열
        "설명": 2,          # B열
        "가입일": 3,        # C열
        "종료일": 4,        # D열
        "월 납입금액": 5,   # E열
        # F~G열(6~7열: 수령, 총 납입액)은 수식 열이므로 제외
    },
    "🚗실물_기타자산": {
        "자산구분": 1,               # A열
        "자산명": 2,                 # B열
        "취득일": 3,                 # C열
        "취득원가(원)": 4,           # D열
        "내용연수(년)": 5,           # E열
        "잔존가치율": 6,             # F열
        "감가상각방법": 7,           # G열
        # H~J열(8~10열: 경과월수, 감가상각누계액(원), 현재평가액(원))은 수식 열
        "비고 및 감가상각 설명": 11, # K열
    },
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
    구글 시트의 기존 수식(예: B열 `총합계`, I~N열 `만기수령액`, G열 `총 납입액`)이 덮어써지지 않도록 보장합니다.
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
    formula_col_indices = SHEET_FORMULA_COL_INDICES.get(sheet_name, {})
    editable_col_indices = SHEET_EDITABLE_COL_INDICES.get(sheet_name, {})

    sanitized_row = strip_formula_columns(sheet_name, row) if row else None
    sanitized_updates = (
        [strip_formula_columns(sheet_name, r) for r in updates]
        if updates is not None
        else None
    )

    payload: Dict[str, Any] = {
        "token": api_token,
        "action": action,
        "sheetName": sheet_name,
        "formulaCols": protected_cols,
        "preserveFormulaColumns": protected_cols,
        "formulaColumnIndices": formula_col_indices,
        "editableColumnIndices": editable_col_indices,
        "copyFormulaFromPrevRow": True,
    }
    if sanitized_row is not None:
        payload["row"] = sanitized_row
    if sanitized_updates is not None:
        payload["updates"] = sanitized_updates

    try:
        resp = requests.post(
            api_url,
            json=payload,
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "AssetVision-Streamlit/1.0",
            },
            allow_redirects=True,
            timeout=(10, 25),
        )
        resp.raise_for_status()

        raw_text = (resp.text or "").lstrip()
        if "text/html" in (resp.headers.get("Content-Type") or "").lower() or raw_text.startswith("<!DOCTYPE") or raw_text.startswith("<html"):
            return (
                False,
                "구글 시트 저장 실패: Apps Script가 JSON 대신 HTML 페이지를 반환했습니다. 웹앱 배포 액세스 권한('모든 사용자')을 확인해 주세요.",
                {"rawText": raw_text[:200]},
            )

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
            f"✅ `{sheet_name}` 시트에 성공적으로 반영되었습니다! (보호된 수식 열: {protected_cols or '없음'})",
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
        "manualCashAccounts": ["💰입출금통장", "입출금통장"],
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
def _fetch_apps_script_json_cached(api_url: str) -> Dict[str, Any]:
    """
    Google Apps Script 웹앱(`doGet`) 호출 및 JSON 파싱 전용 캐시 헬퍼 (성공 응답만 300초 캐싱).
    302 리다이렉트(`script.googleusercontent.com`)와 콜드 스타트 지연을 고려해
    `allow_redirects=True`, `timeout=(10, 25)`을 적용하며, 실패 시 예외를 발생시켜 오류를 캐싱하지 않습니다.
    """
    try:
        resp = requests.get(
            api_url,
            timeout=(10, 25),
            allow_redirects=True,
            headers={
                "Accept": "application/json, text/plain, */*",
                "User-Agent": "AssetVision-Streamlit/1.0",
            },
        )
    except requests.exceptions.Timeout as exc:
        raise RuntimeError(f"[Apps Script HTTP 요청 타임아웃(25초 초과)] {exc}") from exc
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"[Apps Script HTTP 연결/리다이렉트 오류] {exc}") from exc

    if resp.status_code >= 400:
        snippet = (resp.text or "").strip().replace("\n", " ")[:180]
        raise RuntimeError(
            f"[Apps Script HTTP {resp.status_code} 오류] 최종 URL 호스트: {resp.url.split('/')[2] if '/' in resp.url else resp.url} | 응답: {snippet}"
        )

    content_type = (resp.headers.get("Content-Type") or "").lower()
    raw_text = (resp.text or "").lstrip()
    if "text/html" in content_type or raw_text.startswith("<!DOCTYPE") or raw_text.startswith("<html"):
        final_host = resp.url.split("/")[2] if "://" in resp.url else "unknown"
        raise RuntimeError(
            f"[Apps Script JSON 대신 HTML 반환] 리다이렉트 호스트={final_host}. "
            "Google Apps Script 웹앱 배포 설정에서 액세스 권한이 '모든 사용자(Anyone)'인지, 또는 로그인 페이지로 리다이렉트되지 않았는지 확인하세요."
        )

    try:
        data = resp.json()
    except Exception as exc:
        snippet = raw_text.replace("\n", " ")[:180]
        raise RuntimeError(
            f"[doGet JSON 파싱 오류] {type(exc).__name__}: {exc} | 본문 미리보기: {snippet}"
        ) from exc

    if not isinstance(data, dict) or not data:
        raise RuntimeError(
            f"[doGet 응답 형식 오류] 최상위 JSON 객체(dict)가 아니거나 비어 있습니다. (수신 타입: {type(data).__name__})"
        )

    if data.get("result") == "error" or (data.get("error") and len(data) <= 3):
        err_detail = data.get("message") or data.get("error") or str(data)
        raise RuntimeError(f"[Apps Script doGet 에러 응답] {err_detail}")

    return data


def fetch_portfolio_raw_payload_with_diagnostics() -> Tuple[Dict[str, Any], str, Dict[str, Any]]:
    """
    포트폴리오 데이터 로더 + 상세 진단 정보 반환 함수입니다.
    1순위: `PORTFOLIO_API_URL` (Apps Script `doGet`, 302 리다이렉트 지원 & 타임아웃 25초)
    2순위: `gspread` 서비스 계정(`st.secrets["gcp_service_account"]` 또는 로컬 JSON) 직접 조회
    3순위: 안전한 내장 폴백 데이터 반환 + 정확한 실패 단계/예외 메시지 기록
    """
    sheets_cfg = get_sheets_config()
    secrets_diag = get_sheets_secrets_diagnostics()
    api_url = sheets_cfg.get("portfolio_api_url", "")

    diagnostics: Dict[str, Any] = {
        "secrets": secrets_diag,
        "failed_stage": None,
        "error_message": "",
        "gspread_error": "",
        "empty_sections": [],
    }

    if not api_url:
        diagnostics["failed_stage"] = "Secrets 조회 (PORTFOLIO_API_URL 미설정)"
        diagnostics["error_message"] = (
            'st.secrets["sheets"]["PORTFOLIO_API_URL"] / st.secrets["PORTFOLIO_API_URL"] / .env 모두에서 '
            "PORTFOLIO_API_URL 값을 찾지 못했습니다."
        )
    elif not api_url.startswith("http"):
        diagnostics["failed_stage"] = "Secrets 검증 (PORTFOLIO_API_URL 형식 오류)"
        diagnostics["error_message"] = (
            f"PORTFOLIO_API_URL이 'http'로 시작하지 않습니다 (출처: {secrets_diag.get('url_source')})."
        )
    else:
        try:
            data = _fetch_apps_script_json_cached(api_url)
            expected_keys = [
                "summary",
                "manualCashAccounts",
                "savings",
                "bonds",
                "physicalAssets",
                "kisRealtime",
                "kisTrades",
                "kisDividends",
            ]
            empty_secs = [k for k in expected_keys if not data.get(k)]
            diagnostics["empty_sections"] = empty_secs

            client, auth_label = get_gspread_client()
            if client is not None:
                try:
                    gspread_data = _read_records_from_gspread(client)
                    if gspread_data:
                        for k, v in gspread_data.items():
                            if k not in data or not data.get(k):
                                data[k] = v
                        diagnostics["empty_sections"] = [k for k in expected_keys if not data.get(k)]
                        return data, f"Apps Script Live + {auth_label}", diagnostics
                except Exception as g_exc:
                    diagnostics["gspread_error"] = f"{type(g_exc).__name__}: {g_exc}"

            return data, "Google Sheets Apps Script API (Live)", diagnostics
        except Exception as exc:
            diagnostics["failed_stage"] = "Apps Script doGet 호출/JSON 파싱"
            diagnostics["error_message"] = f"{type(exc).__name__}: {exc}"

    client, auth_label = get_gspread_client()
    if client is not None:
        try:
            gspread_data = _read_records_from_gspread(client)
            if gspread_data:
                return gspread_data, f"gspread Direct ({auth_label})", diagnostics
            diagnostics["gspread_error"] = f"시트를 열었으나 레코드가 비어 있습니다 ({auth_label})."
        except Exception as g_exc:
            diagnostics["gspread_error"] = f"{type(g_exc).__name__}: {g_exc}"
    else:
        diagnostics["gspread_error"] = auth_label

    return (
        get_default_fallback_payload(),
        "Fallback Snapshot (오프라인 안전 모드)",
        diagnostics,
    )


def fetch_portfolio_raw_payload() -> Tuple[Dict[str, Any], str]:
    """기존 호환용 래퍼: `(raw_payload, data_source_label)`을 반환합니다."""
    data, label, _ = fetch_portfolio_raw_payload_with_diagnostics()
    return data, label


def get_default_fallback_payload() -> Dict[str, Any]:
    """API 또는 시트 미연결 시에도 앱이 깨지지 않도록 보장하는 기본 포트폴리오 스냅샷입니다."""
    return {
        "summary": {
            "기준일": "2026-11-15",
            "합계": 207826654,
            "현금": 120293765,
            "예적금": 44127594,
            "주식": 25834505,
            "채권": 17570790,
        },
        "integratedSummary": {
            "총순자산_실물포함": 234306098,
            "금융순자산": 207826654,
            "수동관리현금성": 93110610,
            "실물자산합계": 26479444,
            "환율": 1335.32,
        },
        "manualCashAccounts": [
            {
                "날짜": "2026-11-15",
                "총합계": 93110610,
                "주거래 하나 통장": 510640,
                "토스뱅크 통장": 199900,
                "미래에셋 종합_CMA": 70,
                "보유 현금": 36000000,
                "증여금": 50000000,
                "청년도약계좌 정부기여금": 6400000,
            }
        ],
        "savings": [
            {
                "구분": "적금",
                "은행": "하나은행",
                "가입일": "2023-07-10",
                "이율": 4.5,
                "기간": 60,
                "금액": 700000,
                "비과세": "O",
                "통화": "KRW",
                "만기수령액(세전)": 42960750,
                "만기수령액(세후)": 42812795,
                "ID": "A00001",
                "만기일": "2028-07-10",
                "환율": 1,
                "만기수령액(통화)": 49812795,
            },
            {
                "구분": "적금",
                "은행": "전세반환대출",
                "가입일": "2023-10-21",
                "이율": 0.0,
                "기간": 120,
                "금액": 300000,
                "비과세": "",
                "통화": "KRW",
                "만기수령액(세전)": 36000000,
                "만기수령액(세후)": 36000000,
                "ID": "A00002",
                "만기일": "2033-10-21",
                "환율": 1,
                "만기수령액(통화)": 36000000,
            },
        ],
        "bonds": [
            {
                "채권명": "T1.125",
                "설명": "미국장기채",
                "가입일": "2025-11-18",
                "종료일": "2040-08-15",
                "월 납입금액": 99270,
                "수령": "",
                "총 납입액": 17570790,
            }
        ],
        "physicalAssets": [
            {
                "자산구분": "자동차",
                "자산명": "현대 디 올뉴코나 1.6 터보",
                "취득일": "2026-04-01",
                "취득원가(원)": 28000000,
                "내용연수(년)": 5,
                "잔존가치율": 0.1,
                "감가상각방법": "정액법 (5년)",
                "경과월수(개월)": 7,
                "감가상각누계액(원)": 2940000,
                "현재평가액(원)": 25060000,
                "비고 및 감가상각 설명": "차량 감가상각률 연 18% (내용연수 60개월, 잔존가치 10%)",
            },
            {
                "자산구분": "전자기기",
                "자산명": "아이폰 17 프로",
                "취득일": "2026-01-01",
                "취득원가(원)": 1550000,
                "내용연수(년)": 3,
                "잔존가치율": 0,
                "감가상각방법": "정액법 (3년)",
                "경과월수(개월)": 10,
                "감가상각누계액(원)": 430556,
                "현재평가액(원)": 1119444,
                "비고 및 감가상각 설명": "스마트폰 감가상각 (내용연수 36개월, 잔존가치 0%)",
            },
            {
                "자산구분": "귀금속",
                "자산명": "금반지 (순금 1돈)",
                "취득일": "2026-08-01",
                "취득원가(원)": 300000,
                "내용연수(년)": "-",
                "잔존가치율": 1,
                "감가상각방법": "비상각(시세반영)",
                "경과월수(개월)": "-",
                "감가상각누계액(원)": 0,
                "현재평가액(원)": 300000,
                "비고 및 감가상각 설명": "귀금속 자산가치 보존 (비감가상각 대상)",
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
        ],
    }
