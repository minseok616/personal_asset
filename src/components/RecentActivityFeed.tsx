import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Coins,
  ShoppingCart,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { CurrencyCode, KisActivityItem } from '../types/portfolio';
import { formatCurrency, formatUSD } from '../utils/formatters';

interface RecentActivityFeedProps {
  activities: KisActivityItem[];
  currency: CurrencyCode;
  usdKrwRate: number;
}

type ActivityFilter = 'ALL' | '배당입금' | '매수체결' | '환전/입금';

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  activities,
  currency,
  usdKrwRate,
}) => {
  const [filter, setFilter] = useState<ActivityFilter>('ALL');

  const filteredActivities = useMemo(() => {
    if (filter === 'ALL') return activities;
    return activities.filter((a) => a.type === filter);
  }, [activities, filter]);

  const totalDividendsKrw = useMemo(
    () =>
      activities
        .filter((a) => a.type === '배당입금')
        .reduce((acc, a) => acc + a.amountKrw, 0),
    [activities]
  );

  const totalBuyTradesKrw = useMemo(
    () =>
      activities
        .filter((a) => a.type === '매수체결')
        .reduce((acc, a) => acc + a.amountKrw, 0),
    [activities]
  );

  const getTypeBadge = (type: KisActivityItem['type']) => {
    switch (type) {
      case '배당입금':
        return {
          bg: 'bg-[#00E676]/15 text-[#00E676] border-[#00E676]/35',
          icon: <Coins className="w-3.5 h-3.5 text-[#00E676]" />,
          prefix: '+',
          dot: 'bg-[#00E676] shadow-[0_0_8px_rgba(0,230,118,0.6)]',
        };
      case '매수체결':
        return {
          bg: 'bg-[#2979FF]/15 text-[#2979FF] border-[#2979FF]/35',
          icon: <ShoppingCart className="w-3.5 h-3.5 text-[#2979FF]" />,
          prefix: '',
          dot: 'bg-[#2979FF] shadow-[0_0_8px_rgba(41,121,255,0.6)]',
        };
      case '환전/입금':
        return {
          bg: 'bg-[#9C27B0]/20 text-[#D05CE3] border-[#9C27B0]/40',
          icon: <ArrowDownLeft className="w-3.5 h-3.5 text-[#D05CE3]" />,
          prefix: '+',
          dot: 'bg-[#D05CE3] shadow-[0_0_8px_rgba(208,92,227,0.6)]',
        };
      default:
        return {
          bg: 'bg-[#FF5252]/15 text-[#FF5252] border-[#FF5252]/35',
          icon: <ArrowUpRight className="w-3.5 h-3.5 text-[#FF5252]" />,
          prefix: '-',
          dot: 'bg-[#FF5252] shadow-[0_0_8px_rgba(255,82,82,0.6)]',
        };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="bg-[#131C24] border border-[#1F2D3A] hover:border-[#2979FF]/45 rounded-xl p-6 flex flex-col justify-between shadow-lg h-full transition-colors duration-200"
    >
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#00E676] shrink-0" />
                <h3 className="text-sm font-bold tracking-wider uppercase text-white">
                  RECENT ACTIVITY — 한투 배당 & 체결 피드
                </h3>
              </div>
              <p className="text-xs text-[#7A8B9A] mt-1">
                💸KIS_배당및체결내역 시트 연동 · 최근 배당수령 및 매수·외화 입금 타임라인
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0B1116] text-[#7A8B9A] border border-[#1F2D3A] shrink-0 tabular-nums">
              최근 {filteredActivities.length}건
            </span>
          </div>

          {/* Filter Pills */}
          <div className="inline-flex items-center bg-[#0B1116] p-1 rounded-xl border border-[#1F2D3A] text-[11px] font-bold self-start">
            {(['ALL', '배당입금', '매수체결', '환전/입금'] as ActivityFilter[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                  filter === tab
                    ? 'bg-[#00E676] text-[#0B1116]'
                    : 'text-[#7A8B9A] hover:text-white'
                }`}
              >
                {tab === 'ALL' ? '전체' : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline List (Full visibility without vertical/horizontal clipping) */}
        <div className="relative pl-6 space-y-2.5 my-1 flex-1">
          {/* Vertical Timeline Track Line */}
          <div className="absolute left-[7px] top-3 bottom-3 w-[2px] bg-gradient-to-b from-[#00E676]/50 via-[#2979FF]/40 to-[#1F2D3A] rounded-full" />

          {filteredActivities.map((act, idx) => {
            const badge = getTypeBadge(act.type);
            return (
              <motion.div
                key={act.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="relative bg-[#0B1116]/80 hover:bg-[#192530]/80 border border-[#1F2D3A] rounded-xl p-3.5 transition-colors duration-150 group"
              >
                {/* Timeline Dot */}
                <span
                  className={`absolute -left-[22px] top-4 w-3 h-3 rounded-full border-2 border-[#131C24] ${badge.dot}`}
                />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${badge.bg}`}
                      >
                        {badge.icon}
                        {act.type}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#131C24] border border-[#1F2D3A] text-[10px] font-bold text-gray-300">
                        {act.accountName}
                      </span>
                      <span className="text-[11px] text-[#7A8B9A] tabular-nums">
                        {act.date}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-white mt-1.5 group-hover:text-[#00E676] transition-colors">
                      {act.itemName}
                    </div>
                    <div className="text-[11px] text-[#7A8B9A] mt-0.5 tabular-nums">
                      티커: <span className="font-mono text-gray-300">{act.ticker}</span>
                      {act.quantity ? ` · 수량 ${act.quantity}주` : ''}
                      {act.unitPrice
                        ? ` · 체결단가 ${formatCurrency(act.unitPrice, currency, usdKrwRate)}`
                        : ''}
                    </div>
                  </div>

                  <div className="text-right tabular-nums shrink-0">
                    <div
                      className={`text-sm font-extrabold ${
                        act.type === '배당입금'
                          ? 'text-[#00E676]'
                          : act.type === '환전/입금'
                          ? 'text-[#D05CE3]'
                          : 'text-white'
                      }`}
                    >
                      {badge.prefix}
                      {act.currency === 'USD' && currency === 'USD' && act.amountUsd
                        ? formatUSD(act.amountUsd)
                        : formatCurrency(act.amountKrw, currency, usdKrwRate)}
                    </div>
                    {act.amountUsd && currency === 'KRW' && (
                      <div className="text-[10px] text-[#7A8B9A] mt-0.5">
                        ({formatUSD(act.amountUsd)})
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Bottom Summary Footer */}
      <div className="mt-4 pt-3 border-t border-[#1F2D3A] grid grid-cols-2 gap-2.5 text-xs tabular-nums">
        <div className="bg-[#0B1116]/70 border border-[#1F2D3A]/80 rounded-xl px-3.5 py-2.5 flex flex-col justify-between">
          <span className="text-[11px] text-[#7A8B9A]">최근 누적 배당수령</span>
          <strong className="text-[#00E676] font-extrabold text-sm mt-0.5">
            +{formatCurrency(totalDividendsKrw, currency, usdKrwRate)}
          </strong>
        </div>
        <div className="bg-[#0B1116]/70 border border-[#1F2D3A]/80 rounded-xl px-3.5 py-2.5 flex flex-col justify-between">
          <span className="text-[11px] text-[#7A8B9A]">최근 매수체결 합계</span>
          <strong className="text-[#2979FF] font-extrabold text-sm mt-0.5">
            {formatCurrency(totalBuyTradesKrw, currency, usdKrwRate)}
          </strong>
        </div>
      </div>
    </motion.div>
  );
};
