import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Briefcase,
  Sliders,
  ArrowLeftRight,
  PiggyBank,
  TrendingUp,
  CalendarClock,
  Sparkles,
  ChevronRight,
  ScrollText,
  Bot,
} from 'lucide-react';
import { CurrencyCode, NormalizedSavingsItem, TabType } from '../types/portfolio';
import { formatCurrency } from '../utils/formatters';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  nearestSavings: NormalizedSavingsItem | null;
  currency: CurrencyCode;
  usdKrwRate: number;
}

const NAV_ITEMS: {
  id: TabType;
  label: string;
  subLabel: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    subLabel: '전체 자산 요약',
    icon: LayoutDashboard,
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    subLabel: '주식 · 한투 실시간',
    icon: Briefcase,
  },
  {
    id: 'trades',
    label: 'Trade & Dividend',
    subLabel: '매매체결 · 배당 DB',
    icon: ScrollText,
  },
  {
    id: 'research',
    label: 'AI Research',
    subLabel: '관심종목 · 주간리포트',
    icon: Bot,
  },
  {
    id: 'rebalancing',
    label: 'Rebalancing',
    subLabel: '자산배분 시뮬레이터',
    icon: Sliders,
  },
  {
    id: 'cashflow',
    label: 'Cashflow',
    subLabel: '월 수입 · 지출 · 저축',
    icon: ArrowLeftRight,
  },
  {
    id: 'savings',
    label: 'Savings',
    subLabel: '예적금 · 만기 스케줄',
    icon: PiggyBank,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  nearestSavings,
  currency,
  usdKrwRate,
}) => {
  return (
    <aside className="w-full md:w-64 shrink-0 bg-[#131C24] border-b md:border-b-0 md:border-r border-[#1F2D3A] flex flex-col justify-between md:h-screen md:sticky md:top-0 select-none overflow-y-auto">
      {/* Top Logo & Navigation */}
      <div>
        {/* Brand Header */}
        <div className="px-4 py-3.5 md:px-6 md:py-5 border-b border-[#1F2D3A] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-[#00E676]/15 border border-[#00E676]/40 flex items-center justify-center shadow-[0_0_20px_rgba(0,230,118,0.18)]">
              <TrendingUp className="w-5 h-5 text-[#00E676]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-extrabold tracking-tight text-white">
                  AssetVision
                </h1>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30">
                  PRO
                </span>
              </div>
              <p className="text-[11px] md:text-xs text-[#7A8B9A] font-medium">
                Fintech Wealth Terminal
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Menu with layoutId Sliding Indicator (Horizontal scroll on mobile iPhone, vertical on desktop) */}
        <div className="px-2.5 py-2.5 md:px-3 md:py-4">
          <div className="hidden md:block px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#7A8B9A]">
            Analytics Menu
          </div>
          <nav className="flex md:flex-col gap-1.5 md:gap-0 md:space-y-1 overflow-x-auto pb-1 md:pb-0 relative">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className="shrink-0 md:w-full relative group flex items-center justify-between px-3 py-2 md:px-3.5 md:py-2.5 rounded-xl text-left transition-colors duration-150 cursor-pointer"
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebarActiveTab"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-xl bg-[#00E676]/12 border border-[#00E676]/45 shadow-[0_0_18px_rgba(0,230,118,0.1)]"
                    />
                  )}

                  <div className="relative z-10 flex items-center gap-2 md:gap-3">
                    <div
                      className={`p-1.5 md:p-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-[#00E676] text-[#0B1116]'
                          : 'bg-[#0B1116]/60 text-[#7A8B9A] group-hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div
                        className={`text-xs md:text-sm font-semibold leading-tight whitespace-nowrap ${
                          isActive ? 'text-white' : 'text-gray-200 group-hover:text-white'
                        }`}
                      >
                        {item.label}
                      </div>
                      <div className="hidden md:block text-[11px] text-[#7A8B9A] mt-0.5">
                        {item.subLabel}
                      </div>
                    </div>
                  </div>

                  <ChevronRight
                    className={`hidden md:block relative z-10 w-4 h-4 transition-transform ${
                      isActive
                        ? 'text-[#00E676] translate-x-0.5'
                        : 'text-transparent group-hover:text-[#7A8B9A]'
                    }`}
                  />
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Summary Card: Closest Maturity Savings (Desktop only to save vertical space on iPhone) */}
      <div className="hidden md:block p-4">
        <div
          onClick={() => onSelectTab('savings')}
          className="cursor-pointer rounded-xl bg-gradient-to-b from-[#182430] to-[#0E161D] border border-[#1F2D3A] hover:border-[#00E676]/50 p-4 transition-colors duration-200 shadow-lg group"
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#7A8B9A]">
              <CalendarClock className="w-3.5 h-3.5 text-[#00E676]" />
              <span>최단기 만기 예정</span>
            </div>
            {nearestSavings && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30 tabular-nums">
                {nearestSavings.dDay >= 0
                  ? `D-${nearestSavings.dDay}`
                  : `D+${Math.abs(nearestSavings.dDay)}`}
              </span>
            )}
          </div>

          {nearestSavings ? (
            <>
              <div className="flex items-baseline justify-between mb-1">
                <div className="text-base font-bold text-white group-hover:text-[#00E676] transition-colors">
                  {nearestSavings.bank}
                </div>
                <span className="text-xs font-medium text-[#7A8B9A]">
                  {nearestSavings.category} · 연 {nearestSavings.interestRatePercent.toFixed(1)}%
                </span>
              </div>

              <div className="mt-2.5 pt-2.5 border-t border-[#1F2D3A]/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#7A8B9A]">만기일</span>
                  <span className="text-gray-200 font-medium tabular-nums">
                    {nearestSavings.maturityDate}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#7A8B9A]">세후 만기수령액</span>
                  <span className="text-sm font-bold text-[#00E676] tabular-nums">
                    {formatCurrency(nearestSavings.postTaxPayoutKrw, currency, usdKrwRate)}
                  </span>
                </div>
              </div>

              {/* Animated Maturity Progress Bar */}
              <div className="mt-2.5">
                <div className="flex justify-between text-[10px] text-[#7A8B9A] mb-1 tabular-nums">
                  <span>만기 진행률</span>
                  <span className="text-white font-semibold">
                    {nearestSavings.progressPercent.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#0B1116] rounded-full overflow-hidden border border-[#1F2D3A]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, Math.max(5, nearestSavings.progressPercent))}%`,
                    }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    className="h-full bg-gradient-to-r from-[#2979FF] to-[#00E676] rounded-full"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="text-xs text-[#7A8B9A] py-4 text-center">
              등록된 예적금 만기 정보가 없습니다.
            </div>
          )}

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#7A8B9A] group-hover:text-gray-300">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#2979FF]" />
              만기 스케줄 상세보기
            </span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </aside>
  );
};
