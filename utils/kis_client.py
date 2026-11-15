"""
한국투자증권(KIS) OpenAPI 4대 계좌(위탁·ISA·연금저축·IRP) 연동 및 인메모리 토큰 캐싱 모듈 (utils/kis_client.py)

핵심 설계:
1. Streamlit Community Cloud는 컨테이너 재시작 시 로컬 파일이 초기화되므로,
   KIS OAuth 접근 토큰(`access_token`)을 로컬 파일(`token.json` 등)에 저장하지 않고
   `@st.cache_resource` 싱글톤 저장소(`KisMemoryTokenVault`)에 스레드 락(`threading.Lock`)과 함께 캐싱합니다.
2. KIS 토큰 발급 API의 1분당 1회 제한(`EGW00133`)을 방지하기 위해 최소 65초 쿨다운 가드를 적용합니다.
3. 4대 계좌(위탁 `-01`, ISA `-01`, 연금저축 `-22`, 퇴직연금 IRP `-29`)를 `utils.secrets_helper.get_kis_config()`에서
   일관된 키 구조로 읽어와 조회합니다.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import requests
import streamlit as st

from utils.secrets_helper import get_kis_config


@dataclass
class KisTokenEntry:
    access_token: str
    token_type: str
    expires_at_epoch: float
    issued_at_str: str


@dataclass
class KisMemoryTokenVault:
    tokens: Dict[str, KisTokenEntry] = field(default_factory=dict)
    last_attempt_epoch: Dict[str, float] = field(default_factory=dict)
    last_error_msg: Dict[str, str] = field(default_factory=dict)
    lock: threading.Lock = field(default_factory=threading.Lock)


@st.cache_resource(show_spinner=False)
def _get_kis_memory_token_store() -> KisMemoryTokenVault:
    """
    Streamlit Cloud 컨테이너 생명주기 동안 유지되는 인메모리 KIS 토큰 저장소입니다.
    파일 시스템 쓰기를 일절 수행하지 않으며, 멀티스레드/리런 시에도 단일 토큰을 공유합니다.
    """
    return KisMemoryTokenVault()


def get_kis_access_token(force_refresh: bool = False) -> Tuple[Optional[str], str]:
    """
    메모리 캐시(`@st.cache_resource`)에서 유효한 KIS OAuth 접근 토큰을 조회하거나,
    만료 시 새로 발급받아 메모리에 저장 후 반환합니다.
    1분당 1회 발급 제한(EGW00133) 보호를 위해 65초 이내 중복 발급 요청을 차단합니다.
    """
    cfg = get_kis_config()
    app_key = cfg.get("app_key", "")
    app_secret = cfg.get("app_secret", "")
    base_url = cfg.get("base_url", "https://openapi.koreainvestment.com:9443").rstrip("/")

    if not app_key or not app_secret:
        return None, "KIS API 키 미설정 (Google Sheets 연동 모드로 동작 중)"

    cache_key = f"{base_url}:{app_key[:8]}"
    vault = _get_kis_memory_token_store()

    with vault.lock:
        now = time.time()

        # 1) 만료 10분 전까지 메모리 캐시 토큰 즉시 재사용
        if not force_refresh and cache_key in vault.tokens:
            entry = vault.tokens[cache_key]
            if entry.expires_at_epoch - 600 > now:
                remaining_min = int((entry.expires_at_epoch - now) // 60)
                return entry.access_token, f"KIS 메모리 캐시 토큰 활성 (잔여 {remaining_min}분)"

        # 2) 1분당 1회 토큰 발급 제한(EGW00133) 방어용 65초 쿨다운 가드
        last_try = vault.last_attempt_epoch.get(cache_key, 0.0)
        if not force_refresh and (now - last_try) < 65.0:
            if cache_key in vault.tokens:
                return vault.tokens[cache_key].access_token, "KIS 기존 메모리 토큰 유지 (1분 쿨다운 보호)"
            wait_sec = int(65 - (now - last_try))
            prev_err = vault.last_error_msg.get(cache_key, "토큰 발급 대기")
            return None, f"KIS 토큰 1분당 1회 제한 보호 중 ({wait_sec}초 후 재시도 · {prev_err})"

        vault.last_attempt_epoch[cache_key] = now

        # 3) 토큰 신규 발급 요청
        token_url = f"{base_url}/oauth2/tokenP"
        payload = {
            "grant_type": "client_credentials",
            "appkey": app_key,
            "appsecret": app_secret,
        }
        try:
            resp = requests.post(
                token_url,
                json=payload,
                headers={"Content-Type": "application/json; charset=UTF-8"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            access_token = data.get("access_token")
            expires_in = float(data.get("expires_in", 86400))
            if not access_token:
                err_msg = f"KIS 토큰 응답 오류: {data.get('msg1', '알 수 없는 오류')}"
                vault.last_error_msg[cache_key] = err_msg
                return None, err_msg

            vault.tokens[cache_key] = KisTokenEntry(
                access_token=access_token,
                token_type=data.get("token_type", "Bearer"),
                expires_at_epoch=now + expires_in,
                issued_at_str=str(data.get("access_token_token_expired", "")),
            )
            vault.last_error_msg.pop(cache_key, None)
            return access_token, "KIS 토큰 신규 발급 및 메모리 캐싱 완료"
        except Exception as exc:
            err_msg = f"KIS 토큰 발급 예외: {exc}"
            vault.last_error_msg[cache_key] = err_msg
            return None, err_msg


def get_configured_kis_accounts() -> List[Dict[str, str]]:
    """
    `st.secrets["kis"]` 또는 `.env`에 설정된 4대 계좌(위탁, ISA, 연금저축, 퇴직연금 IRP) 목록을 반환합니다.
    """
    cfg = get_kis_config()
    accounts = [
        {
            "key": "brokerage",
            "label": "위탁계좌",
            "cano": cfg.get("cano_brokerage", ""),
            "acnt_prdt_cd": cfg.get("acnt_prdt_cd_brokerage", "01"),
        },
        {
            "key": "isa",
            "label": "ISA중개형",
            "cano": cfg.get("cano_isa", ""),
            "acnt_prdt_cd": cfg.get("acnt_prdt_cd_isa", "01"),
        },
        {
            "key": "pension",
            "label": "연금저축",
            "cano": cfg.get("cano_pension", ""),
            "acnt_prdt_cd": cfg.get("acnt_prdt_cd_pension", "22"),
        },
        {
            "key": "irp",
            "label": "퇴직연금(IRP)",
            "cano": cfg.get("cano_irp", ""),
            "acnt_prdt_cd": cfg.get("acnt_prdt_cd_irp", "29"),
        },
    ]
    return [acc for acc in accounts if acc["cano"]]


@st.cache_data(ttl=300, show_spinner=False)
def fetch_kis_direct_domestic_balance(
    cano: str, acnt_prdt_cd: str, account_label: str
) -> List[Dict[str, Any]]:
    """
    KIS 국내주식/ETF/연금 잔고조회 API를 호출하여 보유종목 리스트를 반환합니다.
    - 일반 위탁(`01`), ISA(`01`), 연금저축(`22`): `TTTC8434R` (`/uapi/domestic-stock/v1/trading/inquire-balance`)
    - 퇴직연금 IRP(`29`): `TTTC2208R` (`/uapi/domestic-stock/v1/trading/pension/inquire-balance`) 우선 호출 후 `TTTC8434R` 폴백
    """
    cfg = get_kis_config()
    app_key = cfg.get("app_key", "")
    app_secret = cfg.get("app_secret", "")
    base_url = cfg.get("base_url", "https://openapi.koreainvestment.com:9443").rstrip("/")

    if not app_key or not app_secret or not cano:
        return []

    token, _ = get_kis_access_token()
    if not token:
        return []

    is_irp = str(acnt_prdt_cd).strip() == "29" or "IRP" in account_label.upper()
    url = (
        f"{base_url}/uapi/domestic-stock/v1/trading/pension/inquire-balance"
        if is_irp
        else f"{base_url}/uapi/domestic-stock/v1/trading/inquire-balance"
    )
    tr_id = "TTTC2208R" if is_irp else "TTTC8434R"

    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "authorization": f"Bearer {token}",
        "appkey": app_key,
        "appsecret": app_secret,
        "tr_id": tr_id,
    }
    params = {
        "CANO": cano,
        "ACNT_PRDT_CD": acnt_prdt_cd or ("29" if is_irp else "01"),
        "AFHR_FLPR_YN": "N",
        "OFL_YN": "",
        "INQR_DVSN": "00" if is_irp else "02",
        "UNPR_DVSN": "01",
        "FUND_STTL_ICLD_YN": "N",
        "FNCG_AMT_AUTO_RDPT_YN": "N",
        "PRCS_DVSN": "00",
        "CTX_AREA_FK100": "",
        "CTX_AREA_NK100": "",
    }

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=10)
        resp.raise_for_status()
        body = resp.json()
        rows: List[Dict[str, Any]] = []
        for item in body.get("output1", []):
            qty = float(item.get("hldg_qty", item.get("cblc_qty", 0)) or 0)
            if qty <= 0:
                continue
            rows.append(
                {
                    "기준시각": "KIS Direct Live",
                    "시장구분": account_label,
                    "계좌구분": account_label,
                    "종목코드": item.get("pdno", ""),
                    "종목명": item.get("prdt_name", ""),
                    "보유수량": qty,
                    "매수평단가": float(item.get("pchs_avg_pric", 0) or 0),
                    "현재가": float(item.get("prpr", 0) or 0),
                    "평가금액": float(item.get("evlu_amt", 0) or 0),
                    "평가손익": float(item.get("evlu_pfls_amt", 0) or 0),
                    "수익률(%)": float(item.get("evlu_pfls_rt", 0) or 0),
                }
            )
        return rows
    except Exception:
        return []


@st.cache_data(ttl=300, show_spinner=False)
def fetch_all_kis_accounts_balance() -> List[Dict[str, Any]]:
    """
    설정된 4개 계좌(위탁 `01`, ISA `01`, 연금저축 `22`, IRP `29`) 전체의 실시간 잔고를 순회 조회하여 병합 반환합니다.
    """
    accounts = get_configured_kis_accounts()
    if not accounts:
        return []

    combined: List[Dict[str, Any]] = []
    for acc in accounts:
        rows = fetch_kis_direct_domestic_balance(
            cano=acc["cano"],
            acnt_prdt_cd=acc["acnt_prdt_cd"],
            account_label=acc["label"],
        )
        combined.extend(rows)
    return combined
