"""
Secrets 및 환경변수 통합 관리 헬퍼 모듈 (utils/secrets_helper.py)

우선순위:
1. Streamlit Community Cloud의 `st.secrets`에서 우선 조회 (섹션 구조 및 최상위 키 모두 지원)
2. 로컬 실행 환경에서는 `.env` 파일 및 OS 환경변수(`os.getenv`)를 fallback으로 조회
3. 일부 섹션이나 키가 비어 있어도 절대 크래시되지 않고 안전한 기본값(빈 문자열)을 반환
4. 코드 내에 어떠한 API 키, 계좌번호, 시트 ID, 개인 경로도 하드코딩하지 않음
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import streamlit as st
from dotenv import load_dotenv

# 로컬 실행 시 프로젝트 루트의 .env 파일을 로드 (클라우드에서 파일이 없어도 무방)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_ENV_PATH = _PROJECT_ROOT / ".env"
if _ENV_PATH.exists():
    load_dotenv(dotenv_path=_ENV_PATH, override=False)
else:
    load_dotenv(override=False)


def _has_streamlit_secrets() -> bool:
    """st.secrets가 정상적으로 초기화되어 접근 가능한지 안전하게 확인합니다."""
    try:
        return len(st.secrets) > 0
    except Exception:
        return False


def get_secret(
    key: str,
    default: Any = None,
    section: Optional[str] = None,
    env_fallbacks: Optional[list[str]] = None,
) -> Any:
    """
    1순위: Streamlit Cloud의 `st.secrets`에서 값을 읽어옵니다.
           - `section`이 지정된 경우 `st.secrets[section][key]`를 먼저 확인합니다.
           - 최상위 `st.secrets[key]`도 함께 확인합니다.
    2순위: 로컬 `.env` 및 OS 환경변수(`os.getenv`)에서 읽어옵니다.
    3순위: 모두 없으면 `default`를 반환합니다.
    """
    if _has_streamlit_secrets():
        try:
            if section and section in st.secrets:
                sec_obj = st.secrets[section]
                if hasattr(sec_obj, "__contains__"):
                    if key in sec_obj and sec_obj[key] not in (None, ""):
                        return sec_obj[key]
                    lower_key = key.lower()
                    if lower_key in sec_obj and sec_obj[lower_key] not in (None, ""):
                        return sec_obj[lower_key]

            if key in st.secrets and st.secrets[key] not in (None, ""):
                return st.secrets[key]

            if env_fallbacks:
                for alt_key in env_fallbacks:
                    if section and section in st.secrets:
                        sec_obj = st.secrets[section]
                        if hasattr(sec_obj, "__contains__"):
                            if alt_key in sec_obj and sec_obj[alt_key] not in (None, ""):
                                return sec_obj[alt_key]
                            if alt_key.lower() in sec_obj and sec_obj[alt_key.lower()] not in (None, ""):
                                return sec_obj[alt_key.lower()]
                    if alt_key in st.secrets and st.secrets[alt_key] not in (None, ""):
                        return st.secrets[alt_key]
        except Exception:
            pass

    val = os.getenv(key)
    if val not in (None, ""):
        return val

    if env_fallbacks:
        for alt_key in env_fallbacks:
            alt_val = os.getenv(alt_key)
            if alt_val not in (None, ""):
                return alt_val

    return default


def get_secret_section(section: str) -> Optional[Dict[str, Any]]:
    """
    `st.secrets[section]` 테이블(예: `gcp_service_account`)을 dict 형태로 안전하게 반환합니다.
    없으면 None을 반환합니다.
    """
    if _has_streamlit_secrets():
        try:
            if section in st.secrets and st.secrets[section] is not None:
                return dict(st.secrets[section])
        except Exception:
            return None
    return None


def _parse_account_pair(raw_cano: str, raw_prdt: str, default_prdt: str) -> Tuple[str, str]:
    """
    계좌번호가 '12345678-01'처럼 하이픈 포함 문자열로 들어오거나,
    CANO('12345678')와 ACNT_PRDT_CD('01')로 분리되어 들어오는 경우 모두 안전하게 정규화합니다.
    """
    cano_clean = str(raw_cano or "").strip()
    prdt_clean = str(raw_prdt or "").strip()

    if "-" in cano_clean:
        parts = cano_clean.split("-", 1)
        cano_clean = parts[0].strip()
        if not prdt_clean and len(parts) > 1 and parts[1].strip():
            prdt_clean = parts[1].strip()

    if not prdt_clean:
        prdt_clean = default_prdt

    return cano_clean, prdt_clean


def get_kis_config() -> Dict[str, str]:
    """
    한국투자증권(KIS) OpenAPI 키 및 4개 계좌(위탁, ISA, 연금저축, IRP) 설정을 반환합니다.
    모든 값은 `st.secrets` 우선 -> `.env` fallback으로 읽으며 하드코딩된 계좌번호를 포함하지 않습니다.
    """
    raw_brok_cano = str(
        get_secret(
            "KIS_CANO_BROKERAGE",
            default="",
            section="kis",
            env_fallbacks=["CANO_BROKERAGE", "BROKERAGE_CANO", "KIS_ACCOUNT_BROKERAGE", "KIS_CANO"],
        )
    )
    raw_brok_prdt = str(
        get_secret(
            "KIS_ACNT_PRDT_CD_BROKERAGE",
            default="",
            section="kis",
            env_fallbacks=["ACNT_PRDT_CD_BROKERAGE", "BROKERAGE_PRDT_CD", "KIS_ACNT_PRDT_CD"],
        )
    )
    cano_brok, prdt_brok = _parse_account_pair(raw_brok_cano, raw_brok_prdt, "01")

    raw_isa_cano = str(
        get_secret(
            "KIS_CANO_ISA",
            default="",
            section="kis",
            env_fallbacks=["CANO_ISA", "ISA_CANO", "KIS_ACCOUNT_ISA"],
        )
    )
    raw_isa_prdt = str(
        get_secret(
            "KIS_ACNT_PRDT_CD_ISA",
            default="",
            section="kis",
            env_fallbacks=["ACNT_PRDT_CD_ISA", "ISA_PRDT_CD"],
        )
    )
    cano_isa, prdt_isa = _parse_account_pair(raw_isa_cano, raw_isa_prdt, "01")

    raw_pen_cano = str(
        get_secret(
            "KIS_CANO_PENSION",
            default="",
            section="kis",
            env_fallbacks=["CANO_PENSION", "PENSION_CANO", "KIS_ACCOUNT_PENSION"],
        )
    )
    raw_pen_prdt = str(
        get_secret(
            "KIS_ACNT_PRDT_CD_PENSION",
            default="",
            section="kis",
            env_fallbacks=["ACNT_PRDT_CD_PENSION", "PENSION_PRDT_CD"],
        )
    )
    cano_pen, prdt_pen = _parse_account_pair(raw_pen_cano, raw_pen_prdt, "22")

    raw_irp_cano = str(
        get_secret(
            "KIS_CANO_IRP",
            default="",
            section="kis",
            env_fallbacks=["CANO_IRP", "IRP_CANO", "KIS_ACCOUNT_IRP"],
        )
    )
    raw_irp_prdt = str(
        get_secret(
            "KIS_ACNT_PRDT_CD_IRP",
            default="",
            section="kis",
            env_fallbacks=["ACNT_PRDT_CD_IRP", "IRP_PRDT_CD"],
        )
    )
    cano_irp, prdt_irp = _parse_account_pair(raw_irp_cano, raw_irp_prdt, "29")

    return {
        "app_key": str(
            get_secret("KIS_APP_KEY", default="", section="kis", env_fallbacks=["APP_KEY"])
        ).strip(),
        "app_secret": str(
            get_secret("KIS_APP_SECRET", default="", section="kis", env_fallbacks=["APP_SECRET"])
        ).strip(),
        "base_url": str(
            get_secret(
                "KIS_BASE_URL",
                default="https://openapi.koreainvestment.com:9443",
                section="kis",
                env_fallbacks=["BASE_URL"],
            )
        ).strip(),
        "hts_id": str(
            get_secret("KIS_HTS_ID", default="", section="kis", env_fallbacks=["HTS_ID"])
        ).strip(),
        "cano_brokerage": cano_brok,
        "acnt_prdt_cd_brokerage": prdt_brok,
        "cano_isa": cano_isa,
        "acnt_prdt_cd_isa": prdt_isa,
        "cano_pension": cano_pen,
        "acnt_prdt_cd_pension": prdt_pen,
        "cano_irp": cano_irp,
        "acnt_prdt_cd_irp": prdt_irp,
    }


def get_gemini_api_key() -> str:
    """Gemini API 키를 `st.secrets` 우선, `.env` 차순위로 반환합니다."""
    return str(
        get_secret(
            "GEMINI_API_KEY",
            default="",
            section="gemini",
            env_fallbacks=["VITE_GEMINI_API_KEY", "GOOGLE_API_KEY", "api_key"],
        )
    ).strip()


def get_sheets_config() -> Dict[str, str]:
    """Google Sheets 연동 정보(시트 ID, 시트 이름, Apps Script JSON API URL, API_TOKEN, 로컬 서비스계정 경로)를 반환합니다."""
    return {
        "portfolio_api_url": str(
            get_secret(
                "PORTFOLIO_API_URL",
                default="",
                section="sheets",
                env_fallbacks=["VITE_PORTFOLIO_API_URL", "APPS_SCRIPT_URL"],
            )
        ).strip(),
        "api_token": str(
            get_secret(
                "API_TOKEN",
                default="",
                section="sheets",
                env_fallbacks=["SHEETS_API_TOKEN", "PORTFOLIO_API_TOKEN"],
            )
        ).strip(),
        "spreadsheet_id": str(
            get_secret(
                "GOOGLE_SHEET_ID",
                default="",
                section="sheets",
                env_fallbacks=["SPREADSHEET_ID", "SHEET_ID"],
            )
        ).strip(),
        "spreadsheet_name": str(
            get_secret(
                "GOOGLE_SHEET_NAME",
                default="",
                section="sheets",
                env_fallbacks=["SPREADSHEET_NAME"],
            )
        ).strip(),
        "service_account_file": str(
            get_secret(
                "GOOGLE_SERVICE_ACCOUNT_FILE",
                default="",
                section="sheets",
                env_fallbacks=["GOOGLE_APPLICATION_CREDENTIALS", "SERVICE_ACCOUNT_JSON_PATH"],
            )
        ).strip(),
    }
