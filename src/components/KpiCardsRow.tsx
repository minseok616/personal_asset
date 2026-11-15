import React from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Coins,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Car,
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { CurrencyCode, NetWorthViewMode, PortfolioData } from '../types/portfolio';
import {
  formatCompactCurrency,
  formatCurrency,
  formatSignedCurrency,
  formatSignedPercent,
} from '../utils/formatters';
import { CountUpNumber } from './CountUpNumber';

interface KpiCardsRowProps {
  data: PortfolioData;
  currency: CurrencyCode;
  usdKrwRate: number;
  netWorthMode: NetWorthViewMode;
  onChangeNetWorthMode: (mode: NetWorthViewMode) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 320,
      damping: 26,
    },
  },
};

export const KpiCardsRow: React.FC<KpiCardsRowProps> = ({
  data,
  currency,
  usdKrwRate,
  netWorthMode,
  onChangeNetWorthMode,
}) => {
  const {
    summary,
    assetHistory,
    totalStockEvalKrw,
    totalStockProfitKrw,
    totalStockReturnRate,
    cashflow,
  } = data;

  const isWithPhysical = netWorthMode === 'TOTAL_WITH_PHYSICAL';
  const displayedNetWorthKrw = isWithPhysical
    ? summary.grandTotalKrw
    : summary.financialTotalKrw;

  const recentHistory = assetHistory.slice(-12);

  const portfolioSparkData = recentHistory.map((h, i) => ({
    idx: i,
    val: isWithPhysical ? h.totalWithPhysicalKrw : h.totalKrw,
  }));

  const stockSparkData = recentHistory.map((h, i) => ({
    idx: i,
    val: h.stockKrw,
  }));

  const surplusSparkData = recentHistory.map((h, i) => {
    const prev = i > 0 ? recentHistory[i - 1].savingsKrw : h.savingsKrw - cashflow.savingsKrw;
    const diff = Math.max(cashflow.surplusKrw * 0.75, h.savingsKrw - prev + cashflow.balanceKrw);
    return {
      idx: i,
      val: i === recentHistory.length - 1 ? cashflow.surplusKrw : diff,
    };
  });

  const rateSparkData = [
    { idx: 0, val: 51.2 },
    { idx: 1, val: 52.8 },
    { idx: 2, val: 53.5 },
    { idx: 3, val: 52.9 },
    { idx: 4, val: 54.4 },
    { idx: 5, val: 55.1 },
    { idx: 6, val: 56.0 },
    { idx: 7, val: 55.8 },
    { idx: 8, val: 56.7 },
    { idx: 9, val: cashflow.savingsRatePercent },
  ];

  const isStockPositive = totalStockProfitKrw >= 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {/* Card 1: TOTAL NET WORTH (with Dual Toggle: 총 순자산(실물 포함) vs 금융 순자산) */}
      <motion.div
        variants={cardVariants}
        className="bg-[#131C24] border border-[#1F2D3A] hover:border-[#00E676]/60 hover:shadow-[0_8px_30px_rgba(0,230,118,0.12)] rounded-xl p-5 flex flex-col justify-between transition-colors duration-200 shadow-lg relative overflow-hidden"
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-bold tracking-wider uppercase text-[#7A8B9A]">
              {isWithPhysical ? '총 순자산 (실물 포함)' : '금융 순자산 (투자·현금·적금)'}
            </span>
            {/* Dual Toggle Switch */}
            <div className="inline-flex items-center bg-[#0B1116] p-0.5 rounded-lg border border-[#1F2D3A] text-[10px] font-bold shrink-0">
              <button
                onClick={() => onChangeNetWorthMode('TOTAL_WITH_PHYSICAL')}
                className={`px-2 py-0.5 rounded-md transition-colors duration-150 cursor-pointer ${
                  isWithPhysical
                    ? 'bg-[#00E676] text-[#0B1116] shadow-[0_0_8px_rgba(0,230,118,0.3)]'
                    : 'text-[#7A8B9A] hover:text-white'
                }`}
              >
                실물포함
              </button>
              <button
                onClick={() => onChangeNetWorthMode('FINANCIAL_ONLY')}
                className={`px-2 py-0.5 rounded-md transition-colors duration-150 cursor-pointer ${
                  !isWithPhysical
                    ? 'bg-[#2979FF] text-white shadow-[0_0_8px_rgba(41,121,255,0.35)]'
                    : 'text-[#7A8B9A] hover:text-white'
                }`}
              >
                금융만
              </button>
            </div>
          </div>

          <div className="text-2xl font-extrabold text-white tabular-nums tracking-tight">
            <CountUpNumber
              value={displayedNetWorthKrw}
              formatter={(v) => formatCurrency(v, currency, usdKrwRate)}
            />
          </div>

          {/* Side-by-Side Sub-Indicator comparing Financial vs Physical */}
          <div className="mt-2 pt-2 border-t border-[#1F2D3A]/70 flex items-center justify-between text-[11px] tabular-nums">
            <div className="flex items-center gap-1 text-gray-300">
              <Wallet className="w-3 h-3 text-[#2979FF]" />
              <span>금융:</span>
              <strong className="text-white">
                {formatCompactCurrency(summary.financialTotalKrw, currency, usdKrwRate)}
              </strong>
            </div>
            <div className="flex items-center gap-1 text-gray-300">
              <Car className="w-3 h-3 text-[#00E676]" />
              <span>실물:</span>
              <strong className="text-[#00E676]">
                {formatCompactCurrency(summary.physicalTotalKrw, currency, usdKrwRate)}
              </strong>
            </div>
          </div>
        </div>

        {/* Mini Sparkline (Neon Mint) */}
        <div className="h-12 mt-3 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={portfolioSparkData}>
              <defs>
                <linearGradient id="sparkMint1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00E676" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#00E676" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="val"
                stroke="#00E676"
                strokeWidth={2}
                fill="url(#sparkMint1)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Card 2: STOCK & ETF P/L */}
      <motion.div
        variants={cardVariants}
        className="bg-[#131C24] border border-[#1F2D3A] hover:border-[#2979FF]/60 hover:shadow-[0_8px_30px_rgba(41,121,255,0.12)] rounded-xl p-5 flex flex-col justify-between transition-colors duration-200 shadow-lg relative overflow-hidden"
      >
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold tracking-wider uppercase text-[#7A8B9A]">
              STOCK & ETF P/L (자동연동)
            </span>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                isStockPositive
                  ? 'bg-[#00E676]/12 border-[#00E676]/30'
                  : 'bg-[#FF5252]/12 border-[#FF5252]/30'
              }`}
            >
              {isStockPositive ? (
                <TrendingUp className="w-3.5 h-3.5 text-[#00E676]" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-[#FF5252]" />
              )}
            </div>
          </div>

          <div className="text-2xl font-extrabold text-white tabular-nums tracking-tight">
            <CountUpNumber
              value={totalStockEvalKrw}
              formatter={(v) => formatCurrency(v, currency, usdKrwRate)}
            />
          </div>

          <div className="mt-2 pt-2 border-t border-[#1F2D3A]/70 flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-bold tabular-nums ${
                isStockPositive
                  ? 'bg-[#00E676]/15 text-[#00E676]'
                  : 'bg-[#FF5252]/15 text-[#FF5252]'
              }`}
            >
              {isStockPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {formatSignedPercent(totalStockReturnRate)}
            </span>
            <span
              className={`text-xs font-semibold tabular-nums ${
                isStockPositive ? 'text-[#00E676]' : 'text-[#FF5252]'
              }`}
            >
              {formatSignedCurrency(totalStockProfitKrw, currency, usdKrwRate)}
            </span>
            <span className="text-[11px] text-[#7A8B9A]">평가손익</span>
          </div>
        </div>

        {/* Mini Sparkline (Purple) */}
        <div className="h-12 mt-3 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stockSparkData}>
              <defs>
                <linearGradient id="sparkPurple2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9C27B0" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#9C27B0" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="val"
                stroke="#9C27B0"
                strokeWidth={2}
                fill="url(#sparkPurple2)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Card 3: MONTHLY SURPLUS */}
      <motion.div
        variants={cardVariants}
        className="bg-[#131C24] border border-[#1F2D3A] hover:border-[#9C27B0]/60 hover:shadow-[0_8px_30px_rgba(156,39,176,0.14)] rounded-xl p-5 flex flex-col justify-between transition-colors duration-200 shadow-lg relative overflow-hidden"
      >
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold tracking-wider uppercase text-[#7A8B9A]">
              MONTHLY SURPLUS
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#9C27B0]/15 border border-[#9C27B0]/40 flex items-center justify-center">
              <Coins className="w-3.5 h-3.5 text-[#9C27B0]" />
            </div>
          </div>

          <div className="text-2xl font-extrabold text-white tabular-nums tracking-tight">
            <CountUpNumber
              value={cashflow.surplusKrw}
              formatter={(v) => formatCurrency(v, currency, usdKrwRate)}
            />
          </div>

          <div className="mt-2 pt-2 border-t border-[#1F2D3A]/70 flex items-center gap-2 flex-wrap text-xs text-[#7A8B9A] tabular-nums">
            <span className="px-2 py-0.5 rounded-md bg-[#9C27B0]/15 text-[#D05CE3] font-semibold">
              저축 + 잔액
            </span>
            <span>
              저축 {formatCurrency(cashflow.savingsKrw, currency, usdKrwRate)}
            </span>
          </div>
        </div>

        {/* Mini Sparkline (Neon Mint) */}
        <div className="h-12 mt-3 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={surplusSparkData}>
              <defs>
                <linearGradient id="sparkMint3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00E676" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#00E676" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="val"
                stroke="#00E676"
                strokeWidth={2}
                fill="url(#sparkMint3)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Card 4: SAVINGS RATE */}
      <motion.div
        variants={cardVariants}
        className="bg-[#131C24] border border-[#1F2D3A] hover:border-[#00E676]/60 hover:shadow-[0_8px_30px_rgba(0,230,118,0.12)] rounded-xl p-5 flex flex-col justify-between transition-colors duration-200 shadow-lg relative overflow-hidden"
      >
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold tracking-wider uppercase text-[#7A8B9A]">
              SAVINGS RATE
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#00E676]/12 border border-[#00E676]/30 flex items-center justify-center">
              <Percent className="w-3.5 h-3.5 text-[#00E676]" />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-extrabold text-white tabular-nums tracking-tight">
              <CountUpNumber
                value={cashflow.savingsRatePercent}
                formatter={(v) => `${v.toFixed(1)}%`}
              />
            </div>
            <span className="text-xs font-semibold text-[#00E676] tabular-nums">
              (순저축 {cashflow.pureSavingsRatePercent.toFixed(1)}%)
            </span>
          </div>

          <div className="mt-2 pt-2 border-t border-[#1F2D3A]/70 flex items-center gap-2 text-xs text-[#7A8B9A] tabular-nums">
            <span className="px-2 py-0.5 rounded-md bg-[#00E676]/15 text-[#00E676] font-bold">
              우수
            </span>
            <span>
              월 총수입 {formatCurrency(cashflow.totalIncomeKrw, currency, usdKrwRate)} 대비
            </span>
          </div>
        </div>

        {/* Mini Sparkline (Purple) */}
        <div className="h-12 mt-3 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rateSparkData}>
              <defs>
                <linearGradient id="sparkPurple4" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9C27B0" stopOpacity={0.38} />
                  <stop offset="100%" stopColor="#9C27B0" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="val"
                stroke="#9C27B0"
                strokeWidth={2}
                fill="url(#sparkPurple4)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </motion.div>
  );
};
