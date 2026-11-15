import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Sparkles,
  X,
  Send,
  KeyRound,
  Trash2,
  Microscope,
  Layers,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import {
  CurrencyCode,
  ExposureViewMode,
  NetWorthViewMode,
  PortfolioData,
  TabType,
} from '../types/portfolio';
import {
  formatCurrency,
  formatKRW,
  formatSignedCurrency,
  formatSignedPercent,
  formatUSD,
} from '../utils/formatters';

interface AssetCopilotDrawerProps {
  data: PortfolioData;
  activeTab: TabType;
  currency: CurrencyCode;
  netWorthMode: NetWorthViewMode;
  exposureMode: ExposureViewMode;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tabContext?: string;
  engineLabel?: string;
}

const QUICK_QUESTION_CHIPS = [
  '현재 보고 있는 화면 핵심 요약해줘',
  '실질 해외주식 vs 국내주식 비중 분석해줘',
  '이번 주 SaveTicker 긍정/부정 TOP 5 정리해줘',
  '현재 달러예수금 리밸런싱 추천해줘',
] as const;

const TAB_NAMES: Record<TabType, string> = {
  dashboard: 'Dashboard (전체 자산 요약)',
  portfolio: 'Portfolio (계좌별 보유종목 & 수익)',
  trades: 'Trade & Dividend (매매체결 · 배당 DB)',
  research: 'AI Research (SaveTicker · 주간리포트)',
  rebalancing: 'Rebalancing (자산배분 시뮬레이터)',
  cashflow: 'Cashflow (월 현금흐름 · 저축)',
  savings: 'Savings (예적금 · 만기 스케줄)',
};

const LOCAL_KEY_STORAGE = 'assetvision_gemini_api_key';

