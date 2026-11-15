# 📈 AssetVision PRO — 개인 자산관리 통합 포트폴리오 터미널

> **GitHub Repository**: [`minseok616/personal_asset`](https://github.com/minseok616/personal_asset)  
> **한국투자증권(KIS) OpenAPI 다중 계좌 실시간 연동 · 비-KIS 수동 관리 자산 Google Sheets 양방향 동기화(`doGet`/`doPost`) · Gemini 2.5 Flash 기반 AI 포트폴리오 비서(`AssetCopilot`)**를 하나로 결합한 다크 모드 핀테크 자산관리 대시보드입니다.  
> PC 웹 브라우저뿐만 아니라 **Streamlit Community Cloud 비공개(Private) 배포**를 통해 **아이폰(iPhone) Safari**에서도 언제 어디서나 안전하게 내 자산을 조회·관리할 수 있습니다.

---

## ✨ 1. 프로젝트 소개 및 주요 기능

### ① KIS OpenAPI 다중 계좌 실시간 조회 (Read-Only 보호)
- **다중 계좌 통합 모니터링**: 한국투자증권 **위탁계좌(외화 달러예수금 포함)**, **ISA 중개형**, **연금저축**, **퇴직연금(IRP)** 및 **해외직투(토스증권)** 계좌의 보유 종목, 매수평단가, 현재가, 평가손익, 수익률(%)을 실시간으로 통합 집계합니다.
- **인메모리 토큰 캐싱 (`@st.cache_resource`)**: Streamlit Community Cloud 컨테이너 재시작 시 로컬 파일이 초기화되는 환경 특성과 KIS OAuth 토큰의 1분당 1회 발급 제한(`EGW00133`)을 모두 해결하기 위해, 접근 토큰을 로컬 파일(`token.json`)이 아닌 프로세스 메모리에 만료 시각과 함께 안전하게 캐싱합니다.
- **읽기 전용(Read-Only) 무결성 보장**: 증권사 API로 자동 적재되는 실시간 잔고(`💾KIS_실시간잔고`), 매매체결 내역(`📜KIS_매매체결DB`), 배당 내역(`💸KIS_배당내역DB`)은 대시보드에서 읽기 전용으로 보호됩니다.

### ② 비-KIS 수동 관리 자산 Google Sheets 양방향 동기화 (`doGet` & `doPost`)
앱 내 **`[✏️ 비-KIS 자산 관리 / 시트 수정]`** 탭에서 `st.data_editor` 및 빠른 입력 폼을 통해 아래 4개 시트의 데이터를 직접 수정·추가하고 **[💾 구글 시트에 저장]** 버튼을 누르면 Google Apps Script 웹앱(`PORTFOLIO_API_URL`)의 `doPost`를 통해 구글 시트에 즉시 반영됩니다.
1. **`💰입출금통장`**: 날짜별 `주거래 하나 통장`, `토스뱅크 통장`, `미래에셋 종합_CMA`, `보유 현금`, `증여금`, `청년도약계좌 정부기여금` 잔액 수정 및 오늘 날짜 기준 신규 행 추가 (**🔒 B열 `총합계` 수식 덮어쓰기 방지 및 이전 행 수식 자동 복사**)
2. **`🌱예적금내역`**: `구분`, `은행`, `가입일`, `이율`, `기간`, `금액`, `비과세`, `통화` 입력 항목 수정·추가 (**🔒 `만기일`, `만기수령액(세전/세후)` 수식 열 보존**)
3. **`🏠채권내역`**: `채권명`, `설명`, `가입일`, `종료일`, `월 납입금액` 수정·추가 (**🔒 `총 납입액` 수식 열 보존**)
4. **`🚗실물_기타자산`**: 차량(`현대 디 올뉴코나`, 연 15% 감가), IT기기(`아이폰 17 Pro`, 연 30% 감가), 귀금속(`순금 반지`, 시세 연동) 등의 취득원가·감가상각누계액·현재가치(잔존가치) 수정·추가
- 저장 완료 즉시 `st.cache_data.clear()`가 호출되어 상단 총 순자산 KPI와 모든 차트가 최신 시트 데이터로 즉시 재계산됩니다.

### ③ 실질 기초자산(Underlying Exposure) 분류 및 인터랙티브 리밸런싱
- **실질 기초자산 자동 분류 알고리즘**: 연금저축·IRP·ISA 계좌에서 매수한 국내상장 해외 ETF(`KODEX 미국S&P500`, `TIGER 미국나스닥100`, `ACE 미국30년국채액티브(H)` 등)를 단순 상장시장(KRX)이 아닌 **실제 추종 기초자산(`해외주식`, `해외채권`, `국내채권`)** 기준으로 재분류합니다.
- **`[기초자산 실질 기준 (권장) | 상장시장 기준]` 토글**: 자산배분 도넛 차트와 리밸런싱 시뮬레이터에서 두 기준을 즉시 전환하며 목표 비중(%) 슬라이더로 자산군별 추가 매수(+) / 비중 축소(-) 필요 금액을 실시간 시뮬레이션할 수 있습니다.

### ④ Gemini AI 포트폴리오 비서 (`AssetCopilot`) & SaveTicker 리서치
- **`AssetCopilot` 실시간 AI 브리핑**: 현재 화면 컨텍스트와 Google Sheets 전체 데이터를 실시간으로 주입받아 `gemini-2.5-flash` 모델과 대화하며 포트폴리오 요약, 실질 해외주식 비중 진단, 달러예수금 분할매수 리밸런싱 전략을 제안받습니다.
- **SaveTicker 긍정/부정 TOP 5 & Deep Research 원클릭 실행**: 주간 뉴스 감성 스코어 기반 **🚀 긍정 전망 TOP 5 (Bullish 5)** 및 **⚠️ 부정·주의 TOP 5 (Bearish 5)** 비교 카드와 함께, 심층 분석 프롬프트를 복사하여 Gemini Deep Research로 바로 연결하는 기능을 제공합니다.

---

## 🏗️ 2. 시스템 아키텍처 및 기술 스택

### 시스템 아키텍처

```mermaid
flowchart LR
    subgraph Client["📱 사용자 단말 (iPhone Safari / Desktop Web)"]
        UI["Streamlit Cloud App (app.py)\n& React Dashboard View (dist/)"]
    end

    subgraph Backend["☁️ Streamlit Community Cloud (Python Runtime)"]
        Secrets["utils/secrets_helper.py\n(st.secrets 우선 · .env Fallback)"]
        GSheets["utils/gsheets_client.py\n(doGet / doPost & gspread)"]
        KIS["utils/kis_client.py\n(@st.cache_resource 토큰 캐싱)"]
        Copilot["AssetCopilot Engine\n(Context Synthesis)"]
    end

    subgraph External["🌐 외부 연동 서비스"]
        GAS["Google Apps Script Web App\n(doGet 조회 / doPost 수식보존 저장)"]
        Sheet[("Google Sheets 마스터 DB\n(입출금·예적금·채권·실물·KIS잔고)")]
        KISAPI["한국투자증권 KIS OpenAPI\n(실시간 잔고 · 예수금)"]
        Gemini["Google Gemini 2.5 Flash API\n(포트폴리오 분석 · 리서치)"]
    end

    UI <--> Secrets
    UI <--> GSheets
    UI <--> KIS
    UI <--> Copilot
    GSheets <-->|"JSON GET / POST (API_TOKEN)"| GAS
    GAS <--> Sheet
    GSheets -.->|"Service Account (Optional)"| Sheet
    KIS <-->|"OAuth Bearer Token"| KISAPI
    Copilot <-->|"REST API"| Gemini
```

### 기술 스택 (Tech Stack)

| 구분 | 사용 기술 | 주요 역할 |
| :--- | :--- | :--- |
| **Cloud & Mobile UI** | **Python 3.12, Streamlit, Plotly, Pandas** | Streamlit Community Cloud 배포, 아이폰 Safari 반응형 차트(`use_container_width=True`) 및 시트 에디터(`st.data_editor`) |
| **Web SPA View** | **Vite, React 18, TypeScript, Tailwind CSS, Recharts, Framer Motion** | 데스크톱/웹앱 풀 대시보드 UI 및 Streamlit 내부 하이브리드 임베드 뷰 |
| **Database & Sync** | **Google Sheets, Google Apps Script (`doGet`/`doPost`), `gspread`** | 클라우드 스프레드시트 원장 관리 및 비-KIS 수동 자산 양방향 실시간 저장 |
| **Brokerage API** | **한국투자증권(KIS) OpenAPI** | 위탁·ISA·연금저축·IRP 실시간 잔고 및 외화예수금 조회 (`@st.cache_resource` 토큰 관리) |
| **AI & LLM** | **Google Gemini API (`gemini-2.5-flash`)** | 실시간 포트폴리오 컨텍스트 기반 대화형 AI 비서(`AssetCopilot`) 및 주간 리포트 브리핑 |

---

## 📂 3. 프로젝트 디렉토리 구조

```text
personal_asset/
├── app.py                          # Streamlit 메인 애플리케이션 엔트리포인트 (모바일 최적화 & 시트 양방향 편집)
├── requirements.txt                # Streamlit Cloud 배포용 Python 패키지 의존성 목록
├── .gitignore                      # 민감 정보(.env, secrets.toml, 서비스계정 JSON 등) Git 업로드 차단 설정
├── README.md                       # 프로젝트 문서
├── .streamlit/
│   ├── config.toml                 # TradeVision 다크 모드 테마(#0B1116 / #00E676) 및 서버 설정
│   └── secrets.toml.example        # Streamlit Cloud Secrets 설정용 TOML 템플릿 (예시 파일)
├── utils/
│   ├── __init__.py
│   ├── secrets_helper.py           # st.secrets 최우선 조회 및 로컬 .env Fallback 통합 헬퍼
│   ├── gsheets_client.py           # Apps Script (doGet/doPost) 양방향 통신, 수식 열 보호 및 gspread 인증
│   └── kis_client.py               # KIS OpenAPI 인메모리 토큰 캐싱(@st.cache_resource) 및 잔고 조회
├── src/                            # React + TypeScript + Tailwind CSS 프론트엔드 소스코드
│   ├── App.tsx                     # React 대시보드 메인 컨테이너
│   ├── components/                 # KPI 카드, 차트, 보유종목 테이블, 리밸런싱 시뮬레이터, AssetCopilot 드로어
│   ├── types/portfolio.ts          # 포트폴리오 데이터 타입 정의
│   └── utils/                      # 데이터 파서(dataParser.ts) 및 통화 포매터(formatters.ts)
└── dist/                           # Vite 프로덕션 빌드 번들 (민감 정보 미포함)
```

---

## 🚀 4. 로컬 실행 방법 및 Streamlit Community Cloud 비공개 배포 가이드

### 4-1. 로컬 실행 방법

#### 1) 저장소 클론 및 Python 가상환경 구성
```bash
git clone https://github.com/minseok616/personal_asset.git
cd personal_asset

# 가상환경 생성 및 패키지 설치
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate

pip install -r requirements.txt
```

#### 2) 로컬 환경변수(`.env` 또는 `.streamlit/secrets.toml`) 설정
로컬 실행 시 프로젝트 루트에 `.env` 파일을 생성하거나 `.streamlit/secrets.toml.example`을 `.streamlit/secrets.toml`로 복사하여 본인의 API 정보를 입력합니다.

```ini
# .env 예시 (로컬 전용 — .gitignore에 의해 Git에 업로드되지 않음)
PORTFOLIO_API_URL=https://script.google.com/macros/s/YOUR_APPS_SCRIPT_DEPLOYMENT_ID/exec
API_TOKEN=YOUR_CUSTOM_SECRET_WRITE_TOKEN
GOOGLE_SHEET_ID=YOUR_GOOGLE_SPREADSHEET_ID
GOOGLE_SERVICE_ACCOUNT_FILE=service_account.json

GEMINI_API_KEY=YOUR_GEMINI_API_KEY

KIS_APP_KEY=YOUR_KIS_APP_KEY
KIS_APP_SECRET=YOUR_KIS_APP_SECRET
KIS_BASE_URL=https://openapi.koreainvestment.com:9443
KIS_CANO_BROKERAGE=00000000
KIS_ACNT_PRDT_CD_BROKERAGE=01
KIS_CANO_ISA=00000000
KIS_ACNT_PRDT_CD_ISA=01
KIS_CANO_PENSION=00000000
KIS_ACNT_PRDT_CD_PENSION=22
KIS_CANO_IRP=00000000
KIS_ACNT_PRDT_CD_IRP=29
```

#### 3) Streamlit 앱 실행
```bash
streamlit run app.py
```

---

### 4-2. Streamlit Community Cloud 비공개(Private) 배포 가이드

1. **GitHub Private 저장소에 Push**
   - `.gitignore`에 의해 `.env`, `.streamlit/secrets.toml`, `*service_account*.json` 등 민감 파일이 제외되었는지 `git status`로 확인한 후 `minseok616/personal_asset` 저장소에 Push합니다.
2. **Streamlit Community Cloud 앱 생성**
   - [share.streamlit.io](https://share.streamlit.io/)에 접속하여 **Create app**을 클릭합니다.
   - **Repository**: `minseok616/personal_asset` / **Branch**: `main` / **Main file path**: `app.py`를 선택합니다.
3. **Advanced settings → Secrets 설정 (TOML 형식)**
   - **Advanced settings...**를 열고 **Secrets** 입력란에 아래 TOML 템플릿을 붙여넣은 뒤 실제 값을 입력합니다.

```toml
# ==============================================================================
# Streamlit Community Cloud — Advanced settings -> Secrets (TOML)
# ==============================================================================

# 1. Google Sheets & Apps Script 웹앱 연동 (doGet 조회 & doPost 양방향 저장)
[sheets]
PORTFOLIO_API_URL = "https://script.google.com/macros/s/YOUR_APPS_SCRIPT_DEPLOYMENT_ID/exec"
API_TOKEN = "YOUR_CUSTOM_SECRET_WRITE_TOKEN"
GOOGLE_SHEET_ID = "YOUR_GOOGLE_SPREADSHEET_ID"
GOOGLE_SHEET_NAME = "개인자산관리_마스터시트"

# 2. Gemini API 설정 (AssetCopilot AI 비서 연동)
[gemini]
GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"

# 3. 한국투자증권(KIS) OpenAPI 및 계좌 설정
[kis]
KIS_APP_KEY = "YOUR_KIS_APP_KEY"
KIS_APP_SECRET = "YOUR_KIS_APP_SECRET"
KIS_BASE_URL = "https://openapi.koreainvestment.com:9443"
KIS_HTS_ID = "YOUR_KIS_HTS_ID"

KIS_CANO_BROKERAGE = "YOUR_8_DIGIT_BROKERAGE_CANO"
KIS_ACNT_PRDT_CD_BROKERAGE = "01"
KIS_CANO_ISA = "YOUR_8_DIGIT_ISA_CANO"
KIS_ACNT_PRDT_CD_ISA = "01"
KIS_CANO_PENSION = "YOUR_8_DIGIT_PENSION_CANO"
KIS_ACNT_PRDT_CD_PENSION = "22"
KIS_CANO_IRP = "YOUR_8_DIGIT_IRP_CANO"
KIS_ACNT_PRDT_CD_IRP = "29"

# 4. Google Cloud Service Account (gspread 직접 시트 연동 시 선택 사용)
[gcp_service_account]
type = "service_account"
project_id = "your-gcp-project-id"
private_key_id = "your-private-key-id"
private_key = "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
client_email = "your-service-account@your-gcp-project-id.iam.gserviceaccount.com"
client_id = "YOUR_CLIENT_ID"
auth_uri = "https://accounts.google.com/o/oauth2/auth"
token_uri = "https://oauth2.googleapis.com/token"
auth_provider_x509_cert_url = "https://www.googleapis.com/oauth2/v1/certs"
client_x509_cert_url = "https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-gcp-project-id.iam.gserviceaccount.com"
universe_domain = "googleapis.com"
```

4. **아이폰(iPhone) Safari 접속 및 홈 화면 추가**
   - 앱 배포 후 **Settings → Sharing**에서 **This app is private**으로 설정하고 본인의 Google 계정 이메일만 허용합니다.
   - 아이폰 Safari에서 배포된 URL에 접속해 로그인한 뒤, 하단 **공유 버튼(⬆️) → '홈 화면에 추가'**를 누르면 네이티브 핀테크 앱처럼 전체 화면으로 이용할 수 있습니다.
