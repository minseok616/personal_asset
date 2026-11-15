import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Layers } from 'lucide-react';
import { CurrencyCode, NormalizedHistoryItem, PeriodFilter } from '../types/portfolio';
import {
  formatCompactCurrency,
  formatCurrency,
  formatSignedCurrency,
  formatSignedPercent,
} from '../utils/formatters';

interface PortfolioPerformanceChartProps {
  history: NormalizedHistoryItem[];
  currency: CurrencyCode;
  usdKrwRate: number;
}

const PERIOD_OPTIONS: PeriodFilter[] = ['3M', '6M', '1Y', 'ALL'];

export const PortfolioPerformanceChart: React.FC<PortfolioPerformanceChartProps> = ({
  history,
  currency,
  usdKrwRate,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('ALL');
  const [showSubSeries, setShowSubSeries] = useState<boolean>(true);

  const filteredData = useMemo(() => {
    if (!history.length) return [];
    switch (period) {
      case '3M':
        return history.slice(-4);
      case '6M':
        return history.slice(-7);
      case '1Y':
        return history.slice(-13);
      case 'ALL':
      default:
        return history;
    }
  }, [history, period]);

  const periodStats = useMemo(() => {
    if (filteredData.length < 2) {
      return { diffKrw: 0, diffPercent: 0, startLabel: '-', endLabel: '-' };
    }
    const first = filteredData[0];
    const last = filteredData[filteredData.length - 1];
    const diffKrw = last.totalKrw - first.totalKrw;
    const diffPercent = first.totalKrw > 0 ? (diffKrw / first.totalKrw) * 100 : 0;
    return {
      diffKrw,
      diffPercent,
      startLabel: first.dateLabel,
      endLabel: last.dateLabel,
    };
  }, [filteredData]);

  const isPositive = periodStats.diffKrw >= 0;

  return (
    <div className="bg-[#131C24] border border-[#1F2D3A] rounded-xl p-6 flex flex-col justify-between shadow-lg h-full">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <TrendingUp className="w-4 h-4 text-[#00E676] shrink-0" />
            <h3 className="text-sm font-bold tracking-wider uppercase text-white whitespace-nowrap">
              PORTFOLIO PERFORMANCE
            </h3>
            <span
              className={`px-2 py-0.5 rounded-md text-xs font-bold tabular-nums whitespace-nowrap ${
                isPositive
                  ? 'bg-[#00E676]/15 text-[#00E676]'
                  : 'bg-[#FF5252]/15 text-[#FF5252]'
              }`}
            >
              {formatSignedPercent(periodStats.diffPercent)} (
              {formatSignedCurrency(periodStats.diffKrw, currency, usdKrwRate)})
            </span>
          </div>
          <p className="text-xs text-[#7A8B9A] mt-1 tabular-nums">
            조회 기간: {periodStats.startLabel} ~ {periodStats.endLabel} ({filteredData.length}개 기준점)
          </p>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setShowSubSeries((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
              showSubSeries
                ? 'bg-[#2979FF]/15 text-[#2979FF] border-[#2979FF]/40'
                : 'bg-[#0B1116] text-[#7A8B9A] border-[#1F2D3A] hover:text-white'
            }`}
            title="예적금/주식 보조 시리즈 함께 표시"
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden md:inline">세부 비중선</span>
          </button>

          <div className="inline-flex items-center bg-[#0B1116] p-1 rounded-xl border border-[#1F2D3A]">
            {PERIOD_OPTIONS.map((opt) => {
              const active = period === opt;
              return (
                <button
                  key={opt}
                  onClick={() => setPeriod(opt)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer ${
                    active
                      ? 'bg-[#00E676] text-[#0B1116] shadow-[0_0_10px_rgba(0,230,118,0.3)]'
                      : 'text-[#7A8B9A] hover:text-white'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Recharts AreaChart */}
      <div className="w-full h-[340px] sm:h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={filteredData}
            margin={{ top: 10, right: 12, left: 4, bottom: 0 }}
          >
            <defs>
              <linearGradient id="totalNeonMintGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00E676" stopOpacity={0.42} />
                <stop offset="65%" stopColor="#00E676" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#00E676" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="savingsBlueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2979FF" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#2979FF" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="stockPurpleGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9C27B0" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#9C27B0" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1F2D3A" vertical={false} />

            <XAxis
              dataKey="shortDate"
              stroke="#7A8B9A"
              tick={{ fill: '#7A8B9A', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#1F2D3A' }}
              dy={8}
            />

            <YAxis
              stroke="#7A8B9A"
              tick={{ fill: '#7A8B9A', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatCompactCurrency(v, currency, usdKrwRate)}
              width={74}
              domain={['auto', 'auto']}
            />

            {/* Glassmorphism Dark Tooltip */}
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const item: NormalizedHistoryItem = payload[0].payload;
                return (
                  <div className="bg-[#0B1116]/85 backdrop-blur-xl border border-white/15 rounded-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.75)] min-w-[240px]">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
                      <span className="text-xs font-bold text-white tabular-nums">
                        {item.dateLabel}
                      </span>
                      <span className="text-[11px] text-[#7A8B9A] tabular-nums">
                        환율 ₩{item.exchangeRate.toLocaleString('ko-KR')}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs tabular-nums">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-gray-200 font-semibold">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#00E676]" />
                          총 포트폴리오
                        </span>
                        <span className="font-extrabold text-[#00E676] text-sm">
                          {formatCurrency(item.totalKrw, currency, usdKrwRate)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[#7A8B9A]">
                          <span className="w-2 h-2 rounded-full bg-[#2979FF]" />
                          예적금 합계
                        </span>
                        <span className="font-semibold text-white">
                          {formatCurrency(item.savingsKrw, currency, usdKrwRate)}
                        </span>
                      </div>

                      {item.cashKrw > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[#7A8B9A]">
                            <span className="w-2 h-2 rounded-full bg-[#00B0FF]" />
                            현금 · 달러예수금
                          </span>
                          <span className="font-semibold text-white">
                            {formatCurrency(item.cashKrw, currency, usdKrwRate)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[#7A8B9A]">
                          <span className="w-2 h-2 rounded-full bg-[#9C27B0]" />
                          주식 · ETF 계좌
                        </span>
                        <span className="font-semibold text-white">
                          {formatCurrency(item.stockKrw, currency, usdKrwRate)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />

            {showSubSeries && (
              <Area
                type="monotone"
                dataKey="savingsKrw"
                name="예적금"
                stroke="#2979FF"
                strokeWidth={1.75}
                strokeDasharray="4 4"
                fill="url(#savingsBlueGrad)"
                activeDot={{ r: 4, fill: '#2979FF', stroke: '#0B1116', strokeWidth: 2 }}
              />
            )}

            {showSubSeries && (
              <Area
                type="monotone"
                dataKey="stockKrw"
                name="주식계좌"
                stroke="#9C27B0"
                strokeWidth={1.75}
                fill="url(#stockPurpleGrad)"
                activeDot={{ r: 4, fill: '#9C27B0', stroke: '#0B1116', strokeWidth: 2 }}
              />
            )}

            <Area
              type="monotone"
              dataKey="totalKrw"
              name="총 순자산"
              stroke="#00E676"
              strokeWidth={3}
              fill="url(#totalNeonMintGrad)"
              activeDot={{
                r: 6,
                fill: '#00E676',
                stroke: '#0B1116',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Legend Footer */}
      <div className="mt-4 pt-3 border-t border-[#1F2D3A] flex flex-wrap items-center justify-between gap-2 text-xs text-[#7A8B9A]">
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E676]" />
            <span className="text-gray-200 font-medium">
              총자산 ({currency === 'KRW' ? '원화 ₩' : '달러 $'})
            </span>
          </span>
          {showSubSeries && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2979FF]" />
                <span>예적금 추이</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#9C27B0]" />
                <span>주식 · ETF 평가액</span>
              </span>
            </>
          )}
        </div>
        <span className="tabular-nums">
          최초 기록 대비{' '}
          <strong className="text-[#00E676]">
            {history.length >= 2
              ? formatSignedPercent(
                  ((history[history.length - 1].totalKrw - history[0].totalKrw) /
                    history[0].totalKrw) *
                    100
                )
              : '+0.00%'}
          </strong>{' '}
          성장
        </span>
      </div>
    </div>
  );
};