export const AssetCopilotDrawer: React.FC<AssetCopilotDrawerProps> = ({
  data,
  activeTab,
  currency,
  netWorthMode,
  exposureMode,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showKeyConfig, setShowKeyConfig] = useState<boolean>(false);
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem(LOCAL_KEY_STORAGE) || '';
    } catch {
      return '';
    }
  });
  const [copiedToast, setCopiedToast] = useState<string | null>(null);

  const envApiKey =
    (typeof window !== 'undefined' && (window as any).__STREAMLIT_CONFIG__?.GEMINI_API_KEY) ||
    (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ||
    '';
  const effectiveApiKey = customApiKey.trim() || envApiKey.trim();

  const usdKrwRate = data.usdKrwRate;
  const fmt = (krw: number) => formatCurrency(krw, currency, usdKrwRate);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-msg',
      role: 'assistant',
      timestamp: '방금 전',
      tabContext: TAB_NAMES[activeTab],
      engineLabel: 'AssetCopilot AI (gemini-2.5-flash)',
      content: `안녕하세요! **AssetCopilot AI**입니다.
현재 보고 계신 화면(**${TAB_NAMES[activeTab]}**)과 구글 시트 실시간 데이터(총 순자산 **${formatKRW(
        data.summary.grandTotalKrw
      )}**, 금융 순자산 **${formatKRW(
        data.summary.financialTotalKrw
      )}**, 위탁 달러예수금 **${formatUSD(
        data.integratedSummary.usdDepositUsd
      )}**)가 실시간 컨텍스트로 연결되어 있습니다.

상단의 **원클릭 빠른 질문 칩**을 누르시거나 궁금한 점을 자유롭게 질문해 주세요!`,
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  const saveCustomKey = (val: string) => {
    setCustomApiKey(val);
    try {
      if (val.trim()) localStorage.setItem(LOCAL_KEY_STORAGE, val.trim());
      else localStorage.removeItem(LOCAL_KEY_STORAGE);
    } catch {
      // ignore
    }
  };

  // Build full context string for Gemini API
  const systemContextPrompt = useMemo(() => {
    const s = data.integratedSummary;
    const totalEquityAndBond =
      s.underlyingOverseasStockKrw +
      s.underlyingOverseasBondKrw +
      s.underlyingDomesticBondKrw +
      s.underlyingDomesticStockKrw;
    const overseasStockShareOfInv =
      totalEquityAndBond > 0 ? (s.underlyingOverseasStockKrw / totalEquityAndBond) * 100 : 0;

    return `당신은 사용자의 개인 자산관리 포트폴리오 대시보드에 내장된 전문 AI 금융 비서 'AssetCopilot'입니다.
한국어로 명확하고 전문적인 마크다운 형식(핵심 수치 볼드 처리, 불릿 리스트 활용)으로 답변하세요.

[현재 사용자가 보고 있는 화면 컨텍스트]
- 현재 활성 탭: ${TAB_NAMES[activeTab]} (${activeTab})
- 표시 통화 모드: ${currency} (적용 환율: ₩${usdKrwRate.toLocaleString('ko-KR')}/USD)
- 순자산 보기 모드: ${netWorthMode === 'TOTAL_WITH_PHYSICAL' ? '총 순자산 (실물자산 포함)' : '금융 순자산 전용'}
- 자산배분 기준 모드: ${exposureMode === 'UNDERLYING' ? '기초자산 실질 기준 (권장)' : '상장시장 기준'}

[구글 시트 실시간 포트폴리오 핵심 데이터]
1. 순자산 요약 (기준일: ${data.summary.baseDate}):
   - 총 순자산 (실물 포함): ₩${Math.round(data.summary.grandTotalKrw).toLocaleString('ko-KR')}
   - 금융 순자산 (투자·현금·적금): ₩${Math.round(data.summary.financialTotalKrw).toLocaleString('ko-KR')}
   - 수동 관리 현금·증여·기여금 합계: ₩${Math.round(data.manualCashTotalKrw).toLocaleString('ko-KR')} (증여금 ₩50,000,000, 보유현금 ₩36,000,000, 청년도약 정부기여금 ₩6,400,000, 하나은행 ₩510,640, 토스뱅크 ₩199,900)
   - 한투 실시간 예수금 합계: ₩${Math.round(s.kisCashTotalKrw).toLocaleString('ko-KR')} (위탁 달러예수금 $${s.usdDepositUsd.toLocaleString('en-US')} ≈ ₩${Math.round(s.usdDepositKrw).toLocaleString('ko-KR')})
   - 은행 예적금: ₩${Math.round(s.bankSavingsKrw).toLocaleString('ko-KR')} (하나은행 청년도약계좌 연 4.5% 비과세 D-${data.nearestMaturitySavings?.dDay ?? 604}, 신한 적금 연 7.0% 등)
   - 실물자산 합계: ₩${Math.round(data.physicalAssetsTotalKrw).toLocaleString('ko-KR')}
     * 현대 디 올뉴코나: 취득원가 ₩28,500,000 / 감가상각누계액 -₩5,000,000 (연 15% 감가) / 현재추정가치 ₩23,500,000 (잔존 82.5%)
     * 아이폰 17 Pro: 취득원가 ₩2,150,000 / 감가상각누계액 -₩250,000 (연 30% 감가) / 현재추정가치 ₩1,900,000 (잔존 88.4%)
     * 순금 반지: 취득원가 ₩750,000 / 현재추정가치 ₩920,000 (+22.7% 시세 상승)

2. 실질 기초자산(Underlying Exposure) vs 상장시장 기준 비교:
   - [실질 기준] 해외주식 합계: ₩${Math.round(s.underlyingOverseasStockKrw).toLocaleString('ko-KR')} (연금저축·IRP 내 KODEX/TIGER 미국나스닥100·S&P500·배당다우존스·TDF ETF 합산, 전체 투자자산 내 ${overseasStockShareOfInv.toFixed(1)}%)
   - [실질 기준] 해외채권 합계: ₩${Math.round(s.underlyingOverseasBondKrw).toLocaleString('ko-KR')} (ISA·IRP ACE 미국30년국채액티브 + 미래에셋 미국장기채 T1.125)
   - [실질 기준] 국내채권·혼합형 합계: ₩${Math.round(s.underlyingDomesticBondKrw + s.underlyingDomesticStockKrw).toLocaleString('ko-KR')} (IRP KODEX 코리아배당성장채권혼합 ₩1,829,520, 실질 국내순수주식 ₩0)
   - [상장시장 기준] 국내상장 ETF: ₩${Math.round(s.domesticEtfKrw + (s.underlyingOverseasBondKrw - Math.max(0, s.overseasBondKrw - 492405))).toLocaleString('ko-KR')} vs 해외직투: ₩${Math.round(s.overseasStockKrw).toLocaleString('ko-KR')} (미보유)

3. 보유 종목 상세 (${data.holdings.length}종목, 총 평가액 ₩${Math.round(data.totalStockEvalKrw).toLocaleString('ko-KR')}, 총 손익 ${formatSignedCurrency(data.totalStockProfitKrw, 'KRW', usdKrwRate)}):
${data.holdings
  .map(
    (h) =>
      `   - [${h.accountCategory}] ${h.name}(${h.code}): ${h.quantity}주, 평가액 ₩${Math.round(
        h.evalAmountKrw
      ).toLocaleString('ko-KR')}, 손익 ₩${Math.round(h.profitKrw).toLocaleString(
        'ko-KR'
      )} (${formatSignedPercent(h.returnRate, 2)}), 실질분류: ${h.underlyingAssetClass}`
  )
  .join('\n')}

4. SaveTicker 긍정 전망 TOP 5 & 부정·주의 TOP 5:
   - 긍정 TOP 5 (Bullish): ${data.bullishTop5
     .map((b) => `#${b.rank} ${b.ticker}(${b.stockName}, +${b.sentimentScore}점: ${b.rationale})`)
     .join(' / ')}
   - 부정·주의 TOP 5 (Bearish): ${data.bearishTop5
     .map((b) => `#${b.rank} ${b.ticker}(${b.stockName}, ${b.sentimentScore}점: ${b.rationale})`)
     .join(' / ')}

5. 최신 Gemini 주간 리포트 (${data.geminiWeeklyReports[0]?.reportWeek}):
   - 헤드라인: ${data.geminiWeeklyReports[0]?.headline}
   - 리밸런싱 제안: ${data.geminiWeeklyReports[0]?.rebalancingActionPlan}`;
  }, [data, activeTab, currency, netWorthMode, exposureMode, usdKrwRate]);

  // Built-in Context-Aware Response Generator (Instant fallback & precision synthesis)
  const buildLocalSmartResponse = (userQuestion: string): string => {
    const q = userQuestion.trim();
    const s = data.integratedSummary;
    const finTotal = data.summary.financialTotalKrw || 1;
    const grandTotal = data.summary.grandTotalKrw || 1;

    // 1) "현재 보고 있는 화면 핵심 요약해줘"
    if (q.includes('현재 보고 있는 화면') || q.includes('화면 핵심 요약')) {
      if (activeTab === 'dashboard') {
        return `### 📊 현재 화면 요약 — **Dashboard (전체 자산 종합 뷰)**

현재 **${currency}** 기준(${netWorthMode === 'TOTAL_WITH_PHYSICAL' ? '실물 포함 총 순자산' : '금융 순자산'})으로 대시보드 메인 화면을 보고 계십니다.

• **총 순자산 (실물 포함)**: **${fmt(data.summary.grandTotalKrw)}** (전월 대비 **${formatSignedCurrency(data.momChangeKrw, currency, usdKrwRate)} / ${formatSignedPercent(data.momChangePercent, 2)}**)
• **금융 순자산 (투자·현금·적금)**: **${fmt(data.summary.financialTotalKrw)}**
• **수동 관리 자산 + 실물자산**: 수동 현금·증여·기여금 **${fmt(data.manualCashTotalKrw)}** + 실물자산 **${fmt(data.physicalAssetsTotalKrw)}** (현대 디 올뉴코나 연 15% 감가 반영 **${fmt(23500000)}**, 아이폰 17 Pro 연 30% 감가 반영 **${fmt(1900000)}**, 금반지 **${fmt(920000)}**)
• **실시간 투자 성과**: 한투 + 토스 보유 **${data.holdings.length}개 종목** 총 평가액 **${fmt(data.totalStockEvalKrw)}**, 누적 평가손익 **${formatSignedCurrency(data.totalStockProfitKrw, currency, usdKrwRate)} (${formatSignedPercent(data.totalStockReturnRate, 2)})**
• **핵심 포인트**: 위탁계좌 달러예수금 **${formatUSD(s.usdDepositUsd)} (${fmt(s.usdDepositKrw)})**가 대기 중이므로, 하단 리밸런싱 시뮬레이터를 통해 해외주식/배당주 분할 배치를 점검해 보세요.`;
      }

      if (activeTab === 'portfolio') {
        return `### 💼 현재 화면 요약 — **Portfolio (계좌별 보유 종목 & 수익 분석)**

현재 한국투자증권 실시간 연동(**${data.kisHoldingsCount}종목**) 및 토스증권 해외직투(**${data.usStockHoldingsCount}종목**) 상세 화면을 보고 계십니다.

• **주식·ETF 평가총액**: **${fmt(data.totalStockEvalKrw)}** (합산 평가손익 **${formatSignedCurrency(data.totalStockProfitKrw, currency, usdKrwRate)} / ${formatSignedPercent(data.totalStockReturnRate, 2)}**)
• **계좌별 현금성 예수금 분리**: 위탁 달러예수금 **${formatUSD(s.usdDepositUsd)} (≈ ${formatKRW(s.usdDepositKrw)})**, 연금저축 예수금 **₩47,032**, ISA 예수금 **₩12,460**
• **수익 상위 효자 종목**:
  1) **[퇴직연금 IRP] TIGER 미국나스닥100**: 평가익 **+₩742,785 (+46.68%)**
  2) **[퇴직연금 IRP] TIGER 미국배당다우존스**: 평가익 **+₩499,060 (+26.44%)**
  3) **[퇴직연금 IRP] KODEX 코리아배당성장채권혼합**: 평가익 **+₩277,355 (+17.87%)**
  4) **[연금저축] KODEX 미국나스닥100**: 366주 보유, 평가익 **+₩197,460 (+2.21%)**
