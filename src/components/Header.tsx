import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Clock,
  Activity,
  Globe,
  Wifi,
  AlertCircle,
  ShieldCheck,
  Database,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  X,
} from 'lucide-react';
import { CurrencyCode, SystemDiagnostics, TabType } from '../types/portfolio';
import { formatTimeKST } from '../utils/formatters';

interface HeaderProps {
  activeTab: TabType;
  currency: CurrencyCode;
  onToggleCurrency: (c: CurrencyCode) => void;
  diagnostics: SystemDiagnostics;
  lastUpdated: Date | null;
  baseDate: string;
  exchangeRate: number;
  isRefreshing: boolean;
  isFromCache: boolean;
  errorMsg: string | null;
  secondsUntilRefresh: number;
  onManualRefresh: () => void;
}

const TAB_TITLES: Record<TabType, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Portfolio Command Center',
    subtitle: '수동 관리 자산(현금·증여·실물) + 한투 API 실시간(잔고·배당·체결) 통합 터미널',
  },
  portfolio: {
    title: 'Equities & Account Holdings',
    subtitle: '📊주식내역(manualStocks) + 💾KIS_실시간잔고(kisRealtime) 계좌별 통합 분석',
  },
  trades: {
    title: 'Trade & Dividend Ledger',
    subtitle: '📜KIS_매매체결DB(kisTrades) 최근 60일 체결 내역 및 💸KIS_배당내역DB(kisDividends) 수령 현황',
  },
  research: {
    title: 'AI Research & Weekly Report',
    subtitle: '🤖Gemini_주간리포트 브리핑 및 🔍관심종목_리서치(watchlistResearch) 자동 레이더',
  },
  rebalancing: {
    title: 'Asset Rebalancing Simulator',
    subtitle: '5대 자산군 현재 비중 vs 목표 비중 비교 및 실시간 매수/매도 시뮬레이터',
  },
  cashflow: {
    title: 'Monthly Cashflow & Surplus',
    subtitle: '월간 수입 · 지출 · 저축 배분 및 잉여현금 흐름 분석',
  },
  savings: {
    title: 'Savings & Maturity Schedule',
    subtitle: '예적금 · 청년도약계좌 · 청약 · 채권 만기 스케줄 및 세후 수령액',
  },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  currency,
  onToggleCurrency,
  diagnostics,
  lastUpdated,
  baseDate,
  exchangeRate,
  isRefreshing,
  isFromCache,
  errorMsg,
  secondsUntilRefresh: initialSeconds = 300,
  onManualRefresh,
}) => {
  const [showDiagPanel, setShowDiagPanel] = useState<boolean>(false);
  const [localSeconds, setLocalSeconds] = useState<number>(initialSeconds);

  useEffect(() => {
    setLocalSeconds(300);
  }, [lastUpdated]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLocalSeconds((prev) => (prev <= 1 ? 300 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const { title, subtitle } = TAB_TITLES[activeTab];
  const mins = Math.floor(localSeconds / 60);
  const secs = localSeconds % 60;
  const countdownStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const syncedTimeStr = lastUpdated ? formatTimeKST(lastUpdated) : diagnostics.lastSyncedAt || baseDate;

  return (
    <header className="bg-[#131C24]/90 backdrop-blur-md border-b border-[#1F2D3A] px-6 py-4 sticky top-0 z-30">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        {/* Left Title & Live Status */}
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#00E676]/12 text-[#00E676] border border-[#00E676]/30">
                <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse-glow" />
                {diagnostics.apiLive ? 'API LIVE' : 'CACHE FALLBACK'}
              </span>
              {isFromCache && isRefreshing && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#2979FF]/15 text-[#2979FF] border border-[#2979FF]/30">
                  <Wifi className="w-3 h-3 animate-pulse" />
                  백그라운드 최신화 중...
                </span>
              )}
            </div>
            <p className="text-xs text-[#7A8B9A] mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Right Info Bar, System Diagnostics Indicator, Currency Toggle & Manual Refresh */}
        <div className="flex flex-wrap items-center gap-2.5 relative">
          {errorMsg && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF5252]/15 border border-[#FF5252]/30 text-xs text-[#FF5252]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>폴백 보호 가동 중 (캐시 데이터 표시)</span>
            </div>
          )}

          {/* System Connection & Self-Diagnostics Indicator Button */}
          <button
            onClick={() => setShowDiagPanel((prev) => !prev)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-colors duration-150 cursor-pointer whitespace-nowrap ${
              showDiagPanel
                ? 'bg-[#00E676]/15 border-[#00E676]/50 text-white shadow-[0_0_16px_rgba(0,230,118,0.2)]'
                : 'bg-[#0B1116] border-[#1F2D3A] hover:border-[#00E676]/40 text-gray-200'
            }`}
            title="클릭하여 Google Sheets & 한투 API 시트별 자가 진단 패널 열기"
          >
            <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
            <span className="font-bold text-[#00E676]">API Live</span>
            <span className="text-[#1F2D3A]">|</span>
            <Database className="w-3.5 h-3.5 text-[#2979FF]" />
            <span className="font-semibold text-white tabular-nums">
              {diagnostics.totalRecordCount}건 연동
            </span>
            <span className="text-[#1F2D3A] hidden sm:inline">|</span>
            <Clock className="w-3.5 h-3.5 text-[#7A8B9A] hidden sm:inline" />
            <span className="text-[#7A8B9A] tabular-nums hidden sm:inline">{syncedTimeStr}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#7A8B9A] transition-transform ${
                showDiagPanel ? 'rotate-180 text-[#00E676]' : ''
              }`}
            />
          </button>

          {/* KRW (₩) / USD ($) Multi-Currency Toggle Switch */}
          <div
            className="inline-flex items-center bg-[#0B1116] p-1 rounded-xl border border-[#1F2D3A]"
            title="전체 대시보드 통화 기준 전환 (KRW 원화 / USD 달러)"
          >
            <button
              onClick={() => onToggleCurrency('KRW')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                currency === 'KRW'
                  ? 'bg-[#00E676] text-[#0B1116] shadow-[0_0_12px_rgba(0,230,118,0.35)]'
                  : 'text-[#7A8B9A] hover:text-white'
              }`}
            >
              KRW (₩)
            </button>
            <button
              onClick={() => onToggleCurrency('USD')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                currency === 'USD'
                  ? 'bg-[#2979FF] text-white shadow-[0_0_12px_rgba(41,121,255,0.4)]'
                  : 'text-[#7A8B9A] hover:text-white'
              }`}
            >
              USD ($)
            </button>
          </div>

          {/* Exchange Rate Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0B1116] border border-[#1F2D3A] text-xs whitespace-nowrap">
            <Globe className="w-3.5 h-3.5 text-[#2979FF]" />
            <span className="text-[#7A8B9A]">USD/KRW</span>
            <span className="font-bold text-white tabular-nums">
              ₩{exchangeRate.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Auto-Polling Timer Pill */}
          <div
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0B1116] border border-[#1F2D3A] text-xs whitespace-nowrap"
            title="5분(300,000ms) 주기로 Google Apps Script API를 자동 호출합니다"
          >
            <Activity className="w-3.5 h-3.5 text-[#9C27B0]" />
            <span className="font-mono font-semibold text-gray-200 tabular-nums">
              {countdownStr}
            </span>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={onManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#00E676] hover:bg-[#00E676]/90 text-[#0B1116] transition-colors duration-150 disabled:opacity-60 shadow-[0_0_15px_rgba(0,230,118,0.25)] cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? '동기화 중...' : '새로고침'}</span>
          </button>

          {/* Expandable Self-Diagnostics Popover Panel */}
          <AnimatePresence>
            {showDiagPanel && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                className="absolute right-0 top-12 w-full sm:w-[460px] bg-[#0B1116]/95 backdrop-blur-xl border border-[#00E676]/40 rounded-2xl p-5 shadow-[0_16px_48px_rgba(0,0,0,0.85)] z-50"
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1F2D3A]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#00E676]" />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                      SYSTEM SELF-DIAGNOSTICS — 시트 연동 자가 진단
                    </h4>
                  </div>
                  <button
                    onClick={() => setShowDiagPanel(false)}
                    className="p-1 rounded-lg text-[#7A8B9A] hover:text-white hover:bg-[#131C24] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  {diagnostics.modules.map((mod) => {
                    const isLive = mod.status === 'LIVE';
                    return (
                      <div
                        key={mod.key}
                        className="p-3 rounded-xl bg-[#131C24]/90 border border-[#1F2D3A] flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{mod.label}</span>
                            <span className="px-1.5 py-0.5 rounded bg-[#0B1116] text-[#7A8B9A] font-mono text-[10px] border border-[#1F2D3A]">
                              {mod.sheetName}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#7A8B9A] mt-0.5 truncate">
                            {mod.summaryText}
                          </div>
                        </div>

                        <div className="flex flex-col items-end shrink-0 tabular-nums">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              isLive
                                ? 'bg-[#00E676]/15 text-[#00E676] border-[#00E676]/35'
                                : 'bg-[#2979FF]/15 text-[#2979FF] border-[#2979FF]/35'
                            }`}
                          >
                            {isLive ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                            {isLive ? 'API LIVE' : 'AUTO SYNC'}
                          </span>
                          <span className="text-[11px] font-bold text-gray-300 mt-1">
                            {mod.recordCount}건 검증됨
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#1F2D3A] flex items-center justify-between text-[11px] text-[#7A8B9A] tabular-nums">
                  <span>폴백(Fallback) 무결성 보호: 활성화됨</span>
                  <span className="text-[#00E676] font-bold">
                    마지막 동기화: {syncedTimeStr}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
