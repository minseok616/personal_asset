import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Sliders,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  CurrencyCode,
  ExposureViewMode,
  IntegratedSummary,
  RebalancingItem,
} from '../types/portfolio';
import {
  formatCurrency,
  formatSignedCurrency,
  formatSignedPercent,
} from '../utils/formatters';
import { CountUpNumber } from './CountUpNumber';

interface RebalancingSimulatorProps {
  rebalancingPlan: RebalancingItem[];
  rebalancingPlanUnderlying?: RebalancingItem[];
  integratedSummary: IntegratedSummary;
  currency: CurrencyCode;
  usdKrwRate: number;
  compact?: boolean;
  exposureMode?: ExposureViewMode;
  onChangeExposureMode?: (mode: ExposureViewMode) => void;
}

export const RebalancingSimulator: React.FC<RebalancingSimulatorProps> = ({
  rebalancingPlan,
  rebalancingPlanUnderlying,
  integratedSummary,
  currency,
  usdKrwRate,
  compact = false,
  exposureMode: propExposureMode,
  onChangeExposureMode,
}) => {
  const totalNetWorthKrw = integratedSummary.totalNetWorthKrw;
  const [localExposureMode, setLocalExposureMode] = useState<ExposureViewMode>('UNDERLYING');
  const exposureMode = propExposureMode ?? localExposureMode;

  const handleSelectExposure = (mode: ExposureViewMode) => {
    setLocalExposureMode(mode);
    onChangeExposureMode?.(mode);
  };

  const activePlan = useMemo(() => {
    if (
      exposureMode === 'UNDERLYING' &&
      rebalancingPlanUnderlying &&
      rebalancingPlanUnderlying.length > 0
    ) {
      return rebalancingPlanUnderlying;
    }
    return rebalancingPlan;
  }, [exposureMode, rebalancingPlan, rebalancingPlanUnderlying]);

  // Interactive target weights state (keyed by item.id)
  const [targetWeights, setTargetWeights] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    [...rebalancingPlan, ...(rebalancingPlanUnderlying || [])].forEach((item) => {
      map[item.id] = Number(item.targetWeightPercent.toFixed(1));
    });
    return map;
  });

  useEffect(() => {
    setTargetWeights((prev) => {
      const next = { ...prev };
      [...rebalancingPlan, ...(rebalancingPlanUnderlying || [])].forEach((item) => {
        if (next[item.id] === undefined) {
          next[item.id] = Number(item.targetWeightPercent.toFixed(1));
        }
      });
      return next;
    });
  }, [rebalancingPlan, rebalancingPlanUnderlying]);

  const handleWeightChange = (id: string, newVal: number) => {
    const clamped = Math.max(0, Math.min(100, Number(newVal.toFixed(1))));
    setTargetWeights((prev) => ({
      ...prev,
      [id]: clamped,
    }));
  };

  // Presets
  const applyPreset = (mode: 'DEFAULT' | 'GROWTH' | 'CONSERVATIVE' | 'CURRENT') => {
    const next: Record<string, number> = { ...targetWeights };
    activePlan.forEach((item) => {
      if (mode === 'CURRENT') {
        next[item.id] = Number(item.currentWeightPercent.toFixed(1));
      } else if (mode === 'GROWTH') {
        if (item.assetClass.includes('현금')) next[item.id] = 12;
        else if (item.assetClass.includes('예적금')) next[item.id] = 18;
        else if (item.assetClass.includes('해외주식') || item.assetClass.includes('ETF'))
          next[item.id] = exposureMode === 'UNDERLYING' ? 55 : 40;
        else if (item.assetClass.includes('해외직투')) next[item.id] = 20;
        else if (item.assetClass.includes('해외채권') || item.assetClass.includes('해외 채권'))
          next[item.id] = 10;
        else next[item.id] = 5;
      } else if (mode === 'CONSERVATIVE') {
        if (item.assetClass.includes('현금')) next[item.id] = 25;
        else if (item.assetClass.includes('예적금')) next[item.id] = 40;
        else if (item.assetClass.includes('해외주식') || item.assetClass.includes('ETF'))
          next[item.id] = exposureMode === 'UNDERLYING' ? 20 : 18;
        else if (item.assetClass.includes('해외직투')) next[item.id] = 5;
        else if (item.assetClass.includes('해외채권') || item.assetClass.includes('해외 채권'))
          next[item.id] = 10;
        else next[item.id] = 5;
      } else {
        next[item.id] = Number(item.targetWeightPercent.toFixed(1));
      }
    });
    setTargetWeights(next);
  };

  const normalizeTo100 = () => {
    const keys = activePlan.map((i) => i.id);
    const sum = keys.reduce((a, k) => a + (targetWeights[k] ?? 0), 0);
    if (sum <= 0) return;
    const next: Record<string, number> = { ...targetWeights };
    let running = 0;
    keys.forEach((k, idx) => {
      if (idx === keys.length - 1) {
        next[k] = Number(Math.max(0, 100 - running).toFixed(1));
      } else {
        const v = Number((((targetWeights[k] ?? 0) / sum) * 100).toFixed(1));
        next[k] = v;
        running += v;
      }
    });
    setTargetWeights(next);
  };

  const simulatedRows = useMemo(() => {
    return activePlan.map((item) => {
      const targetWeight = targetWeights[item.id] ?? item.targetWeightPercent;
      const targetAmountKrw = totalNetWorthKrw * (targetWeight / 100);
      const diffAmountKrw = targetAmountKrw - item.currentAmountKrw;
      const diffWeight = targetWeight - item.currentWeightPercent;

      return {
        ...item,
        targetWeight,
        targetAmountKrw,
        diffAmountKrw,
        diffWeight,
      };
    });
  }, [activePlan, targetWeights, totalNetWorthKrw]);

  const totalTargetWeight = useMemo(
    () => simulatedRows.reduce((acc, r) => acc + r.targetWeight, 0),
    [simulatedRows]
  );

  const isWeightValid = Math.abs(totalTargetWeight - 100) < 0.15;

  const totalBuyNeededKrw = useMemo(
    () =>
      simulatedRows
        .filter((r) => r.diffAmountKrw > 0)
        .reduce((acc, r) => acc + r.diffAmountKrw, 0),
    [simulatedRows]
  );

  return (
    <div className="bg-[#131C24] border border-[#1F2D3A] rounded-xl p-6 shadow-lg space-y-6">
      {/* Header & Presets */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-[#1F2D3A] pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Sliders className="w-4 h-4 text-[#00E676]" />
            <h3 className="text-sm font-bold tracking-wider uppercase text-white">
              INTERACTIVE REBALANCING SIMULATOR — 자산배분 시뮬레이터
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30">
              실시간 시뮬레이션
            </span>

            {/* Exposure Basis Toggle: [기초자산 실질 기준 (권장) | 상장시장 기준] */}
            <div className="inline-flex items-center bg-[#0B1116] p-1 rounded-xl border border-[#1F2D3A] text-[11px] font-bold">
              <button
                onClick={() => handleSelectExposure('UNDERLYING')}
                className={`px-2.5 py-1 rounded-lg transition-colors duration-150 cursor-pointer ${
                  exposureMode === 'UNDERLYING'
                    ? 'bg-[#00E676] text-[#0B1116] shadow-[0_0_10px_rgba(0,230,118,0.25)]'
                    : 'text-[#7A8B9A] hover:text-white'
                }`}
              >
                기초자산 실질 기준 (권장)
              </button>
              <button
                onClick={() => handleSelectExposure('LISTED_MARKET')}
                className={`px-2.5 py-1 rounded-lg transition-colors duration-150 cursor-pointer ${
                  exposureMode === 'LISTED_MARKET'
                    ? 'bg-[#2979FF] text-white'
                    : 'text-[#7A8B9A] hover:text-white'
                }`}
              >
                상장시장 기준
              </button>
            </div>
          </div>
          <p className="text-xs text-[#7A8B9A] mt-1.5">
            {exposureMode === 'UNDERLYING'
              ? '연금·ISA·IRP 내 국내상장 미국 ETF(나스닥100·S&P500·배당다우·미국채30년)를 실제 기초자산(해외주식·해외채권)으로 합산해 시뮬레이션합니다. 기준 금융순자산: '
              : '상장 거래소(KRX 국내상장 ETF vs US 직투) 기준으로 자산군 목표 비중을 조절합니다. 기준 금융순자산: '}
            <strong className="text-white tabular-nums">
              {formatCurrency(totalNetWorthKrw, currency, usdKrwRate)}
            </strong>
          </p>
        </div>

        {/* Preset Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => applyPreset('DEFAULT')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0B1116] hover:bg-[#192530] text-gray-200 border border-[#1F2D3A] transition-colors cursor-pointer"
          >
            추천 표준 배분
          </button>
          <button
            onClick={() => applyPreset('GROWTH')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0B1116] hover:bg-[#192530] text-[#00E676] border border-[#00E676]/30 transition-colors cursor-pointer"
          >
            공격형 성장 (ETF·미국주 60%)
          </button>
          <button
            onClick={() => applyPreset('CONSERVATIVE')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0B1116] hover:bg-[#192530] text-[#2979FF] border border-[#2979FF]/30 transition-colors cursor-pointer"
          >
            안정형 방어 (현금·예적금 65%)
          </button>
          <button
            onClick={() => applyPreset('CURRENT')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0B1116] hover:bg-[#192530] text-[#7A8B9A] hover:text-white border border-[#1F2D3A] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            현재 비중으로 초기화
          </button>
        </div>
      </div>

      {/* Main Content Grid: Left Comparison Chart + Right Interactive Sliders & Calculator */}
      <div className={`grid grid-cols-1 ${compact ? 'xl:grid-cols-12' : 'xl:grid-cols-12'} gap-6 items-start`}>
        {/* Left: Current vs Target Weight Comparison BarChart (5 cols) */}
        <div className="xl:col-span-5 bg-[#0B1116]/60 border border-[#1F2D3A] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
              자산군별 현재 비중 vs 목표 비중 (%)
            </span>
            <span className="text-[11px] text-[#7A8B9A]">단위: %</span>
          </div>

          <div className="w-full h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={simulatedRows}
                margin={{ top: 10, right: 10, left: -12, bottom: 8 }}
                barGap={6}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2D3A" vertical={false} />
                <XAxis
                  dataKey="assetClass"
                  stroke="#7A8B9A"
                  tick={{ fill: '#E2E8F0', fontSize: 11, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#1F2D3A' }}
                  interval={0}
                />
                <YAxis
                  stroke="#7A8B9A"
                  tick={{ fill: '#7A8B9A', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  cursor={{ fill: '#192530', opacity: 0.45 }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const row = payload[0].payload;
                    const isBuy = row.diffAmountKrw >= 0;
                    return (
                      <div className="bg-[#0B1116]/90 backdrop-blur-xl border border-white/15 rounded-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.7)] text-xs tabular-nums min-w-[230px]">
                        <div className="font-bold text-white text-sm mb-1 flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: row.color }}
                          />
                          {row.assetClass}
                        </div>
                        <div className="text-[11px] text-[#7A8B9A] mb-2.5 border-b border-[#1F2D3A] pb-2">
                          {row.description}
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-[#7A8B9A]">현재 비중 (평가액):</span>
                            <span className="font-bold text-[#2979FF]">
                              {row.currentWeightPercent.toFixed(1)}% (
                              {formatCurrency(row.currentAmountKrw, currency, usdKrwRate)})
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#7A8B9A]">목표 비중 (목표액):</span>
                            <span className="font-bold text-[#00E676]">
                              {row.targetWeight.toFixed(1)}% (
                              {formatCurrency(row.targetAmountKrw, currency, usdKrwRate)})
                            </span>
                          </div>
                          <div className="flex justify-between pt-1.5 border-t border-[#1F2D3A]">
                            <span className="text-gray-300 font-semibold">리밸런싱 조정액:</span>
                            <span
                              className={`font-extrabold ${
                                isBuy ? 'text-[#00E676]' : 'text-[#FF5252]'
                              }`}
                            >
                              {formatSignedCurrency(row.diffAmountKrw, currency, usdKrwRate)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(value) => <span className="text-gray-300 font-medium">{value}</span>}
                />
                <Bar
                  dataKey="currentWeightPercent"
                  name="현재 비중 (%)"
                  fill="#2979FF"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="targetWeight"
                  name="목표 비중 (%)"
                  fill="#00E676"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Box inside Chart Column */}
          <div className="mt-4 pt-3 border-t border-[#1F2D3A] flex items-center justify-between text-xs tabular-nums">
            <div className="flex items-center gap-2">
              {isWeightValid ? (
                <span className="inline-flex items-center gap-1.5 text-[#00E676] font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  목표 비중 합계: {totalTargetWeight.toFixed(1)}%
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[#FF5252] font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  목표 합계: {totalTargetWeight.toFixed(1)}% (100% 권장)
                </span>
              )}
            </div>

            {!isWeightValid && (
              <button
                onClick={normalizeTo100}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#00E676] text-[#0B1116] hover:bg-[#00E676]/90 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                100% 자동 맞춤
              </button>
            )}

            {isWeightValid && (
              <span className="text-[#7A8B9A]">
                이동 필요 자금:{' '}
                <strong className="text-white">
                  {formatCurrency(totalBuyNeededKrw, currency, usdKrwRate)}
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Right: Interactive Sliders & Action Table (7 cols) */}
        <div className="xl:col-span-7 space-y-3">
          {simulatedRows.map((row) => {
            const isBuy = row.diffAmountKrw > 500;
            const isSell = row.diffAmountKrw < -500;

            return (
              <div
                key={row.id}
                className="bg-[#0B1116]/75 border border-[#1F2D3A] hover:border-[#00E676]/40 hover:shadow-[0_6px_20px_rgba(0,230,118,0.08)] rounded-xl p-4 transition-colors duration-150"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4">
                  {/* Asset Class Info (4 cols) */}
                  <div className="md:col-span-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className="font-bold text-white text-sm">{row.assetClass}</span>
                    </div>
                    <div className="text-[11px] text-[#7A8B9A] mt-0.5 truncate" title={row.description}>
                      {row.description}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-xs tabular-nums">
                      <span className="text-[#7A8B9A]">현재:</span>
                      <span className="font-bold text-gray-200">
                        {formatCurrency(row.currentAmountKrw, currency, usdKrwRate)}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-[#2979FF]/15 text-[#2979FF] font-bold text-[11px]">
                        {row.currentWeightPercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Interactive Slider + Number Input + Spring Progress Bar (4 cols) */}
                  <div className="md:col-span-4 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#7A8B9A] font-medium">목표 비중 조절</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={row.targetWeight}
                          onChange={(e) =>
                            handleWeightChange(row.id, parseFloat(e.target.value) || 0)
                          }
                          className="w-16 px-2 py-0.5 rounded-lg bg-[#131C24] border border-[#1F2D3A] focus:border-[#00E676] focus:outline-none text-right font-extrabold text-[#00E676] text-xs tabular-nums"
                        />
                        <span className="text-xs font-bold text-[#00E676]">%</span>
                      </div>
                    </div>

                    {/* Spring-Animated Progress Bar */}
                    <div className="w-full h-1.5 bg-[#131C24] rounded-full overflow-hidden border border-[#1F2D3A]/60 relative">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: row.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, row.targetWeight)}%` }}
                        transition={{ type: 'spring', stiffness: 130, damping: 20 }}
                      />
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={80}
                      step={0.5}
                      value={row.targetWeight}
                      onChange={(e) => handleWeightChange(row.id, parseFloat(e.target.value) || 0)}
                      className="w-full h-2 bg-[#131C24] rounded-lg appearance-none cursor-pointer accent-[#00E676]"
                    />

                    <div className="flex justify-between text-[10px] text-[#7A8B9A] tabular-nums">
                      <span>목표액: {formatCurrency(row.targetAmountKrw, currency, usdKrwRate)}</span>
                      <span>비중차: {formatSignedPercent(row.diffWeight, 1)}</span>
                    </div>
                  </div>

                  {/* Action Required Calculation Result (4 cols) */}
                  <div className="md:col-span-4 flex flex-col md:items-end justify-center">
                    <div className="text-[10px] uppercase tracking-wider text-[#7A8B9A] mb-1">
                      {isBuy
                        ? '추가 매수 필요 금액 (+)'
                        : isSell
                        ? '비중 축소 필요 금액 (-)'
                        : '목표 비중 유지'}
                    </div>
                    <div
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-extrabold border tabular-nums ${
                        isBuy
                          ? 'bg-[#00E676]/15 text-[#00E676] border-[#00E676]/30'
                          : isSell
                          ? 'bg-[#FF5252]/15 text-[#FF5252] border-[#FF5252]/30'
                          : 'bg-[#1F2D3A]/60 text-gray-300 border-[#1F2D3A]'
                      }`}
                    >
                      {isBuy && <ArrowUpRight className="w-4 h-4 shrink-0" />}
                      {isSell && <ArrowDownRight className="w-4 h-4 shrink-0" />}
                      <CountUpNumber
                        value={row.diffAmountKrw}
                        formatter={(v) => formatSignedCurrency(v, currency, usdKrwRate)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
