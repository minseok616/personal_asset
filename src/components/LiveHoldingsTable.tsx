import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  WalletCards,
  DollarSign,
} from 'lucide-react';
import {
  AccountFilterType,
  CashDepositItem,
  CurrencyCode,
  NormalizedHoldingItem,
} from '../types/portfolio';
import {
  formatCurrency,
  formatKRW,
  formatSignedCurrency,
  formatSignedPercent,
  formatUSD,
} from '../utils/formatters';
import { CountUpNumber } from './CountUpNumber';

interface LiveHoldingsTableProps {
  holdings: NormalizedHoldingItem[];
  cashDeposits: CashDepositItem[];
  totalCashDepositsKrw: number;
  kisCount: number;
  usCount: number;
  totalStockEvalKrw: number;
  totalStockProfitKrw: number;
  totalStockReturnRate: number;
  currency: CurrencyCode;
  usdKrwRate: number;
}

const ACCOUNT_TABS: AccountFilterType[] = [
  '전체',
  '위탁계좌',
  'ISA중개형',
  '연금저축',
  '퇴직연금(IRP)',
  '토스증권',
];

const ACCOUNT_BADGE_STYLES: Record<Exclude<AccountFilterType, '전체'>, string> = {
  위탁계좌: 'bg-[#2979FF]/15 text-[#2979FF] border-[#2979FF]/35',
  ISA중개형: 'bg-[#00E676]/15 text-[#00E676] border-[#00E676]/35',
  연금저축: 'bg-[#9C27B0]/20 text-[#D05CE3] border-[#9C27B0]/40',
  '퇴직연금(IRP)': 'bg-[#00B0FF]/15 text-[#00B0FF] border-[#00B0FF]/35',
  토스증권: 'bg-[#FFAB00]/15 text-[#FFAB00] border-[#FFAB00]/35',
};

