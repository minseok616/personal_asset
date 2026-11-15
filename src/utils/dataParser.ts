import {
  AccountBreakdownItem,
  AccountFilterType,
  CashDepositItem,
  DiagnosticModuleStatus,
  GeminiWeeklyReportItem,
  IntegratedSummary,
  KisActivityItem,
  KisDividendItem,
  KisTradeItem,
  ManualCashAccountItem,
  NormalizedBondItem,
  NormalizedCashflow,
  NormalizedCheckingAccount,
  NormalizedHistoryItem,
  NormalizedHoldingItem,
  NormalizedSavingsItem,
  NormalizedSummary,
  PhysicalAssetItem,
  PortfolioData,
  RebalancingItem,
  SaveTickerNewsItem,
  SavingsDistItem,
  SentimentPickItem,
  SystemDiagnostics,
  UnderlyingAssetClass,
  WatchlistResearchItem,
} from '../types/portfolio';
import { formatDateKST, formatShortDateKST, formatTimeKST } from './formatters';

export const DEFAULT_API_URL: string =
  (typeof window !== 'undefined' && (window as any).__STREAMLIT_CONFIG__?.PORTFOLIO_API_URL) ||
  (import.meta.env.VITE_PORTFOLIO_API_URL as string | undefined) ||
  '';

export const CACHE_STORAGE_KEY = 'assetvision_portfolio_cache_v3';
export const CACHE_TIMESTAMP_KEY = 'assetvision_portfolio_cache_ts_v3';

export const DEFAULT_PHYSICAL_ASSETS: PhysicalAssetItem[] = [
  {
    id: 'phys-kona',
    name: '현대 디 올뉴코나',
    category: '차량/모빌리티',
    purchasePriceKrw: 28500000,
    currentValueKrw: 23500000,
    accumulatedDepreciationKrw: 5000000,
    annualDepreciationRatePercent: 15,
    residualValueRatioPercent: 82.46,
    depreciationRatioPercent: 17.54,
    acquisitionDate: '2025.03',
    note: '실물 차량 자산 (연 15% 정률 감가상각 반영)',
    color: '#00E676',
  },
  {
    id: 'phys-iphone17',
    name: '아이폰 17 Pro',
    category: 'IT/디지털',
    purchasePriceKrw: 2150000,
    currentValueKrw: 1900000,
    accumulatedDepreciationKrw: 250000,
    annualDepreciationRatePercent: 30,
    residualValueRatioPercent: 88.37,
    depreciationRatioPercent: 11.63,
    acquisitionDate: '2025.10',
    note: '플래그십 모바일 디바이스 (연 30% 정률 감가상각 반영)',
    color: '#2979FF',
  },
  {
    id: 'phys-goldring',
    name: '순금 반지 (Gold)',
    category: '귀금속/골드',
    purchasePriceKrw: 750000,
    currentValueKrw: 920000,
    accumulatedDepreciationKrw: -170000,
    annualDepreciationRatePercent: 0,
    residualValueRatioPercent: 100,
    depreciationRatioPercent: 0,
    acquisitionDate: '2024.05',
    note: '실물 금 현물 보유분 (감가 없음 · 금 시세 +22.7% 상승)',
    color: '#FFAB00',
  },
];

export const DEFAULT_KIS_ACTIVITY: KisActivityItem[] = [
  {
    id: 'act-1',
    date: '2026.11.14',
    type: '환전/입금',
    accountName: '위탁계좌',
    ticker: 'USD',
    itemName: '위탁계좌 외화예수금 달러 보유 ($20,312.48)',
    amountKrw: 27148950,
    amountUsd: 20312.48,
    currency: 'USD',
  },
  {
    id: 'act-2',
    date: '2026.11.12',
    type: '배당입금',
    accountName: '퇴직연금(IRP)',
    ticker: '458730',
    itemName: 'TIGER 미국배당다우존스 월분배금 입금',
    quantity: 157,
    amountKrw: 9420,
    currency: 'KRW',
  },
  {
    id: 'act-3',
    date: '2026.11.10',
    type: '매수체결',
    accountName: '연금저축',
    ticker: '379810',
    itemName: 'KODEX 미국나스닥100 정기 적립 매수',
    quantity: 18,
    unitPrice: 24915,
    amountKrw: 448470,
    currency: 'KRW',
  },
  {
    id: 'act-4',
    date: '2026.11.08',
    type: '매수체결',
    accountName: '퇴직연금(IRP)',
    ticker: '360750',
    itemName: 'TIGER 미국S&P500 정기 매수 체결',
    quantity: 12,
    unitPrice: 25120,
    amountKrw: 301440,
    currency: 'KRW',
  },
  {
    id: 'act-5',
    date: '2026.11.04',
    type: '배당입금',
    accountName: 'ISA중개형',
    ticker: '453850',
    itemName: 'ACE 미국30년국채액티브(H) 월배당금 입금',
    quantity: 44,
    amountKrw: 1320,
    currency: 'KRW',
  },
  {
    id: 'act-6',
    date: '2026.10.28',
    type: '배당입금',
    accountName: '토스증권',
    ticker: 'MSFT',
    itemName: '마이크로소프트 (MSFT) 분기 배당금 수령',
    quantity: 5,
    amountKrw: 5547,
    amountUsd: 4.15,
    currency: 'USD',
  },
];

export const DEFAULT_KIS_TRADES: KisTradeItem[] = [
  {
    id: 'trd-1',
    executedAt: '2026.11.12 14:22:10',
    accountCategory: '연금저축',
    tradeType: '매수',
    code: '379810',
    name: 'KODEX 미국나스닥100',
    market: 'KRX',
    currency: 'KRW',
    quantity: 18,
    unitPriceOriginal: 24915,
    unitPriceKrw: 24915,
    amountOriginal: 448470,
    amountKrw: 448470,
    note: '월 적립식 정기 매수',
  },
  {
    id: 'trd-2',
    executedAt: '2026.11.08 10:15:44',
    accountCategory: '퇴직연금(IRP)',
    tradeType: '매수',
    code: '360750',
    name: 'TIGER 미국S&P500',
    market: 'KRX',
    currency: 'KRW',
    quantity: 12,
    unitPriceOriginal: 25120,
    unitPriceKrw: 25120,
    amountOriginal: 301440,
    amountKrw: 301440,
    note: 'IRP 안전·위험자산 리밸런싱 매수',
  },
  {
    id: 'trd-3',
    executedAt: '2026.11.04 13:05:19',
    accountCategory: '퇴직연금(IRP)',
    tradeType: '매수',
    code: '458730',
    name: 'TIGER 미국배당다우존스',
    market: 'KRX',
    currency: 'KRW',
    quantity: 25,
    unitPriceOriginal: 15150,
    unitPriceKrw: 15150,
    amountOriginal: 378750,
    amountKrw: 378750,
    note: '배당 재투자 적립 매수',
  },
  {
    id: 'trd-4',
    executedAt: '2026.10.29 11:40:02',
    accountCategory: '연금저축',
    tradeType: '매수',
    code: '379800',
    name: 'KODEX 미국S&P500',
    market: 'KRX',
    currency: 'KRW',
    quantity: 20,
    unitPriceOriginal: 22780,
    unitPriceKrw: 22780,
    amountOriginal: 455600,
    amountKrw: 455600,
    note: '연금저축 세액공제 한도 적립',
  },
  {
    id: 'trd-5',
    executedAt: '2026.10.21 15:10:33',
    accountCategory: 'ISA중개형',
    tradeType: '매수',
    code: '453850',
    name: 'ACE 미국30년국채액티브(H)',
    market: 'KRX',
    currency: 'KRW',
    quantity: 44,
    unitPriceOriginal: 6960,
    unitPriceKrw: 6960,
    amountOriginal: 306240,
    amountKrw: 306240,
    note: '금리 인하 사이클 대비 듀레이션 확대',
  },
  {
    id: 'trd-6',
    executedAt: '2026.10.14 23:32:18',
    accountCategory: '위탁계좌',
    tradeType: '매도',
    code: 'SOXL',
    name: 'Direxion Daily Semiconductor Bull 3X',
    market: 'NYS',
    currency: 'USD',
    quantity: 15,
    unitPriceOriginal: 38.4,
    unitPriceKrw: 51324,
    amountOriginal: 576.0,
    amountKrw: 769861,
    note: '단기 스윙 차익실현 및 달러예수금 확보',
  },
  {
    id: 'trd-7',
    executedAt: '2026.09.28 22:45:09',
    accountCategory: '토스증권',
    tradeType: '매수',
    code: 'MSFT',
    name: '마이크로소프트 (Microsoft Corp)',
    market: 'NAS',
    currency: 'USD',
    quantity: 2,
    unitPriceOriginal: 428.5,
    unitPriceKrw: 572718,
    amountOriginal: 857.0,
    amountKrw: 1145436,
    note: 'AI 클라우드 코파일럿 성장 모멘텀 추가 매수',
  },
];

export const DEFAULT_KIS_DIVIDENDS: KisDividendItem[] = [
  {
    id: 'div-1',
    recordDate: '2026.11.12',
    accountCategory: '퇴직연금(IRP)',
    code: '458730',
    name: 'TIGER 미국배당다우존스 (월배당)',
    currency: 'KRW',
    holdingQty: 157,
    dividendPerShare: 60,
    preTaxUsd: 7.05,
    postTaxUsd: 7.05,
    preTaxKrw: 9420,
    postTaxKrw: 9420,
    taxRatePercent: 0,
  },
  {
    id: 'div-2',
    recordDate: '2026.11.04',
    accountCategory: 'ISA중개형',
    code: '453850',
    name: 'ACE 미국30년국채액티브(H) (월배당)',
    currency: 'KRW',
    holdingQty: 44,
    dividendPerShare: 30,
    preTaxUsd: 0.99,
    postTaxUsd: 0.99,
    preTaxKrw: 1320,
    postTaxKrw: 1320,
    taxRatePercent: 0,
  },
  {
    id: 'div-3',
    recordDate: '2026.10.28',
    accountCategory: '토스증권',
    code: 'MSFT',
    name: '마이크로소프트 (Microsoft Corp)',
    currency: 'USD',
    holdingQty: 5,
    dividendPerShare: 0.83,
    preTaxUsd: 4.15,
    postTaxUsd: 3.53,
    preTaxKrw: 5547,
    postTaxKrw: 4718,
    taxRatePercent: 15.0,
  },
  {
    id: 'div-4',
    recordDate: '2026.10.15',
    accountCategory: '위탁계좌',
    code: 'CASH_USD',
    name: '위탁계좌 외화 RP / 달러예수금 이자',
    currency: 'USD',
    holdingQty: 1,
    dividendPerShare: 68.4,
    preTaxUsd: 68.4,
    postTaxUsd: 57.87,
    preTaxKrw: 91421,
    postTaxKrw: 77347,
    taxRatePercent: 15.4,
  },
  {
    id: 'div-5',
    recordDate: '2026.10.12',
    accountCategory: '퇴직연금(IRP)',
    code: '458730',
    name: 'TIGER 미국배당다우존스 (월배당)',
    currency: 'KRW',
    holdingQty: 132,
    dividendPerShare: 58,
    preTaxUsd: 5.73,
    postTaxUsd: 5.73,
    preTaxKrw: 7656,
    postTaxKrw: 7656,
    taxRatePercent: 0,
  },
  {
    id: 'div-6',
    recordDate: '2026.10.05',
    accountCategory: '퇴직연금(IRP)',
    code: '237370',
    name: 'KODEX 코리아배당성장채권혼합 분배금',
    currency: 'KRW',
    holdingQty: 121,
    dividendPerShare: 110,
    preTaxUsd: 9.96,
    postTaxUsd: 9.96,
    preTaxKrw: 13310,
    postTaxKrw: 13310,
    taxRatePercent: 0,
  },
];

export const DEFAULT_WATCHLIST_RESEARCH: WatchlistResearchItem[] = [
  {
    id: 'wl-nvda',
    code: 'NVDA',
    name: '엔비디아 (NVIDIA Corp)',
    sector: 'AI / 반도체',
    currency: 'USD',
    currentPrice: 142.8,
    currentPriceKrw: 190861,
    dailyChangePercent: 2.84,
    high52w: 149.76,
    low52w: 75.6,
    position52wPercent: 90.6,
    targetBuyPrice: 132.0,
    targetGapPercent: -7.56,
    aiSummary:
      'Blackwell 아키텍처 공급 본격화 및 하이퍼스케일러 AI CAPEX 상향 지속. 단기 고점 부근이나 $132 지지선 조정 시 위탁계좌 달러예수금($20,312) 분할 투입 1순위.',
    aiSignal: '분할매수',
  },
  {
    id: 'wl-msft',
    code: 'MSFT',
    name: '마이크로소프트 (Microsoft)',
    sector: '빅테크 / 클라우드',
    currency: 'USD',
    currentPrice: 459.86,
    currentPriceKrw: 614633,
    dailyChangePercent: 0.88,
    high52w: 468.35,
    low52w: 385.58,
    position52wPercent: 89.7,
    targetBuyPrice: 435.0,
    targetGapPercent: -5.41,
    aiSummary:
      'Azure AI 매출 기여도 확대 및 엔터프라이즈 Copilot 유료 구독 전환 가속. 현재 토스증권 5주 보유 중(평단 $427.10, +7.67%)으로 조정 시 비중 확대 유효.',
    aiSignal: '추세추종',
  },
  {
    id: 'wl-avgo',
    code: 'AVGO',
    name: '브로드컴 (Broadcom Inc)',
    sector: 'AI / 네트워크 반도체',
    currency: 'USD',
    currentPrice: 173.4,
    currentPriceKrw: 231760,
    dailyChangePercent: 1.65,
    high52w: 185.16,
    low52w: 118.4,
    position52wPercent: 82.4,
    targetBuyPrice: 168.0,
    targetGapPercent: -3.11,
    aiSummary:
      '맞춤형 AI 가속기(ASIC) 수주 확대와 VMware 통합 마진 개선으로 잉여현금흐름(FCF) 및 배당 성장성 동시 확보. 목표매수가($168) 근접 구간.',
    aiSignal: '적극매수권',
  },
  {
    id: 'wl-googl',
    code: 'GOOGL',
    name: '알파벳 A (Alphabet Inc)',
    sector: '빅테크 / AI 플랫폼',
    currency: 'USD',
    currentPrice: 181.2,
    currentPriceKrw: 242186,
    dailyChangePercent: -0.42,
    high52w: 191.75,
    low52w: 130.67,
    position52wPercent: 82.7,
    targetBuyPrice: 175.0,
    targetGapPercent: -3.42,
    aiSummary:
      '빅테크 내 가장 매력적인 Forward PER(21배 수준) 밸류에이션 보유. Gemini 2.0 생태계 통합 및 클라우드 영업이익률 14% 돌파로 하방 경직성 우수.',
    aiSignal: '적극매수권',
  },
  {
    id: 'wl-schd',
    code: 'SCHD',
    name: 'Schwab US Dividend Equity ETF',
    sector: '배당성장 ETF',
    currency: 'USD',
    currentPrice: 28.95,
    currentPriceKrw: 38694,
    dailyChangePercent: 0.35,
    high52w: 29.45,
    low52w: 24.1,
    position52wPercent: 90.7,
    targetBuyPrice: 28.2,
    targetGapPercent: -2.59,
    aiSummary:
      '액면분할 이후 유동성 개선 및 연 3.4%대 배당수익률 + 연평균 10% 배당성장 유지. 위탁계좌 달러예수금 활용 달러 현금흐름 파이프라인 구축에 최적.',
    aiSignal: '적극매수권',
  },
  {
    id: 'wl-tlt',
    code: 'TLT',
    name: 'iShares 20+ Year Treasury Bond',
    sector: '미국 장기국채 ETF',
    currency: 'USD',
    currentPrice: 92.4,
    currentPriceKrw: 123499,
    dailyChangePercent: -1.12,
    high52w: 101.64,
    low52w: 87.3,
    position52wPercent: 35.6,
    targetBuyPrice: 91.5,
    targetGapPercent: -0.97,
    aiSummary:
      '미국 10년/30년물 금리 반등으로 52주 저점 부근(35.6% 위치) 진입. 목표매수가($91.50)와 괴리율 -0.97%로 월분배금(연 4.3%) 수취 및 금리 피크아웃 헤지 구간.',
    aiSignal: '적극매수권',
  },
];

