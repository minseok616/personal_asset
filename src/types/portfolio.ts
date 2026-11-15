export type TabType =
  | 'dashboard'
  | 'portfolio'
  | 'trades'
  | 'rebalancing'
  | 'research'
  | 'cashflow'
  | 'savings';

export type PeriodFilter = '3M' | '6M' | '1Y' | 'ALL';

export type CurrencyCode = 'KRW' | 'USD';

export type NetWorthViewMode = 'TOTAL_WITH_PHYSICAL' | 'FINANCIAL_ONLY';

export type ExposureViewMode = 'UNDERLYING' | 'LISTED_MARKET';

export type UnderlyingAssetClass =
  | '해외주식'
  | '해외채권'
  | '국내주식'
  | '국내채권'
  | '현금성 자산';

export type AccountFilterType =
  | '전체'
  | '위탁계좌'
  | 'ISA중개형'
  | '연금저축'
  | '퇴직연금(IRP)'
  | '토스증권';

export interface NormalizedSummary {
  baseDate: string;
  financialTotalKrw: number; // 금융 순자산 (투자·현금·적금)
  physicalTotalKrw: number; // 실물·기타 자산 (현대 디 올뉴코나, 아이폰17프로, 금반지)
  grandTotalKrw: number; // 총 순자산 (실물 포함)
  totalKrw: number; // default active net worth
  cashKrw: number;
  savingsKrw: number;
  stockKrw: number;
  bondKrw: number;
}

export interface ManualCashAccountItem {
  id: string;
  name: string;
  institution: string;
  category: '은행통장' | 'CMA' | '보유현금' | '증여금' | '정부기여금';
  amountKrw: number;
  weightOfManualPercent: number;
  color: string;
  badgeText: string;
}

export interface PhysicalAssetItem {
  id: string;
  name: string;
  category: '차량/모빌리티' | 'IT/디지털' | '귀금속/골드' | '기타실물';
  purchasePriceKrw: number; // 취득원가
  currentValueKrw: number; // 현재추정가치
  accumulatedDepreciationKrw: number; // 감가상각누계액 (취득원가 - 현재추정가치, 시세상승 시 음수)
  annualDepreciationRatePercent: number; // 연 감가율 (예: 코나 15%, 아이폰17Pro 30%)
  residualValueRatioPercent: number; // 취득원가 대비 잔존가치율 (%)
  depreciationRatioPercent: number; // 취득원가 대비 감가율 (%)
  acquisitionDate?: string; // 취득시기
  note: string;
  color: string;
}

export interface SaveTickerNewsItem {
  id: string;
  publishedAt: string; // 수집/발행 일시
  ticker: string; // 종목코드/티커
  stockName: string; // 종목명
  title: string; // 뉴스 헤드라인
  summary: string; // 1주간 뉴스 기반 핵심 요약
  sentiment: '긍정' | '부정' | '중립';
  sentimentScore: number; // 감성 스코어 (-100 ~ +100)
  source: string; // 출처 (SaveTicker, Reuters, Bloomberg 등)
  url: string; // 원문 링크
}

export interface SentimentPickItem {
  id: string;
  rank: number; // 1 ~ 5
  ticker: string;
  stockName: string;
  sentiment: 'BULLISH' | 'BEARISH';
  sentimentScore: number; // 예: +94, -82
  weeklyChangePercent: number;
  newsCount: number;
  rationale: string; // 1주간 뉴스 기반 핵심 근거
  catalysts: string[]; // 핵심 키워드 배지
  inPortfolio?: boolean; // 현재 보유 종목 여부
}

export interface KisActivityItem {
  id: string;
  date: string;
  type: '배당입금' | '매수체결' | '매도체결' | '환전/입금';
  accountName: string;
  ticker: string;
  itemName: string;
  quantity?: number;
  unitPrice?: number;
  amountKrw: number;
  amountUsd?: number;
  currency: 'KRW' | 'USD';
}

export interface KisTradeItem {
  id: string;
  executedAt: string; // 체결일시
  accountCategory: Exclude<AccountFilterType, '전체'>; // 계좌구분 배지
  tradeType: '매수' | '매도'; // 매수(#00E676) / 매도(#FF5252)
  code: string; // 종목코드/티커
  name: string; // 종목명
  market: string; // KRX / NAS / NYS
  currency: 'KRW' | 'USD';
  quantity: number; // 수량
  unitPriceOriginal: number; // 체결단가 (원통화)
  unitPriceKrw: number; // 체결단가 (원화환산)
  amountOriginal: number; // 체결금액 (원통화)
  amountKrw: number; // 원화환산액
  note?: string;
}

