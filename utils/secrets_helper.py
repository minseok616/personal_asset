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
from collections.abc import Mapping
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import streamlit as st
from dotenv import load_dotenv

# 로컬 실행 시 프로젝트 루트의 .env 파일을 로드 (클라우드에서 파일이 없어도 무방)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_ENV_PATH = _PROJECT_ROOT / ".env"
if _ENV_PATH.exists():
    load_dotenv(dotenv_path=_ENV_PATH, override=False)
else:
    load_dotenv(override=False)


def _clean_secret_value(val: Any) -> Any:
    """문자열 시크릿 값 앞뒤의 공백 및 불필요한 따옴표를 안전하게 정리합니다."""
    if isinstance(val, str):
        cleaned = val.strip()
        if len(cleaned) >= 2 and (
            (cleaned[0] == '"' and cleaned[-1] == '"')
            or (cleaned[0] == "'" and cleaned[-1] == "'")
        ):
            cleaned = cleaned[1:-1].strip()
        return cleaned
    return val


def _has_streamlit_secrets() -> bool:
    """st.secrets가 정상적으로 초기화되어 접근 가능한지 안전하게 확인합니다."""
    try:
        return len(st.secrets) > 0
    except Exception:
        return False


def _read_from_mapping(mapping_obj: Any, candidate_keys: List[str]) -> Tuple[Any, Optional[str]]:
    """st.secrets 또는 섹션(AttrDict/dict)에서 대소문자 변형 포함 키를 안전하게 조회합니다."""
    if mapping_obj is None:
        return None, None
    try:
        keys_available = list(mapping_obj.keys()) if hasattr(mapping_obj, "keys") else []
    except Exception:
        keys_available = []

    lower_map = {str(k).lower(): k for k in keys_available}

    for cand in candidate_keys:
        try:
            if isinstance(mapping_obj, Mapping) or hasattr(mapping_obj, "__contains__"):
                if cand in mapping_obj:
                    val = _clean_secret_value(mapping_obj[cand])
                    if val not in (None, ""):
                        return val, cand
        except Exception:
            pass

        matched_key = lower_map.get(cand.lower())
        if matched_key is not None:
            try:
                val = _clean_secret_value(mapping_obj[matched_key])
                if val not in (None, ""):
                    return val, str(matched_key)
            except Exception:
                pass
    return None, None


def get_secret_with_source(
    key: str,
    default: Any = None,
    section: Optional[str] = None,
    env_fallbacks: Optional[list[str]] = None,
) -> Tuple[Any, str]:
    """
    1순위: Streamlit Cloud `st.secrets[section][key]` (중첩 섹션)
    2순위: Streamlit Cloud `st.secrets[key]` (최상위 키)
    3순위: 로컬 `.env` 및 OS 환경변수(`os.getenv`)
    값과 함께 출처 라벨을 반환합니다.
    """
    candidates = [key] + (env_fallbacks or [])

    if _has_streamlit_secrets():
        try:
            if section:
                sec_obj = None
                try:
                    if section in st.secrets:
                        sec_obj = st.secrets[section]
                except Exception:
                    sec_obj = None

                if sec_obj is None:
                    sec_val, sec_name = _read_from_mapping(st.secrets, [section])
                    if isinstance(sec_val, Mapping) or hasattr(sec_val, "keys"):
                        sec_obj = sec_val
                        section_used = sec_name or section
                    else:
                        section_used = section
                else:
                    section_used = section

                if sec_obj is not None:
                    val, matched = _read_from_mapping(sec_obj, candidates)
                    if val not in (None, ""):
                        return val, f'st.secrets["{section_used}"]["{matched}"]'

            val, matched = _read_from_mapping(st.secrets, candidates)
            if val not in (None, "") and not isinstance(val, Mapping):
                return val, f'st.secrets["{matched}"]'
        except Exception:
            pass

    for cand in candidates:
        env_val = _clean_secret_value(os.getenv(cand))
        if env_val not in (None, ""):
            return env_val, f'env:{cand}'

    return default, "미설정"


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
    val, _ = get_secret_with_source(
        key=key,
        default=default,
        section=section,
        env_fallbacks=env_fallbacks,
    )
    return val


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


def get_sheets_secrets_diagnostics() -> Dict[str, str]:
    """
    `PORTFOLIO_API_URL`과 `API_TOKEN`이 `st.secrets["sheets"]`, 최상위 `st.secrets`, `.env` 중
    어디서 읽혔는지 마스킹된 요약 정보와 함께 반환합니다 (비밀 값 자체는 노출하지 않음).
    """
    url_val, url_src = get_secret_with_source(
        "PORTFOLIO_API_URL",
        default="",
        section="sheets",
        env_fallbacks=["VITE_PORTFOLIO_API_URL", "APPS_SCRIPT_URL"],
    )
    token_val, token_src = get_secret_with_source(
        "API_TOKEN",
        default="",
        section="sheets",
        env_fallbacks=["SHEETS_API_TOKEN", "PORTFOLIO_API_TOKEN"],
    )
    url_str = str(url_val or "").strip()
    if url_str.startswith("http"):
        parts = url_str.split("/")
        masked_url = "/".join(parts[:4]) + "/.../" + (parts[-1] if len(parts) > 4 else "")
    else:
        masked_url = "미설정" if not url_str else "(잘못된 URL 형식)"

    return {
        "url_source": url_src,
        "url_masked": masked_url,
        "url_configured": "OK" if url_str.startswith("http") else "MISSING",
        "token_source": token_src,
        "token_configured": "OK" if str(token_val or "").strip() else "MISSING",
    }


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
