"""
한국투자증권(KIS) OpenAPI 연동 및 메모리 토큰 캐싱 모듈 (utils/kis_client.py)

핵심 설계:
- Streamlit Community Cloud는 컨테이너 재시작 시 로컬 파일이 초기화되므로,
  KIS OAuth 접근 토큰(`access_token`)을 로컬 파일(`token.json` 등)에 저장하지 않고
  `@st.cache_resource`를 사용해 프로세스 메모리에 안전하게 캐싱합니다.
- 모든 API 키(`KIS_APP_KEY`, `KIS_APP_SECRET`)와 계좌번호(`KIS_CANO_*`)는
  `utils.secrets_helper.get_kis_config()`를 통해 `st.secrets` 우선 -> `.env` 차순위로 로드합니다.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
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


@st.cache_resource(show_spinner=False)
def _get_kis_memory_token_store() -> Dict[str, KisTokenEntry]:
    """
    Streamlit Cloud 컨테이너 생명주기 동안 유지되는 인메모리 KIS 토큰 저장소입니다.
    파일 시스템 쓰기를 일절 수행하지 않아 클라우드 재시작/권한 이슈에 안전하며,
    1분당 1회 토큰 발급 제한(EGW00133)을 방지합니다.
    """
    return {}


def get_kis_access_token(force_refresh: bool = False) -> Tuple[Optional[str], str]:
    """
    메모리 캐시(`@st.cache_resource`)에서 유효한 KIS OAuth 접근 토큰을 조회하거나,
    만료 시 새로 발급받아 메모리에 저장 후 반환합니다.

    반환값: (access_token, status_message)
    """
    cfg = get_kis_config()
    app_key = cfg.get("app_key", "")
    app_secret = cfg.get("app_secret", "")
    base_url = cfg.get("base_url", "https://openapi.koreainvestment.com:9443").rstrip("/")

    if not app_key or not app_secret:
        return None, "KIS API 키 미설정 (Apps Script / Google Sheets 연동 모드로 동작 중)"

    cache_key = f"{base_url}:{app_key[:8]}"
    token_store = _get_kis_memory_token_store()
    now = time.time()

    # 만료 10분 전까지 메모리 캐시 토큰 재사용
    if not force_refresh and cache_key in token_store:
        entry = token_store[cache_key]
        if entry.expires_at_epoch - 600 > now:
            remaining_min = int((entry.expires_at_epoch - now) // 60)
            return entry.access_token, f"KIS 메모리 캐시 토큰 활성 (잔여 {remaining_min}분)"

    # 토큰 신규 발급 요청
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
            return None, f"KIS 토큰 응답 오류: {data.get('msg1', '알 수 없는 오류')}"

        token_store[cache_key] = KisTokenEntry(
            access_token=access_token,
            token_type=data.get("token_type", "Bearer"),
            expires_at_epoch=now + expires_in,
            issued_at_str=str(data.get("access_token_token_expired", "")),
        )
        return access_token, "KIS 토큰 신규 발급 및 메모리 캐싱 완료"
    except Exception as exc:
        return None, f"KIS 토큰 발급 예외: {exc}"


@st.cache_data(ttl=300, show_spinner=False)
def fetch_kis_direct_domestic_balance(
    cano: str, acnt_prdt_cd: str, account_label: str
) -> List[Dict[str, Any]]:
    """
    KIS 국내주식/ETF 잔고조회 API (`TTTC8434R`)를 직접 호출하여 보유종목 리스트를 반환합니다.
    5분(300초) TTL로 캐싱됩니다.
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

    url = f"{base_url}/uapi/domestic-stock/v1/trading/inquire-balance"
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "authorization": f"Bearer {token}",
        "appkey": app_key,
        "appsecret": app_secret,
        "tr_id": "TTTC8434R",
    }
    params = {
        "CANO": cano,
        "ACNT_PRDT_CD": acnt_prdt_cd or "01",
        "AFHR_FLPR_YN": "N",
        "OFL_YN": "",
        "INQR_DVSN": "02",
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
            qty = float(item.get("hldg_qty", 0) or 0)
            if qty <= 0:
                continue
            rows.append(
                {
                    "기준시각": "KIS Direct Live",
                    "시장구분": "KRX",
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
