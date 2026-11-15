import React from 'react';
import { motion } from 'framer-motion';
import {
  PiggyBank,
  CalendarClock,
  ShieldCheck,
  Landmark,
  Award,
  TrendingUp,
} from 'lucide-react';
import {
  CurrencyCode,
  NormalizedBondItem,
  NormalizedCheckingAccount,
  NormalizedSavingsItem,
} from '../types/portfolio';
import { formatCurrency } from '../utils/formatters';

interface SavingsScheduleSectionProps {
  savings: NormalizedSavingsItem[];
  bonds: NormalizedBondItem[];
  checkingAccounts: NormalizedCheckingAccount[];
  currency: CurrencyCode;
  usdKrwRate: number;
}

export const SavingsScheduleSection: React.FC<SavingsScheduleSectionProps> = ({
  savings,
  bonds,
  checkingAccounts,
  currency,
  usdKrwRate,
}) => {
  const totalPostTaxPayout = savings.reduce((acc, s) => acc + s.postTaxPayoutKrw, 0);
  const totalPreTaxPayout = savings.reduce((acc, s) => acc + s.preTaxPayoutKrw, 0);

  return (
    <div className="space-y-6">
      {/* Top Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#131C24] border border-[#1F2D3A] rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-[#7A8B9A] font-semibold uppercase">
            <span>만기 예상 총 수령액 (세후)</span>
            <PiggyBank className="w-4 h-4 text-[#00E676]" />
          </div>
          <div className="text-2xl font-extrabold text-[#00E676] tabular-nums mt-2">
            {formatCurrency(totalPostTaxPayout, currency, usdKrwRate)}
          </div>
          <div className="text-xs text-[#7A8B9A] mt-1 tabular-nums">
            세전 합계: {formatCurrency(totalPreTaxPayout, currency, usdKrwRate)} ({savings.length}개 계좌)
          </div>
        </div>

        <div className="bg-[#131C24] border border-[#1F2D3A] rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-[#7A8B9A] font-semibold uppercase">
            <span>입출금 / CMA 예수금 합계</span>
            <Landmark className="w-4 h-4 text-[#2979FF]" />
          </div>
          <div className="text-2xl font-extrabold text-white tabular-nums mt-2">
            {formatCurrency(checkingAccounts[0]?.totalKrw || 0, currency, usdKrwRate)}
          </div>
          <div className="text-xs text-[#7A8B9A] mt-1 tabular-nums">
            하나+토스+CMA: {formatCurrency((checkingAccounts[0]?.hanaBankKrw || 0) + (checkingAccounts[0]?.tossBankKrw || 0) + (checkingAccounts[0]?.miraeCmaKrw || 0), currency, usdKrwRate)} · 기준일{' '}
            {checkingAccounts[0]?.date || '-'}
          </div>
        </div>

        <div className="bg-[#131C24] border border-[#1F2D3A] rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-[#7A8B9A] font-semibold uppercase">
            <span>보유 채권 총 납입약정</span>
            <Award className="w-4 h-4 text-[#9C27B0]" />
          </div>
          <div className="text-2xl font-extrabold text-white tabular-nums mt-2">
            {formatCurrency(
              bonds.reduce((acc, b) => acc + b.totalPaidKrw, 0),
              currency,
              usdKrwRate
            )}
          </div>
          <div className="text-xs text-[#7A8B9A] mt-1 tabular-nums">
            {bonds[0]
              ? `${bonds[0].name} (${bonds[0].description}) · 월 ${formatCurrency(
                  bonds[0].monthlyPaymentKrw,
                  currency,
                  usdKrwRate
                )}`
              : '등록된 채권 없음'}
          </div>
        </div>
      </div>

      {/* Savings Maturity Schedule Cards */}
      <div className="bg-[#131C24] border border-[#1F2D3A] rounded-xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[#00E676]" />
              <h3 className="text-sm font-bold tracking-wider uppercase text-white">
                SAVINGS & MATURITY TIMELINE
              </h3>
            </div>
            <p className="text-xs text-[#7A8B9A] mt-1">
              만기일이 가까운 순서로 정렬된 예적금 · 청약 · 채권 상품 상세 스케줄
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savings.map((item, idx) => {
            const isClosest = idx === 0;
            return (
              <div
                key={item.id}
                className={`rounded-xl p-5 border transition-colors duration-150 ${
                  isClosest
                    ? 'bg-gradient-to-br from-[#172630] to-[#111A22] border-[#00E676]/50 shadow-[0_0_20px_rgba(0,230,118,0.08)]'
                    : 'bg-[#0B1116]/70 border-[#1F2D3A]'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#2979FF]/15 text-[#2979FF] border border-[#2979FF]/30">
                      {item.category}
                    </span>
                    <span className="text-base font-extrabold text-white">
                      {item.bank}
                    </span>
                    {item.isTaxFree && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30">
                        <ShieldCheck className="w-3 h-3" />
                        비과세
                      </span>
                    )}
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-extrabold tabular-nums ${
                      isClosest
                        ? 'bg-[#00E676] text-[#0B1116]'
                        : 'bg-[#1F2D3A] text-gray-200'
                    }`}
                  >
                    {item.dDay >= 0 ? `D-${item.dDay}` : `D+${Math.abs(item.dDay)}`}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-[#1F2D3A]/80 text-xs tabular-nums">
                  <div>
                    <div className="text-[#7A8B9A] text-[11px]">약정 금리</div>
                    <div className="font-bold text-[#00E676] text-sm mt-0.5 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      연 {item.interestRatePercent.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[#7A8B9A] text-[11px]">가입일 ~ 만기일</div>
                    <div className="font-semibold text-white mt-0.5">
                      {item.maturityDate}
                    </div>
                    <div className="text-[10px] text-[#7A8B9A]">
                      가입 {item.joinDate} ({item.periodMonths}개월)
                    </div>
                  </div>
                  <div>
                    <div className="text-[#7A8B9A] text-[11px]">납입액 ({item.currency})</div>
                    <div className="font-semibold text-white mt-0.5">
                      {item.currency === 'USD'
                        ? `$${item.monthlyAmount.toLocaleString()}`
                        : formatCurrency(item.monthlyAmount, currency, usdKrwRate)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#7A8B9A] text-[11px]">세후 만기수령액</div>
                    <div className="font-extrabold text-[#00E676] text-sm mt-0.5">
                      {formatCurrency(item.postTaxPayoutKrw, currency, usdKrwRate)}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-[#7A8B9A] mb-1 tabular-nums">
                    <span>만기 달성 진행률</span>
                    <span className="text-white font-bold">
                      {item.progressPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#0B1116] rounded-full overflow-hidden border border-[#1F2D3A]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(4, item.progressPercent))}%` }}
                      transition={{
                        duration: 0.85,
                        delay: idx * 0.05,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="h-full bg-gradient-to-r from-[#2979FF] to-[#00E676] rounded-full"
                    />
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
