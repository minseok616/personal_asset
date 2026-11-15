import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ArrowLeftRight } from 'lucide-react';
import { CurrencyCode, NormalizedCashflow, SavingsDistItem } from '../types/portfolio';
import { formatCompactCurrency, formatCurrency } from '../utils/formatters';

interface MonthlySavingsChartProps {
  savingsDist: SavingsDistItem[];
  combinedCashflowBars: SavingsDistItem[];
  cashflow: NormalizedCashflow;
  currency: CurrencyCode;
  usdKrwRate: number;
}

export const MonthlySavingsChart: React.FC<MonthlySavingsChartProps> = ({
  savingsDist,
  combinedCashflowBars,
  cashflow,
  currency,
  usdKrwRate,
}) => {
  const [viewMode, setViewMode] = useState<'ALL' | 'SAVINGS_ONLY'>('ALL');

  const chartData =
    viewMode === 'ALL'
      ? combinedCashflowBars
      : savingsDist.filter((d) => d.amount > 0);

  return (
    <div className="bg-[#131C24] border border-[#1F2D3A] rounded-xl p-6 flex flex-col justify-between shadow-lg h-full">
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-[#2979FF]" />
              <h3 className="text-sm font-bold tracking-wider uppercase text-white">
                MONTHLY SAVINGS & CASHFLOW
              </h3>
            </div>
            <p className="text-xs text-[#7A8B9A] mt-1">
              월간 저축 포트폴리오 배분(IRP · 청년도약 · 전세금 · 청약) 및 지출/잔액 구조
            </p>
          </div>

          {/* Toggle View Mode */}
          <div className="inline-flex items-center bg-[#0B1116] p-1 rounded-xl border border-[#1F2D3A] self-start sm:self-auto shrink-0 whitespace-nowrap">
            <button
              onClick={() => setViewMode('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                viewMode === 'ALL'
                  ? 'bg-[#2979FF] text-white shadow-[0_0_10px_rgba(41,121,255,0.3)]'
                  : 'text-[#7A8B9A] hover:text-white'
              }`}
            >
              전체 현금흐름
            </button>
            <button
              onClick={() => setViewMode('SAVINGS_ONLY')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                viewMode === 'SAVINGS_ONLY'
                  ? 'bg-[#00E676] text-[#0B1116] shadow-[0_0_10px_rgba(0,230,118,0.3)]'
                  : 'text-[#7A8B9A] hover:text-white'
              }`}
            >
              저축 상세만
            </button>
          </div>
        </div>

        {/* Horizontal Bar Chart */}
        <div className="w-full h-[270px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 10, bottom: 4 }}
              barCategoryGap="22%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1F2D3A"
                horizontal={true}
                vertical={false}
              />
              <XAxis
                type="number"
                stroke="#7A8B9A"
                tick={{ fill: '#7A8B9A', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1F2D3A' }}
                tickFormatter={(v) => formatCompactCurrency(v, currency, usdKrwRate)}
              />
              <YAxis
                type="category"
                dataKey="shortName"
                stroke="#7A8B9A"
                tick={{ fill: '#E2E8F0', fontSize: 12, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                width={96}
              />
              <Tooltip
                cursor={{ fill: '#192530', opacity: 0.5 }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item: SavingsDistItem = payload[0].payload;
                  return (
                    <div className="bg-[#0B1116]/90 backdrop-blur-xl border border-white/15 rounded-xl p-3.5 shadow-2xl text-xs tabular-nums">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-bold text-white">{item.name}</span>
                      </div>
                      <div className="text-sm font-extrabold text-white mt-1">
                        {formatCurrency(item.amount, currency, usdKrwRate)}
                      </div>
                      <div className="text-[11px] text-[#7A8B9A] mt-0.5">
                        월 총수입 대비 비중: {item.percentOfIncome.toFixed(1)}% ({item.category})
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={26} isAnimationActive={false}>
                {chartData.map((entry, idx) => (
                  <Cell key={`bar-${idx}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Cashflow Breakdown Summary Cards */}
      <div className="mt-4 pt-4 border-t border-[#1F2D3A] grid grid-cols-3 gap-3 text-xs tabular-nums">
        <div className="bg-[#0B1116]/70 border border-[#1F2D3A]/80 rounded-xl p-3">
          <div className="flex items-center justify-between text-[#7A8B9A] mb-1">
            <span>월 정기저축</span>
            <span className="w-2 h-2 rounded-full bg-[#00E676]" />
          </div>
          <div className="text-sm font-extrabold text-[#00E676]">
            {formatCurrency(cashflow.savingsKrw, currency, usdKrwRate)}
          </div>
          <div className="text-[10px] text-[#7A8B9A] mt-0.5">
            비중 {cashflow.pureSavingsRatePercent.toFixed(1)}%
          </div>
        </div>

        <div className="bg-[#0B1116]/70 border border-[#1F2D3A]/80 rounded-xl p-3">
          <div className="flex items-center justify-between text-[#7A8B9A] mb-1">
            <span>월 잉여잔액</span>
            <span className="w-2 h-2 rounded-full bg-[#2979FF]" />
          </div>
          <div className="text-sm font-extrabold text-[#2979FF]">
            {formatCurrency(cashflow.balanceKrw, currency, usdKrwRate)}
          </div>
          <div className="text-[10px] text-[#7A8B9A] mt-0.5">
            비중{' '}
            {cashflow.totalIncomeKrw > 0
              ? ((cashflow.balanceKrw / cashflow.totalIncomeKrw) * 100).toFixed(1)
              : '0.0'}
            %
          </div>
        </div>

        <div className="bg-[#0B1116]/70 border border-[#1F2D3A]/80 rounded-xl p-3">
          <div className="flex items-center justify-between text-[#7A8B9A] mb-1">
            <span>월 지출합계</span>
            <span className="w-2 h-2 rounded-full bg-[#FF5252]" />
          </div>
          <div className="text-sm font-extrabold text-[#FF5252]">
            {formatCurrency(cashflow.expenseKrw, currency, usdKrwRate)}
          </div>
          <div className="text-[10px] text-[#7A8B9A] mt-0.5">
            비중{' '}
            {cashflow.totalIncomeKrw > 0
              ? ((cashflow.expenseKrw / cashflow.totalIncomeKrw) * 100).toFixed(1)
              : '0.0'}
            %
          </div>
        </div>
      </div>
    </div>
  );
};