export const DEFAULT_GEMINI_WEEKLY_REPORTS: GeminiWeeklyReportItem[] = [
  {
    id: 'rep-2026-w46',
    reportDate: '2026.11.14',
    reportWeek: '2026년 11월 2주차 (W46)',
    weeklyNetWorthChangeKrw: 3425000,
    weeklyReturnPercent: 1.44,
    headline:
      '미국 빅테크·나스닥100 강세에 따른 연금/IRP 수익 확대 및 위탁 달러예수금($20,312) 분할 배치 전략',
    marketMacroSummary:
      '• 미 연준(Fed)의 점진적 금리 인하 기조 속에서 미국 소매판매·고용 지표가 견조하게 유지되며 S&P500 및 나스닥100 지수가 신고가 흐름을 이어갔습니다.\n• 원/달러 환율은 ₩1,336.57 수준에서 안정화되었으며, 미 장기채 금리(30년물)가 4.5% 부근으로 소폭 상승함에 따라 주식형 ETF 강세와 장기국채 ETF의 단기 조정이 교차했습니다.',
    holdingsIssues:
      '• [연금저축/IRP] KODEX 미국나스닥100(366주, +2.21%)과 TIGER 미국나스닥100(14주, +₩742,785), TIGER 미국배당다우존스(157주, +₩499,060)가 포트폴리오 전체 수익을 견인했습니다.\n• [ISA/IRP 채권] ACE 미국30년국채액티브(H)(-9.13%)는 금리 상승 영향으로 평가손실 구간이나 월배당 재투자를 통한 평단가 인하 효과가 누적되고 있습니다.\n• [해외직투] 토스증권 마이크로소프트(MSFT 5주)는 원화 기준 +₩218,929(+7.67%) 수익을 기록 중입니다.',
    watchlistTopPicks:
      '• 1순위 [AVGO 브로드컴 / GOOGL 알파벳]: 목표매수가 대비 괴리율이 -3% 이내로 근접했으며 AI 인프라 수혜 대비 밸류에이션 매력이 가장 높습니다.\n• 2순위 [TLT / ACE 미국30년국채]: 52주 가격 밴드 하단(35.6%)에 위치해 있어 ISA 비과세 계좌 내 추가 적립 시 기대 손익비가 우수합니다.',
    rebalancingActionPlan:
      '• 현재 한투 위탁계좌에 보유 중인 달러 예수금 $20,312.48(약 ₩2,715만)과 수동 현금자산(보유현금 3,600만·증여금 5,000만)으로 인해 현금성 비중이 높습니다.\n• 위탁계좌 달러예수금 중 $6,000(약 30%)를 향후 4주간 주당 $1,500씩 SCHD(배당성장) 및 GOOGL/AVGO(AI 빅테크)에 분할 매수하여 달러 배당 파이프라인을 강화할 것을 제안합니다.',
  },
  {
    id: 'rep-2026-w45',
    reportDate: '2026.11.07',
    reportWeek: '2026년 11월 1주차 (W45)',
    weeklyNetWorthChangeKrw: 2180000,
    weeklyReturnPercent: 0.93,
    headline:
      '미 대선 및 FOMC 이벤트 통과 후 불확실성 해소, 퇴직연금(IRP) 배당다우존스 분배금 수령 점검',
    marketMacroSummary:
      '• 빅 이벤트(FOMC 25bp 인하) 소화 이후 글로벌 위험자산 선호 심리가 회복되며 미국 대형 기술주와 배당성장주 동반 상승세가 나타났습니다.\n• 달러 인덱스가 강보합을 유지하면서 보유 중인 외화예수금($20,312.48)의 원화 환산 가치 방어력이 돋보였습니다.',
    holdingsIssues:
      '• [퇴직연금 IRP] TIGER 미국배당다우존스 및 KODEX 코리아배당성장채권혼합이 안정적인 방어력과 현금흐름을 제공하며 계좌 전체 평가익 +₩1,504,190을 달성했습니다.\n• [청년도약계좌] 하나은행 적금(연 4.5% 비과세) 및 정부기여금(₩640만) 누적분이 안전자산 버퍼 역할을 충실히 수행 중입니다.',
    watchlistTopPicks:
      '• [NVDA 엔비디아]: 차세대 AI 서버 출하 모멘텀 지속, $132 이하 조정 시 분할 진입 타겟 유지.\n• [SCHD]: 분기 배당 성장률이 10% 이상 유지되고 있어 외화 RP 대기자금의 전환처로 유망합니다.',
    rebalancingActionPlan:
      '• 연말 세액공제 극대화를 위해 연금저축 및 퇴직연금(IRP) 계좌의 월 정기적립(월 75만 원) 스케줄을 유지하고, ISA 계좌 내 현금예수금으로 월배당 채권 ETF 10주 추가 매수를 권장합니다.',
  },
  {
    id: 'rep-2026-w44',
    reportDate: '2026.10.31',
    reportWeek: '2026년 10월 5주차 (W44)',
    weeklyNetWorthChangeKrw: -640000,
    weeklyReturnPercent: -0.28,
    headline:
      '빅테크 3분기 실적 발표 시즌 변동성 대응 및 현금·예적금 안전마진 기반 방어 성공',
    marketMacroSummary:
      '• 미국 주요 빅테크 기업들의 AI 설비투자(CAPEX) 확대 발표로 단기 차익실현 매물이 출회되며 나스닥 지수가 숨고르기 장세를 보였습니다.\n• 국고채 및 미국 장기채 금리가 일시 반등하며 채권형 자산의 변동성이 확대되었습니다.',
    holdingsIssues:
      '• [토스증권 MSFT] 클라우드 매출 호조에도 가이던스 경계감으로 단기 등락했으나 매수평단가($427.10) 대비 견조한 수익권(+7%대)을 유지했습니다.\n• [현금/적금] 전체 자산의 60% 이상이 현금·증여금·청년도약계좌에 배치되어 있어 시장 조정에도 전체 순자산 변동폭은 -0.28%로 극히 제한적이었습니다.',
    watchlistTopPicks:
      '• [MSFT 마이크로소프트]: 실적 발표 직후 눌림목은 중장기 매수 기회로 판단됩니다.\n• [379810 KODEX 미국나스닥100]: 연금저축 계좌 내 정기 적립 수량을 15주 → 18주로 소폭 확대하는 전략이 유효합니다.',
    rebalancingActionPlan:
      '• 변동성 확대 구간에서 추격 매수를 자제하고, 위탁계좌 달러예수금($20,312.48)은 외화 RP 이자를 수취하며 11월 중순 이후 분할 진입 시점을 노리는 전략을 유지합니다.',
  },
];

export const DEFAULT_BULLISH_TOP5: SentimentPickItem[] = [
  {
    id: 'bull-1',
    rank: 1,
    ticker: 'NVDA',
    stockName: '엔비디아 (NVIDIA Corp)',
    sentiment: 'BULLISH',
    sentimentScore: 95,
    weeklyChangePercent: 5.42,
    newsCount: 14,
    rationale:
      'Blackwell GB200 서버 랙 출하 본격화 및 빅테크 4사(MSFT·GOOGL·META·AMZN)의 2027년 AI 데이터센터 CAPEX 가이던스 상향으로 1주간 기관 목표주가 상향 리포트 9건 집중.',
    catalysts: ['Blackwell 양산 가속', '하이퍼스케일러 CAPEX 확대', '영업이익률 63% 유지'],
    inPortfolio: true,
  },
  {
    id: 'bull-2',
    rank: 2,
    ticker: 'AVGO',
    stockName: '브로드컴 (Broadcom Inc)',
    sentiment: 'BULLISH',
    sentimentScore: 91,
    weeklyChangePercent: 4.18,
    newsCount: 9,
    rationale:
      '구글·메타향 맞춤형 AI 가속기(XPU/ASIC) 신규 수주 모멘텀 및 VMware 클라우드 소프트웨어 ARR(연간반복매출) 고성장으로 잉여현금흐름(FCF) 사상 최고치 경신 전망.',
    catalysts: ['맞춤형 AI ASIC 독점력', 'VMware 마진 레버리지', '배당성장 +14%'],
    inPortfolio: false,
  },
  {
    id: 'bull-3',
    rank: 3,
    ticker: 'MSFT',
    stockName: '마이크로소프트 (Microsoft)',
    sentiment: 'BULLISH',
    sentimentScore: 89,
    weeklyChangePercent: 2.65,
    newsCount: 11,
    rationale:
      'Azure 클라우드 내 AI 워크로드 비중이 13%p 이상 기여하며 엔터프라이즈 M365 Copilot 유료 시트 전환율이 분기 대비 60% 급증. 토스증권 보유분(+7.67%) 핵심 코어 홀딩 유효.',
    catalysts: ['Azure AI 성장 가속', 'M365 Copilot 수익화', '토스 직투 보유중'],
    inPortfolio: true,
  },
  {
    id: 'bull-4',
    rank: 4,
    ticker: 'GOOGL',
    stockName: '알파벳 A (Alphabet Inc)',
    sentiment: 'BULLISH',
    sentimentScore: 86,
    weeklyChangePercent: 3.12,
    newsCount: 8,
    rationale:
      'Gemini 2.5 검색 AI 오버뷰 도입 이후 광고 단가(CPC) 상승 확인 및 구글 클라우드 영업이익률 17% 돌파. 매그니피센트 7 중 가장 저평가된 Forward PER(20.8배) 매력 부각.',
    catalysts: ['Gemini 검색 수익성 입증', '클라우드 이익률 급증', 'M7 밸류에이션 매력 1위'],
    inPortfolio: false,
  },
  {
    id: 'bull-5',
    rank: 5,
    ticker: 'SCHD',
    stockName: 'Schwab US Dividend Equity / TIGER 미배당',
    sentiment: 'BULLISH',
    sentimentScore: 83,
    weeklyChangePercent: 1.95,
    newsCount: 6,
    rationale:
      '미 연준 금리 인하 사이클 속 금융·헬스케어·필수소비재 가치주의 현금흐름 안정성 부각. 퇴직연금(IRP) 내 TIGER 미국배당다우존스(157주) 및 달러예수금 배당 파이프라인 최선호.',
    catalysts: ['연 10%+ 배당성장', '금융·가치주 로테이션', 'IRP 157주 보유중'],
    inPortfolio: true,
  },
];

export const DEFAULT_BEARISH_TOP5: SentimentPickItem[] = [
  {
    id: 'bear-1',
    rank: 1,
    ticker: 'TLT',
    stockName: '미국 30년 장기국채 (ACE 미30년국채H)',
    sentiment: 'BEARISH',
    sentimentScore: -78,
    weeklyChangePercent: -2.85,
    newsCount: 10,
    rationale:
      '미국 재정적자 확대에 따른 국채 발행량 증가 우려와 견조한 소매판매 지표로 10년·30년물 금리가 4.5%대로 반등. 단기 평가손(-9.13%) 구간이나 월분배금 재투자로 평단 인하 대응 필요.',
    catalysts: ['장기채 금리 4.5% 반등', '국채 발행 물량 부담', 'ISA·IRP 보유 주의점검'],
    inPortfolio: true,
  },
  {
    id: 'bear-2',
    rank: 2,
    ticker: 'INTC',
    stockName: '인텔 (Intel Corp)',
    sentiment: 'BEARISH',
    sentimentScore: -84,
    weeklyChangePercent: -6.4,
    newsCount: 8,
    rationale:
      '파운드리(IFS) 사업부 대규모 영업적자 지속 및 서버용 CPU 점유율 하락에 따른 구조조정 비용 반영. AI 가속기 Gaudi3 매출 가이던스 하향으로 기관 투자의견 보수적 유지.',
    catalysts: ['파운드리 적자 지속', '데이터센터 점유율 둔화', '가이던스 하향'],
    inPortfolio: false,
  },
  {
    id: 'bear-3',
    rank: 3,
    ticker: 'SMCI',
    stockName: '슈퍼마이크로컴퓨터 (Super Micro)',
    sentiment: 'BEARISH',
    sentimentScore: -81,
    weeklyChangePercent: -8.9,
    newsCount: 7,
    rationale:
      '연차보고서(10-K) 제출 지연 이슈 및 서버 랙 마진율 압박(Gross Margin 11%대 하락) 우려 지속. AI 서버 수요 자체는 견조하나 거버넌스 불확실성 해소 전까지 관망 권고.',
    catalysts: ['회계·공시 리스크', '매출총이익률 둔화', '변동성 경계'],
    inPortfolio: false,
  },
  {
    id: 'bear-4',
    rank: 4,
    ticker: 'SOXL',
    stockName: 'Direxion 반도체 3배 레버리지 ETF',
    sentiment: 'BEARISH',
    sentimentScore: -72,
    weeklyChangePercent: -4.15,
    newsCount: 5,
    rationale:
      '필라델피아 반도체 지수 내 AI 수혜주(NVDA·AVGO)와 레거시 반도체(아날로그·장비주) 간 양극화 심화로 지수 횡보 시 3배 레버리지 변동성 끌림(Volatility Drag) 손실 주의.',
    catalysts: ['레버리지 음의 복리 주의', '반도체 업종 내 양극화', '지난달 익절 완료'],
    inPortfolio: false,
  },
  {
    id: 'bear-5',
    rank: 5,
    ticker: 'TSLA',
    stockName: '테슬라 (Tesla Inc)',
    sentiment: 'BEARISH',
    sentimentScore: -66,
    weeklyChangePercent: -3.2,
    newsCount: 9,
    rationale:
      '자율주행(FSD)·로보택시 규제 완화 기대감으로 급등한 이후 단기 RSI 과열 구간 진입 및 EV 보조금 축소 논의에 따른 전기차 본업 마진 변동성 경계 리포트 출회.',
    catalysts: ['단기 밸류에이션 과열', 'EV 보조금 정책 변수', '차익실현 매물 소화'],
    inPortfolio: false,
  },
];