export interface KisDividendItem {
  id: string;
  recordDate: string; // 배당 기준일 / 지급일
  accountCategory: Exclude<AccountFilterType, '전체'>;
  code: string; // 티커/종목코드
  name: string; // 종목명
  currency: 'USD' | 'KRW';
  holdingQty?: number; // 보유수량
  dividendPerShare?: number; // 주당배당금
  preTaxUsd: number; // 세전 달러 배당금
  postTaxUsd: number; // 세후 달러 배당금
  preTaxKrw: number; // 세전 원화 환산액
  postTaxKrw: number; // 세후 원화 환산액
  taxRatePercent: number; // 세율(%)
}

export interface WatchlistResearchItem {
  id: string;
  code: string; // 티커/종목코드
  name: string; // 종목명
  sector: string; // 섹터
  currency: 'USD' | 'KRW';
  currentPrice: number; // 현재가
  currentPriceKrw: number; // 원화환산 현재가
  dailyChangePercent: number; // 전일대비(%)
  high52w: number; // 52주 최고가
  low52w: number; // 52주 최저가
  position52wPercent: number; // 52주 최고/최저가 대비 현재 위치 (0~100%)
  targetBuyPrice: number; // 목표매수가
  targetGapPercent: number; // 목표괴리율(%)
  aiSummary: string; // Gemini AI 분석 요약 코멘트
  aiSignal: '적극매수권' | '분할매수' | '관망대기' | '추세추종';
}

export interface GeminiWeeklyReportItem {
  id: string;
  reportDate: string; // 기준일자
  reportWeek: string; // 보고주차 (예: 2026년 11월 2주차)
  weeklyNetWorthChangeKrw: number; // 주간 순자산 증감액
  weeklyReturnPercent: number; // 주간 수익률(%)
  headline: string; // 한줄 핵심 헤드라인
  marketMacroSummary: string; // 🌐 시장·매크로 요약
  holdingsIssues: string; // 💼 보유종목 핵심 이슈
  watchlistTopPicks: string; // 🔍 관심종목 TOP 픽
  rebalancingActionPlan: string; // 🎯 AI 리밸런싱 액션 제안
}

export interface DiagnosticModuleStatus {
  key: string;
  label: string;
  sheetName: string;
  status: 'LIVE' | 'DERIVED_SYNC' | 'FALLBACK';
  recordCount: number;
  summaryText: string;
}

export interface SystemDiagnostics {
  apiLive: boolean;
  totalRecordCount: number;
  lastSyncedAt: string;
  modules: DiagnosticModuleStatus[];
}

export interface IntegratedSummary {
  totalNetWorthKrw: number; // 금융 순자산
  grandTotalWithPhysicalKrw: number; // 총 순자산 (실물 포함)
  physicalAssetsKrw: number; // 실물자산 합계
  manualCashTotalKrw: number; // 수동 입출금/현금/증여/기여금 합계
  kisCashTotalKrw: number; // 한투 실시간 예수금 합계
  cashAssetKrw: number; // 전체 현금성 자산 (수동 현금 + 한투 예수금)
  bankSavingsKrw: number;
  // Listed Market Basis (상장시장 기준)
  domesticEtfKrw: number;
  overseasStockKrw: number;
  overseasBondKrw: number;
  // Underlying Exposure Basis (기초자산 실질 기준 - 권장)
  underlyingOverseasStockKrw: number; // KRX 상장 미국/해외주식 ETF + 미국 직투 주식
  underlyingOverseasBondKrw: number; // KRX 상장 미국국채 ETF + 해외 직접 채권 (T1.125)
  underlyingDomesticStockKrw: number; // 실질 국내주식
  underlyingDomesticBondKrw: number; // 실질 국내채권/채권혼합 (KODEX 코리아배당성장채권혼합 등)
  usdDepositUsd: number;
  usdDepositKrw: number;
  usdKrwRate: number;
}

export interface AccountBreakdownItem {
  accountName: string;
  category: string;
  evalAmountKrw: number;
  cashAmountKrw: number;
  totalAmountKrw: number;
  weightPercent: number;
  profitKrw: number;
  returnRate: number;
  color: string;
  isManual?: boolean;
}

export interface RebalancingItem {
  id: string;
  assetClass: string;
  description: string;
  currentAmountKrw: number;
  currentWeightPercent: number;
  targetWeightPercent: number;
  color: string;
}