export const LiveHoldingsTable: React.FC<LiveHoldingsTableProps> = ({
  holdings,
  cashDeposits,
  totalCashDepositsKrw,
  kisCount,
  usCount,
  currency,
  usdKrwRate,
}) => {
  const [selectedAccount, setSelectedAccount] = useState<AccountFilterType>('전체');

  // Count per account tab
  const tabCounts = useMemo(() => {
    const counts: Record<AccountFilterType, number> = {
      전체: holdings.length,
      위탁계좌: 0,
      ISA중개형: 0,
      연금저축: 0,
      '퇴직연금(IRP)': 0,
      토스증권: 0,
    };
    holdings.forEach((h) => {
      counts[h.accountCategory] = (counts[h.accountCategory] || 0) + 1;
    });
    return counts;
  }, [holdings]);

  const filteredHoldings = useMemo(() => {
    if (selectedAccount === '전체') return holdings;
    return holdings.filter((h) => h.accountCategory === selectedAccount);
  }, [holdings, selectedAccount]);

  const filteredStats = useMemo(() => {
    const evalSum = filteredHoldings.reduce((acc, h) => acc + h.evalAmountKrw, 0);
    const profitSum = filteredHoldings.reduce((acc, h) => acc + h.profitKrw, 0);
    const buySum = evalSum - profitSum;
    const retRate = buySum > 0 ? (profitSum / buySum) * 100 : 0;
    return { evalSum, profitSum, buySum, retRate };
  }, [filteredHoldings]);

  const isFilteredPositive = filteredStats.profitSum >= 0;

  return (
    <div className="bg-[#131C24] border border-[#1F2D3A] rounded-xl p-6 flex flex-col justify-between shadow-lg h-full space-y-5">
      <div className="space-y-4">
        {/* 1. Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#00E676]" />
              <h3 className="text-sm font-bold tracking-wider uppercase text-white">
                LIVE HOLDINGS — 계좌별 실시간 보유 종목 & 수익 분석
              </h3>
            </div>
            <p className="text-xs text-[#7A8B9A] mt-1">
              한국투자증권 실시간 연동({kisCount}종목) 및 토스증권 해외직투({usCount}종목) 통합 포트폴리오
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#00E676]/12 text-[#00E676] border border-[#00E676]/30 tabular-nums">
              총 {holdings.length}개 보유 종목
            </span>
          </div>
        </div>

        {/* 2. Separate Account Cash Deposit Summary Bar (계좌별 예수금 요약 바 - CASH_* 분리) */}
        <div className="bg-gradient-to-r from-[#0B1116] via-[#101922] to-[#0B1116] border border-[#1F2D3A] rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2.5 border-b border-[#1F2D3A]/80">
            <div className="flex items-center gap-2">
              <WalletCards className="w-4 h-4 text-[#2979FF]" />
              <span className="text-xs font-bold text-white uppercase tracking-wide">
                계좌별 현금성 예수금 요약 바 (주식 테이블 분리)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs tabular-nums">
              <span className="text-[#7A8B9A]">예수금 총합계:</span>
              <span className="font-extrabold text-[#00E676] text-sm">
                <CountUpNumber
                  value={totalCashDepositsKrw}
                  formatter={(v) => formatCurrency(v, currency, usdKrwRate)}
                />
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5 text-xs tabular-nums">
            {cashDeposits.map((cash) => {
              const isUsdCash = cash.currency === 'USD';
              return (
                <div
                  key={cash.id}
                  className={`rounded-lg px-3 py-2.5 border flex flex-col justify-between transition-colors duration-150 ${
                    isUsdCash
                      ? 'bg-[#00E676]/10 border-[#00E676]/40 shadow-[0_0_15px_rgba(0,230,118,0.08)]'
                      : 'bg-[#131C24]/90 border-[#1F2D3A]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-gray-200 truncate">
                      {cash.name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                        isUsdCash
                          ? 'bg-[#00E676] text-[#0B1116]'
                          : 'bg-[#1F2D3A] text-gray-300'
                      }`}
                    >
                      {cash.currency}
                    </span>
                  </div>

                  <div className="mt-1.5">
                    {isUsdCash ? (
                      <>
                        <div className="text-sm font-extrabold text-[#00E676] flex items-center gap-0.5">
                          <DollarSign className="w-3.5 h-3.5 shrink-0" />
                          {cash.amountOriginal.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-[10px] text-gray-300 mt-0.5">
                          ≈ {formatKRW(cash.amountKrw)} (환율 ₩{usdKrwRate.toLocaleString('ko-KR')})
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-bold text-white">
                          {formatCurrency(cash.amountKrw, currency, usdKrwRate)}
                        </div>
                        <div className="text-[10px] text-[#7A8B9A] mt-0.5">
                          {cash.accountName} 주문가능 현금
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Account Filter Tabs ('전체', '위탁계좌', 'ISA중개형', '연금저축', '퇴직연금(IRP)', '토스증권') */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {ACCOUNT_TABS.map((tab) => {
            const isActive = selectedAccount === tab;
            const count = tabCounts[tab] || 0;
            return (
              <button
                key={tab}
                onClick={() => setSelectedAccount(tab)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 border ${
                  isActive
                    ? 'bg-[#00E676] text-[#0B1116] border-[#00E676] shadow-[0_0_14px_rgba(0,230,118,0.28)]'
                    : 'bg-[#0B1116] text-[#7A8B9A] border-[#1F2D3A] hover:text-white hover:border-[#2E4254]'
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold tabular-nums ${
                    isActive
                      ? 'bg-[#0B1116]/20 text-[#0B1116]'
                      : 'bg-[#131C24] text-[#7A8B9A]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 4. Holdings Table: [계좌 배지 | 종목명(티커) | 보유수량 | 매수평단가 vs 현재가 | 평가금액 | 평가손익 | 수익률(%)] */}
        <div className="overflow-x-auto rounded-xl border border-[#1F2D3A]">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-[#0B1116] border-b border-[#1F2D3A] text-[11px] font-bold uppercase tracking-wider text-[#7A8B9A]">
                <th className="py-3 pl-3.5 pr-2">계좌 구분</th>
                <th className="py-3 px-3">종목명 (티커)</th>
                <th className="py-3 px-2.5 text-right">보유수량</th>
                <th className="py-3 px-3 text-right">매수평단가 vs 현재가</th>
                <th className="py-3 px-3 text-right">평가금액</th>
                <th className="py-3 px-3 text-right">평가손익</th>
                <th className="py-3 pl-3 pr-3.5 text-right">수익률(%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2D3A]/60 text-xs tabular-nums">
              {filteredHoldings.length > 0 ? (
                filteredHoldings.map((item) => {
                  const isPos = item.returnRate > 0 || (item.returnRate === 0 && item.profitKrw > 0);
                  const isNeg = item.returnRate < 0 || (item.returnRate === 0 && item.profitKrw < 0);
                  const badgeStyle = ACCOUNT_BADGE_STYLES[item.accountCategory];

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[#192530]/70 transition-colors group"
                    >
                      {/* 1) 계좌 배지 */}
                      <td className="py-3.5 pl-3.5 pr-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${badgeStyle}`}
                        >
                          {item.accountCategory}
                        </span>
                      </td>

                      {/* 2) 종목명(티커) */}
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-white text-xs group-hover:text-[#00E676] transition-colors">
                          {item.name}
                        </div>
                        <div className="text-[11px] font-mono text-[#7A8B9A] mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{item.code}</span>
                          {item.source === 'US_STOCK' && (
                            <span className="px-1.5 py-0.2 rounded bg-[#2979FF]/20 text-[#2979FF] text-[10px] font-sans font-bold">
                              US 직투
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-sans font-bold border ${
                              item.underlyingAssetClass === '해외주식'
                                ? 'bg-[#9C27B0]/20 text-[#D05CE3] border-[#9C27B0]/40'
                                : item.underlyingAssetClass === '해외채권'
                                ? 'bg-[#00B0FF]/15 text-[#00B0FF] border-[#00B0FF]/35'
                                : 'bg-[#00E676]/15 text-[#00E676] border-[#00E676]/35'
                            }`}
                          >
                            실질: {item.underlyingAssetClass}
                          </span>
                        </div>
                      </td>

                      {/* 3) 보유수량 */}
                      <td className="py-3.5 px-2.5 text-right font-bold text-white">
                        {item.quantity.toLocaleString('ko-KR')}주
                      </td>

                      {/* 4) 매수평단가 vs 현재가 */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5 text-xs">
                          <span className="text-[#7A8B9A]">
                            {item.source === 'US_STOCK' && currency === 'USD' && item.avgPriceUsd
                              ? formatUSD(item.avgPriceUsd)
                              : formatCurrency(item.avgPriceKrw, currency, usdKrwRate)}
                          </span>
                          <ArrowRight className="w-3 h-3 text-[#7A8B9A]" />
                          <span className="font-extrabold text-white">
                            {item.source === 'US_STOCK' && currency === 'USD' && item.currentPriceUsd
                              ? formatUSD(item.currentPriceUsd)
                              : formatCurrency(item.currentPriceKrw, currency, usdKrwRate)}
                          </span>
                        </div>
                        {item.source === 'US_STOCK' && currency === 'KRW' && item.avgPriceUsd && (
                          <div className="text-[10px] text-[#7A8B9A] mt-0.5">
                            ${item.avgPriceUsd.toFixed(2)} → ${item.currentPriceUsd?.toFixed(2)}
                          </div>
                        )}
                      </td>

                      {/* 5) 평가금액 */}
                      <td className="py-3.5 px-3 text-right font-extrabold text-white">
                        {formatCurrency(item.evalAmountKrw, currency, usdKrwRate)}
                      </td>

                      {/* 6) 평가손익 */}
                      <td
                        className={`py-3.5 px-3 text-right font-extrabold ${
                          isPos
                            ? 'text-[#00E676]'
                            : isNeg
                            ? 'text-[#FF5252]'
                            : 'text-gray-300'
                        }`}
                      >
                        {formatSignedCurrency(item.profitKrw, currency, usdKrwRate)}
                      </td>

                      {/* 7) 수익률(%) - kisRealtime value used directly with 2 decimals */}
                      <td className="py-3.5 pl-3 pr-3.5 text-right">
                        <span
                          className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                            isPos
                              ? 'bg-[#00E676]/15 text-[#00E676] border-[#00E676]/35'
                              : isNeg
                              ? 'bg-[#FF5252]/15 text-[#FF5252] border-[#FF5252]/35'
                              : 'bg-[#1F2D3A] text-gray-300 border-[#2E4254]'
                          }`}
                        >
                          {isPos && <ArrowUpRight className="w-3.5 h-3.5" />}
                          {isNeg && <ArrowDownRight className="w-3.5 h-3.5" />}
                          {formatSignedPercent(item.returnRate, 2)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#7A8B9A]">
                    선택한 계좌({selectedAccount})에 보유 중인 주식/ETF 종목이 없습니다. (상단 예수금 요약 바를 확인해 주세요)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Footer Summary for Selected Account Filter */}
      <div className="pt-3 border-t border-[#1F2D3A] flex flex-wrap items-center justify-between gap-3 bg-[#0B1116]/70 rounded-xl px-4 py-3 text-xs tabular-nums">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[#7A8B9A] mr-1.5">[{selectedAccount}] 종목 매수원금:</span>
            <span className="font-bold text-gray-200">
              {formatCurrency(filteredStats.buySum, currency, usdKrwRate)}
            </span>
          </div>
          <div className="hidden sm:block text-[#1F2D3A]">|</div>
          <div>
            <span className="text-[#7A8B9A] mr-1.5">[{selectedAccount}] 평가금액 합계:</span>
            <span className="font-extrabold text-white">
              <CountUpNumber
                value={filteredStats.evalSum}
                formatter={(v) => formatCurrency(v, currency, usdKrwRate)}
              />
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#7A8B9A]">[{selectedAccount}] 합산 평가손익:</span>
          <span
            className={`font-extrabold ${
              isFilteredPositive ? 'text-[#00E676]' : 'text-[#FF5252]'
            }`}
          >
            {formatSignedCurrency(filteredStats.profitSum, currency, usdKrwRate)} (
            {formatSignedPercent(filteredStats.retRate, 2)})
          </span>
        </div>
      </div>
    </div>
  );
};