export const DEFAULT_SAVETICKER_NEWS: SaveTickerNewsItem[] = [
  {
    id: 'st-news-1',
    publishedAt: '2026.11.14 21:30',
    ticker: 'NVDA',
    stockName: '엔비디아 (NVIDIA)',
    title: '모건스탠리 "Blackwell GB200 분기 출하량 시장 예상치 25% 상회… 목표주가 상향"',
    summary:
      '하이퍼스케일러향 차세대 Blackwell 서버 랙 수율이 90% 이상 안정화되며 4분기 및 내년 1분기 데이터센터 매출 가이던스 상향 여력이 높다는 분석.',
    sentiment: '긍정',
    sentimentScore: 95,
    source: 'SaveTicker · Morgan Stanley',
    url: 'https://www.saveticker.com',
  },
  {
    id: 'st-news-2',
    publishedAt: '2026.11.14 18:45',
    ticker: 'AVGO',
    stockName: '브로드컴 (Broadcom)',
    title: '브로드컴, 빅테크 맞춤형 AI 가속기(XPU) 3나노 신규 수주… AI 반도체 매출 전년비 +150%',
    summary:
      '고대역폭 네트워크 스위치(Tomahawk 5)와 커스텀 ASIC 수주 잔고가 급증하며 AI 인프라 핵심 수혜주로 재평가 진행 중.',
    sentiment: '긍정',
    sentimentScore: 91,
    source: 'SaveTicker · Bloomberg',
    url: 'https://www.saveticker.com',
  },
  {
    id: 'st-news-3',
    publishedAt: '2026.11.14 14:10',
    ticker: 'TLT',
    stockName: '미국 30년 장기국채 ETF',
    title: '미 10년물·30년물 국채금리 4.5%대 재돌파… "연준 금리 인하 속도 조절론 부상"',
    summary:
      '미국 소매판매 및 고용 지표 호조와 재정적자 국채 발행 부담이 맞물리며 장기채 금리 상승 압력 지속. ISA·IRP 장기채 ETF는 배당 재투자 관점 접근 유효.',
    sentiment: '부정',
    sentimentScore: -78,
    source: 'SaveTicker · WSJ',
    url: 'https://www.saveticker.com',
  },
  {
    id: 'st-news-4',
    publishedAt: '2026.11.13 22:15',
    ticker: 'MSFT',
    stockName: '마이크로소프트 (Microsoft)',
    title: 'Microsoft Azure AI 클라우드 예약 매출(RPO) 사상 최대… 기업용 Copilot 도입 가속',
    summary:
      '포춘 500대 기업의 70% 이상이 M365 Copilot을 도입했으며 Azure OpenAI API 호출량이 분기 대비 2배 이상 증가해 클라우드 마진 방어에 성공.',
    sentiment: '긍정',
    sentimentScore: 89,
    source: 'SaveTicker · CNBC',
    url: 'https://www.saveticker.com',
  },
  {
    id: 'st-news-5',
    publishedAt: '2026.11.13 16:20',
    ticker: 'GOOGL',
    stockName: '알파벳 A (Alphabet)',
    title: '구글 클라우드 영업이익률 17% 돌파 및 Gemini 2.5 광고 전환율 상승 효과 본격화',
    summary:
      'AI 검색 오버뷰 도입 이후 사용자 체류 시간과 상업용 검색 쿼리가 동반 증가하며 검색 독점력 우려를 실적으로 불식.',
    sentiment: '긍정',
    sentimentScore: 86,
    source: 'SaveTicker · Reuters',
    url: 'https://www.saveticker.com',
  },
  {
    id: 'st-news-6',
    publishedAt: '2026.11.12 23:05',
    ticker: 'INTC',
    stockName: '인텔 (Intel)',
    title: '인텔 파운드리 사업부 손실 지속 및 서버 CPU 시장 점유율 AMD·ARM에 추가 잠식',
    summary:
      '18A 공정 양산 전까지 대규모 설비투자 비용 부담이 지속되며 단기 현금흐름 압박과 배당 중단에 따른 기관 매도세 출회.',
    sentiment: '부정',
    sentimentScore: -84,
    source: 'SaveTicker · Barron’s',
    url: 'https://www.saveticker.com',
  },
  {
    id: 'st-news-7',
    publishedAt: '2026.11.12 11:40',
    ticker: 'SCHD',
    stockName: 'Schwab US Dividend Equity ETF',
    title: '미국 배당성장 ETF(SCHD) 자금 순유입 4주 연속 증가… 달러 대기자금 유입세 뚜렷',
    summary:
      '머니마켓펀드(MMF) 및 외화 RP 금리 하락에 대비해 연 3.5% 배당수익률과 11% 배당성장률을 기록 중인 우량 배당성장주로 자금 이동 가속.',
    sentiment: '긍정',
    sentimentScore: 83,
    source: 'SaveTicker · Morningstar',
    url: 'https://www.saveticker.com',
  },
  {
    id: 'st-news-8',
    publishedAt: '2026.11.11 19:50',
    ticker: 'SMCI',
    stockName: '슈퍼마이크로컴퓨터 (SMCI)',
    title: '슈퍼마이크로, 감사보고서 제출 지연에 따른 나스닥 규정 준수 계획서 제출 임박',
    summary:
      '수랭식 AI 서버 기술력은 유효하나 회계 감사인 교체 및 마진율 둔화 이슈로 단기 변동성이 극심해 보수적 리스크 관리 필요.',
    sentiment: '부정',
    sentimentScore: -81,
    source: 'SaveTicker · MarketWatch',
    url: 'https://www.saveticker.com',
  },
  {
    id: 'st-news-9',
    publishedAt: '2026.11.10 15:15',
    ticker: 'TSLA',
    stockName: '테슬라 (Tesla)',
    title: '연방 전기차 세액공제(IRA $7,500) 폐지 검토 보도에 EV 섹터 전반 단기 차익실현 매물',
    summary:
      '자율주행 규제 완화 수혜와 전기차 보조금 축소 이슈가 맞물리며 단기 주가 과열 해소 구간 진입.',
    sentiment: '부정',
    sentimentScore: -66,
    source: 'SaveTicker · Financial Times',
    url: 'https://www.saveticker.com',
  },
  {
    id: 'st-news-10',
    publishedAt: '2026.11.09 09:30',
    ticker: 'QQQ',
    stockName: '나스닥100 (KODEX/TIGER 미국나스닥100)',
    title: '나스닥100 지수 사상 최고치 경신… 연금저축·IRP 계좌 내 미국지수 ETF 수익률 호조',
    summary:
      '미국 대형 기술주 실적 서프라이즈와 원/달러 환율 1,330원대 중반 지지로 국내 상장 환노출 미국지수 ETF(379810, 133690)의 원화 환산 수익률 극대화.',
    sentiment: '긍정',
    sentimentScore: 90,
    source: 'SaveTicker · ETF Focus',
    url: 'https://www.saveticker.com',
  },
];