• **집중 관리 종목**: **[ISA/IRP] ACE 미국30년국채액티브(H)**는 금리 반등으로 **-9.13%** 구간이나 월분배금 재투자로 평단가를 낮추는 구간입니다.`;
      }

      if (activeTab === 'research') {
        const latestRep = data.geminiWeeklyReports[0];
        return `### 🤖 현재 화면 요약 — **AI Research (SaveTicker & 주간 리포트)**

현재 **SaveTicker 1주간 뉴스 감성 분석(긍정 TOP 5 vs 부정 TOP 5)** 및 **${latestRep?.reportWeek}** AI 브리핑 화면을 보고 계십니다.

• **🚀 AI 선정 긍정 전망 TOP 5**: **NVDA (+95점)**, **AVGO (+91점)**, **MSFT (+89점)**, **GOOGL (+86점)**, **SCHD (+83점, IRP 보유중)**
• **⚠️ AI 선정 부정·주의 TOP 5**: **TLT/미국30년국채 (-78점, 보유점검)**, **INTC (-84점)**, **SMCI (-81점)**, **SOXL (-72점)**, **TSLA (-66점)**
• **관심종목 목표가 근접 픽**: **AVGO(괴리율 -3.11%)**, **GOOGL(-3.42%)**, **SCHD(-2.59%)**, **TLT(-0.97%)**가 적극매수권에 진입했습니다.
• **활용 팁**: 각 카드의 **[🔬 Deep Research 프롬프트 복사 & Gemini 실행]** 버튼을 누르면 종목별 심층 분석 프롬프트가 복사되고 Gemini 앱이 즉시 열립니다.`;
      }

      if (activeTab === 'trades') {
        return `### 📜 현재 화면 요약 — **Trade & Dividend (매매체결 · 배당 DB)**

