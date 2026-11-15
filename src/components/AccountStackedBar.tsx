import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers } from 'lucide-react';
import { AccountBreakdownItem, CurrencyCode } from '../types/portfolio';
import { formatCompactCurrency, formatCurrency, formatSignedPercent } from '../utils/formatters';

interface AccountStackedBarProps {
  accounts: AccountBreakdownItem[];
  totalNetWorthKrw: number;
  currency: CurrencyCode;
  usdKrwRate: number;
}

export const AccountStackedBar: React.FC<AccountStackedBarProps> = ({
  accounts,
  totalNetWorthKrw,
  currency,
  usdKrwRate,
}) => {
  const [hoveredAccount, setHoveredAccount] = useState<string | null>(null);
  const activeAcc = accounts.find((a) => a.accountName === hoveredAccount) || null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="bg-[#131C24] border border-[#1F2D3A] hover:border-[#00E676]/45 rounded-xl p-5 shadow-lg relative transition-colors duration-200"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#00E676]" />
          <h3 className="text-xs font-bold tracking-wider uppercase text-white">
            ACCOUNT ASSET DISTRIBUTION — 수동 자산 & 한투 자동연동 계좌 비중 스택 바
          </h3>
        </div>
        <div className="text-xs text-[#7A8B9A] tabular-nums">
          총 통합 순자산 (실물 포함):{' '}
          <strong className="text-white font-bold">
            {formatCurrency(totalNetWorthKrw, currency, usdKrwRate)}
          </strong>
        </div>
      </div>

      {/* Animated Spring Horizontal Stacked Progress Bar + Floating Glassmorphism Overlay Tooltip */}
      <div className="relative">
        <AnimatePresence>
          {activeAcc && (
            <motion.div
              key="stacked-bar-floating-tooltip"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              className="absolute bottom-full left-0 right-0 mb-2.5 z-30 pointer-events-none px-4 py-2.5 rounded-xl bg-[#0B1116]/95 backdrop-blur-md border border-[#00E676]/40 shadow-[0_10px_32px_rgba(0,0,0,0.8)] flex flex-wrap items-center justify-between gap-3 text-xs tabular-nums"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: activeAcc.color }}
                />
                <span className="font-bold text-white text-sm">{activeAcc.accountName}</span>
                <span className="text-[#7A8B9A]">({activeAcc.category})</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    activeAcc.isManual
                      ? 'bg-[#2979FF]/20 text-[#2979FF]'
                      : 'bg-[#00E676]/20 text-[#00E676]'
                  }`}
                >
                  {activeAcc.isManual ? '수동시트' : '한투/자동'}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-[#7A8B9A] mr-1.5">평가합계:</span>
                  <span className="font-extrabold text-white">
                    {formatCurrency(activeAcc.totalAmountKrw, currency, usdKrwRate)}
                  </span>
                </div>
                <div>
                  <span className="text-[#7A8B9A] mr-1.5">전체 비중:</span>
                  <span className="font-extrabold text-[#00E676]">
                    {activeAcc.weightPercent.toFixed(2)}%
                  </span>
                </div>
                {activeAcc.profitKrw !== 0 && (
                  <div>
                    <span className="text-[#7A8B9A] mr-1.5">수익률:</span>
                    <span
                      className={`font-bold ${
                        activeAcc.returnRate >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'
                      }`}
                    >
                      {formatSignedPercent(activeAcc.returnRate)}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full h-5 bg-[#0B1116] rounded-xl overflow-hidden flex border border-[#1F2D3A] p-0.5 gap-0.5">
          {accounts.map((acc, idx) => {
            const isHovered = hoveredAccount === acc.accountName;
            const isDimmed = hoveredAccount !== null && !isHovered;
            return (
              <motion.div
                key={acc.accountName}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(1.5, acc.weightPercent)}%` }}
                transition={{
                  type: 'spring',
                  stiffness: 110,
                  damping: 20,
                  delay: idx * 0.04,
                }}
                onMouseEnter={() => setHoveredAccount(acc.accountName)}
                onMouseLeave={() => setHoveredAccount(null)}
                style={{ backgroundColor: acc.color }}
                className={`h-full first:rounded-l-lg last:rounded-r-lg transition-opacity duration-150 cursor-pointer relative ${
                  isHovered ? 'brightness-125 z-10' : ''
                } ${isDimmed ? 'opacity-40' : 'opacity-95'}`}
              />
            );
          })}
        </div>
      </div>

      {/* Bottom Legend Pills */}
      <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 text-xs tabular-nums">
        {accounts.map((acc) => {
          const isHovered = hoveredAccount === acc.accountName;
          return (
            <div
              key={acc.accountName}
              onMouseEnter={() => setHoveredAccount(acc.accountName)}
              onMouseLeave={() => setHoveredAccount(null)}
              className={`px-2.5 py-2 rounded-lg border transition-colors duration-150 cursor-pointer flex flex-col justify-between ${
                isHovered
                  ? 'bg-[#192530] border-[#00E676]/50'
                  : 'bg-[#0B1116]/60 border-[#1F2D3A]/80 hover:border-[#2E4254]'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: acc.color }}
                  />
                  <span className="font-bold text-gray-200 truncate text-[11px]">
                    {acc.accountName}
                  </span>
                </div>
                <span className="font-extrabold text-white text-[11px]">
                  {acc.weightPercent.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-[11px]">
                <span className="text-[#7A8B9A] truncate max-w-[90px]" title={acc.category}>
                  {acc.isManual ? '수동입력' : '자동연동'}
                </span>
                <span className="font-semibold text-gray-300">
                  {formatCompactCurrency(acc.totalAmountKrw, currency, usdKrwRate)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