// Embedded fallback snapshot from live Google Apps Script endpoint
export const INITIAL_FALLBACK_RAW = {
  updatedAt: '2026-11-14T12:18:31.735Z',
  usdKrwRate: 1336.565,
  summary: {
    기준일: '2026-11-13T15:00:00.000Z',
    금융자산합계: 193782151.0399224,
    현금: 120319053.8312,
    예적금: 44127593.84772239,
    주식: 29335503.361,
    채권: 0,
  },
  assetHistory: [
    { 날짜: '2024-11-23T15:00:00.000Z', 환율: 1403.51, '총합계(원)': 19104750.03, '예적금합계(원)': 16318012.01, '입출금합계(원)': '', '채권합계(원)': 0, '주식계좌합계(원)': 2786738.03 },
    { 날짜: '2024-12-23T15:00:00.000Z', 환율: 1453.42, '총합계(원)': 20266723.4, '예적금합계(원)': 17330757.89, '입출금합계(원)': '', '채권합계(원)': 0, '주식계좌합계(원)': 2935965.51 },
    { 날짜: '2025-01-22T15:00:00.000Z', 환율: 1433.93, '총합계(원)': 21328788.53, '예적금합계(원)': 18343503.77, '입출금합계(원)': '', '채권합계(원)': 0, '주식계좌합계(원)': 2985284.76 },
    { 날짜: '2025-02-21T15:00:00.000Z', 환율: 1434.29, '총합계(원)': 22084245.64, '예적금합계(원)': 19356249.65, '입출금합계(원)': '', '채권합계(원)': 0, '주식계좌합계(원)': 2727995.99 },
    { 날짜: '2025-03-23T15:00:00.000Z', 환율: 1466.27, '총합계(원)': 22995880.38, '예적금합계(원)': 20368995.53, '입출금합계(원)': '', '채권합계(원)': 0, '주식계좌합계(원)': 2626884.85 },
    { 날짜: '2025-04-22T15:00:00.000Z', 환율: 1426.45, '총합계(원)': 23883724.27, '예적금합계(원)': 21381741.41, '입출금합계(원)': '', '채권합계(원)': 0, '주식계좌합계(원)': 2501982.85 },
    { 날짜: '2025-05-22T15:00:00.000Z', 환율: 1364.23, '총합계(원)': 25402961.45, '예적금합계(원)': 22394487.29, '입출금합계(원)': '', '채권합계(원)': 0, '주식계좌합계(원)': 3008474.16 },
    { 날짜: '2025-06-21T15:00:00.000Z', 환율: 1369.47, '총합계(원)': 26597613.83, '예적금합계(원)': 23407233.18, '입출금합계(원)': '', '채권합계(원)': 0, '주식계좌합계(원)': 3190380.66 },
    { 날짜: '2025-07-21T15:00:00.000Z', 환율: 1379.78, '총합계(원)': 27796610.04, '예적금합계(원)': 24419979.06, '입출금합계(원)': '', '채권합계(원)': 0, '주식계좌합계(원)': 3376630.99 },
    { 날짜: '2025-08-20T15:00:00.000Z', 환율: 1399.61, '총합계(원)': 28502916.63, '예적금합계(원)': 25133168.95, '입출금합계(원)': '', '채권합계(원)': 0, '주식계좌합계(원)': 3369747.68 },
    { 날짜: '2025-09-19T15:00:00.000Z', 환율: 1395.21, '총합계(원)': 29607150.38, '예적금합계(원)': 26145914.83, '입출금합계(원)': '', '채권합계(원)': 0, '주식계좌합계(원)': 3461235.55 },
    { 날짜: '2025-10-19T15:00:00.000Z', 환율: 1419.74, '총합계(원)': 30612277.84, '예적금합계(원)': 27158660.71, '입출금합계(원)': '', '채권합계(원)': 0, '주식계좌합계(원)': 3453617.13 },
    { 날짜: '2025-11-18T15:00:00.000Z', 환율: 1466.13, '총합계(원)': 31831222.11, '예적금합계(원)': 28575884.39, '입출금합계(원)': '', '채권합계(원)': 0, '주식계좌합계(원)': 3255337.71 },
    { 날짜: '2025-12-18T15:00:00.000Z', 환율: 1474.66, '총합계(원)': 32835948.6, '예적금합계(원)': 29588630.27, '입출금합계(원)': '', '채권합계(원)': 0, '주식계좌합계(원)': 3247318.32 },
    { 날짜: '2026-01-17T15:00:00.000Z', 환율: 1471.58, '총합계(원)': 43255510.14, '예적금합계(원)': 30910354.23, '입출금합계(원)': 9271992, '채권합계(원)': 0, '주식계좌합계(원)': 3073163.9 },
    { 날짜: '2026-02-16T15:00:00.000Z', 환율: 1439.97, '총합계(원)': 44156216.12, '예적금합계(원)': 32232078.19, '입출금합계(원)': 9271992, '채권합계(원)': 0, '주식계좌합계(원)': 2652145.93 },
    { 날짜: '2026-03-18T15:00:00.000Z', 환율: 1489.84, '총합계(원)': 45425546.74, '예적금합계(원)': 33553802.16, '입출금합계(원)': 9271992, '채권합계(원)': 0, '주식계좌합계(원)': 2599752.58 },
    { 날짜: '2026-04-17T15:00:00.000Z', 환율: 1466.04, '총합계(원)': 46972949.7, '예적금합계(원)': 34875526.12, '입출금합계(원)': 9271992, '채권합계(원)': 0, '주식계좌합계(원)': 2825431.58 },
    { 날짜: '2026-05-17T15:00:00.000Z', 환율: 1492.32, '총합계(원)': 48299685.78, '예적금합계(원)': 36197250.08, '입출금합계(원)': 9271992, '채권합계(원)': 0, '주식계좌합계(원)': 2830443.7 },
    { 날짜: '2026-06-16T15:00:00.000Z', 환율: 1525.42, '총합계(원)': 49323155.26, '예적금합계(원)': 37518974.04, '입출금합계(원)': 9271992, '채권합계(원)': 0, '주식계좌합계(원)': 2532189.22 },
    { 날짜: '2026-07-16T15:00:00.000Z', 환율: 1486.67, '총합계(원)': 50744520.14, '예적금합계(원)': 38840698.0, '입출금합계(원)': 9271992, '채권합계(원)': 0, '주식계좌합계(원)': 2631830.14 },
    { 날짜: '2026-08-15T15:00:00.000Z', 환율: 1415.37, '총합계(원)': 52745085.47, '예적금합계(원)': 40162421.96, '입출금합계(원)': 9271992, '채권합계(원)': 0, '주식계좌합계(원)': 3310671.51 },
    { 날짜: '2026-09-14T15:00:00.000Z', 환율: 1363.57, '총합계(원)': 54078303.89, '예적금합계(원)': 41484145.92, '입출금합계(원)': 9271992, '채권합계(원)': 0, '주식계좌합계(원)': 3322165.96 },
    { 날짜: '2026-10-14T15:00:00.000Z', 환율: 1340.95, '총합계(원)': 55682845.0, '예적금합계(원)': 42805869.89, '입출금합계(원)': 9271992, '채권합계(원)': 0, '주식계좌합계(원)': 3604983.12 },
    { 날짜: '2026-11-13T15:00:00.000Z', 환율: 1336.565, '총합계(원)': 140739202.21, '예적금합계(원)': 44127593.85, '입출금합계(원)': 93110610, '채권합계(원)': 0, '주식계좌합계(원)': 3500998.36 },
  ],
  kisRealtime: [
    { 기준시각: '2026-11-14T11:49:14.000Z', 시장구분: '[위탁계좌] 예수금(KRW)', 종목코드: 'CASH_43783212_01', 종목명: '위탁계좌 원화예수금', 보유수량: 1, 매입평균가: 2, 현재가: 2, 평가금액: 2, 평가손익: 0, '수익률(%)': 0, 예수금: 2 },
    { 기준시각: '2026-11-14T11:49:14.000Z', 시장구분: '[위탁계좌] 외화예수금(USD)', 종목코드: 'CASH_USD', 종목명: '위탁계좌 달러예수금($)', 보유수량: 1, 매입평균가: 20312.48, 현재가: 20312.48, 평가금액: 20312.48, 평가손익: 0, '수익률(%)': 0, 예수금: 20312.48 },
    { 기준시각: '2026-11-14T11:49:14.000Z', 시장구분: '[ISA중개형] 국내', 종목코드: 453850, 종목명: 'ACE 미국30년국채액티브(H)', 보유수량: 44, 매입평균가: 7660, 현재가: 6960, 평가금액: 306240, 평가손익: -30800, '수익률(%)': -9.13, 예수금: 0 },
    { 기준시각: '2026-11-14T11:49:14.000Z', 시장구분: '[ISA중개형] 예수금(KRW)', 종목코드: 'CASH_43783213_01', 종목명: 'ISA중개형 원화예수금', 보유수량: 1, 매입평균가: 12460, 현재가: 12460, 평가금액: 12460, 평가손익: 0, '수익률(%)': 0, 예수금: 12460 },
    { 기준시각: '2026-11-14T11:49:14.000Z', 시장구분: '[연금저축] 국내', 종목코드: 379800, 종목명: 'KODEX 미국S&P500', 보유수량: 103, 매입평균가: 22911.068, 현재가: 22780, 평가금액: 2346340, 평가손익: -13500, '수익률(%)': -0.57, 예수금: 0 },
    { 기준시각: '2026-11-14T11:49:14.000Z', 시장구분: '[연금저축] 국내', 종목코드: 379810, 종목명: 'KODEX 미국나스닥100', 보유수량: 366, 매입평균가: 24375.4918, 현재가: 24915, 평가금액: 9118890, 평가손익: 197460, '수익률(%)': 2.21, 예수금: 0 },
    { 기준시각: '2026-11-14T11:49:14.000Z', 시장구분: '[연금저축] 국내', 종목코드: 434060, 종목명: 'KODEX TDF2050액티브 적격', 보유수량: 228, 매입평균가: 16661.0965, 현재가: 15700, 평가금액: 3579600, 평가손익: -219130, '수익률(%)': -5.76, 예수금: 0 },
    { 기준시각: '2026-11-14T11:49:14.000Z', 시장구분: '[연금저축] 예수금(KRW)', 종목코드: 'CASH_47223092_22', 종목명: '연금저축 원화예수금', 보유수량: 1, 매입평균가: 47032, 현재가: 47032, 평가금액: 47032, 평가손익: 0, '수익률(%)': 0, 예수금: 47032 },
    { 기준시각: '2026-11-14T11:49:14.000Z', 시장구분: '[퇴직연금(IRP)] 국내', 종목코드: 133690, 종목명: 'TIGER 미국나스닥100', 보유수량: 14, 매입평균가: 113663.9286, 현재가: 166720, 평가금액: 2334080, 평가손익: 742785, '수익률(%)': 0, 예수금: 0 },
    { 기준시각: '2026-11-14T11:49:14.000Z', 시장구분: '[퇴직연금(IRP)] 국내', 종목코드: 237370, 종목명: 'KODEX 코리아배당성장채권혼합', 보유수량: 121, 매입평균가: 12827.8099, 현재가: 15120, 평가금액: 1829520, 평가손익: 277355, '수익률(%)': 0, 예수금: 0 },
    { 기준시각: '2026-11-14T11:49:14.000Z', 시장구분: '[퇴직연금(IRP)] 국내', 종목코드: 360750, 종목명: 'TIGER 미국S&P500', 보유수량: 113, 매입평균가: 24388.9823, 현재가: 25120, 평가금액: 2838560, 평가손익: 82605, '수익률(%)': 0, 예수금: 0 },
    { 기준시각: '2026-11-14T11:49:14.000Z', 시장구분: '[퇴직연금(IRP)] 국내', 종목코드: 379800, 종목명: 'KODEX 미국S&P500', 보유수량: 6, 매입평균가: 23387.5, 현재가: 22780, 평가금액: 136680, 평가손익: -3645, '수익률(%)': 0, 예수금: 0 },
    { 기준시각: '2026-11-14T11:49:14.000Z', 시장구분: '[퇴직연금(IRP)] 국내', 종목코드: 379810, 종목명: 'KODEX 미국나스닥100', 보유수량: 2, 매입평균가: 23950, 현재가: 24915, 평가금액: 49830, 평가손익: 1930, '수익률(%)': 0, 예수금: 0 },
    { 기준시각: '2026-11-14T11:49:14.000Z', 시장구분: '[퇴직연금(IRP)] 국내', 종목코드: 434060, 종목명: 'KODEX TDF2050액티브 적격', 보유수량: 46, 매입평균가: 16802.6087, 현재가: 15700, 평가금액: 722200, 평가손익: -50720, '수익률(%)': 0, 예수금: 0 },
    { 기준시각: '2026-11-14T11:49:14.000Z', 시장구분: '[퇴직연금(IRP)] 국내', 종목코드: 458730, 종목명: 'TIGER 미국배당다우존스', 보유수량: 157, 매입평균가: 12021.2739, 현재가: 15200, 평가금액: 2386400, 평가손익: 499060, '수익률(%)': 0, 예수금: 0 },
    { 기준시각: '2026-11-14T11:49:14.000Z', 시장구분: '[퇴직연금(IRP)] 국내', 종목코드: 476750, 종목명: 'ACE 미국30년국채엔화노출액티브(H)', 보유수량: 27, 매입평균가: 8568.3333, 현재가: 6895, 평가금액: 186165, 평가손익: -45180, '수익률(%)': 0, 예수금: 0 },
    { 기준시각: '2026-11-14T11:49:14.000Z', 시장구분: '[퇴직연금(IRP)] 예수금', 종목코드: 'CASH_IRP', 종목명: '퇴직연금(IRP) 예수금', 보유수량: 1, 매입평균가: 0, 현재가: 0, 평가금액: 0, 평가손익: 0, '수익률(%)': 0, 예수금: 0 },
  ],
  stockDetail: [
    {
      '종목정보 시장': 'NAS',
      종목명: '마이크로소프트',
      섹터: 'Technology',
      코드: 'MSFT',
      '매수정보 보유량': 5,
      매수평단가: 427.1,
      '매수총액($)': 2135.5,
      '매수평단가(원)': 570846.9115,
      '매수총액(원)': 2854234.5575,
      '1336.565 평균환율': 1377.36,
      '잔고 현재가': 1336.565,
      평가총액: '$',
      '평가총액(원)': 3073163.9045,
      '수익현황 총수익': '$',
      원화수익: 218929.347,
      일간수익: 0.88,
    },
  ],
  savings: [
    {
      구분: '적금',
      은행: '하나은행',
      가입일: '2023-07-09T15:00:00.000Z',
      이율: 0.045,
      기간: 60,
      금액: 700000,
      비과세: 'O',
      통화: 'KRW',
      '만기수령액(세전)': 42939275.02,
      '만기수령액(세후)': 42791393.48,
      ID: 'A00001',
      만기일: '2028-07-09T15:00:00.000Z',
      환율: 0.9995,
      '만기수령액(통화)': 49812794.5,
    },
    {
      구분: '적금',
      은행: '신한은행',
      가입일: '2026-01-01T15:00:00.000Z',
      이율: 0.07,
      기간: 12,
      금액: 300000,
      비과세: '',
      통화: 'KRW',
      '만기수령액(세전)': 3728714.16,
      '만기수령액(세후)': 3707736.96,
      ID: 'A00002',
      만기일: '2027-01-01T15:00:00.000Z',
      환율: 0.9979,
      '만기수령액(통화)': 3715479.0,
    },
    {
      구분: '적금',
      은행: '전세반환대출',
      가입일: '2023-10-21T15:00:00.000Z',
      이율: 0,
      기간: 120,
      금액: 300000,
      비과세: '',
      통화: 'KRW',
      '만기수령액(세전)': 35946718.77,
      '만기수령액(세후)': 35946718.77,
      ID: 'A00003',
      만기일: '2033-10-21T15:00:00.000Z',
      환율: 0.9985,
      '만기수령액(통화)': 36000000,
    },
    {
      구분: '채권',
      은행: '미래에셋증권',
      가입일: '2025-11-14T15:00:00.000Z',
      이율: 0.01125,
      기간: 177,
      금액: 43400,
      비과세: '',
      통화: 'USD',
      '만기수령액(세전)': 73196859.02,
      '만기수령액(세후)': 71592570.64,
      ID: 'A00004',
      만기일: '2040-08-14T15:00:00.000Z',
      환율: 1446.53,
      '만기수령액(통화)': 49492.63,
    },
  ],
  checkingAccounts: [
    {
      날짜: '2026-11-13T15:00:00.000Z',
      총합계: 93110610,
      '주거래 하나 통장': 510640,
      '토스뱅크 통장': 199900,
      '미래에셋 종합_CMA': 70,
      '보유 현금': 36000000,
      증여금: 50000000,
      '청년도약계좌 정부기여금': 6400000,
    },
  ],
  bonds: [
    {
      채권명: 'T1.125',
      설명: '미국장기채',
      가입일: '2025-11-17T15:00:00.000Z',
      종료일: '2040-08-14T15:00:00.000Z',
      '월 납입금액': 99270,
      수령: '',
      '총 납입액': 17570790,
    },
  ],
  monthlyCashflow: [
    { Category: '잔액', Amount: 403693 },
    { Category: '저축 ', Amount: 1850000 },
    { Category: '지출', Amount: 1662307 },
  ],
  monthlySavingsDist: [
    { '저축 분류': 'IRP & 연금 저축', 'IRP & 연금 저축': 750000 },
    { '저축 분류': '전세금 상환 저축액', '전세금 상환 저축액': 300000 },
    { '저축 분류': '주택청약저축', 주택청약저축: 100000 },
    { '저축 분류': '청년도약계좌 (28년 8월 만기)', '청년도약계좌 (28년 8월 만기)': 700000 },
    { '저축 분류': '미국주식', 미국주식: 0 },
    { '저축 분류': '신한은행 적금', '신한은행 적금': 0 },
  ],
};

function toNum(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[,₩$%\s]/g, '');
    if (!cleaned) return 0;
    const parsed = Number(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function mapAccountCategory(marketOrAccount: string): Exclude<AccountFilterType, '전체'> {
  const s = marketOrAccount.toUpperCase();
  if (s.includes('ISA')) return 'ISA중개형';
  if (s.includes('연금저축')) return '연금저축';
  if (s.includes('IRP') || s.includes('퇴직연금')) return '퇴직연금(IRP)';
  if (s.includes('토스') || s.includes('NAS') || s.includes('NYS') || s.includes('US')) return '토스증권';
  return '위탁계좌';
}

export function classifyUnderlyingAsset(
  rawUnderlying: unknown,
  name: string,
  code: string,
  source: 'KIS' | 'US_STOCK',
  market: string
): UnderlyingAssetClass {
  const rawStr = String(rawUnderlying || '').trim();
  if (
    rawStr === '해외주식' ||
    rawStr === '해외채권' ||
    rawStr === '국내주식' ||
    rawStr === '국내채권' ||
    rawStr === '현금성 자산'
  ) {
    return rawStr;
  }

  const upperCode = code.toUpperCase();
  const upperName = name.toUpperCase();
  const upperMarket = market.toUpperCase();

  if (upperCode.startsWith('CASH_') || upperMarket.includes('예수금')) {
    return '현금성 자산';
  }

  const isBond =
    upperName.includes('국채') ||
    upperName.includes('채권') ||
    upperName.includes('BOND') ||
    upperName.includes('TREASURY') ||
    upperCode === 'TLT' ||
    upperCode === '453850' ||
    upperCode === '476750';

  const isOverseasExposure =
    source === 'US_STOCK' ||
    upperMarket.includes('NAS') ||
    upperMarket.includes('NYS') ||
    upperMarket.includes('AMS') ||
    upperName.includes('미국') ||
    upperName.includes('나스닥') ||
    upperName.includes('S&P') ||
    upperName.includes('다우존스') ||
    upperName.includes('TDF') ||
    upperName.includes('글로벌') ||
    upperName.includes('선진국') ||
    upperName.includes('차이나') ||
    upperName.includes('인도') ||
    upperName.includes('일본') ||
    upperCode === '379800' ||
    upperCode === '379810' ||
    upperCode === '133690' ||
    upperCode === '360750' ||
    upperCode === '458730' ||
    upperCode === '434060' ||
    upperCode === '453850' ||
    upperCode === '476750';

  if (isOverseasExposure) {
    return isBond ? '해외채권' : '해외주식';
  }

  return isBond ? '국내채권' : '국내주식';
}

export function loadCachedRawData(): any {
  try {
    const cached = localStorage.getItem(CACHE_STORAGE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('Failed to read localStorage cache:', e);
  }
  return INITIAL_FALLBACK_RAW;
}

export function saveCachedRawData(rawData: any): void {
  try {
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(rawData));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, new Date().toISOString());
  } catch (e) {
    console.warn('Failed to write localStorage cache:', e);
  }
}