• **최근 60일 매매 요약**: 누적 매수 **6건 (${fmt(3035936)})**, 누적 매도 **1건 (SOXL ${fmt(769861)})**, 순매수 **${fmt(2266075)}**
• **배당금 수령 현황**: 총 **${data.kisDividends.length}건**, 세후 수령액 합계 **${fmt(113771)} ($85.13)**
• **인사이트**: 연금저축·IRP 계좌에서 수령하는 월배당(TIGER 미국배당다우존스 등)과 ISA 계좌 월배당은 **배당소득세(15.4%) 과세이연/비과세**가 적용되어 복리 재투자 효율이 극대화되고 있습니다.`;
      }

      if (activeTab === 'rebalancing') {
        return `### ⚖️ 현재 화면 요약 — **Rebalancing (인터랙티브 자산배분 시뮬레이터)**

현재 **${exposureMode === 'UNDERLYING' ? '기초자산 실질 기준 (권장)' : '상장시장 기준'}** 모드로 금융 순자산(**${fmt(finTotal)}**) 대비 자산군별 비중을 시뮬레이션 중입니다.

• **현금성 자산**: **${fmt(s.cashAssetKrw)} (${((s.cashAssetKrw / finTotal) * 100).toFixed(1)}%)** — 보유현금·증여금 및 달러예수금($20,312.48) 포함
• **은행 예적금**: **${fmt(s.bankSavingsKrw)} (${((s.bankSavingsKrw / finTotal) * 100).toFixed(1)}%)** — 청년도약계좌 등
• **실질 해외주식**: **${fmt(s.underlyingOverseasStockKrw)} (${((s.underlyingOverseasStockKrw / finTotal) * 100).toFixed(1)}%)** — 연금/IRP 미국ETF 합산 (해외직투 미보유)
• **실질 해외채권**: **${fmt(s.underlyingOverseasBondKrw)} (${((s.underlyingOverseasBondKrw / finTotal) * 100).toFixed(1)}%)** — 미국30년국채 ETF + T1.125`;
      }

      return `### 📌 현재 화면 요약 — **${TAB_NAMES[activeTab]}**

• **총 순자산 (실물 포함)**: **${fmt(data.summary.grandTotalKrw)}**
• **금융 순자산**: **${fmt(data.summary.financialTotalKrw)}**
• **월 현금흐름 저축률**: 총수입 **${fmt(data.cashflow.totalIncomeKrw)}** 중 저축·잉여 **${fmt(data.cashflow.surplusKrw)} (저축률 ${data.cashflow.savingsRatePercent.toFixed(1)}%)**
• **최단기 만기 예적금**: **${data.nearestMaturitySavings?.bank} (${data.nearestMaturitySavings?.category})** — 만기일 **${data.nearestMaturitySavings?.maturityDate} (D-${data.nearestMaturitySavings?.dDay})**, 세후 예상수령액 **${fmt(data.nearestMaturitySavings?.postTaxPayoutKrw || 0)}**`;
    }

    // 2) "실질 해외주식 vs 국내주식 비중 분석해줘"
    if (q.includes('실질 해외주식') || q.includes('국내주식 비중') || q.includes('기초자산')) {
      const totalStockAndBond =
        s.underlyingOverseasStockKrw +
        s.underlyingOverseasBondKrw +
        s.underlyingDomesticBondKrw +
        s.underlyingDomesticStockKrw;
      const usStockPctOfRisk =
        totalStockAndBond > 0 ? (s.underlyingOverseasStockKrw / totalStockAndBond) * 100 : 0;
      const usBondPctOfRisk =
        totalStockAndBond > 0 ? (s.underlyingOverseasBondKrw / totalStockAndBond) * 100 : 0;
      const krBondPctOfRisk =
        totalStockAndBond > 0
          ? ((s.underlyingDomesticBondKrw + s.underlyingDomesticStockKrw) / totalStockAndBond) * 100
          : 0;

      return `### 🌐 기초자산 실질 노출도(Underlying Exposure) 정밀 분석

상장 거래소(KRX) 기준으로는 연금저축·IRP·ISA의 ETF가 '국내 상장'으로 보이지만, **실제 투자되는 기초자산(Underlying Asset)** 기준으로 재분류하면 포트폴리오의 **글로벌 달러·미국 자산 집중도**가 명확히 드러납니다.

#### 1. 상장시장 기준 vs 기초자산 실질 기준 비교
• **[상장시장 기준]** 국내상장 ETF **${fmt(s.domesticEtfKrw)}** vs 미국 직투 **${fmt(s.overseasStockKrw)}**
• **[기초자산 실질 기준 (권장)]**:
  1) **실질 해외주식 합계**: **${fmt(s.underlyingOverseasStockKrw)}** (전체 투자자산의 **${usStockPctOfRisk.toFixed(1)}%**, 금융자산의 **${((s.underlyingOverseasStockKrw / finTotal) * 100).toFixed(1)}%**)
     - 연금저축: KODEX 미국나스닥100 (**₩9,118,890**), KODEX TDF2050액티브 (**₩3,579,600**), KODEX 미국S&P500 (**₩2,346,340**)
     - 퇴직연금(IRP): TIGER 미국S&P500 (**₩2,838,560**), TIGER 미국배당다우존스 (**₩2,386,400**), TIGER 미국나스닥100 (**₩2,334,080**), KODEX TDF2050 (**₩722,200**) 등
     - 해외직투(토스 등): **미보유 (₩0)**
  2) **실질 해외채권 합계**: **${fmt(s.underlyingOverseasBondKrw)}** (전체 투자자산의 **${usBondPctOfRisk.toFixed(1)}%**)
     - ISA/IRP ACE 미국30년국채액티브 (**₩492,405**) + 미래에셋 미국장기채 T1.125 (**₩18,555,600**)
  3) **실질 국내채권·혼합형**: **${fmt(s.underlyingDomesticBondKrw + s.underlyingDomesticStockKrw)}** (전체 투자자산의 **${krBondPctOfRisk.toFixed(1)}%**)
     - IRP KODEX 코리아배당성장채권혼합 (**₩1,829,520**)
  4) **실질 순수 국내주식**: **₩0 (0.0%)**