export interface CashDepositItem {
  id: string;
  accountName: string;
  code: string;
  name: string;
  currency: 'KRW' | 'USD';
  amountOriginal: number;
  amountKrw: number;
  color: string;
}

export interface NormalizedHistoryItem {
  rawDate: string;
  dateLabel: string;
  shortDate: string;
  timestamp: number;
  exchangeRate: number;
  totalKrw: number;
  totalWithPhysicalKrw: number;
  savingsKrw: number;
  cashKrw: number;
  bondKrw: number;
  stockKrw: number;
  physicalKrw: number;
}

export interface NormalizedHoldingItem {
  id: string;
  source: 'KIS' | 'US_STOCK';
  accountCategory: Exclude<AccountFilterType, '전체'>;
  market: string;
  code: string;
  name: string;
  quantity: number;
  avgPriceKrw: number;
  avgPriceUsd?: number;
  currentPriceKrw: number;
  currentPriceUsd?: number;
  evalAmountKrw: number;
  evalAmountUsd?: number;
  profitKrw: number;
  returnRate: number;
  dailyReturnRate?: number;
  underlyingAssetClass: UnderlyingAssetClass; // 실질자산분류 (해외주식, 해외채권, 국내채권, 국내주식)
  listedMarketClass: string; // 상장시장 기준 분류 (국내상장 ETF / 미국 직투 등)
}

export interface NormalizedSavingsItem {
  id: string;
  category: string;
  bank: string;
  joinDate: string;
  maturityDate: string;
  rawMaturityDate: string;
  maturityTimestamp: number;
  dDay: number;
  interestRatePercent: number;
  periodMonths: number;
  monthlyAmount: number;
  isTaxFree: boolean;
  currency: string;
  preTaxPayoutKrw: number;
  postTaxPayoutKrw: number;
  progressPercent: number;
}

export interface NormalizedCashflow {
  balanceKrw: number;
  savingsKrw: number;
  expenseKrw: number;
  totalIncomeKrw: number;
  surplusKrw: number;
  savingsRatePercent: number;
  pureSavingsRatePercent: number;
}

export interface SavingsDistItem {
  name: string;
  shortName: string;
  amount: number;
  category: '저축/투자' | '지출' | '잉여잔액';
  color: string;
  percentOfIncome: number;
}

export interface NormalizedBondItem {
  name: string;
  description: string;
  joinDate: string;
  endDate: string;
  monthlyPaymentKrw: number;
  totalPaidKrw: number;
}

export interface NormalizedCheckingAccount {
  date: string;
  totalKrw: number;
  hanaBankKrw: number;
  tossBankKrw: number;
  miraeCmaKrw: number;
  heldCashKrw: number;
  giftMoneyKrw: number;
  youthGovGrantKrw: number;
}

export interface PortfolioData {
  updatedAt: string;
  usdKrwRate: number;
  summary: NormalizedSummary;
  integratedSummary: IntegratedSummary;
  diagnostics: SystemDiagnostics;
  manualCashAccounts: ManualCashAccountItem[];
  manualCashTotalKrw: number;
  physicalAssets: PhysicalAssetItem[];
  physicalAssetsTotalKrw: number;
  kisActivity: KisActivityItem[];
  kisTrades: KisTradeItem[];
  kisDividends: KisDividendItem[];
  watchlistResearch: WatchlistResearchItem[];
  geminiWeeklyReports: GeminiWeeklyReportItem[];
  saveTickerNews: SaveTickerNewsItem[];
  bullishTop5: SentimentPickItem[];
  bearishTop5: SentimentPickItem[];
  accountBreakdown: AccountBreakdownItem[];
  rebalancingPlan: RebalancingItem[];
  rebalancingPlanUnderlying: RebalancingItem[];
  cashDeposits: CashDepositItem[];
  totalCashDepositsKrw: number;
  assetHistory: NormalizedHistoryItem[];
  holdings: NormalizedHoldingItem[];
  kisHoldingsCount: number;
  usStockHoldingsCount: number;
  totalStockEvalKrw: number;
  totalStockBuyKrw: number;
  totalStockProfitKrw: number;
  totalStockReturnRate: number;
  momChangeKrw: number;
  momChangePercent: number;
  savings: NormalizedSavingsItem[];
  nearestMaturitySavings: NormalizedSavingsItem | null;
  cashflow: NormalizedCashflow;
  savingsDist: SavingsDistItem[];
  combinedCashflowBars: SavingsDistItem[];
  bonds: NormalizedBondItem[];
  checkingAccounts: NormalizedCheckingAccount[];
}
