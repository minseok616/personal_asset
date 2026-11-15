import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Landmark,
  Car,
  Smartphone,
  Gem,
  Banknote,
  Gift,
  Award,
  Wallet,
  Sparkles,
} from 'lucide-react';
import {
  CurrencyCode,
  ManualCashAccountItem,
  PhysicalAssetItem,
} from '../types/portfolio';
import { formatCompactCurrency, formatCurrency } from '../utils/formatters';
import { CountUpNumber } from './CountUpNumber';

interface ManualAndPhysicalAssetsCardProps {
  manualCashAccounts: ManualCashAccountItem[];
  manualCashTotalKrw: number;
  physicalAssets: PhysicalAssetItem[];
  physicalAssetsTotalKrw: number;
  currency: CurrencyCode;
  usdKrwRate: number;
}

export const ManualAndPhysicalAssetsCard: React.FC<ManualAndPhysicalAssetsCardProps> = ({
  manualCashAccounts,
  manualCashTotalKrw,
  physicalAssets,
  physicalAssetsTotalKrw,
  currency,
  usdKrwRate,
}) => {
  const [filterMode, setFilterMode] = useState<'ALL' | 'CASH_ONLY' | 'PHYSICAL_ONLY'>('ALL');
  const combinedManualTotal = manualCashTotalKrw + physicalAssetsTotalKrw;

  const getManualIcon = (cat: ManualCashAccountItem['category']) => {
    switch (cat) {
      case '증여금':
        return <Gift className="w-4 h-4 text-[#9C27B0]" />;
      case '보유현금':
        return <Banknote className="w-4 h-4 text-[#00E676]" />;
      case '정부기여금':
        return <Award className="w-4 h-4 text-[#2979FF]" />;
      case 'CMA':
        return <Wallet className="w-4 h-4 text-[#FFAB00]" />;
      default:
        return <Landmark className="w-4 h-4 text-[#00B0FF]" />;
    }
  };

  const getPhysicalIcon = (cat: PhysicalAssetItem['category']) => {
    switch (cat) {
      case '차량/모빌리티':
        return <Car className="w-4 h-4 text-[#00E676]" />;
      case 'IT/디지털':
        return <Smartphone className="w-4 h-4 text-[#2979FF]" />;
      default:
        return <Gem className="w-4 h-4 text-[#FFAB00]" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="bg-[#131C24] border border-[#1F2D3A] hover:border-[#00E676]/45 rounded-xl p-6 shadow-lg space-y-5 transition-colors duration-200"
    >
      {/* Top Header & Summary Pills */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-[#1F2D3A] pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-4 h-4 text-[#00E676]" />
            <h3 className="text-sm font-bold tracking-wider uppercase text-white">
              CASH & MANUAL ASSETS — 수동 관리 자산 (시트 직접 입력)
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30">
              입출금 · 현금 · 증여 · 실물 통합
            </span>
          </div>
          <p className="text-xs text-[#7A8B9A] mt-1">
            구글 시트 수동 관리 항목(하나·토스·CMA, 보유현금 3,600만, 증여금 5,000만, 정부기여금 640만, 실물자산 2,632만) 실시간 현황
          </p>
        </div>

        {/* Right Totals & Filter Toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-[#0B1116] border border-[#1F2D3A] text-xs tabular-nums">
            <div>
              <span className="text-[#7A8B9A] mr-1.5">수동 현금합계:</span>
              <strong className="text-[#00E676] font-extrabold">
                <CountUpNumber
                  value={manualCashTotalKrw}
                  formatter={(v) => formatCurrency(v, currency, usdKrwRate)}
                />
              </strong>
            </div>
            <span className="text-[#1F2D3A]">|</span>
            <div>
              <span className="text-[#7A8B9A] mr-1.5">실물자산 합계:</span>
              <strong className="text-[#2979FF] font-extrabold">
                <CountUpNumber
                  value={physicalAssetsTotalKrw}
                  formatter={(v) => formatCurrency(v, currency, usdKrwRate)}
                />
              </strong>
            </div>
          </div>

          <div className="inline-flex items-center bg-[#0B1116] p-1 rounded-xl border border-[#1F2D3A] text-xs font-bold">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1 rounded-lg transition-colors duration-150 cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-[#00E676] text-[#0B1116]'
                  : 'text-[#7A8B9A] hover:text-white'
              }`}
            >
              전체 ({manualCashAccounts.length + physicalAssets.length})
            </button>
            <button
              onClick={() => setFilterMode('CASH_ONLY')}
              className={`px-3 py-1 rounded-lg transition-colors duration-150 cursor-pointer ${
                filterMode === 'CASH_ONLY'
                  ? 'bg-[#2979FF] text-white'
                  : 'text-[#7A8B9A] hover:text-white'
              }`}
            >
              💰입출금·현금·증여 ({manualCashAccounts.length})
            </button>
            <button
              onClick={() => setFilterMode('PHYSICAL_ONLY')}
              className={`px-3 py-1 rounded-lg transition-colors duration-150 cursor-pointer ${
                filterMode === 'PHYSICAL_ONLY'
                  ? 'bg-[#9C27B0] text-white'
                  : 'text-[#7A8B9A] hover:text-white'
              }`}
            >
              🚗실물자산 ({physicalAssets.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content Grid: Left Manual Cash Accounts + Right Physical Assets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Manual Cash Accounts Section (7 cols when ALL, 12 when CASH_ONLY) */}
        {(filterMode === 'ALL' || filterMode === 'CASH_ONLY') && (
          <div
            className={`${
              filterMode === 'ALL' ? 'lg:col-span-7' : 'lg:col-span-12'
            } space-y-3`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-gray-200 px-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00E676]" />
                💰 수동 입출금통장 · 보유현금 · 증여금 · 정부기여금
              </span>
              <span className="text-[#00E676] tabular-nums">
                {formatCurrency(manualCashTotalKrw, currency, usdKrwRate)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {manualCashAccounts.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#0B1116]/85 border border-[#1F2D3A] hover:border-[#00E676]/50 hover:bg-[#111B24] rounded-xl p-3.5 flex flex-col justify-between transition-colors duration-150 shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-[#131C24] border border-[#1F2D3A] flex items-center justify-center shrink-0">
                        {getManualIcon(item.category)}
                      </div>
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold border"
                        style={{
                          backgroundColor: `${item.color}18`,
                          color: item.color,
                          borderColor: `${item.color}45`,
                        }}
                      >
                        {item.badgeText}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-white truncate" title={item.name}>
                      {item.name}
                    </div>
                    <div className="text-[10px] text-[#7A8B9A] mt-0.5">{item.institution}</div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#1F2D3A]/70">
                    <div className="text-sm font-extrabold text-white tabular-nums">
                      <CountUpNumber
                        value={item.amountKrw}
                        formatter={(v) => formatCurrency(v, currency, usdKrwRate)}
                      />
                    </div>
                    {/* Animated Progress Bar */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[#131C24] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(100, Math.max(4, item.weightOfManualPercent))}%`,
                          }}
                          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                      </div>
                      <span className="text-[10px] text-[#7A8B9A] font-semibold tabular-nums">
                        {item.weightOfManualPercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Physical Assets Section (5 cols when ALL, 12 when PHYSICAL_ONLY) */}
        {(filterMode === 'ALL' || filterMode === 'PHYSICAL_ONLY') && (
          <div
            className={`${
              filterMode === 'ALL' ? 'lg:col-span-5' : 'lg:col-span-12'
            } space-y-3`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-gray-200 px-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2979FF]" />
                🚗 실물 · 기타자산 감가상각 & 현재추정가치 분석
              </span>
              <span className="text-[#2979FF] tabular-nums">
                현재가치 합계 {formatCurrency(physicalAssetsTotalKrw, currency, usdKrwRate)}
              </span>
            </div>

            <div className="space-y-3">
              {physicalAssets.map((phys) => {
                const weightOfPhys =
                  physicalAssetsTotalKrw > 0
                    ? (phys.currentValueKrw / physicalAssetsTotalKrw) * 100
                    : 0;
                const isDepreciating = phys.accumulatedDepreciationKrw > 0;
                const isAppreciating = phys.accumulatedDepreciationKrw < 0;
                const residualPct = phys.residualValueRatioPercent;
                const depPct = phys.depreciationRatioPercent;

                return (
                  <div
                    key={phys.id}
                    className="bg-gradient-to-r from-[#0B1116] to-[#111A24] border border-[#1F2D3A] hover:border-[#2979FF]/50 rounded-xl p-4 transition-colors duration-150 space-y-3"
                  >
                    {/* Top Row: Asset Name, Depreciation Rate Badge & Current Value */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#131C24] border border-[#1F2D3A] flex items-center justify-center shrink-0">
                          {getPhysicalIcon(phys.category)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-extrabold text-white truncate">
                              {phys.name}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1F2D3A] text-gray-300 shrink-0">
                              {phys.category}
                            </span>
                            {phys.annualDepreciationRatePercent > 0 ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#FF5252]/15 text-[#FF5252] border border-[#FF5252]/35 shrink-0">
                                연 {phys.annualDepreciationRatePercent}% 감가
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#FFAB00]/15 text-[#FFAB00] border border-[#FFAB00]/35 shrink-0">
                                현물 시세 연동
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#7A8B9A] mt-0.5 truncate">
                            {phys.note}
                            {phys.acquisitionDate ? ` · 취득: ${phys.acquisitionDate}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="text-right tabular-nums shrink-0">
                        <div className="text-sm font-extrabold text-[#00E676]">
                          <CountUpNumber
                            value={phys.currentValueKrw}
                            formatter={(v) => formatCurrency(v, currency, usdKrwRate)}
                          />
                        </div>
                        <div className="text-[10px] text-[#7A8B9A] mt-0.5">
                          실물 내 비중 {weightOfPhys.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Middle 3-Column Box: 취득원가 vs 감가상각누계액 vs 현재추정가치 */}
                    <div className="grid grid-cols-3 gap-2 bg-[#131C24]/90 border border-[#1F2D3A]/80 rounded-lg p-2.5 text-[11px] tabular-nums">
                      <div>
                        <div className="text-[10px] text-[#7A8B9A]">취득원가 (매입가)</div>
                        <div className="font-bold text-gray-200 mt-0.5">
                          {formatCurrency(phys.purchasePriceKrw, currency, usdKrwRate)}
                        </div>
                      </div>
                      <div className="border-l border-[#1F2D3A] pl-2.5">
                        <div className="text-[10px] text-[#7A8B9A]">
                          {isAppreciating ? '시세 평가차익' : '감가상각누계액'}
                        </div>
                        <div
                          className={`font-extrabold mt-0.5 ${
                            isDepreciating
                              ? 'text-[#FF5252]'
                              : isAppreciating
                              ? 'text-[#00E676]'
                              : 'text-gray-300'
                          }`}
                        >
                          {isDepreciating
                            ? `-${formatCurrency(phys.accumulatedDepreciationKrw, currency, usdKrwRate)}`
                            : isAppreciating
                            ? `+${formatCurrency(Math.abs(phys.accumulatedDepreciationKrw), currency, usdKrwRate)}`
                            : '₩0'}
                        </div>
                      </div>
                      <div className="border-l border-[#1F2D3A] pl-2.5">
                        <div className="text-[10px] text-[#7A8B9A]">현재추정가치 (잔존율)</div>
                        <div className="font-extrabold text-[#00E676] mt-0.5">
                          {isAppreciating
                            ? `122.7% (+22.7%)`
                            : `잔존 ${residualPct.toFixed(1)}%`}
                        </div>
                      </div>
                    </div>

                    {/* Dual Progress Bar: 취득원가 대비 잔존가치 vs 감가상각누계액 */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] tabular-nums">
                        <span className="text-[#00E676] font-bold">
                          현재추정가치 {residualPct.toFixed(1)}%
                        </span>
                        {isDepreciating ? (
                          <span className="text-[#FF5252] font-bold">
                            감가상각누계 {depPct.toFixed(1)}% (연 {phys.annualDepreciationRatePercent}% 감가)
                          </span>
                        ) : (
                          <span className="text-[#FFAB00] font-bold">
                            감가 없음 · 금 시세 상승분 반영
                          </span>
                        )}
                      </div>
                      <div className="w-full h-2 bg-[#131C24] rounded-full overflow-hidden flex border border-[#1F2D3A]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, Math.max(6, residualPct))}%` }}
                          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                          className="h-full"
                          style={{ backgroundColor: phys.color }}
                        />
                        {isDepreciating && (
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, Math.max(0, depPct))}%` }}
                            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                            className="h-full bg-[#FF5252]/70"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Summary Footer inside Physical Assets Column */}
              <div className="px-4 py-3 rounded-xl bg-[#0B1116]/60 border border-[#1F2D3A] flex items-center justify-between text-xs tabular-nums">
                <span className="text-[#7A8B9A]">수동 관리 자산 총합 (현금+증여+실물):</span>
                <strong className="text-white font-extrabold text-sm">
                  {formatCompactCurrency(combinedManualTotal, currency, usdKrwRate)} (
                  {formatCurrency(combinedManualTotal, currency, usdKrwRate)})
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