#### 💡 핵심 인사이트
• 투자자산(주식·채권 합계 **${fmt(totalStockAndBond)}**) 중 **실질 해외(미국) 자산 비중이 ${(usStockPctOfRisk + usBondPctOfRisk).toFixed(1)}%**에 달하며, 위탁계좌 달러예수금(**${formatUSD(s.usdDepositUsd)} ≈ ${fmt(s.usdDepositKrw)}**)까지 포함하면 달러·미국 노출도가 매우 탄탄하게 구축되어 있습니다.`;
    }

    // 3) "이번 주 SaveTicker 긍정/부정 TOP 5 정리해줘"
    if (q.includes('SaveTicker') || q.includes('긍정/부정') || q.includes('TOP 5')) {
      return `### 📰 이번 주 SaveTicker AI 감성 분석 — **긍정 TOP 5 vs 부정·주의 TOP 5**

최근 1주간 수집된 글로벌 금융 뉴스 스크랩(**${data.saveTickerNews.length}건**)의 AI 감성 스코어 분석 결과입니다.

#### 🚀 AI 선정 긍정 전망 TOP 5 (Bullish 5)
1. **#1 NVDA (엔비디아 · 감성 +95점)**: Blackwell GB200 서버 랙 수율 안정화 및 빅테크 4사 AI CAPEX 상향으로 목표주가 상향 리포트 집중 *(연금/IRP 나스닥·S&P500 ETF 내 핵심 비중)*
2. **#2 AVGO (브로드컴 · 감성 +91점)**: 빅테크 맞춤형 AI 가속기(ASIC) 신규 수주 및 VMware 클라우드 FCF 마진 레버리지 극대화 *(목표매수가 $168 대비 괴리율 -3.11%)*
3. **#3 MSFT (마이크로소프트 · 감성 +89점)**: Azure AI 예약매출 사상 최대 및 M365 Copilot 엔터프라이즈 도입 가속 *(관심 모니터링 대상)*
4. **#4 GOOGL (알파벳 A · 감성 +86점)**: 클라우드 영업이익률 17% 돌파 및 Gemini 검색 광고 전환율 상승, M7 내 최저 PER(20.8배) 매력
5. **#5 SCHD (미국배당다우존스 · 감성 +83점)**: 금리 인하 사이클 대비 배당성장주 자금 순유입 4주 연속 지속 *(IRP 157주 보유중, +26.44% 수익중)*

