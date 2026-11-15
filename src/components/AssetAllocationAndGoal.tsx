import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieIcon, Target } from 'lucide-react';
import {
  CurrencyCode,
  ExposureViewMode,
  IntegratedSummary,
  NetWorthViewMode,
  NormalizedSummary,
} from '../types/portfolio';
import { formatCompactCurrency, formatCurrency } from '../utils/formatters';
import { CountUpNumber } from './CountUpNumber';

/**
 * GPU 가속 conic-gradient 마스크를 이용해 Recharts SVG 재계산(paddingAngle 끊김) 없이
 * 60/120fps로 원형/반원 차트가 호를 그리며 부드럽게 채워지게 하는 훅
 */
function useSmoothCircleSweep(
  triggerKey: string,
  options: {
    fromDeg: number;
    centerX: string;
    centerY: string;
    maxSweepDeg: number;
    durationMs: number;
    delayMs?: number;
  }
) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const { fromDeg, centerX, centerY, maxSweepDeg, durationMs, delayMs = 0 } = options;

    // 시작 전 0도 상태로 마스킹
    const initMask = `conic-gradient(from ${fromDeg}deg at ${centerX} ${centerY}, #000 0deg, transparent 0.5deg, transparent 360deg)`;
    el.style.webkitMaskImage = initMask;
    el.style.maskImage = initMask;

    const startAnimation = () => {
      const startTime = performance.now();
      const tick = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, Math.max(0, elapsed / durationMs));
        // 부드러운 cubic-out 이징: 1 - (1 - t)^3
        const eased = 1 - Math.pow(1 - t, 3);
        const sweep = eased * maxSweepDeg;

        if (t < 1) {
          const edge = Math.min(360, sweep + 1.8);
          const mask = `conic-gradient(from ${fromDeg}deg at ${centerX} ${centerY}, #000 0deg, #000 ${sweep.toFixed(
            2
          )}deg, transparent ${edge.toFixed(2)}deg, transparent 360deg)`;
          el.style.webkitMaskImage = mask;
          el.style.maskImage = mask;
          rafId = requestAnimationFrame(tick);
        } else {
          el.style.webkitMaskImage = '';
          el.style.maskImage = '';
        }
      };
      rafId = requestAnimationFrame(tick);
    };

    if (delayMs > 0) {
      timeoutId = setTimeout(startAnimation, delayMs);
    } else {
      startAnimation();
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
      if (el) {
        el.style.webkitMaskImage = '';
        el.style.maskImage = '';
      }
    };
  }, [
    triggerKey,
    options.fromDeg,
    options.centerX,
    options.centerY,
    options.maxSweepDeg,
    options.durationMs,
    options.delayMs,
  ]);

  return containerRef;
}

interface AssetAllocationAndGoalProps {
  summary: NormalizedSummary;
  integratedSummary: IntegratedSummary;
  monthlySurplusKrw: number;
  currency: CurrencyCode;
  usdKrwRate: number;
  netWorthMode?: NetWorthViewMode;
  exposureMode?: ExposureViewMode;
  onChangeExposureMode?: (mode: ExposureViewMode) => void;
}