export function parsePortfolioResponse(raw: any, isLiveApi = true): PortfolioData {
  const data = raw && typeof raw === 'object' ? raw : INITIAL_FALLBACK_RAW;

  // 1. Asset History & Exchange Rate (with #VALUE! formula error recovery)
  const rawHistorySource: any[] =
    Array.isArray(data.assetHistory) && data.assetHistory.length > 0
      ? data.assetHistory
      : INITIAL_FALLBACK_RAW.assetHistory;

  const fallbackHistoryByDate = new Map<string, any>();
  INITIAL_FALLBACK_RAW.assetHistory.forEach((fh) => {
    if (fh && fh['날짜']) fallbackHistoryByDate.set(String(fh['날짜']), fh);
  });

  const assetHistory: NormalizedHistoryItem[] = rawHistorySource
    .filter((row) => row && row['날짜'])
    .map((row, idx) => {
      const rawDate = String(row['날짜']);
      const fbRow =
        fallbackHistoryByDate.get(rawDate) ||
        INITIAL_FALLBACK_RAW.assetHistory[idx] ||
        {};
      const d = new Date(rawDate);

      const savingsVal =
        toNum(row['예적금합계(원)'] ?? row['예적금합계']) ||
        toNum(fbRow['예적금합계(원)']);
      const cashVal =
        toNum(row['입출금합계(원)'] ?? row['입출금합계']) ||
        toNum(fbRow['입출금합계(원)']);
      const bondVal =
        toNum(row['채권합계(원)'] ?? row['채권합계']) ||
        toNum(fbRow['채권합계(원)']);
      const stockVal =
        toNum(row['주식계좌합계(원)'] ?? row['주식계좌']) ||
        toNum(fbRow['주식계좌합계(원)']);

      const rawTotalFin = toNum(
        row['총합계(원)'] ?? row['총합계(원화)'] ?? row['총합계']
      );
      const totalFin =
        rawTotalFin > 0
          ? rawTotalFin
          : toNum(fbRow['총합계(원)']) ||
            savingsVal + cashVal + bondVal + stockVal;

      const phys = toNum(row['실물자산(원)']) || 26320000;
      const rawTotalWithPhys = toNum(row['총순자산(원)']);
      const totalWithPhys =
        rawTotalWithPhys > 0 ? rawTotalWithPhys : totalFin + phys;

      return {
        rawDate,
        dateLabel: formatDateKST(rawDate),
        shortDate: formatShortDateKST(rawDate),
        timestamp: isNaN(d.getTime()) ? 0 : d.getTime(),
        exchangeRate: toNum(row['환율']) || toNum(fbRow['환율']) || 1336.565,
        totalKrw: totalFin,
        totalWithPhysicalKrw: totalWithPhys,
        savingsKrw: savingsVal,
        cashKrw: cashVal,
        bondKrw: bondVal,
        stockKrw: stockVal,
        physicalKrw: phys,
      };
    })
    .filter((item) => item.totalKrw > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  const latestHistory = assetHistory[assetHistory.length - 1];
  const prevHistory = assetHistory.length >= 2 ? assetHistory[assetHistory.length - 2] : null;

  const usdKrwRate =
    toNum(data.usdKrwRate) ||
    toNum(data.integratedSummary?.usdKrwRate) ||
    latestHistory?.exchangeRate ||
    1336.565;

  // 2. Manual Cash Accounts (💰입출금통장: manualCashAccounts or checkingAccounts[0])
  const rawChecking: any[] = Array.isArray(data.checkingAccounts) ? data.checkingAccounts : [];
  const checkingAccounts: NormalizedCheckingAccount[] = rawChecking
    .filter((c) => c && (toNum(c['총합계']) > 0 || String(c['날짜'] || '').trim() !== ''))
    .map((c) => ({
      date: formatDateKST(c['날짜']),
      totalKrw: toNum(c['총합계']),
      hanaBankKrw: toNum(c['주거래 하나 통장'] ?? c['하나은행'] ?? 510640),
      tossBankKrw: toNum(c['토스뱅크 통장'] ?? c['토스뱅크'] ?? 199900),
      miraeCmaKrw: toNum(c['미래에셋 종합_CMA'] ?? c['CMA'] ?? 70),
      heldCashKrw: toNum(c['보유 현금'] ?? c['보유현금'] ?? 36000000),
      giftMoneyKrw: toNum(c['증여금'] ?? 50000000),
      youthGovGrantKrw: toNum(c['청년도약계좌 정부기여금'] ?? c['정부기여금'] ?? 6400000),
    }));

  const latestCheck = checkingAccounts[0] || {
    date: '2026.11.14',
    totalKrw: 93110610,
    hanaBankKrw: 510640,
    tossBankKrw: 199900,
    miraeCmaKrw: 70,
    heldCashKrw: 36000000,
    giftMoneyKrw: 50000000,
    youthGovGrantKrw: 6400000,
  };

  const rawManualCash: any[] = Array.isArray(data.manualCashAccounts) ? data.manualCashAccounts : [];
  let manualCashAccounts: ManualCashAccountItem[] = [];
  let manualCashStatus: DiagnosticModuleStatus['status'] = 'LIVE';

  if (rawManualCash.length > 0) {
    const colors = ['#00E676', '#2979FF', '#9C27B0', '#FFAB00', '#00B0FF', '#1DE9B6'];
    const sumManual = rawManualCash.reduce(
      (s, item) => s + toNum(item['금액'] ?? item['잔액'] ?? item['amountKrw'] ?? item['Amount']),
      0
    );
    manualCashAccounts = rawManualCash.map((item, idx) => {
      const amt = toNum(item['금액'] ?? item['잔액'] ?? item['amountKrw'] ?? item['Amount']);
      const name = String(item['항목명'] ?? item['계좌명'] ?? item['name'] ?? `수동자금 ${idx + 1}`);
      return {
        id: `manual-${idx}`,
        name,
        institution: String(item['금융사'] ?? item['은행'] ?? item['institution'] ?? '수동입력'),
        category: name.includes('증여')
          ? '증여금'
          : name.includes('기여금')
          ? '정부기여금'
          : name.includes('현금')
          ? '보유현금'
          : name.includes('CMA')
          ? 'CMA'
          : '은행통장',
        amountKrw: amt,
        weightOfManualPercent: sumManual > 0 ? (amt / sumManual) * 100 : 0,
        color: colors[idx % colors.length],
        badgeText: String(item['구분'] ?? '수동관리'),
      };
    });
  } else {
    manualCashStatus = rawChecking.length > 0 ? 'LIVE' : 'FALLBACK';
    const rawItems = [
      {
        id: 'mc-gift',
        name: '증여금 (수동 적립)',
        institution: '가족 증여 자산',
        category: '증여금' as const,
        amountKrw: latestCheck.giftMoneyKrw,
        color: '#9C27B0',
        badgeText: '증여자산',
      },
      {
        id: 'mc-cash',
        name: '보유 현금 (안전자산)',
        institution: '직접 보유 현금',
        category: '보유현금' as const,
        amountKrw: latestCheck.heldCashKrw,
        color: '#00E676',
        badgeText: '현금보유',
      },
      {
        id: 'mc-gov',
        name: '청년도약계좌 정부기여금',
        institution: '서민금융진흥원 / 하나',
        category: '정부기여금' as const,
        amountKrw: latestCheck.youthGovGrantKrw,
        color: '#2979FF',
        badgeText: '정부기여',
      },
      {
        id: 'mc-hana',
        name: '주거래 하나 통장',
        institution: '하나은행',
        category: '은행통장' as const,
        amountKrw: latestCheck.hanaBankKrw,
        color: '#00B0FF',
        badgeText: '입출금',
      },
      {
        id: 'mc-toss',
        name: '토스뱅크 통장',
        institution: '토스뱅크',
        category: '은행통장' as const,
        amountKrw: latestCheck.tossBankKrw,
        color: '#1DE9B6',
        badgeText: '파킹통장',
      },
      {
        id: 'mc-cma',
        name: '미래에셋 종합 CMA',
        institution: '미래에셋증권',
        category: 'CMA' as const,
        amountKrw: latestCheck.miraeCmaKrw,
        color: '#FFAB00',
        badgeText: 'CMA',
      },
    ];
    const sumManual = rawItems.reduce((s, i) => s + i.amountKrw, 0) || 1;
    manualCashAccounts = rawItems.map((i) => ({
      ...i,
      weightOfManualPercent: (i.amountKrw / sumManual) * 100,
    }));
  }

  const manualCashTotalKrw = manualCashAccounts.reduce((s, i) => s + i.amountKrw, 0);

  // 3. Physical Assets (🚗실물_기타자산: 현대 디 올뉴코나, 아이폰17프로, 금반지)
  const rawPhysical: any[] = Array.isArray(data.physicalAssets) ? data.physicalAssets : [];
  let physicalAssets: PhysicalAssetItem[] = [];
  let physicalStatus: DiagnosticModuleStatus['status'] = 'LIVE';

  if (rawPhysical.length > 0) {
    const colors = ['#00E676', '#2979FF', '#FFAB00', '#9C27B0'];
    physicalAssets = rawPhysical
      .filter((p) => p && (p['자산명'] || p['품목'] || p['name']))
      .map((p, idx) => {
        const name = String(p['자산명'] ?? p['품목'] ?? p['name'] ?? '').trim();
        const isCar = name.includes('코나') || name.includes('차');
        const isPhone = name.includes('아이폰') || name.includes('프로');
        const isGold = name.includes('금') || name.includes('반지');
        const defaultPurchase = isCar ? 28500000 : isPhone ? 2150000 : isGold ? 750000 : 1000000;
        const val = toNum(p['현재가치'] ?? p['평가금액'] ?? p['금액'] ?? p['currentValueKrw']);
        const purchase =
          toNum(p['취득원가'] ?? p['매입가'] ?? p['취득가'] ?? p['purchasePriceKrw']) ||
          defaultPurchase;
        const annualDepRate =
          toNum(p['연감가율(%)'] ?? p['감가율'] ?? p['annualDepreciationRatePercent']) ||
          (isCar ? 15 : isPhone ? 30 : 0);
        const accumDep =
          toNum(p['감가상각누계액'] ?? p['accumulatedDepreciationKrw']) || purchase - val;
        const residualRatio =
          purchase > 0 ? Math.min(100, Math.max(0, (val / purchase) * 100)) : 100;
        const depRatio = Math.max(0, 100 - residualRatio);

        return {
          id: `phys-${idx}`,
          name,
          category: isCar
            ? '차량/모빌리티'
            : isPhone
            ? 'IT/디지털'
            : isGold
            ? '귀금속/골드'
            : '기타실물',
          purchasePriceKrw: purchase,
          currentValueKrw: val,
          accumulatedDepreciationKrw: accumDep,
          annualDepreciationRatePercent: annualDepRate,
          residualValueRatioPercent: residualRatio,
          depreciationRatioPercent: depRatio,
          acquisitionDate: String(
            p['취득일'] ?? p['구입일'] ?? (isCar ? '2025.03' : isPhone ? '2025.10' : '2024.05')
          ),
          note: String(
            p['비고'] ??
              p['설명'] ??
              (annualDepRate > 0 ? `연 ${annualDepRate}% 정률 감가상각 반영` : '실물 시세 반영')
          ),
          color: colors[idx % colors.length],
        };
      });
  } else {
    physicalStatus = 'DERIVED_SYNC';
    physicalAssets = DEFAULT_PHYSICAL_ASSETS;
  }

  const physicalAssetsTotalKrw = physicalAssets.reduce((s, p) => s + p.currentValueKrw, 0);

  // 4. KIS Activity Feed (💸KIS_배당및체결내역) + Trade & Dividend DBs (📜KIS_매매체결DB, 💸KIS_배당내역DB) + AI Research (🔍관심종목_리서치, 🤖Gemini_주간리포트)
  const rawActivity: any[] = Array.isArray(data.kisActivity) ? data.kisActivity : [];
  let kisActivity: KisActivityItem[] = [];
  let activityStatus: DiagnosticModuleStatus['status'] = 'LIVE';

  if (rawActivity.length > 0) {
    kisActivity = rawActivity
      .filter((a) => a && (a['종목명'] || a['내역'] || a['itemName']))
      .map((a, idx) => {
        const rawType = String(a['구분'] ?? a['유형'] ?? a['type'] ?? '매수체결');
        const type: KisActivityItem['type'] = rawType.includes('배당') || rawType.includes('분배')
          ? '배당입금'
          : rawType.includes('매도')
          ? '매도체결'
          : rawType.includes('환전') || rawType.includes('입금')
          ? '환전/입금'
          : '매수체결';
        const cur = String(a['통화'] ?? a['currency'] ?? 'KRW').toUpperCase() === 'USD' ? 'USD' : 'KRW';
        const amtRaw = toNum(a['금액'] ?? a['체결금액'] ?? a['배당금'] ?? a['amountKrw']);
        return {
          id: `kis-act-${idx}`,
          date: formatDateKST(a['일자'] ?? a['날짜'] ?? a['date']),
          type,
          accountName: String(a['계좌'] ?? a['계좌구분'] ?? a['accountName'] ?? '한투계좌'),
          ticker: String(a['종목코드'] ?? a['티커'] ?? a['ticker'] ?? '-'),
          itemName: String(a['종목명'] ?? a['내역'] ?? a['itemName'] ?? '-'),
          quantity: toNum(a['수량'] ?? a['quantity']) || undefined,
          unitPrice: toNum(a['단가'] ?? a['unitPrice']) || undefined,
          amountKrw: cur === 'USD' ? amtRaw * usdKrwRate : amtRaw,
          amountUsd: cur === 'USD' ? amtRaw : undefined,
          currency: cur,
        };
      });
  } else {
    activityStatus = 'DERIVED_SYNC';
    kisActivity = DEFAULT_KIS_ACTIVITY;
  }

  // 4-B. KIS Trades DB (📜KIS_매매체결DB)
  const rawTrades: any[] = Array.isArray(data.kisTrades) ? data.kisTrades : [];
  let kisTrades: KisTradeItem[] = [];
  if (rawTrades.length > 0) {
    kisTrades = rawTrades
      .filter((t) => t && (t['종목명'] || t['종목코드'] || t['name'] || t['code']))
      .map((t, idx) => {
        const rawSide = String(t['매매구분'] ?? t['구분'] ?? t['tradeType'] ?? '매수');
        const tradeType: '매수' | '매도' = rawSide.includes('매도') || rawSide.toUpperCase().includes('SELL') ? '매도' : '매수';
        const accCat = mapAccountCategory(String(t['계좌구분'] ?? t['계좌'] ?? t['accountCategory'] ?? '위탁계좌'));
        const cur: 'KRW' | 'USD' =
          String(t['통화'] ?? t['currency'] ?? 'KRW').toUpperCase() === 'USD' ||
          String(t['시장구분'] ?? t['시장'] ?? '').toUpperCase().includes('NAS') ||
          String(t['시장구분'] ?? t['시장'] ?? '').toUpperCase().includes('NYS')
            ? 'USD'
            : 'KRW';
        const qty = toNum(t['체결수량'] ?? t['수량'] ?? t['quantity']) || 1;
        const unitOrig = toNum(t['체결단가'] ?? t['단가'] ?? t['unitPriceOriginal'] ?? t['unitPrice']);
        const amtOrig = toNum(t['체결금액'] ?? t['금액'] ?? t['amountOriginal']) || qty * unitOrig;
        const unitKrw = cur === 'USD' ? unitOrig * usdKrwRate : unitOrig;
        const amtKrw = toNum(t['원화환산액'] ?? t['amountKrw']) || (cur === 'USD' ? amtOrig * usdKrwRate : amtOrig);

        return {
          id: String(t['id'] ?? `kis-trd-${idx}`),
          executedAt: String(t['체결일시'] ?? t['일자'] ?? t['날짜'] ?? t['executedAt'] ?? formatDateKST(new Date())),
          accountCategory: accCat,
          tradeType,
          code: String(t['종목코드'] ?? t['티커'] ?? t['code'] ?? '-').trim(),
          name: String(t['종목명'] ?? t['name'] ?? '-').trim(),
          market: String(t['시장구분'] ?? t['시장'] ?? t['market'] ?? (cur === 'USD' ? 'NAS' : 'KRX')).trim(),
          currency: cur,
          quantity: qty,
          unitPriceOriginal: unitOrig,
          unitPriceKrw: unitKrw,
          amountOriginal: amtOrig,
          amountKrw: amtKrw,
          note: String(t['비고'] ?? t['메모'] ?? t['note'] ?? ''),
        };
      });
  } else {
    kisTrades = DEFAULT_KIS_TRADES;
  }

  // 4-C. KIS Dividends DB (💸KIS_배당내역DB)
  const rawDividends: any[] = Array.isArray(data.kisDividends) ? data.kisDividends : [];
  let kisDividends: KisDividendItem[] = [];
  if (rawDividends.length > 0) {
    kisDividends = rawDividends
      .filter((d) => d && (d['종목명'] || d['종목코드'] || d['name'] || d['code']))
      .map((d, idx) => {
        const cur: 'USD' | 'KRW' =
          String(d['통화'] ?? d['currency'] ?? 'USD').toUpperCase() === 'KRW' ? 'KRW' : 'USD';
        const preUsd = toNum(d['세전배당금($)'] ?? d['세전배당금'] ?? d['preTaxUsd']);
        const postUsd = toNum(d['세후배당금($)'] ?? d['세후배당금'] ?? d['postTaxUsd']) || preUsd * 0.85;
        const preKrw =
          toNum(d['세전원화'] ?? d['preTaxKrw']) || (cur === 'USD' ? preUsd * usdKrwRate : preUsd);
        const postKrw =
          toNum(d['원화환산액'] ?? d['세후원화'] ?? d['postTaxKrw']) ||
          (cur === 'USD' ? postUsd * usdKrwRate : postUsd);
        return {
          id: String(d['id'] ?? `kis-div-${idx}`),
          recordDate: formatDateKST(d['배당기준일'] ?? d['지급일'] ?? d['일자'] ?? d['recordDate']),
          accountCategory: mapAccountCategory(String(d['계좌구분'] ?? d['계좌'] ?? d['accountCategory'] ?? '위탁계좌')),
          code: String(d['종목코드'] ?? d['티커'] ?? d['code'] ?? '-').trim(),
          name: String(d['종목명'] ?? d['name'] ?? '-').trim(),
          currency: cur,
          holdingQty: toNum(d['보유수량'] ?? d['수량'] ?? d['holdingQty']) || undefined,
          dividendPerShare: toNum(d['주당배당금'] ?? d['dividendPerShare']) || undefined,
          preTaxUsd: cur === 'USD' ? preUsd : preKrw / usdKrwRate,
          postTaxUsd: cur === 'USD' ? postUsd : postKrw / usdKrwRate,
          preTaxKrw: preKrw,
          postTaxKrw: postKrw,
          taxRatePercent: toNum(d['세율(%)'] ?? d['taxRatePercent'] ?? (cur === 'USD' ? 15.0 : 0)),
        };
      });
  } else {
    kisDividends = DEFAULT_KIS_DIVIDENDS;
  }

  // 4-D. Watchlist Research (🔍관심종목_리서치)
  const rawWatchlist: any[] = Array.isArray(data.watchlistResearch) ? data.watchlistResearch : [];
  let watchlistResearch: WatchlistResearchItem[] = [];
  if (rawWatchlist.length > 0) {
    watchlistResearch = rawWatchlist
      .filter((w) => w && (w['종목명'] || w['티커'] || w['종목코드'] || w['name'] || w['code']))
      .map((w, idx) => {
        const cur: 'USD' | 'KRW' =
          String(w['통화'] ?? w['currency'] ?? 'USD').toUpperCase() === 'KRW' ? 'KRW' : 'USD';
        const curPrice = toNum(w['현재가'] ?? w['currentPrice']);
        const high52 = toNum(w['52주최고가'] ?? w['52주 최고가'] ?? w['high52w']) || curPrice * 1.15;
        const low52 = toNum(w['52주최저가'] ?? w['52주 최저가'] ?? w['low52w']) || curPrice * 0.75;
        const range = Math.max(0.01, high52 - low52);
        const pos52 = Math.min(100, Math.max(0, ((curPrice - low52) / range) * 100));
        const targetBuy = toNum(w['목표매수가'] ?? w['목표가'] ?? w['targetBuyPrice']) || curPrice * 0.95;
        const gapPct =
          toNum(w['목표괴리율(%)'] ?? w['목표괴리율'] ?? w['targetGapPercent']) ||
          (curPrice > 0 ? ((targetBuy - curPrice) / curPrice) * 100 : 0);

        return {
          id: String(w['id'] ?? `wl-${idx}`),
          code: String(w['티커'] ?? w['종목코드'] ?? w['code'] ?? '-').trim(),
          name: String(w['종목명'] ?? w['name'] ?? '-').trim(),
          sector: String(w['섹터'] ?? w['업종'] ?? w['sector'] ?? '핵심 기술주').trim(),
          currency: cur,
          currentPrice: curPrice,
          currentPriceKrw: cur === 'USD' ? curPrice * usdKrwRate : curPrice,
          dailyChangePercent: toNum(w['전일대비(%)'] ?? w['등락률(%)'] ?? w['dailyChangePercent']),
          high52w: high52,
          low52w: low52,
          position52wPercent: pos52,
          targetBuyPrice: targetBuy,
          targetGapPercent: gapPct,
          aiSummary: String(
            w['Gemini AI 분석 요약'] ??
              w['AI분석요약'] ??
              w['분석요약'] ??
              w['aiSummary'] ??
              '실적 모멘텀 및 밸류에이션 매력도 기반 분할 매수 유효 구간.'
          ).trim(),
          aiSignal:
            Math.abs(gapPct) <= 3.5
              ? '적극매수권'
              : gapPct < -3.5
              ? '분할매수'
              : '추세추종',
        };
      });
  } else {
    watchlistResearch = DEFAULT_WATCHLIST_RESEARCH;
  }

  // 4-E. Gemini Weekly Reports (🤖Gemini_주간리포트)
  const rawReports: any[] = Array.isArray(data.geminiWeeklyReports) ? data.geminiWeeklyReports : [];
  let geminiWeeklyReports: GeminiWeeklyReportItem[] = [];
  if (rawReports.length > 0) {
    geminiWeeklyReports = rawReports
      .filter((r) => r && (r['기준일자'] || r['보고주차'] || r['reportDate'] || r['reportWeek']))
      .map((r, idx) => ({
        id: String(r['id'] ?? `rep-${idx}`),
        reportDate: formatDateKST(r['기준일자'] ?? r['날짜'] ?? r['reportDate']),
        reportWeek: String(r['보고주차'] ?? r['주차'] ?? r['reportWeek'] ?? `주간 리포트 #${idx + 1}`),
        weeklyNetWorthChangeKrw: toNum(r['주간순자산증감액'] ?? r['순자산증감액'] ?? r['weeklyNetWorthChangeKrw']),
        weeklyReturnPercent: toNum(r['주간수익률(%)'] ?? r['수익률(%)'] ?? r['weeklyReturnPercent']),
        headline: String(
          r['핵심헤드라인'] ??
            r['요약제목'] ??
            r['headline'] ??
            '주간 포트폴리오 성과 점검 및 AI 자산배분 리포트'
        ),
        marketMacroSummary: String(
          r['시장매크로요약'] ?? r['시장·매크로 요약'] ?? r['marketMacroSummary'] ?? '-'
        ),
        holdingsIssues: String(
          r['보유종목핵심이슈'] ?? r['보유종목 핵심 이슈'] ?? r['holdingsIssues'] ?? '-'
        ),
        watchlistTopPicks: String(
          r['관심종목TOP픽'] ?? r['관심종목 TOP 픽'] ?? r['watchlistTopPicks'] ?? '-'
        ),
        rebalancingActionPlan: String(
          r['AI리밸런싱액션제안'] ?? r['AI 리밸런싱 액션 제안'] ?? r['rebalancingActionPlan'] ?? '-'
        ),
      }));
  } else {
    geminiWeeklyReports = DEFAULT_GEMINI_WEEKLY_REPORTS;
  }

  // 4-F. SaveTicker News DB (📰SaveTicker_뉴스스크랩DB) & AI Bullish/Bearish TOP 5
  const rawSaveTicker: any[] = Array.isArray(data.saveTickerNews) ? data.saveTickerNews : [];
  let saveTickerNews: SaveTickerNewsItem[] = [];
  if (rawSaveTicker.length > 0) {
    saveTickerNews = rawSaveTicker
      .filter((n) => n && (n['제목'] || n['뉴스제목'] || n['title'] || n['티커'] || n['ticker']))
      .map((n, idx) => {
        const rawSent = String(n['감성'] ?? n['감성분류'] ?? n['sentiment'] ?? '긍정');
        const score = toNum(n['감성스코어'] ?? n['감성점수'] ?? n['sentimentScore'] ?? 80);
        const sentiment: '긍정' | '부정' | '중립' =
          rawSent.includes('부정') || rawSent.includes('주의') || score < -10
            ? '부정'
            : rawSent.includes('중립') || (score >= -10 && score <= 10)
            ? '중립'
            : '긍정';
        return {
          id: String(n['id'] ?? `st-news-${idx}`),
          publishedAt: String(
            n['수집일시'] ?? n['발행일시'] ?? n['일자'] ?? n['publishedAt'] ?? formatDateKST(new Date())
          ),
          ticker: String(n['티커'] ?? n['종목코드'] ?? n['ticker'] ?? '-').trim(),
          stockName: String(n['종목명'] ?? n['stockName'] ?? '-').trim(),
          title: String(n['제목'] ?? n['뉴스제목'] ?? n['title'] ?? '-').trim(),
          summary: String(n['요약'] ?? n['핵심요약'] ?? n['summary'] ?? '-').trim(),
          sentiment,
          sentimentScore: score,
          source: String(n['출처'] ?? n['언론사'] ?? n['source'] ?? 'SaveTicker').trim(),
          url: String(n['원문링크'] ?? n['링크'] ?? n['url'] ?? 'https://www.saveticker.com').trim(),
        };
      });
  } else {
    saveTickerNews = DEFAULT_SAVETICKER_NEWS;
  }

  const bullishTop5: SentimentPickItem[] =
    Array.isArray(data.bullishTop5) && data.bullishTop5.length > 0
      ? data.bullishTop5
      : DEFAULT_BULLISH_TOP5;
  const bearishTop5: SentimentPickItem[] =
    Array.isArray(data.bearishTop5) && data.bearishTop5.length > 0
      ? data.bearishTop5
      : DEFAULT_BEARISH_TOP5;

  // 5. Bonds
  const rawBonds: any[] = Array.isArray(data.bonds) ? data.bonds : [];
  const bonds: NormalizedBondItem[] = rawBonds
    .filter((b) => b && String(b['채권명'] || '').trim() !== '')
    .map((b) => ({
      name: String(b['채권명'] || '').trim(),
      description: String(b['설명'] || '').trim(),
      joinDate: formatDateKST(b['가입일']),
      endDate: formatDateKST(b['종료일']),
      monthlyPaymentKrw: toNum(b['월 납입금액']),
      totalPaidKrw: toNum(b['총 납입액']),
    }));

  // 6. Holdings (kisRealtime + manualStocks/stockDetail) & Cash Deposits (CASH_*)
  const holdings: NormalizedHoldingItem[] = [];
  const cashDeposits: CashDepositItem[] = [];

  const rawKis: any[] =
    Array.isArray(data.kisRealtime) && data.kisRealtime.length > 0
      ? data.kisRealtime
      : INITIAL_FALLBACK_RAW.kisRealtime;
  const rawManualStocksSource: any[] =
    Array.isArray(data.manualStocks) && data.manualStocks.length > 0
      ? data.manualStocks
      : Array.isArray(data.stockDetail) && data.stockDetail.length > 0
      ? data.stockDetail
      : INITIAL_FALLBACK_RAW.stockDetail;
  const rawStocks = rawManualStocksSource;

  let kisCount = 0;
  let usdDepositUsd = 0;
  let usdDepositKrw = 0;

  rawKis.forEach((item, idx) => {
    const code = String(item['종목코드'] ?? item['코드'] ?? '').trim();
    const name = String(item['종목명'] || '').trim();
    const marketRaw = String(item['시장구분'] || 'KRX').trim();

    if (!name && !code) return;

    // Separate CASH_ deposit rows from equity holdings table
    if (code.toUpperCase().startsWith('CASH_') || marketRaw.includes('예수금')) {
      if (name.includes('조회오류')) return;

      const isUsd =
        code.toUpperCase().includes('USD') ||
        marketRaw.toUpperCase().includes('USD') ||
        name.includes('달러') ||
        name.includes('$');

      const rawVal = toNum(item['예수금'] ?? item['평가금액'] ?? item['현재가']);
      const amountKrw = isUsd ? rawVal * usdKrwRate : rawVal;

      if (isUsd) {
        usdDepositUsd += rawVal;
        usdDepositKrw += amountKrw;
      }

      let accLabel = '위탁계좌';
      let color = '#00E676';
      if (marketRaw.includes('ISA')) {
        accLabel = 'ISA중개형';
        color = '#2979FF';
      } else if (marketRaw.includes('연금저축')) {
        accLabel = '연금저축';
        color = '#9C27B0';
      } else if (marketRaw.includes('IRP') || marketRaw.includes('퇴직연금')) {
        accLabel = '퇴직연금(IRP)';
        color = '#00B0FF';
      }

      cashDeposits.push({
        id: `cash-${code || idx}`,
        accountName: accLabel,
        code,
        name: name.replace(/\s+/g, ' '),
        currency: isUsd ? 'USD' : 'KRW',
        amountOriginal: rawVal,
        amountKrw,
        color,
      });
      return;
    }

    const qty = toNum(item['보유수량'] ?? item['보유량']);
    if (qty <= 0 && toNum(item['평가금액']) <= 0) return;

    kisCount++;
    const accountCategory = mapAccountCategory(marketRaw);
    const avgPrice = toNum(item['매입평균가'] ?? item['매수평단가']);
    const curPrice = toNum(item['현재가']);
    const evalAmt = toNum(item['평가금액'] ?? item['평가총액']) || qty * curPrice;
    const buyAmt = qty * avgPrice;
    const profit =
      item['평가손익'] !== undefined && item['평가손익'] !== ''
        ? toNum(item['평가손익'])
        : evalAmt - buyAmt;

    const rawRate = toNum(item['수익률(%)']);
    const retRate =
      rawRate !== 0
        ? rawRate
        : profit !== 0 && buyAmt > 0
        ? (profit / buyAmt) * 100
        : 0;

    const underlyingAssetClass = classifyUnderlyingAsset(
      item['실질자산분류'],
      name,
      code,
      'KIS',
      marketRaw
    );
    const listedMarketClass =
      name.includes('국채') || name.includes('채권')
        ? '국내상장 채권ETF'
        : '국내상장 주식ETF';

    holdings.push({
      id: `kis-${accountCategory}-${code}-${idx}`,
      source: 'KIS',
      accountCategory,
      market: marketRaw,
      code: code || '-',
      name: name || code,
      quantity: qty,
      avgPriceKrw: avgPrice,
      currentPriceKrw: curPrice,
      evalAmountKrw: evalAmt,
      profitKrw: profit,
      returnRate: retRate,
      underlyingAssetClass,
      listedMarketClass,
    });
  });

  let usCount = 0;
  rawStocks.forEach((item, idx) => {
    const name = String(item['종목명'] || '').trim();
    const code = String(item['코드'] || item['종목코드'] || '').trim();
    const qty = toNum(item['매수정보 보유량'] ?? item['보유량'] ?? item['보유수량']);
    if (!name && !code) return;
    if (qty <= 0) return;

    usCount++;
    const market = String(item['종목정보 시장'] ?? item['시장구분'] ?? item['시장'] ?? 'NAS').trim();
    const accountCategory: Exclude<AccountFilterType, '전체'> = item['계좌']
      ? mapAccountCategory(String(item['계좌']))
      : '토스증권';

    const avgPriceUsd = toNum(item['매수평단가']) || 427.1;
    const avgPriceKrw = toNum(item['매수평단가(원)']) || avgPriceUsd * usdKrwRate;
    const buyTotalKrw = toNum(item['매수총액(원)']) || qty * avgPriceKrw;
    const evalTotalKrw = toNum(item['평가총액(원)']) || qty * avgPriceUsd * usdKrwRate;
    const profitKrw =
      item['원화수익'] !== undefined && item['원화수익'] !== ''
        ? toNum(item['원화수익'])
        : evalTotalKrw - buyTotalKrw;

    const currentPriceKrw = qty > 0 ? evalTotalKrw / qty : avgPriceKrw;
    const currentPriceUsd = usdKrwRate > 0 ? currentPriceKrw / usdKrwRate : avgPriceUsd;
    const evalAmountUsd = usdKrwRate > 0 ? evalTotalKrw / usdKrwRate : qty * currentPriceUsd;
    const returnRate = buyTotalKrw > 0 ? (profitKrw / buyTotalKrw) * 100 : 0;
    const dailyReturnRate =
      item['일간수익'] !== undefined && item['일간수익'] !== '' ? toNum(item['일간수익']) : undefined;

    const underlyingAssetClass = classifyUnderlyingAsset(
      item['실질자산분류'],
      name,
      code,
      'US_STOCK',
      market
    );

    holdings.push({
      id: `stock-${code || idx}`,
      source: 'US_STOCK',
      accountCategory,
      market,
      code: code || '-',
      name: name || code,
      quantity: qty,
      avgPriceKrw,
      avgPriceUsd,
      currentPriceKrw,
      currentPriceUsd,
      evalAmountKrw: evalTotalKrw,
      evalAmountUsd,
      profitKrw,
      returnRate,
      dailyReturnRate,
      underlyingAssetClass,
      listedMarketClass: '미국 직투 주식',
    });
  });

  const kisCashTotalKrw = cashDeposits.reduce((acc, c) => acc + c.amountKrw, 0);
  const totalCashDepositsKrw = kisCashTotalKrw + manualCashTotalKrw;

  const holdingsEvalSum = holdings.reduce((acc, h) => acc + h.evalAmountKrw, 0);
  const holdingsBuySum = holdings.reduce((acc, h) => acc + (h.evalAmountKrw - h.profitKrw), 0);
  const totalStockProfitKrw = holdings.reduce((acc, h) => acc + h.profitKrw, 0);

  // 7. Summary & IntegratedSummary (Financial Net Worth vs Total Net Worth with Physical)
  const rawSummary = data.summary || {};
  const rawSavingsSummary = toNum(rawSummary['예적금']);
  // Guard against #DIV/0! in Google Sheet savings cell dropping 예적금 below 5,000,000 KRW
  const bankSavingsKrw =
    rawSavingsSummary >= 5000000
      ? rawSavingsSummary
      : INITIAL_FALLBACK_RAW.summary.예적금;
  const cashAssetKrw = Math.max(toNum(rawSummary['현금']), totalCashDepositsKrw);
  const totalStockEvalKrw = holdingsEvalSum > 0 ? holdingsEvalSum : toNum(rawSummary['주식']);
  const totalStockBuyKrw = holdingsBuySum > 0 ? holdingsBuySum : totalStockEvalKrw - totalStockProfitKrw;
  const totalStockReturnRate =
    totalStockBuyKrw > 0 ? (totalStockProfitKrw / totalStockBuyKrw) * 100 : 0;

  const kisBondEtfsKrw = holdings
    .filter((h) => h.source === 'KIS' && (h.name.includes('국채') || h.name.includes('채권')))
    .reduce((acc, h) => acc + h.evalAmountKrw, 0);

  const domesticEtfKrw = holdings
    .filter((h) => h.source === 'KIS' && !h.name.includes('국채') && !h.name.includes('채권'))
    .reduce((acc, h) => acc + h.evalAmountKrw, 0);

  const overseasStockKrw = holdings
    .filter((h) => h.source === 'US_STOCK')
    .reduce((acc, h) => acc + h.evalAmountKrw, 0);

  const rawFinTotal = toNum(rawSummary['금융자산합계'] ?? rawSummary['합계']);
  const computedFinTotal =
    cashAssetKrw + bankSavingsKrw + domesticEtfKrw + overseasStockKrw + kisBondEtfsKrw;
  const financialTotalKrw = Math.max(rawFinTotal, computedFinTotal);

  const overseasBondKrw =
    toNum(rawSummary['채권']) > 0
      ? toNum(rawSummary['채권'])
      : Math.max(
          kisBondEtfsKrw,
          financialTotalKrw - (cashAssetKrw + bankSavingsKrw + domesticEtfKrw + overseasStockKrw)
        );

  // Underlying Exposure Basis (기초자산 실질 기준)
  const underlyingOverseasStockKrw = holdings
    .filter((h) => h.underlyingAssetClass === '해외주식')
    .reduce((acc, h) => acc + h.evalAmountKrw, 0);

  const underlyingDomesticStockKrw = holdings
    .filter((h) => h.underlyingAssetClass === '국내주식')
    .reduce((acc, h) => acc + h.evalAmountKrw, 0);

  const underlyingDomesticBondKrw = holdings
    .filter((h) => h.underlyingAssetClass === '국내채권')
    .reduce((acc, h) => acc + h.evalAmountKrw, 0);

  const underlyingKisOverseasBondKrw = holdings
    .filter((h) => h.underlyingAssetClass === '해외채권')
    .reduce((acc, h) => acc + h.evalAmountKrw, 0);

  const directUsBondKrw = Math.max(0, overseasBondKrw - kisBondEtfsKrw);
  const underlyingOverseasBondKrw = underlyingKisOverseasBondKrw + directUsBondKrw;

  const grandTotalKrw = financialTotalKrw + physicalAssetsTotalKrw;

  const summary: NormalizedSummary = {
    baseDate: formatDateKST(rawSummary['기준일'] || data.updatedAt),
    financialTotalKrw,
    physicalTotalKrw: physicalAssetsTotalKrw,
    grandTotalKrw,
    totalKrw: grandTotalKrw,
    cashKrw: cashAssetKrw,
    savingsKrw: bankSavingsKrw,
    stockKrw: domesticEtfKrw + overseasStockKrw,
    bondKrw: overseasBondKrw,
  };

  // Update latest assetHistory point with full Financial & Physical net worth
  if (assetHistory.length > 0) {
    const last = assetHistory[assetHistory.length - 1];
    assetHistory[assetHistory.length - 1] = {
      ...last,
      exchangeRate: usdKrwRate,
      totalKrw: financialTotalKrw,
      totalWithPhysicalKrw: grandTotalKrw,
      savingsKrw: bankSavingsKrw,
      cashKrw: cashAssetKrw,
      bondKrw: overseasBondKrw,
      stockKrw: domesticEtfKrw + overseasStockKrw,
      physicalKrw: physicalAssetsTotalKrw,
    };
  }

  const prevTotal = prevHistory?.totalKrw || financialTotalKrw;
  const momChangeKrw = financialTotalKrw - prevTotal;
  const momChangePercent = prevTotal > 0 ? (momChangeKrw / prevTotal) * 100 : 0;

  const integratedSummary: IntegratedSummary = {
    totalNetWorthKrw: financialTotalKrw,
    grandTotalWithPhysicalKrw: grandTotalKrw,
    physicalAssetsKrw: physicalAssetsTotalKrw,
    manualCashTotalKrw,
    kisCashTotalKrw,
    cashAssetKrw,
    bankSavingsKrw,
    domesticEtfKrw,
    overseasStockKrw,
    overseasBondKrw,
    underlyingOverseasStockKrw,
    underlyingOverseasBondKrw,
    underlyingDomesticStockKrw,
    underlyingDomesticBondKrw,
    usdDepositUsd,
    usdDepositKrw,
    usdKrwRate,
  };

  // 8. Account Breakdown (for Stacked Progress Bar)
  const calcAccountStats = (accType: Exclude<AccountFilterType, '전체'>) => {
    const accHoldings = holdings.filter((h) => h.accountCategory === accType);
    const evalAmt = accHoldings.reduce((s, h) => s + h.evalAmountKrw, 0);
    const profitAmt = accHoldings.reduce((s, h) => s + h.profitKrw, 0);
    const buyAmt = evalAmt - profitAmt;
    const cashAmt = cashDeposits
      .filter((c) => c.accountName === accType)
      .reduce((s, c) => s + c.amountKrw, 0);
    const totalAmt = evalAmt + cashAmt;
    const ret = buyAmt > 0 ? (profitAmt / buyAmt) * 100 : 0;
    return { evalAmt, cashAmt, totalAmt, profitAmt, ret };
  };

  const witakStats = calcAccountStats('위탁계좌');
  const pensionStats = calcAccountStats('연금저축');
  const irpStats = calcAccountStats('퇴직연금(IRP)');
  const tossStats = calcAccountStats('토스증권');
  const isaStats = calcAccountStats('ISA중개형');

  const accountBreakdown: AccountBreakdownItem[] = [
    {
      accountName: '수동 현금·증여·기여금',
      category: '증여 5천만 · 현금 3,600만 · 기여금 640만 · 은행',
      evalAmountKrw: 0,
      cashAmountKrw: manualCashTotalKrw,
      totalAmountKrw: manualCashTotalKrw,
      weightPercent: grandTotalKrw > 0 ? (manualCashTotalKrw / grandTotalKrw) * 100 : 0,
      profitKrw: 0,
      returnRate: 0,
      color: '#00E676',
      isManual: true,
    },
    {
      accountName: '은행 예적금',
      category: '하나 청년도약 · 신한 적금 · 청약',
      evalAmountKrw: bankSavingsKrw,
      cashAmountKrw: 0,
      totalAmountKrw: bankSavingsKrw,
      weightPercent: grandTotalKrw > 0 ? (bankSavingsKrw / grandTotalKrw) * 100 : 0,
      profitKrw: 0,
      returnRate: 4.85,
      color: '#2979FF',
      isManual: true,
    },
    {
      accountName: '한투 위탁계좌',
      category: `달러예수금 $${usdDepositUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      evalAmountKrw: witakStats.evalAmt,
      cashAmountKrw: witakStats.cashAmt,
      totalAmountKrw: witakStats.totalAmt,
      weightPercent: grandTotalKrw > 0 ? (witakStats.totalAmt / grandTotalKrw) * 100 : 0,
      profitKrw: witakStats.profitAmt,
      returnRate: witakStats.ret,
      color: '#00B0FF',
    },
    {
      accountName: '실물 · 기타자산',
      category: '올뉴코나 · 아이폰17Pro · 금반지',
      evalAmountKrw: physicalAssetsTotalKrw,
      cashAmountKrw: 0,
      totalAmountKrw: physicalAssetsTotalKrw,
      weightPercent: grandTotalKrw > 0 ? (physicalAssetsTotalKrw / grandTotalKrw) * 100 : 0,
      profitKrw: 0,
      returnRate: 0,
      color: '#FFAB00',
      isManual: true,
    },
    {
      accountName: '연금저축 (한투)',
      category: '국내상장 미국ETF 3종',
      evalAmountKrw: pensionStats.evalAmt,
      cashAmountKrw: pensionStats.cashAmt,
      totalAmountKrw: pensionStats.totalAmt,
      weightPercent: grandTotalKrw > 0 ? (pensionStats.totalAmt / grandTotalKrw) * 100 : 0,
      profitKrw: pensionStats.profitAmt,
      returnRate: pensionStats.ret,
      color: '#9C27B0',
    },
    {
      accountName: '퇴직연금(IRP)',
      category: '나스닥·S&P500·배당 8종',
      evalAmountKrw: irpStats.evalAmt,
      cashAmountKrw: irpStats.cashAmt,
      totalAmountKrw: irpStats.totalAmt,
      weightPercent: grandTotalKrw > 0 ? (irpStats.totalAmt / grandTotalKrw) * 100 : 0,
      profitKrw: irpStats.profitAmt,
      returnRate: irpStats.ret,
      color: '#1DE9B6',
    },
    {
      accountName: '토스 · ISA 계좌',
      category: 'MSFT 직투 & ISA 국채ETF',
      evalAmountKrw: tossStats.evalAmt + isaStats.evalAmt,
      cashAmountKrw: tossStats.cashAmt + isaStats.cashAmt,
      totalAmountKrw: tossStats.totalAmt + isaStats.totalAmt,
      weightPercent:
        grandTotalKrw > 0 ? ((tossStats.totalAmt + isaStats.totalAmt) / grandTotalKrw) * 100 : 0,
      profitKrw: tossStats.profitAmt + isaStats.profitAmt,
      returnRate: tossStats.ret,
      color: '#FF5252',
    },
  ].filter((a) => a.totalAmountKrw > 0);

  // 9. Rebalancing Plan (5 Financial Asset Classes based on Financial Net Worth)
  const rawRebal: any[] = Array.isArray(data.rebalancingPlan) ? data.rebalancingPlan : [];
  let rebalancingPlan: RebalancingItem[] = [];

  if (rawRebal.length > 0) {
    const colors = ['#2979FF', '#00E676', '#9C27B0', '#FFAB00', '#00B0FF'];
    rebalancingPlan = rawRebal.map((r, i) => {
      const curAmt = toNum(r['현재금액'] ?? r['currentAmount'] ?? r['평가금액']);
      const curWeight =
        toNum(r['현재비중'] ?? r['currentWeight']) ||
        (financialTotalKrw > 0 ? (curAmt / financialTotalKrw) * 100 : 0);
      const targetWeight = toNum(r['목표비중'] ?? r['targetWeight']) || 20;
      return {
        id: `rebal-${i}`,
        assetClass: String(r['자산군'] ?? r['assetClass'] ?? `자산군 ${i + 1}`),
        description: String(r['설명'] ?? r['description'] ?? ''),
        currentAmountKrw: curAmt,
        currentWeightPercent: curWeight,
        targetWeightPercent: targetWeight,
        color: colors[i % colors.length],
      };
    });
  } else {
    rebalancingPlan = [
      {
        id: 'rebal-cash',
        assetClass: '현금성 자산',
        description: '보유현금 3.6천만 · 증여 5천만 · 기여금 640만 · 달러예수금 $20,312.48',
        currentAmountKrw: cashAssetKrw,
        currentWeightPercent: financialTotalKrw > 0 ? (cashAssetKrw / financialTotalKrw) * 100 : 0,
        targetWeightPercent: 30,
        color: '#2979FF',
      },
      {
        id: 'rebal-savings',
        assetClass: '은행 예적금',
        description: '하나 청년도약계좌 · 신한 적금 · 전세반환 저축',
        currentAmountKrw: bankSavingsKrw,
        currentWeightPercent: financialTotalKrw > 0 ? (bankSavingsKrw / financialTotalKrw) * 100 : 0,
        targetWeightPercent: 25,
        color: '#00E676',
      },
      {
        id: 'rebal-kr-etf',
        assetClass: '국내상장 해외ETF',
        description: '연금저축 · IRP · ISA 미국 S&P500 / 나스닥100 / 배당 / TDF',
        currentAmountKrw: domesticEtfKrw,
        currentWeightPercent: financialTotalKrw > 0 ? (domesticEtfKrw / financialTotalKrw) * 100 : 0,
        targetWeightPercent: 25,
        color: '#9C27B0',
      },
      {
        id: 'rebal-us-stock',
        assetClass: '해외직투 주식',
        description: '토스증권 미국 개별주 (마이크로소프트 MSFT)',
        currentAmountKrw: overseasStockKrw,
        currentWeightPercent: financialTotalKrw > 0 ? (overseasStockKrw / financialTotalKrw) * 100 : 0,
        targetWeightPercent: 12,
        color: '#FFAB00',
      },
      {
        id: 'rebal-bond',
        assetClass: '해외 채권',
        description: '미국 30년 국채 액티브 ETF (ISA · IRP) 및 미국장기채',
        currentAmountKrw: overseasBondKrw,
        currentWeightPercent: financialTotalKrw > 0 ? (overseasBondKrw / financialTotalKrw) * 100 : 0,
        targetWeightPercent: 8,
        color: '#00B0FF',
      },
    ];
  }

  // 9-B. Rebalancing Plan based on Underlying Exposure (기초자산 실질 기준 - 권장)
  const rebalancingPlanUnderlying: RebalancingItem[] = [
    {
      id: 'rebal-und-cash',
      assetClass: '현금성 자산',
      description: '보유현금 3.6천만 · 증여 5천만 · 기여금 640만 · 달러예수금 $20,312.48',
      currentAmountKrw: cashAssetKrw,
      currentWeightPercent: financialTotalKrw > 0 ? (cashAssetKrw / financialTotalKrw) * 100 : 0,
      targetWeightPercent: 28,
      color: '#2979FF',
    },
    {
      id: 'rebal-und-savings',
      assetClass: '은행 예적금',
      description: '하나 청년도약계좌(연 4.5% 비과세) · 신한 적금 · 전세반환 저축',
      currentAmountKrw: bankSavingsKrw,
      currentWeightPercent: financialTotalKrw > 0 ? (bankSavingsKrw / financialTotalKrw) * 100 : 0,
      targetWeightPercent: 24,
      color: '#00E676',
    },
    {
      id: 'rebal-und-overseas-stock',
      assetClass: '해외주식 (실질 합산)',
      description:
        '연금·IRP 미국지수/배당 ETF(KODEX/TIGER 나스닥100·S&P500·배당다우) + 토스 직투(MSFT)',
      currentAmountKrw: underlyingOverseasStockKrw,
      currentWeightPercent:
        financialTotalKrw > 0 ? (underlyingOverseasStockKrw / financialTotalKrw) * 100 : 0,
      targetWeightPercent: 35,
      color: '#9C27B0',
    },
    {
      id: 'rebal-und-overseas-bond',
      assetClass: '해외채권 (실질 합산)',
      description: 'ISA·IRP ACE 미국30년국채액티브(H) + 미래에셋 미국장기채(T1.125)',
      currentAmountKrw: underlyingOverseasBondKrw,
      currentWeightPercent:
        financialTotalKrw > 0 ? (underlyingOverseasBondKrw / financialTotalKrw) * 100 : 0,
      targetWeightPercent: 10,
      color: '#00B0FF',
    },
    {
      id: 'rebal-und-kr-asset',
      assetClass: '국내채권 · 혼합형',
      description: 'IRP KODEX 코리아배당성장채권혼합 및 국내 안전자산',
      currentAmountKrw: underlyingDomesticBondKrw + underlyingDomesticStockKrw,
      currentWeightPercent:
        financialTotalKrw > 0
          ? ((underlyingDomesticBondKrw + underlyingDomesticStockKrw) / financialTotalKrw) * 100
          : 0,
      targetWeightPercent: 3,
      color: '#FFAB00',
    },
  ];

  // 10. Savings & Nearest Maturity (with #DIV/0! payout recovery)
  const rawSavings: any[] =
    Array.isArray(data.savings) && data.savings.length > 0
      ? data.savings
      : INITIAL_FALLBACK_RAW.savings;
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const savings: NormalizedSavingsItem[] = rawSavings
    .filter((row) => row && (row['은행'] || row['구분']))
    .map((row, idx) => {
      const bankName = String(row['은행'] || '-').trim();
      const catName = String(row['구분'] || '예적금').trim();
      const fbSav = INITIAL_FALLBACK_RAW.savings.find(
        (fs) => String(fs['은행']).trim() === bankName && String(fs['구분']).trim() === catName
      );

      const joinRaw = String(row['가입일'] || fbSav?.['가입일'] || '');
      const matRaw = String(row['만기일'] || fbSav?.['만기일'] || '');
      const joinDateObj = new Date(joinRaw);
      const matDateObj = new Date(matRaw);
      const matTs = isNaN(matDateObj.getTime()) ? 0 : matDateObj.getTime();
      const joinTs = isNaN(joinDateObj.getTime()) ? 0 : joinDateObj.getTime();

      const dDay = matTs > 0 ? Math.ceil((matTs - todayMidnight) / (1000 * 60 * 60 * 24)) : 0;
      const rawRate = toNum(row['이율']);
      const interestRatePercent = rawRate > 0 && rawRate < 1 ? rawRate * 100 : rawRate;
      const periodMonths = toNum(row['기간']) || toNum(fbSav?.['기간']);
      const monthlyAmount = toNum(row['금액']) || toNum(fbSav?.['금액']);
      const isTaxFree = String(row['비과세'] || '').trim().toUpperCase() === 'O';

      let progressPercent = 0;
      if (matTs > joinTs && joinTs > 0) {
        progressPercent = Math.min(
          100,
          Math.max(0, ((todayMidnight - joinTs) / (matTs - joinTs)) * 100)
        );
      }

      const principalTotal = monthlyAmount * periodMonths;
      const estInterest =
        principalTotal * (interestRatePercent / 100) * ((periodMonths + 1) / 24);
      const calcPreTax = principalTotal + estInterest;
      const calcPostTax = isTaxFree ? calcPreTax : principalTotal + estInterest * (1 - 0.154);

      const preTaxPayoutKrw =
        toNum(row['만기수령액(세전)']) ||
        toNum(fbSav?.['만기수령액(세전)']) ||
        calcPreTax;
      const postTaxPayoutKrw =
        toNum(row['만기수령액(세후)'] ?? row['만기수령액(세전)']) ||
        toNum(fbSav?.['만기수령액(세후)']) ||
        calcPostTax;

      return {
        id: String(row['ID'] || `sav-${idx}`),
        category: catName,
        bank: bankName,
        joinDate: formatDateKST(joinRaw),
        maturityDate: formatDateKST(matRaw),
        rawMaturityDate: matRaw,
        maturityTimestamp: matTs,
        dDay,
        interestRatePercent,
        periodMonths,
        monthlyAmount,
        isTaxFree,
        currency: String(row['통화'] || 'KRW').trim(),
        preTaxPayoutKrw,
        postTaxPayoutKrw,
        progressPercent,
      };
    })
    .sort((a, b) => a.maturityTimestamp - b.maturityTimestamp);

  const upcomingSavings = savings.filter((s) => s.dDay >= 0 && s.maturityTimestamp > 0);
  const nearestMaturitySavings =
    upcomingSavings.length > 0 ? upcomingSavings[0] : savings[0] || null;

  // 11. Monthly Cashflow & Savings Distribution (with empty array fallback)
  const rawCashflow: any[] =
    Array.isArray(data.monthlyCashflow) && data.monthlyCashflow.length > 0
      ? data.monthlyCashflow
      : INITIAL_FALLBACK_RAW.monthlyCashflow;
  let balanceKrw = 0;
  let savingsFlowKrw = 0;
  let expenseKrw = 0;

  rawCashflow.forEach((row) => {
    const cat = String(row['Category'] || row['구분'] || '').trim();
    const amt = toNum(row['Amount'] ?? row['금액']);
    if (cat.includes('잔액')) balanceKrw += amt;
    else if (cat.includes('저축')) savingsFlowKrw += amt;
    else if (cat.includes('지출')) expenseKrw += amt;
  });

  const totalIncomeKrw = balanceKrw + savingsFlowKrw + expenseKrw;
  const surplusKrw = savingsFlowKrw + balanceKrw;
  const savingsRatePercent = totalIncomeKrw > 0 ? (surplusKrw / totalIncomeKrw) * 100 : 0;
  const pureSavingsRatePercent = totalIncomeKrw > 0 ? (savingsFlowKrw / totalIncomeKrw) * 100 : 0;

  const cashflow: NormalizedCashflow = {
    balanceKrw,
    savingsKrw: savingsFlowKrw,
    expenseKrw,
    totalIncomeKrw,
    surplusKrw,
    savingsRatePercent,
    pureSavingsRatePercent,
  };

  const rawDist: any[] =
    Array.isArray(data.monthlySavingsDist) && data.monthlySavingsDist.length > 0
      ? data.monthlySavingsDist
      : INITIAL_FALLBACK_RAW.monthlySavingsDist;
  const palette = ['#00E676', '#2979FF', '#9C27B0', '#00B0FF', '#651FFF', '#1DE9B6'];
  const savingsDist: SavingsDistItem[] = [];

  rawDist.forEach((row, idx) => {
    if (!row || typeof row !== 'object') return;
    const labelKey = Object.keys(row).find(
      (k) => k.includes('저축 분류') || k.includes('저축 분야') || k.includes('분류')
    );
    const label = labelKey ? String(row[labelKey] || '').trim() : '';

    if (label) {
      let val = toNum(row[label]);
      if (val === 0) {
        for (const [k, v] of Object.entries(row)) {
          if (k !== labelKey && v !== '' && toNum(v) > 0) {
            val = toNum(v);
            break;
          }
        }
      }

      const shortName = label
        .replace(' (28년 8월 만기)', '')
        .replace(' 상환 저축액', '')
        .replace(' & 연금 저축', '/연금');

      savingsDist.push({
        name: label,
        shortName,
        amount: val,
        category: '저축/투자',
        color: palette[idx % palette.length],
        percentOfIncome: totalIncomeKrw > 0 ? (val / totalIncomeKrw) * 100 : 0,
      });
    }
  });

  savingsDist.sort((a, b) => b.amount - a.amount);

  const combinedCashflowBars: SavingsDistItem[] = [
    ...savingsDist.filter((d) => d.amount > 0),
    {
      name: '월 생활비/지출',
      shortName: '지출 (소비)',
      amount: expenseKrw,
      category: '지출',
      color: '#FF5252',
      percentOfIncome: totalIncomeKrw > 0 ? (expenseKrw / totalIncomeKrw) * 100 : 0,
    },
    {
      name: '월 잉여 잔액',
      shortName: '잉여 잔액',
      amount: balanceKrw,
      category: '잉여잔액',
      color: '#2979FF',
      percentOfIncome: totalIncomeKrw > 0 ? (balanceKrw / totalIncomeKrw) * 100 : 0,
    },
  ];

  // 12. System Diagnostics & Self-Verification Report
  const modules: DiagnosticModuleStatus[] = [
    {
      key: 'manualCashAccounts',
      label: '수동 입출금·현금·증여',
      sheetName: '💰입출금통장',
      status: manualCashStatus,
      recordCount: manualCashAccounts.length,
      summaryText: '하나·토스·CMA·현금(3,600만)·증여(5,000만)·기여금(640만)',
    },
    {
      key: 'physicalAssets',
      label: '실물 · 기타자산',
      sheetName: '🚗실물_기타자산',
      status: physicalStatus,
      recordCount: physicalAssets.length,
      summaryText: '현대 디 올뉴코나 · 아이폰17프로 · 순금반지 (2,632만)',
    },
    {
      key: 'kisRealtime',
      label: '한투 실시간 잔고',
      sheetName: '💾KIS_실시간잔고',
      status: rawKis.length > 0 ? 'LIVE' : 'FALLBACK',
      recordCount: holdings.length + cashDeposits.length,
      summaryText: `달러예수금 $${usdDepositUsd.toLocaleString('en-US')} 및 ETF·주식 ${holdings.length}종`,
    },
    {
      key: 'kisActivity',
      label: '매매체결 · 배당 DB',
      sheetName: '📜KIS_매매체결DB · 💸배당DB',
      status: rawTrades.length > 0 || rawDividends.length > 0 ? 'LIVE' : activityStatus,
      recordCount: kisTrades.length + kisDividends.length,
      summaryText: `매매체결 ${kisTrades.length}건 · 배당내역 ${kisDividends.length}건 연동`,
    },
    {
      key: 'aiResearch',
      label: 'AI 리서치 · 뉴스 · 리포트',
      sheetName: '📰SaveTicker · 🤖Gemini리포트',
      status:
        rawWatchlist.length > 0 || rawReports.length > 0 || rawSaveTicker.length > 0
          ? 'LIVE'
          : 'DERIVED_SYNC',
      recordCount:
        watchlistResearch.length + geminiWeeklyReports.length + saveTickerNews.length,
      summaryText: `SaveTicker 뉴스 ${saveTickerNews.length}건 · 관심종목 ${watchlistResearch.length}종 · 주간리포트 ${geminiWeeklyReports.length}건`,
    },
    {
      key: 'integratedAnalysis',
      label: '포트폴리오 통합분석',
      sheetName: '🎯포트폴리오_통합분석',
      status: data.integratedSummary ? 'LIVE' : 'DERIVED_SYNC',
      recordCount: accountBreakdown.length + rebalancingPlan.length,
      summaryText: `계좌비중 ${accountBreakdown.length}개 · 리밸런싱 ${rebalancingPlan.length}개 자산군`,
    },
  ];

  const totalRecordCount =
    modules.reduce((s, m) => s + m.recordCount, 0) +
    assetHistory.length +
    savings.length;

  const diagnostics: SystemDiagnostics = {
    apiLive: isLiveApi,
    totalRecordCount,
    lastSyncedAt: formatTimeKST(data.updatedAt || new Date()),
    modules,
  };

  return {
    updatedAt: String(data.updatedAt || new Date().toISOString()),
    usdKrwRate,
    summary,
    integratedSummary,
    diagnostics,
    manualCashAccounts,
    manualCashTotalKrw,
    physicalAssets,
    physicalAssetsTotalKrw,
    kisActivity,
    kisTrades,
    kisDividends,
    watchlistResearch,
    geminiWeeklyReports,
    saveTickerNews,
    bullishTop5,
    bearishTop5,
    accountBreakdown,
    rebalancingPlan,
    rebalancingPlanUnderlying,
    cashDeposits,
    totalCashDepositsKrw: kisCashTotalKrw,
    assetHistory,
    holdings,
    kisHoldingsCount: kisCount,
    usStockHoldingsCount: usCount,
    totalStockEvalKrw,
    totalStockBuyKrw,
    totalStockProfitKrw,
    totalStockReturnRate,
    momChangeKrw,
    momChangePercent,
    savings,
    nearestMaturitySavings,
    cashflow,
    savingsDist,
    combinedCashflowBars,
    bonds,
    checkingAccounts,
  };
}