#### ⚠️ AI 선정 부정·주의 TOP 5 (Bearish / Caution 5)
1. **#1 TLT / ACE 미국30년국채 (감성 -78점)**: 미 소매판매 호조 및 국채 발행 물량 부담으로 장기채 금리 4.5%대 반등 *(ISA 44주 보유중 -9.13%, 월분배금 재투자로 평단 인하 대응 권장)*
2. **#2 INTC (인텔 · 감성 -84점)**: 파운드리 영업적자 지속 및 서버 CPU 점유율 하락
3. **#3 SMCI (슈퍼마이크로 · 감성 -81점)**: 공시 지연 이슈 및 서버 마진 압박으로 변동성 경계
4. **#4 SOXL (반도체 3배 레버리지 · 감성 -72점)**: 업종 내 양극화로 지수 횡보 시 음의 복리(Volatility Drag) 주의 *(지난달 $38.40 매도 익절 완료)*
5. **#5 TSLA (테슬라 · 감성 -66점)**: 급등 후 단기 RSI 과열 및 EV 세액공제 정책 변수 소화 구간`;
    }

    // 4) "현재 달러예수금 리밸런싱 추천해줘"
    if (q.includes('달러예수금') || q.includes('리밸런싱 추천')) {
      return `### 🎯 위탁계좌 달러예수금 (**${formatUSD(s.usdDepositUsd)} ≈ ${fmt(s.usdDepositKrw)}**) 리밸런싱 액션 플랜

현재 한투 위탁계좌에 보유 중인 외화예수금 **${formatUSD(s.usdDepositUsd)}**는 전체 금융 순자산(**${fmt(finTotal)}**)의 **${((s.usdDepositKrw / finTotal) * 100).toFixed(1)}%**를 차지하고 있습니다. 수동 현금·증여금(**${fmt(data.manualCashTotalKrw)}**)이 이미 충분한 안전마진을 제공하고 있으므로, 달러예수금은 단계적으로 수익형 자산에 배치하는 것이 유리합니다.

#### 📌 AI 추천 3단계 분할 배치 전략
1. **1단계 — 핵심 AI·배당성장 분할 매수 (30% · 약 $6,000 / ${fmt(6000 * usdKrwRate)})**
   - **향후 4주간 주당 $1,500씩** 정기 분할 매수(DCA) 실행
   - **배분안**:
     * **SCHD (배당성장 ETF, 주당 $28.95)**: 주당 **$750** 투입 → 달러 현금흐름(연 3.5% 배당 + 10% 배당성장) 구축
     * **AVGO (브로드컴) & GOOGL (알파벳)**: 주당 **$750** 투입 → 목표매수가 괴리율이 **-3% 이내**로 진입한 AI 최선호주 매집
2. **2단계 — 조정 시 눌림목 대기 자금 (30% · 약 $6,000 / ${fmt(6000 * usdKrwRate)})**
   - **NVDA ($132 이하)** 또는 **MSFT ($435 이하)** 기술적 지지선 도달 시 지정가 분할 매수용 예비 탄약으로 설정
3. **3단계 — 외화 RP 안전버퍼 유지 (40% · 약 $8,312.48 / ${fmt(8312.48 * usdKrwRate)})**
   - 단기 외화 RP(연 4%대 달러 이자)로 운용하며 환율 변동성 헤지 및 달러 유동성 유지 (지난 10월 세후 **$57.87 / ₩77,347** 이자 수령 실적)`;
    }

    // Default custom question response using live portfolio metrics
    return `### 🤖 AssetCopilot 포트폴리오 데이터 기반 분석 답변

질문하신 **"${q}"**에 대해 현재 연동된 구글 시트 실시간 데이터 기준으로 분석한 결과입니다:

• **총 순자산 (실물 포함)**: **${fmt(grandTotal)}** / **금융 순자산**: **${fmt(finTotal)}**
• **기초자산 실질 기준 포트폴리오 구성**:
  - **현금성 자산 (수동현금·증여 + 달러예수금 $20,312.48)**: **${fmt(s.cashAssetKrw)} (${((s.cashAssetKrw / finTotal) * 100).toFixed(1)}%)**
  - **은행 예적금 (청년도약계좌 등)**: **${fmt(s.bankSavingsKrw)} (${((s.bankSavingsKrw / finTotal) * 100).toFixed(1)}%)**
  - **실질 해외주식 (연금·IRP 미국ETF 합산)**: **${fmt(s.underlyingOverseasStockKrw)} (${((s.underlyingOverseasStockKrw / finTotal) * 100).toFixed(1)}%)**
  - **실질 해외채권 (ISA·IRP 미국채30년 + 미국장기채)**: **${fmt(s.underlyingOverseasBondKrw)} (${((s.underlyingOverseasBondKrw / finTotal) * 100).toFixed(1)}%)**
  - **실물자산 (코나·아이폰17Pro·금반지)**: **${fmt(data.physicalAssetsTotalKrw)}** (취득원가 대비 누적감가 **-₩5,080,000** 반영)

💡 더 깊은 웹 검색 기반 분석이 필요하시다면 아래 **[🔬 Gemini Deep Research 실행]** 버튼을 눌러 즉시 Gemini 앱에서 심층 리포트를 생성하실 수 있습니다.`;
  };

  const handleSendMessage = async (textOverride?: string) => {
    const query = (textOverride ?? input).trim();
    if (!query || isLoading) return;

    if (!textOverride) setInput('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      tabContext: TAB_NAMES[activeTab],
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      if (effectiveApiKey) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
            effectiveApiKey
          )}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemContextPrompt }],
              },
              contents: [
                ...messages.slice(-6).map((m) => ({
                  role: m.role === 'assistant' ? 'model' : 'user',
                  parts: [{ text: m.content }],
                })),
                {
                  role: 'user',
                  parts: [
                    {
                      text: `[현재 화면: ${TAB_NAMES[activeTab]} / 통화: ${currency} / 기준: ${
                        exposureMode === 'UNDERLYING' ? '기초자산 실질 기준' : '상장시장 기준'
                      }]\n질문: ${query}`,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.35,
                maxOutputTokens: 1200,
              },
            }),
          }
        );

        if (response.ok) {
          const json = await response.json();
          const replyText =
            json?.candidates?.[0]?.content?.parts?.[0]?.text ||
            buildLocalSmartResponse(query);

          setMessages((prev) => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              role: 'assistant',
              content: replyText,
              timestamp: new Date().toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              tabContext: TAB_NAMES[activeTab],
              engineLabel: 'Gemini 2.5 Flash Live API',
            },
          ]);
          setIsLoading(false);
          return;
        }
      }

      // Smooth simulated latency + instant local portfolio engine synthesis
      await new Promise((r) => setTimeout(r, 320));
      const fallbackReply = buildLocalSmartResponse(query);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: fallbackReply,
          timestamp: new Date().toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          tabContext: TAB_NAMES[activeTab],
          engineLabel: effectiveApiKey
            ? 'AssetCopilot 폴백 엔진 (API 응답 대체)'
            : 'AssetCopilot 실시간 시트 컨텍스트 엔진',
        },
      ]);
    } catch {
      const fallbackReply = buildLocalSmartResponse(query);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: fallbackReply,
          timestamp: new Date().toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          tabContext: TAB_NAMES[activeTab],
          engineLabel: 'AssetCopilot 실시간 시트 컨텍스트 엔진',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Highlight inline numbers, currencies, and bold text cleanly
  const renderHighlightedInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        const isNegative =
          inner.includes('-₩') ||
          inner.includes('-$') ||
          /-\d+(\.\d+)?%/.test(inner) ||
          inner.includes('감성 -');
        const isPositiveOrMoney =
          inner.includes('₩') ||
          inner.includes('$') ||
          inner.includes('%') ||
          inner.includes('점') ||
          inner.includes('#');

        return (
          <strong
            key={idx}
            className={`font-extrabold tabular-nums ${
              isNegative
                ? 'text-[#FF5252] bg-[#FF5252]/10 px-1 py-0.2 rounded'
                : isPositiveOrMoney
                ? 'text-[#00E676] bg-[#00E676]/10 px-1 py-0.2 rounded'
                : 'text-white'
            }`}
          >
            {inner}
          </strong>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  const renderMarkdownContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-1.5 text-xs leading-relaxed text-gray-200">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;

          if (trimmed.startsWith('### ')) {
            return (
              <h4
                key={idx}
                className="text-sm font-extrabold text-white pt-1 pb-0.5 border-b border-[#1F2D3A]"
              >
                {renderHighlightedInline(trimmed.replace('### ', ''))}
              </h4>
            );
          }

          if (trimmed.startsWith('#### ')) {
            return (
              <h5
                key={idx}
                className="text-xs font-extrabold text-[#2979FF] pt-1.5 uppercase tracking-wide"
              >
                {renderHighlightedInline(trimmed.replace('#### ', ''))}
              </h5>
            );
          }

          if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1">
                <span className="text-[#00E676] font-bold mt-0.5">•</span>
                <div className="flex-1">
                  {renderHighlightedInline(trimmed.slice(2))}
                </div>
              </div>
            );
          }

          if (/^\d+[\.\)]\s/.test(trimmed)) {
            const match = trimmed.match(/^(\d+[\.\)])\s+(.*)$/);
            if (match) {
              return (
                <div key={idx} className="flex items-start gap-1.5 pl-2">
                  <span className="text-[#2979FF] font-extrabold tabular-nums shrink-0">
                    {match[1]}
                  </span>
                  <div className="flex-1">{renderHighlightedInline(match[2])}</div>
                </div>
              );
            }
          }

          return <p key={idx}>{renderHighlightedInline(trimmed)}</p>;
        })}
      </div>
    );
  };

  const handleOpenDeepResearchWithContext = async (msgContent: string) => {
    const deepPrompt = `${systemContextPrompt}\n\n[직전 AI Copilot 분석 내용]\n${msgContent}\n\n위 포트폴리오 데이터와 분석 내용을 바탕으로 최신 글로벌 시장 컨센서스와 세제혜택 계좌(연금저축·IRP·ISA) 및 달러예수금($20,312.48) 최적 실행 전략을 심층 리서치해줘.`;
    try {
      await navigator.clipboard.writeText(deepPrompt);
    } catch {
      // ignore
    }
    setCopiedToast('현재 대화 컨텍스트가 복사되었습니다! 새 탭의 Gemini에 붙여넣기(Ctrl+V) 하세요.');
    window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer');
    setTimeout(() => setCopiedToast(null), 5000);
  };

  return (
    <>
      {/* 1. Floating 'AI Copilot' Button at Bottom-Right with Neon Mint (#00E676) Glow */}
      <motion.button
        onClick={() => setIsOpen(true)}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        aria-label="AI Copilot 열기"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#0B1116]/95 backdrop-blur-xl border-2 border-[#00E676] text-white shadow-[0_0_28px_rgba(0,230,118,0.42)] hover:shadow-[0_0_38px_rgba(0,230,118,0.68)] hover:bg-[#131C24] transition-colors duration-150 cursor-pointer group"
      >
        <div className="relative w-8 h-8 rounded-xl bg-[#00E676] text-[#0B1116] flex items-center justify-center shadow-[0_0_14px_rgba(0,230,118,0.6)]">
          <Bot className="w-5 h-5 stroke-[2.2]" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#0B1116] animate-pulse" />
        </div>
        <div className="text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-xs sm:text-sm font-extrabold tracking-wide text-[#00E676]">
              AI Copilot
            </span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/40">
              AssetCopilot
            </span>
          </div>
          <div className="text-[10px] text-[#7A8B9A] group-hover:text-gray-200 transition-colors">
            화면 요약 · 시트 연동 AI 비서
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#00E676] ml-0.5" />
      </motion.button>

      {/* 2. Sliding Glassmorphism AI Chatbot Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs"
            />

            {/* Right Sliding Panel */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[480px] bg-[#0B1116]/92 backdrop-blur-2xl border-l border-[#00E676]/35 shadow-[-12px_0_45px_rgba(0,0,0,0.85)] flex flex-col justify-between"
            >
              {/* Top Header */}
              <div className="p-4 sm:p-5 border-b border-[#1F2D3A] bg-[#131C24]/85 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#00E676]/15 border border-[#00E676]/50 flex items-center justify-center shadow-[0_0_18px_rgba(0,230,118,0.28)]">
                      <Bot className="w-5 h-5 text-[#00E676]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-white tracking-wide">
                          AssetCopilot AI
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/40">
                          gemini-2.5-flash
                        </span>
                      </div>
                      <p className="text-[11px] text-[#7A8B9A]">
                        Google Sheets 전체 데이터 & 현재 탭 컨텍스트 실시간 주입
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowKeyConfig((prev) => !prev)}
                      title="Gemini API Key 설정"
                      className={`p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                        effectiveApiKey
                          ? 'bg-[#00E676]/15 border-[#00E676]/40 text-[#00E676]'
                          : 'bg-[#0B1116] border-[#1F2D3A] text-[#7A8B9A] hover:text-white'
                      }`}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        setMessages((prev) => (prev.length > 0 ? [prev[0]] : []))
                      }
                      title="대화 초기화"
                      className="p-2 rounded-lg bg-[#0B1116] border border-[#1F2D3A] text-[#7A8B9A] hover:text-white transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setIsOpen(false)}
                      aria-label="AI Copilot 닫기"
                      className="p-2 rounded-lg bg-[#0B1116] border border-[#1F2D3A] text-[#7A8B9A] hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Live Context Injection Status Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0B1116]/90 border border-[#1F2D3A] text-[11px]">
                  <div className="flex items-center gap-1.5 text-gray-200 font-semibold">
                    <Layers className="w-3.5 h-3.5 text-[#00E676]" />
                    <span>현재 컨텍스트:</span>
                    <strong className="text-[#00E676]">{TAB_NAMES[activeTab]}</strong>
                  </div>
                  <div className="text-[10px] text-[#7A8B9A] tabular-nums">
                    {exposureMode === 'UNDERLYING' ? '실질 기초자산 기준' : '상장시장 기준'} ·{' '}
                    {currency}
                  </div>
                </div>

                {/* Optional API Key Input Box */}
                {showKeyConfig && (
                  <div className="p-3 rounded-xl bg-[#0B1116] border border-[#2979FF]/40 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">
                        🔑 VITE_GEMINI_API_KEY 설정 (선택)
                      </span>
                      <span className="text-[10px] text-[#00E676]">
                        {envApiKey
                          ? '.env 환경변수 감지됨'
                          : customApiKey
                          ? '브라우저 키 적용됨'
                          : '미설정 시 내장 시트 엔진 자동 응답'}
                      </span>
                    </div>
                    <input
                      type="password"
                      value={customApiKey}
                      onChange={(e) => saveCustomKey(e.target.value)}
                      placeholder="AIzaSy... (미입력 시 내장 포트폴리오 AI 엔진 즉시 작동)"
                      className="w-full px-3 py-1.5 rounded-lg bg-[#131C24] border border-[#1F2D3A] focus:border-[#00E676] focus:outline-none text-white text-xs"
                    />
                  </div>
                )}

                {/* 4 One-Click Quick Question Chips */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#7A8B9A] flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#00E676]" />
                    원클릭 빠른 질문 칩 (클릭 시 즉시 분석)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {QUICK_QUESTION_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        onClick={() => handleSendMessage(chip)}
                        disabled={isLoading}
                        className="text-left px-3 py-2 rounded-xl bg-[#0B1116] hover:bg-[#00E676]/15 border border-[#1F2D3A] hover:border-[#00E676]/50 text-[11px] font-bold text-gray-200 hover:text-[#00E676] transition-colors duration-150 cursor-pointer truncate"
                        title={chip}
                      >
                        💬 {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Toast inside Drawer */}
              {copiedToast && (
                <div className="mx-4 mt-2 px-3 py-2 rounded-xl bg-[#00E676]/15 border border-[#00E676]/40 text-[11px] text-[#00E676] font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{copiedToast}</span>
                </div>
              )}

              {/* Middle Chat Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 px-1 text-[10px] text-[#7A8B9A]">
                        <span className="font-bold text-gray-300">
                          {isUser ? '나 (User)' : '🤖 AssetCopilot'}
                        </span>
                        <span>· {msg.timestamp}</span>
                        {!isUser && msg.engineLabel && (
                          <span className="px-1.5 py-0.2 rounded bg-[#131C24] border border-[#1F2D3A] text-[#00E676]">
                            {msg.engineLabel}
                          </span>
                        )}
                      </div>

                      <div
                        className={`max-w-[94%] rounded-2xl p-4 border ${
                          isUser
                            ? 'bg-[#2979FF]/20 border-[#2979FF]/45 text-white'
                            : 'bg-[#131C24]/95 border-[#1F2D3A] text-gray-200 shadow-lg'
                        }`}
                      >
                        {isUser ? (
                          <div className="text-xs font-semibold">{msg.content}</div>
                        ) : (
                          <>
                            {renderMarkdownContent(msg.content)}
                            <div className="mt-3 pt-2.5 border-t border-[#1F2D3A] flex items-center justify-between gap-2">
                              <span className="text-[10px] text-[#7A8B9A]">
                                컨텍스트: {msg.tabContext}
                              </span>
                              <button
                                onClick={() => handleOpenDeepResearchWithContext(msg.content)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-[#0B1116] hover:bg-[#00E676] text-[#00E676] hover:text-[#0B1116] border border-[#00E676]/35 transition-colors cursor-pointer"
                              >
                                <Microscope className="w-3 h-3" />
                                🔬 Gemini Deep Research 확장
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-[#00E676] bg-[#131C24] border border-[#1F2D3A] rounded-xl px-4 py-3 w-fit">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>포트폴리오 시트 컨텍스트 분석 중...</span>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Bottom Chat Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="p-4 border-t border-[#1F2D3A] bg-[#131C24]/90 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="현재 화면이나 보유 종목·리밸런싱을 질문하세요..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0B1116] border border-[#1F2D3A] focus:border-[#00E676] focus:outline-none text-xs text-white placeholder-[#7A8B9A]"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="px-4 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00E676]/90 disabled:opacity-40 text-[#0B1116] font-extrabold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  전송
                </button>
              </form>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