export const AssetAllocationAndGoal: React.FC<AssetAllocationAndGoalProps> = ({
  summary,
  integratedSummary,
  monthlySurplusKrw,
  currency,
  usdKrwRate,
  netWorthMode = 'TOTAL_WITH_PHYSICAL',
  exposureMode: propExposureMode,
  onChangeExposureMode,
}) => {
  const [goalTargetKrw, setGoalTargetKrw] = useState<number>(250_000_000);
  const [localExposureMode, setLocalExposureMode] = useState<ExposureViewMode>('UNDERLYING');

  const exposureMode = propExposureMode ?? localExposureMode;
  const handleSelectExposure = (mode: ExposureViewMode) => {
    setLocalExposureMode(mode);
    onChangeExposureMode?.(mode);
  };

  const isWithPhysical = netWorthMode === 'TOTAL_WITH_PHYSICAL';
  const activeTotal = isWithPhysical ? summary.grandTotalKrw : summary.financialTotalKrw;
  const total = activeTotal > 0 ? activeTotal : 1;

  const baseAllocationItems =
    exposureMode === 'UNDERLYING'
      ? [
          {
            name: '현금 · 달러예수금 · 증여',
            value: integratedSummary.cashAssetKrw,
            ratio: (integratedSummary.cashAssetKrw / total) * 100,
            color: '#00E676',
          },
          {
            name: '은행 예적금 (청년도약 등)',
            value: integratedSummary.bankSavingsKrw,
            ratio: (integratedSummary.bankSavingsKrw / total) * 100,
            color: '#2979FF',
          },
          {
            name: '해외주식 (실질: 미ETF+직투)',
            value: integratedSummary.underlyingOverseasStockKrw,
            ratio: (integratedSummary.underlyingOverseasStockKrw / total) * 100,
            color: '#9C27B0',
          },
          {
            name: '해외채권 (실질: 미국채ETF+채권)',
            value: integratedSummary.underlyingOverseasBondKrw,
            ratio: (integratedSummary.underlyingOverseasBondKrw / total) * 100,
            color: '#00B0FF',
          },
          {
            name: '국내채권 · 혼합형 (IRP)',
            value:
              integratedSummary.underlyingDomesticBondKrw +
              integratedSummary.underlyingDomesticStockKrw,
            ratio:
              ((integratedSummary.underlyingDomesticBondKrw +
                integratedSummary.underlyingDomesticStockKrw) /
                total) *
              100,
            color: '#1DE9B6',
          },
        ]
      : [
          {
            name: '현금 · 달러예수금 · 증여',
            value: integratedSummary.cashAssetKrw,
            ratio: (integratedSummary.cashAssetKrw / total) * 100,
            color: '#00E676',
          },
          {
            name: '은행 예적금',
            value: integratedSummary.bankSavingsKrw,
            ratio: (integratedSummary.bankSavingsKrw / total) * 100,
            color: '#2979FF',
          },
          {
            name: '국내상장 ETF (KRX)',
            value: integratedSummary.domesticEtfKrw,
            ratio: (integratedSummary.domesticEtfKrw / total) * 100,
            color: '#9C27B0',
          },
          {
            name: '해외직투 주식 (US)',
            value: integratedSummary.overseasStockKrw,
            ratio: (integratedSummary.overseasStockKrw / total) * 100,
            color: '#1DE9B6',
          },
          {
            name: '해외 채권',
            value: integratedSummary.overseasBondKrw,
            ratio: (integratedSummary.overseasBondKrw / total) * 100,
            color: '#00B0FF',
          },
        ];

  const allocationItems = isWithPhysical
    ? [
        ...baseAllocationItems,
        {
          name: '실물 · 기타자산',
          value: integratedSummary.physicalAssetsKrw,
          ratio: (integratedSummary.physicalAssetsKrw / total) * 100,
          color: '#FFAB00',
        },
      ]
    : baseAllocationItems;

  const chartSlices = useMemo(
    () => allocationItems.filter((item) => item.value > 0),
    [
      exposureMode,
      isWithPhysical,
      total,
      integratedSummary.cashAssetKrw,
      integratedSummary.bankSavingsKrw,
      integratedSummary.underlyingOverseasStockKrw,
      integratedSummary.underlyingOverseasBondKrw,
      integratedSummary.underlyingDomesticBondKrw,
      integratedSummary.underlyingDomesticStockKrw,
      integratedSummary.domesticEtfKrw,
      integratedSummary.overseasStockKrw,
      integratedSummary.overseasBondKrw,
      integratedSummary.physicalAssetsKrw,
    ]
  );

  const rawAchievementRate = (activeTotal / goalTargetKrw) * 100;
  const clampedGaugeRate = Math.min(100, Math.max(0, rawAchievementRate));
  const remainingToGoal = Math.max(0, goalTargetKrw - activeTotal);
  const estMonths =
    remainingToGoal <= 0
      ? 0
      : monthlySurplusKrw > 0
      ? Math.ceil(remainingToGoal / monthlySurplusKrw)
      : null;

  const gaugeData = useMemo(
    () => [
      { name: '달성', value: clampedGaugeRate, color: '#00E676' },
      { name: '잔여 목표', value: Math.max(0, 100 - clampedGaugeRate), color: '#1F2D3A' },
    ],
    [clampedGaugeRate]
  );

  // 12시 방향(0deg)부터 시계방향으로 360도 부드럽게 그려지는 도넛 차트 마스크
  const donutSweepRef = useSmoothCircleSweep(`donut-${exposureMode}-${netWorthMode}`, {
    fromDeg: 0,
    centerX: '50%',
    centerY: '50%',
    maxSweepDeg: 360,
    durationMs: 880,
    delayMs: 30,
  });

  // 9시 방향(270deg)부터 3시 방향까지 180도 부드럽게 채워지는 반원 게이지 마스크
  const gaugeSweepRef = useSmoothCircleSweep(`gauge-${goalTargetKrw}-${netWorthMode}`, {
    fromDeg: 270,
    centerX: '50%',
    centerY: '82%',
    maxSweepDeg: 180,
    durationMs: 920,
    delayMs: 60,
  });

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Top Card: ASSET ALLOCATION Donut Chart */}
      <motion.div
        className="bg-[#131C24] border border-[#1F2D3A] hover:border-[#2979FF]/50 rounded-xl p-5 flex-1 flex flex-col justify-between shadow-lg transition-colors duration-200"
      >
        <div className="flex flex-col gap-2 mb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-[#2979FF]" />
              <h3 className="text-sm font-bold tracking-wider uppercase text-white">
                ASSET ALLOCATION
              </h3>
            </div>
            <span className="text-[11px] text-[#7A8B9A]">
              {isWithPhysical ? '총 순자산(실물 포함) 비중' : '금융 순자산 비중'}
            </span>
          </div>

          {/* Exposure Basis Toggle: [기초자산 실질 기준 (권장) | 상장시장 기준] */}
          <div className="inline-flex items-center bg-[#0B1116] p-1 rounded-xl border border-[#1F2D3A] text-[11px] font-bold self-start">
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

        <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3 my-auto">
          {/* Donut Chart */}
          <div className="sm:col-span-5 h-[175px] relative flex items-center justify-center">
            <div ref={donutSweepRef} className="w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartSlices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    startAngle={90}
                    endAngle={-270}
                    innerRadius={50}
                    outerRadius={72}
                    paddingAngle={3}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {chartSlices.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#0B1116]/90 backdrop-blur-md border border-white/15 rounded-xl px-3.5 py-2.5 shadow-2xl text-xs tabular-nums">
                          <div className="font-bold text-white mb-0.5">{d.name}</div>
                          <div className="text-[#00E676] font-extrabold">
                            {formatCurrency(d.value, currency, usdKrwRate)} ({d.ratio.toFixed(1)}%)
                          </div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Center Net Worth Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-[10px] font-semibold text-[#7A8B9A] uppercase tracking-wider">
                {isWithPhysical ? '총 순자산' : '금융 순자산'}
              </span>
              <span className="text-xs font-extrabold text-white tabular-nums mt-0.5">
                {formatCompactCurrency(activeTotal, currency, usdKrwRate)}
              </span>
            </div>
          </div>

          {/* Right Legend */}
          <div className="sm:col-span-7 space-y-1.5">
            {allocationItems.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-[#0B1116]/60 border border-[#1F2D3A]/60"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-200 font-medium truncate">{item.name}</span>
                </div>
                <div className="text-right tabular-nums shrink-0 ml-2">
                  <span className="font-bold text-white">{item.ratio.toFixed(1)}%</span>
                  <span className="text-[10px] text-[#7A8B9A] ml-1.5">
                    ({formatCompactCurrency(item.value, currency, usdKrwRate)})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Bottom Card: SAVINGS GOAL GAUGE */}
      <motion.div
        className="bg-[#131C24] border border-[#1F2D3A] hover:border-[#00E676]/50 rounded-xl p-5 flex-1 flex flex-col justify-between shadow-lg transition-colors duration-200"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#00E676]" />
            <h3 className="text-sm font-bold tracking-wider uppercase text-white">
              SAVINGS GOAL GAUGE
            </h3>
          </div>

          {/* Milestone Selector (2억 / 2.5억 / 3억) */}
          <div className="inline-flex items-center bg-[#0B1116] p-0.5 rounded-lg border border-[#1F2D3A] text-[10px] font-bold">
            {[
              { label: '2억', val: 200_000_000 },
              { label: '2.5억 목표', val: 250_000_000 },
              { label: '3억', val: 300_000_000 },
            ].map((m) => (
              <button
                key={m.val}
                onClick={() => setGoalTargetKrw(m.val)}
                className={`px-2 py-0.5 rounded-md transition-colors duration-150 cursor-pointer ${
                  goalTargetKrw === m.val
                    ? 'bg-[#00E676] text-[#0B1116]'
                    : 'text-[#7A8B9A] hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Semi-Circle Gauge */}
        <div className="relative h-[130px] flex items-center justify-center">
          <div ref={gaugeSweepRef} className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={gaugeData}
                  dataKey="value"
                  cx="50%"
                  cy="82%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={62}
                  outerRadius={86}
                  paddingAngle={2}
                  stroke="none"
                  cornerRadius={6}
                  isAnimationActive={false}
                >
                  {gaugeData.map((entry, index) => (
                    <Cell key={`gauge-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Center Semi-Circle Value */}
          <div className="absolute bottom-2 flex flex-col items-center text-center pointer-events-none">
            <span className="text-2xl font-extrabold text-[#00E676] tabular-nums tracking-tight">
              <CountUpNumber
                value={rawAchievementRate}
                formatter={(v) => `${v.toFixed(1)}%`}
              />
            </span>
            <span className="text-[11px] text-[#7A8B9A] font-medium">
              {formatCompactCurrency(goalTargetKrw, currency, usdKrwRate)} 목표 대비 달성률
            </span>
          </div>
        </div>

        {/* Goal Footer Stats */}
        <div className="pt-3 border-t border-[#1F2D3A] grid grid-cols-2 gap-2 text-xs tabular-nums">
          <div className="bg-[#0B1116]/70 rounded-lg px-3 py-2 border border-[#1F2D3A]/60">
            <div className="text-[10px] text-[#7A8B9A]">
              {remainingToGoal <= 0 ? '목표 초과 달성액' : '목표까지 남은 금액'}
            </div>
            <div className="font-bold text-white mt-0.5">
              {remainingToGoal <= 0
                ? `+${formatCurrency(activeTotal - goalTargetKrw, currency, usdKrwRate)}`
                : formatCurrency(remainingToGoal, currency, usdKrwRate)}
            </div>
          </div>
          <div className="bg-[#0B1116]/70 rounded-lg px-3 py-2 border border-[#1F2D3A]/60">
            <div className="text-[10px] text-[#7A8B9A]">예상 도달 시기 (현재 잉여 기준)</div>
            <div className="font-bold text-[#00E676] mt-0.5">
              {estMonths === 0
                ? '목표 달성 완료! 🎉'
                : estMonths !== null
                ? `약 ${estMonths}개월 후`
                : '-'}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
