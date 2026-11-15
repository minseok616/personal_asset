import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Globe,
  Briefcase,
  Search,
  Target,
  Sparkles,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  History,
  Radar,
  Rocket,
  AlertTriangle,
  Microscope,
  Newspaper,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import {
  CurrencyCode,
  GeminiWeeklyReportItem,
  SaveTickerNewsItem,
  SentimentPickItem,
  WatchlistResearchItem,
} from '../types/portfolio';
import {
  formatKRW,
  formatSignedCurrency,
  formatSignedPercent,
  formatUSD,
} from '../utils/formatters';

interface AiResearchSectionProps {
  reports: GeminiWeeklyReportItem[];
  watchlist: WatchlistResearchItem[];
  saveTickerNews: SaveTickerNewsItem[];
  bullishTop5: SentimentPickItem[];
  bearishTop5: SentimentPickItem[];
  currency: CurrencyCode;
  usdKrwRate: number;
}

type NewsSentimentFilter = 'ALL' | '긍정' | '부정';

export const AiResearchSection: React.FC<AiResearchSectionProps> = ({
  reports,
  watchlist,
  saveTickerNews,
  bullishTop5,
  bearishTop5,
  currency,
  usdKrwRate,
}) => {
  const [selectedReportId, setSelectedReportId] = useState<string>(
    () => reports[0]?.id || 'rep-0'
  );
  const [selectedSector, setSelectedSector] = useState<string>('전체');
  const [newsSentimentFilter, setNewsSentimentFilter] =
    useState<NewsSentimentFilter>('ALL');
  const [newsSearchQuery, setNewsSearchQuery] = useState<string>('');
  const [copiedBanner, setCopiedBanner] = useState<string | null>(null);

  const activeReport = useMemo(() => {
    return reports.find((r) => r.id === selectedReportId) || reports[0] || null;
  }, [reports, selectedReportId]);

  const sectors = useMemo(() => {
    const set = new Set<string>(['전체']);
    watchlist.forEach((w) => {
      if (w.sector) set.add(w.sector);
    });
    return Array.from(set);
  }, [watchlist]);

  const filteredWatchlist = useMemo(() => {
    if (selectedSector === '전체') return watchlist;
    return watchlist.filter((w) => w.sector === selectedSector);
  }, [watchlist, selectedSector]);

  const filteredNews = useMemo(() => {
    return saveTickerNews.filter((n) => {
      if (newsSentimentFilter !== 'ALL' && n.sentiment !== newsSentimentFilter) {
        return false;
      }
      if (newsSearchQuery.trim() !== '') {
        const q = newsSearchQuery.toLowerCase();
        return (
          n.ticker.toLowerCase().includes(q) ||
          n.stockName.toLowerCase().includes(q) ||
          n.title.toLowerCase().includes(q) ||
          n.summary.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [saveTickerNews, newsSentimentFilter, newsSearchQuery]);

  const isReportPositive = (activeReport?.weeklyNetWorthChangeKrw ?? 0) >= 0;

  // One-Click Deep Research Prompt Copy + Open Gemini App
  const handleRunDeepResearch = async (titleLabel: string, promptText: string) => {
    try {
      await navigator.clipboard.writeText(promptText);
    } catch {
      // Fallback textarea copy if clipboard API is restricted
      const ta = document.createElement('textarea');
      ta.value = promptText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedBanner(
      `[${titleLabel}] Deep Research 전용 프롬프트가 클립보드에 복사되었습니다! 새 탭으로 열린 Gemini에 붙여넣기(Ctrl+V) 해주세요.`
    );
    window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer');
    setTimeout(() => {
      setCopiedBanner((prev) => (prev && prev.includes(titleLabel) ? null : prev));
    }, 6000);
  };

  const buildWeeklyReportDeepPrompt = (rep: GeminiWeeklyReportItem) => {
    return `[Gemini Deep Research 요청 — 개인 자산관리 포트폴리오 주간 심층 진단]
기준일자: ${rep.reportDate} (${rep.reportWeek})
핵심 요약: ${rep.headline}

1. 시장·매크로 현황:
${rep.marketMacroSummary}

2. 현재 보유종목 이슈:
${rep.holdingsIssues}

3. 관심종목 TOP 픽:
${rep.watchlistTopPicks}

4. 리밸런싱 제안 현황:
${rep.rebalancingActionPlan}

[심층 분석 요청 사항]
- 위 포트폴리오(연금저축·IRP·ISA 내 미국 S&P500/나스닥100/배당다우존스/미국30년국채 ETF + 토스증권 MSFT + 한투 위탁 달러예수금 $20,312.48)의 실질 기초자산 노출도 관점에서 향후 1~3개월 매크로 시나리오별(금리/환율) 리스크와 기대수익을 심층 분석해줘.
- 달러예수금($20,312.48)의 최적 분할 매수 타임라인과 세제혜택 계좌(연금저축·IRP·ISA) 내 자산배분 최적화 방안을 구체적인 수치로 제시해줘.`;
  };

  const buildStockDeepPrompt = (
    ticker: string,
    stockName: string,
    sentimentLabel: string,
    score: number,
    rationale: string
  ) => {
    return `[Gemini Deep Research 요청 — ${stockName} (${ticker}) 심층 투자 분석]
• SaveTicker 1주간 AI 감성 분류: ${sentimentLabel} (감성 스코어: ${score > 0 ? `+${score}` : score}점)
• 최근 1주간 핵심 뉴스 근거: ${rationale}
• 내 포트폴리오 컨텍스트: 현재 한투 위탁계좌 달러예수금 $20,312.48 보유 중, 연금저축·IRP·ISA 및 토스증권 해외직투 운용 중 (적용 환율 ₩${usdKrwRate.toLocaleString('ko-KR')})

[Deep Research 심층 분석 요청]
1) ${stockName}(${ticker})의 최근 1주간 핵심 뉴스·실적·가이던스 변화와 월가 주요 IB 목표주가 컨센서스를 검증해줘.
2) 향후 12개월 핵심 성장 촉매(Bull Case)와 하방 리스크 요인(Bear Case)을 정량적 밸류에이션(Forward PER, EV/EBITDA, FCF Yield)과 함께 비교해줘.
3) 내 포트폴리오(달러예수금 $20,312.48 활용 또는 연금/ISA ETF 대체) 관점에서 적정 분할매수 가격대와 목표 비중(%)을 제안해줘.`;
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification when Deep Research Prompt is Copied */}
      <AnimatePresence>
        {copiedBanner && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="sticky top-20 z-40 bg-[#0B1116]/95 backdrop-blur-xl border border-[#00E676] rounded-xl px-4 py-3 shadow-[0_0_25px_rgba(0,230,118,0.28)] flex items-center justify-between gap-3 text-xs text-white"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#00E676] shrink-0" />
              <span className="font-bold">{copiedBanner}</span>
            </div>
            <button
              onClick={() => setCopiedBanner(null)}
              className="px-2.5 py-1 rounded-lg bg-[#131C24] text-[#7A8B9A] hover:text-white text-[11px] font-bold cursor-pointer"
            >
              닫기
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Top: 🚀 AI 선정 긍정 전망 TOP 5 (Bullish 5) vs ⚠️ AI 선정 부정·주의 TOP 5 (Bearish 5) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
        {/* Left Card: 🚀 AI 선정 긍정 전망 TOP 5 (Bullish 5) - Neon Mint Theme */}
        <div className="bg-gradient-to-br from-[#131C24] via-[#101D20] to-[#0B1116] border border-[#00E676]/35 hover:border-[#00E676]/60 rounded-2xl p-6 shadow-xl flex flex-col justify-between transition-colors duration-200">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F2D3A] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-[#00E676]/15 border border-[#00E676]/40 flex items-center justify-center shadow-[0_0_14px_rgba(0,230,118,0.25)]">
                    <Rocket className="w-4 h-4 text-[#00E676]" />
                  </span>
                  <h3 className="text-sm sm:text-base font-extrabold tracking-wide text-white uppercase">
                    🚀 AI 선정 긍정 전망 TOP 5 (Bullish 5)
                  </h3>
                </div>
                <p className="text-xs text-[#7A8B9A] mt-1">
                  📰SaveTicker 1주간 뉴스 스크랩 감성 분석 기반 상승 모멘텀 최상위 5종목
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/35 self-start sm:self-auto shrink-0">
                BULLISH SENTIMENT
              </span>
            </div>

            <div className="space-y-3">
              {bullishTop5.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#0B1116]/85 border border-[#1F2D3A] hover:border-[#00E676]/50 rounded-xl p-4 transition-colors duration-150 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-6 h-6 rounded-lg bg-[#00E676] text-[#0B1116] font-extrabold text-xs flex items-center justify-center tabular-nums">
                        #{item.rank}
                      </span>
                      <span className="font-mono font-extrabold text-sm text-[#00E676]">
                        {item.ticker}
                      </span>
                      <span className="font-bold text-xs sm:text-sm text-white">
                        {item.stockName}
                      </span>
                      {item.inPortfolio && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#2979FF]/20 text-[#2979FF] border border-[#2979FF]/40">
                          보유/연동중
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="text-[11px] text-[#7A8B9A]">
                        주간 뉴스 {item.newsCount}건
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/40">
                        감성 +{item.sentimentScore}점
                      </span>
                    </div>
                  </div>

                  {/* Sentiment Score Bar */}
                  <div className="w-full h-1.5 bg-[#131C24] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.abs(item.sentimentScore))}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                      className="h-full rounded-full bg-gradient-to-r from-[#00E676]/70 to-[#00E676]"
                    />
                  </div>

                  {/* 1-Week News Core Rationale */}
                  <p className="text-xs text-gray-200 leading-relaxed">{item.rationale}</p>

                  {/* Bottom Row: Catalyst Tags + One-Click Deep Research Button */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.catalysts.map((cat) => (
                        <span
                          key={cat}
                          className="px-2 py-0.5 rounded bg-[#131C24] border border-[#1F2D3A] text-[10px] font-semibold text-gray-300"
                        >
                          #{cat}
                        </span>
                      ))}
                    </div>

                    <button
                      onClick={() =>
                        handleRunDeepResearch(
                          `${item.ticker} ${item.stockName}`,
                          buildStockDeepPrompt(
                            item.ticker,
                            item.stockName,
                            '긍정 전망 (Bullish)',
                            item.sentimentScore,
                            item.rationale
                          )
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold bg-[#00E676]/15 hover:bg-[#00E676] text-[#00E676] hover:text-[#0B1116] border border-[#00E676]/40 transition-colors duration-150 cursor-pointer shrink-0"
                    >
                      <Microscope className="w-3.5 h-3.5" />
                      🔬 Deep Research 프롬프트 복사 & Gemini 실행
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Card: ⚠️ AI 선정 부정·주의 TOP 5 (Bearish 5) - Coral Red Theme */}
        <div className="bg-gradient-to-br from-[#131C24] via-[#1F1419] to-[#0B1116] border border-[#FF5252]/35 hover:border-[#FF5252]/60 rounded-2xl p-6 shadow-xl flex flex-col justify-between transition-colors duration-200">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F2D3A] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-[#FF5252]/15 border border-[#FF5252]/40 flex items-center justify-center shadow-[0_0_14px_rgba(255,82,82,0.25)]">
                    <AlertTriangle className="w-4 h-4 text-[#FF5252]" />
                  </span>
                  <h3 className="text-sm sm:text-base font-extrabold tracking-wide text-white uppercase">
                    ⚠️ AI 선정 부정·주의 TOP 5 (Bearish 5)
                  </h3>
                </div>
                <p className="text-xs text-[#7A8B9A] mt-1">
                  📰SaveTicker 1주간 뉴스 스크랩 기반 리스크 점검 및 변동성 주의 5종목
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-[#FF5252]/15 text-[#FF5252] border border-[#FF5252]/35 self-start sm:self-auto shrink-0">
                BEARISH / CAUTION
              </span>
            </div>

            <div className="space-y-3">
              {bearishTop5.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#0B1116]/85 border border-[#1F2D3A] hover:border-[#FF5252]/50 rounded-xl p-4 transition-colors duration-150 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-6 h-6 rounded-lg bg-[#FF5252] text-white font-extrabold text-xs flex items-center justify-center tabular-nums">
                        #{item.rank}
                      </span>
                      <span className="font-mono font-extrabold text-sm text-[#FF5252]">
                        {item.ticker}
                      </span>
                      <span className="font-bold text-xs sm:text-sm text-white">
                        {item.stockName}
                      </span>
                      {item.inPortfolio && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#FFAB00]/20 text-[#FFAB00] border border-[#FFAB00]/40">
                          보유점검
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="text-[11px] text-[#7A8B9A]">
                        주간 뉴스 {item.newsCount}건
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-[#FF5252]/15 text-[#FF5252] border border-[#FF5252]/40">
                        감성 {item.sentimentScore}점
                      </span>
                    </div>
                  </div>

                  {/* Sentiment Score Bar */}
                  <div className="w-full h-1.5 bg-[#131C24] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.abs(item.sentimentScore))}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                      className="h-full rounded-full bg-gradient-to-r from-[#FF5252]/70 to-[#FF5252]"
                    />
                  </div>

                  {/* 1-Week News Core Rationale */}
                  <p className="text-xs text-gray-200 leading-relaxed">{item.rationale}</p>

                  {/* Bottom Row: Catalyst Tags + One-Click Deep Research Button */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.catalysts.map((cat) => (
                        <span
                          key={cat}
                          className="px-2 py-0.5 rounded bg-[#131C24] border border-[#1F2D3A] text-[10px] font-semibold text-gray-300"
                        >
                          #{cat}
                        </span>
                      ))}
                    </div>

                    <button
                      onClick={() =>
                        handleRunDeepResearch(
                          `${item.ticker} ${item.stockName}`,
                          buildStockDeepPrompt(
                            item.ticker,
                            item.stockName,
                            '부정·주의 (Bearish/Caution)',
                            item.sentimentScore,
                            item.rationale
                          )
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold bg-[#FF5252]/15 hover:bg-[#FF5252] text-[#FF5252] hover:text-white border border-[#FF5252]/40 transition-colors duration-150 cursor-pointer shrink-0"
                    >
                      <Microscope className="w-3.5 h-3.5" />
                      🔬 Deep Research 프롬프트 복사 & Gemini 실행
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Middle: 🤖 최신 Gemini 주간 리포트 브리핑 카드 (geminiWeeklyReports) */}
      {activeReport && (
        <div className="bg-gradient-to-br from-[#131C24] via-[#111A24] to-[#0D141C] border border-[#1F2D3A] hover:border-[#00E676]/45 rounded-2xl p-6 shadow-xl space-y-5 transition-colors duration-200">
          {/* Top Header Bar: Report Date, Report Week, Weekly Net Worth Change/Return Badge & History Selector */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-[#1F2D3A] pb-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="w-8 h-8 rounded-xl bg-[#00E676]/15 border border-[#00E676]/40 flex items-center justify-center shadow-[0_0_16px_rgba(0,230,118,0.2)]">
                  <Bot className="w-4 h-4 text-[#00E676]" />
                </div>
                <h3 className="text-base font-extrabold tracking-wide text-white uppercase">
                  🤖 GEMINI WEEKLY REPORT — AI 주간 포트폴리오 브리핑
                </h3>

                {/* Report Week Badge */}
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#2979FF]/20 text-[#2979FF] border border-[#2979FF]/40">
                  {activeReport.reportWeek}
                </span>

                {/* Report Date Pill */}
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono text-[#7A8B9A] bg-[#0B1116] border border-[#1F2D3A] tabular-nums">
                  <Calendar className="w-3 h-3 text-[#00E676]" />
                  기준일: {activeReport.reportDate}
                </span>

                {/* Weekly Net Worth Change / Return Rate Badge */}
                <span
                  className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-extrabold border tabular-nums ${
                    isReportPositive
                      ? 'bg-[#00E676]/15 text-[#00E676] border-[#00E676]/40'
                      : 'bg-[#FF5252]/15 text-[#FF5252] border-[#FF5252]/40'
                  }`}
                >
                  {isReportPositive ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  )}
                  주간 순자산{' '}
                  {formatSignedCurrency(
                    activeReport.weeklyNetWorthChangeKrw,
                    currency,
                    usdKrwRate
                  )}{' '}
                  ({formatSignedPercent(activeReport.weeklyReturnPercent, 2)})
                </span>
              </div>

              <p className="text-xs sm:text-sm font-semibold text-gray-200 pl-0.5">
                <Sparkles className="w-3.5 h-3.5 text-[#00E676] inline mr-1.5 -mt-0.5" />
                {activeReport.headline}
              </p>
            </div>

            {/* Right: Deep Research Button + Historical Report Selector */}
            <div className="flex flex-wrap items-center gap-2 self-start xl:self-auto shrink-0">
              <button
                onClick={() =>
                  handleRunDeepResearch(
                    activeReport.reportWeek,
                    buildWeeklyReportDeepPrompt(activeReport)
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-[#00E676] hover:bg-[#00E676]/90 text-[#0B1116] shadow-[0_0_16px_rgba(0,230,118,0.3)] transition-colors duration-150 cursor-pointer"
              >
                <Microscope className="w-3.5 h-3.5" />
                🔬 Deep Research 프롬프트 복사 & Gemini 실행
              </button>

              <div className="flex items-center gap-1.5 text-xs font-bold text-[#7A8B9A] ml-1">
                <History className="w-3.5 h-3.5 text-[#2979FF]" />
                <span>주차 히스토리:</span>
              </div>

              {/* Quick History Pill Buttons */}
              <div className="inline-flex items-center bg-[#0B1116] p-1 rounded-xl border border-[#1F2D3A] gap-1">
                {reports.map((rep, idx) => {
                  const isActive = rep.id === activeReport.id;
                  return (
                    <button
                      key={rep.id}
                      onClick={() => setSelectedReportId(rep.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-[#00E676] text-[#0B1116] shadow-[0_0_10px_rgba(0,230,118,0.28)]'
                          : 'text-[#7A8B9A] hover:text-white'
                      }`}
                    >
                      {idx === 0 ? `최신 (${rep.reportDate})` : rep.reportDate}
                    </button>
                  );
                })}
              </div>

              {/* Dropdown Select for full week title */}
              <select
                value={activeReport.id}
                onChange={(e) => setSelectedReportId(e.target.value)}
                aria-label="과거 주차 리포트 선택"
                className="bg-[#0B1116] border border-[#1F2D3A] focus:border-[#00E676] focus:outline-none text-xs font-bold text-white rounded-xl px-3 py-1.5 cursor-pointer"
              >
                {reports.map((rep, idx) => (
                  <option key={rep.id} value={rep.id} className="bg-[#0B1116] text-white">
                    {idx === 0 ? `[최신] ${rep.reportWeek}` : rep.reportWeek} ({rep.reportDate})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4 Core Briefing Sections in Glassmorphism Dark Card 2x2 Grid */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeReport.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {/* Section 1: 🌐 시장·매크로 요약 */}
              <div className="bg-[#0B1116]/75 backdrop-blur-md border border-white/10 hover:border-[#2979FF]/50 rounded-xl p-5 space-y-2.5 transition-colors duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-[#2979FF]/15 text-[#2979FF] border border-[#2979FF]/30">
                      <Globe className="w-4 h-4" />
                    </span>
                    <h4 className="text-sm font-extrabold text-white">
                      🌐 시장 · 매크로 요약
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#2979FF]/15 text-[#2979FF]">
                    MACRO & FX
                  </span>
                </div>
                <div className="text-xs text-gray-200 leading-relaxed whitespace-pre-line pl-1">
                  {activeReport.marketMacroSummary}
                </div>
              </div>

              {/* Section 2: 💼 보유종목 핵심 이슈 */}
              <div className="bg-[#0B1116]/75 backdrop-blur-md border border-white/10 hover:border-[#00E676]/50 rounded-xl p-5 space-y-2.5 transition-colors duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30">
                      <Briefcase className="w-4 h-4" />
                    </span>
                    <h4 className="text-sm font-extrabold text-white">
                      💼 보유종목 핵심 이슈
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#00E676]/15 text-[#00E676]">
                    HOLDINGS REVIEW
                  </span>
                </div>
                <div className="text-xs text-gray-200 leading-relaxed whitespace-pre-line pl-1">
                  {activeReport.holdingsIssues}
                </div>
              </div>

              {/* Section 3: 🔍 관심종목 TOP 픽 */}
              <div className="bg-[#0B1116]/75 backdrop-blur-md border border-white/10 hover:border-[#9C27B0]/50 rounded-xl p-5 space-y-2.5 transition-colors duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-[#9C27B0]/20 text-[#D05CE3] border border-[#9C27B0]/40">
                      <Search className="w-4 h-4" />
                    </span>
                    <h4 className="text-sm font-extrabold text-white">
                      🔍 관심종목 TOP 픽
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#9C27B0]/20 text-[#D05CE3]">
                    AI CONVICTION PICKS
                  </span>
                </div>
                <div className="text-xs text-gray-200 leading-relaxed whitespace-pre-line pl-1">
                  {activeReport.watchlistTopPicks}
                </div>
              </div>

              {/* Section 4: 🎯 AI 리밸런싱 액션 제안 */}
              <div className="bg-[#0B1116]/75 backdrop-blur-md border border-white/10 hover:border-[#FFAB00]/50 rounded-xl p-5 space-y-2.5 transition-colors duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-[#FFAB00]/15 text-[#FFAB00] border border-[#FFAB00]/35">
                      <Target className="w-4 h-4" />
                    </span>
                    <h4 className="text-sm font-extrabold text-white">
                      🎯 AI 리밸런싱 액션 제안
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#FFAB00]/15 text-[#FFAB00]">
                    ACTIONABLE PLAN
                  </span>
                </div>
                <div className="text-xs text-gray-200 leading-relaxed whitespace-pre-line pl-1">
                  {activeReport.rebalancingActionPlan}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* 3. Watchlist Auto-Research Radar (watchlistResearch) Table */}
      <div className="bg-[#131C24] border border-[#1F2D3A] rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#1F2D3A] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Radar className="w-4 h-4 text-[#00E676]" />
              <h3 className="text-sm font-bold tracking-wider uppercase text-white">
                🔍 WATCHLIST AUTO-RESEARCH RADAR — 관심종목 자동 리서치 레이더
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30 tabular-nums">
                총 {filteredWatchlist.length}종목 추적 중
              </span>
            </div>
            <p className="text-xs text-[#7A8B9A] mt-1">
              52주 최고/최저가 대비 현재 위치 프로그레스 바 · 목표매수가 괴리율(%) 및 원클릭 Deep Research 연동
            </p>
          </div>

          {/* Sector Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {sectors.map((sec) => {
              const active = selectedSector === sec;
              return (
                <button
                  key={sec}
                  onClick={() => setSelectedSector(sec)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors duration-150 cursor-pointer whitespace-nowrap border ${
                    active
                      ? 'bg-[#00E676] text-[#0B1116] border-[#00E676]'
                      : 'bg-[#0B1116] text-[#7A8B9A] border-[#1F2D3A] hover:text-white'
                  }`}
                >
                  {sec}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#1F2D3A]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0B1116] border-b border-[#1F2D3A] text-[11px] font-bold uppercase tracking-wider text-[#7A8B9A] whitespace-nowrap">
                <th className="py-3.5 pl-4 pr-2">종목명 (티커)</th>
                <th className="py-3.5 px-2.5">섹터</th>
                <th className="py-3.5 px-3 text-right">현재가</th>
                <th className="py-3.5 px-2.5 text-right">전일대비(%)</th>
                <th className="py-3.5 px-4 min-w-[200px]">52주 최저 ~ 최고가 현재 위치</th>
                <th className="py-3.5 px-3 text-right">목표매수가</th>
                <th className="py-3.5 px-3 text-right">목표괴리율(%)</th>
                <th className="py-3.5 px-3 min-w-[260px]">🤖 Gemini AI 분석 요약</th>
                <th className="py-3.5 pl-2 pr-4 text-right">Deep Research</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2D3A]/60 text-xs tabular-nums">
              {filteredWatchlist.map((item) => {
                const isUp = item.dailyChangePercent >= 0;
                const isNearTarget =
                  Math.abs(item.targetGapPercent) <= 3.5 || item.targetGapPercent > 0;
                const fmtPrice = (val: number) =>
                  item.currency === 'USD' ? formatUSD(val) : formatKRW(val);

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-[#192530]/70 transition-colors duration-150 group"
                  >
                    <td className="py-4 pl-4 pr-2 whitespace-nowrap">
                      <div className="font-extrabold text-white group-hover:text-[#00E676] transition-colors">
                        {item.name}
                      </div>
                      <div className="text-[11px] font-mono text-[#7A8B9A] mt-0.5 flex items-center gap-1.5">
                        <span className="text-[#00E676] font-bold">{item.code}</span>
                        <span>· {item.currency}</span>
                      </div>
                    </td>

                    <td className="py-4 px-2.5 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#0B1116] text-gray-200 border border-[#1F2D3A]">
                        {item.sector}
                      </span>
                    </td>

                    <td className="py-4 px-3 text-right whitespace-nowrap">
                      <div className="font-extrabold text-white text-sm">
                        {fmtPrice(item.currentPrice)}
                      </div>
                      {item.currency === 'USD' && (
                        <div className="text-[10px] text-[#7A8B9A]">
                          ≈ {formatKRW(item.currentPriceKrw)}
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-2.5 text-right whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-extrabold border ${
                          isUp
                            ? 'bg-[#00E676]/15 text-[#00E676] border-[#00E676]/35'
                            : 'bg-[#FF5252]/15 text-[#FF5252] border-[#FF5252]/35'
                        }`}
                      >
                        {isUp ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {formatSignedPercent(item.dailyChangePercent, 2)}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-[#7A8B9A]">
                          <span>저 {fmtPrice(item.low52w)}</span>
                          <span className="font-extrabold text-[#2979FF]">
                            밴드 {item.position52wPercent.toFixed(0)}%
                          </span>
                          <span>고 {fmtPrice(item.high52w)}</span>
                        </div>
                        <div className="w-full h-2 bg-[#0B1116] rounded-full overflow-hidden border border-[#1F2D3A] relative">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.min(100, Math.max(4, item.position52wPercent))}%`,
                            }}
                            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                            className="h-full rounded-full bg-gradient-to-r from-[#2979FF] to-[#00E676]"
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-3 text-right whitespace-nowrap">
                      <div className="font-bold text-[#00E676]">
                        {fmtPrice(item.targetBuyPrice)}
                      </div>
                      <div className="text-[10px] text-[#7A8B9A]">{item.aiSignal}</div>
                    </td>

                    <td className="py-4 px-3 text-right whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                          isNearTarget
                            ? 'bg-[#00E676]/15 text-[#00E676] border-[#00E676]/40'
                            : 'bg-[#2979FF]/15 text-[#2979FF] border-[#2979FF]/35'
                        }`}
                      >
                        {formatSignedPercent(item.targetGapPercent, 2)}
                      </span>
                    </td>

                    <td className="py-4 px-3 max-w-[360px]">
                      <div className="text-xs text-gray-200 leading-relaxed font-sans">
                        {item.aiSummary}
                      </div>
                    </td>

                    <td className="py-4 pl-2 pr-4 text-right whitespace-nowrap">
                      <button
                        onClick={() =>
                          handleRunDeepResearch(
                            `${item.code} ${item.name}`,
                            buildStockDeepPrompt(
                              item.code,
                              item.name,
                              item.aiSignal,
                              88,
                              item.aiSummary
                            )
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#0B1116] hover:bg-[#00E676] text-[#00E676] hover:text-[#0B1116] border border-[#00E676]/35 transition-colors duration-150 cursor-pointer"
                      >
                        <Microscope className="w-3.5 h-3.5" />
                        🔬 Deep Research
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Bottom: 📰 SaveTicker 1주간 뉴스 스크랩 피드 (saveTickerNews) Table */}
      <div className="bg-[#131C24] border border-[#1F2D3A] rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#1F2D3A] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-[#2979FF]" />
              <h3 className="text-sm font-bold tracking-wider uppercase text-white">
                📰 SAVETICKER 1-WEEK NEWS SCRAP FEED — 1주간 뉴스 스크랩 피드
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#2979FF]/15 text-[#2979FF] border border-[#2979FF]/30 tabular-nums">
                {filteredNews.length}건 표시
              </span>
            </div>
            <p className="text-xs text-[#7A8B9A] mt-1">
              📰SaveTicker_뉴스스크랩DB 시트 실시간 연동 · AI 감성 스코어 배지 및 원문 링크 · 종목별 심층 분석
            </p>
          </div>

          {/* Right: Sentiment Filter Tabs + Search Input */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center bg-[#0B1116] p-1 rounded-xl border border-[#1F2D3A] text-xs font-bold">
              {(['ALL', '긍정', '부정'] as NewsSentimentFilter[]).map((tab) => {
                const isActive = newsSentimentFilter === tab;
                const count =
                  tab === 'ALL'
                    ? saveTickerNews.length
                    : saveTickerNews.filter((n) => n.sentiment === tab).length;
                return (
                  <button
                    key={tab}
                    onClick={() => setNewsSentimentFilter(tab)}
                    className={`px-3 py-1 rounded-lg transition-colors duration-150 cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? tab === '부정'
                          ? 'bg-[#FF5252] text-white'
                          : 'bg-[#00E676] text-[#0B1116]'
                        : 'text-[#7A8B9A] hover:text-white'
                    }`}
                  >
                    <span>
                      {tab === 'ALL' ? '전체' : tab === '긍정' ? '🚀 긍정' : '⚠️ 부정·주의'}
                    </span>
                    <span className="text-[10px] opacity-80 tabular-nums">({count})</span>
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#7A8B9A] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={newsSearchQuery}
                onChange={(e) => setNewsSearchQuery(e.target.value)}
                placeholder="티커·종목명·키워드 검색..."
                className="pl-8 pr-3 py-1.5 rounded-xl bg-[#0B1116] border border-[#1F2D3A] focus:border-[#00E676] focus:outline-none text-xs text-white placeholder-[#7A8B9A] w-48 sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* SaveTicker News Table */}
        <div className="overflow-x-auto rounded-xl border border-[#1F2D3A]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0B1116] border-b border-[#1F2D3A] text-[11px] font-bold uppercase tracking-wider text-[#7A8B9A] whitespace-nowrap">
                <th className="py-3.5 pl-4 pr-2">수집일시</th>
                <th className="py-3.5 px-3">종목명 (티커)</th>
                <th className="py-3.5 px-3 text-center">감성 스코어</th>
                <th className="py-3.5 px-4 min-w-[340px]">뉴스 헤드라인 & 1주간 핵심 요약</th>
                <th className="py-3.5 px-3">출처</th>
                <th className="py-3.5 pl-2 pr-4 text-right">원문 & Deep Research</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2D3A]/60 text-xs tabular-nums">
              {filteredNews.map((news) => {
                const isBull = news.sentiment === '긍정';
                const isBear = news.sentiment === '부정';
                return (
                  <tr
                    key={news.id}
                    className="hover:bg-[#192530]/70 transition-colors duration-150 group"
                  >
                    <td className="py-3.5 pl-4 pr-2 whitespace-nowrap text-[#7A8B9A] font-mono text-[11px]">
                      {news.publishedAt}
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="font-extrabold text-white">{news.stockName}</div>
                      <div className="font-mono text-[11px] text-[#00E676] font-bold">
                        {news.ticker}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                          isBull
                            ? 'bg-[#00E676]/15 text-[#00E676] border-[#00E676]/40'
                            : isBear
                            ? 'bg-[#FF5252]/15 text-[#FF5252] border-[#FF5252]/40'
                            : 'bg-[#1F2D3A] text-gray-300 border-[#2E4254]'
                        }`}
                      >
                        {isBull ? '긍정' : isBear ? '부정·주의' : '중립'}{' '}
                        {news.sentimentScore > 0
                          ? `+${news.sentimentScore}`
                          : news.sentimentScore}
                        점
                      </span>
                    </td>

                    <td className="py-3.5 px-4 max-w-[520px]">
                      <div className="font-bold text-white text-xs sm:text-sm group-hover:text-[#00E676] transition-colors">
                        {news.title}
                      </div>
                      <div className="text-xs text-[#7A8B9A] mt-1 leading-relaxed">
                        {news.summary}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-[#0B1116] border border-[#1F2D3A] text-[11px] text-gray-300">
                        {news.source}
                      </span>
                    </td>

                    <td className="py-3.5 pl-2 pr-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <a
                          href={news.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#0B1116] hover:bg-[#192530] text-gray-200 border border-[#1F2D3A] transition-colors"
                        >
                          <ExternalLink className="w-3 h-3 text-[#2979FF]" />
                          원문 링크
                        </a>
                        <button
                          onClick={() =>
                            handleRunDeepResearch(
                              `${news.ticker} 뉴스 심층분석`,
                              buildStockDeepPrompt(
                                news.ticker,
                                news.stockName,
                                news.sentiment,
                                news.sentimentScore,
                                `${news.title} — ${news.summary}`
                              )
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#00E676]/15 hover:bg-[#00E676] text-[#00E676] hover:text-[#0B1116] border border-[#00E676]/35 transition-colors cursor-pointer"
                        >
                          <Microscope className="w-3 h-3" />
                          Deep Research
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
