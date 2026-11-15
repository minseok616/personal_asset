import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ScrollText,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import {
  AccountFilterType,
  CurrencyCode,
  KisDividendItem,
  KisTradeItem,
} from '../types/portfolio';
import { formatCurrency, formatKRW, formatUSD } from '../utils/formatters';
import { CountUpNumber } from './CountUpNumber';

interface TradeAndDividendSectionProps {
  trades: KisTradeItem[];
  dividends: KisDividendItem[];
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

export const TradeAndDividendSection: React.FC<TradeAndDividendSectionProps> = ({
  trades,
  dividends,
  currency,
  usdKrwRate,
}) => {
  const [selectedAccount, setSelectedAccount] = useState<AccountFilterType>('전체');
  const [selectedTradeType, setSelectedTradeType] = useState<'전체' | '매수' | '매도'>('전체');

  // Top 3 Summary KPI calculations (60-day cumulative buy, sell, and total dividend KRW)
  const summaryStats = useMemo(() => {
    const buyTrades = trades.filter((t) => t.tradeType === '매수');
    const sellTrades = trades.filter((t) => t.tradeType === '매도');

    const totalBuyKrw = buyTrades.reduce((acc, t) => acc + t.amountKrw, 0);
    const totalSellKrw = sellTrades.reduce((acc, t) => acc + t.amountKrw, 0);

    const totalDivPreTaxKrw = dividends.reduce((acc, d) => acc + d.preTaxKrw, 0);
    const totalDivPostTaxKrw = dividends.reduce((acc, d) => acc + d.postTaxKrw, 0);
    const totalDivPostTaxUsd = dividends.reduce((acc, d) => acc + d.postTaxUsd, 0);

    return {
      buyCount: buyTrades.length,
      sellCount: sellTrades.length,
      totalBuyKrw,
      totalSellKrw,
      netBuyKrw: totalBuyKrw - totalSellKrw,
      divCount: dividends.length,
      totalDivPreTaxKrw,
      totalDivPostTaxKrw,
      totalDivPostTaxUsd,
    };
  }, [trades, dividends]);

  // Filtered trades for 📜KIS_매매체결DB table
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      const matchAcc = selectedAccount === '전체' || t.accountCategory === selectedAccount;
      const matchSide = selectedTradeType === '전체' || t.tradeType === selectedTradeType;
      return matchAcc && matchSide;
    });
  }, [trades, selectedAccount, selectedTradeType]);

  // Filtered dividends for 💸KIS_배당내역DB card list
  const filteredDividends = useMemo(() => {
    if (selectedAccount === '전체') return dividends;
    return dividends.filter((d) => d.accountCategory === selectedAccount);
  }, [dividends, selectedAccount]);

  return (
    <div className="space-y-5">
      {/* 1. Top 3 Summary Cards (최근 60일 누적 매수금액, 매도금액, 배당금 수령 합계) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: 60D Total Buy */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className="bg-[#131C24] border border-[#1F2D3A] hover:border-[#00E676]/50 rounded-xl p-5 flex flex-col justify-between transition-colors duration-200 shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold tracking-wider uppercase text-[#7A8B9A]">
              60D CUMULATIVE BUY — 최근 60일 누적 매수금액
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30">
              <ArrowUpRight className="w-3.5 h-3.5" />
              매수 {summaryStats.buyCount}건
            </span>
          </div>
          <div className="text-2xl font-extrabold text-[#00E676] tabular-nums tracking-tight my-1">
            <CountUpNumber
              value={summaryStats.totalBuyKrw}
              formatter={(v) => formatCurrency(v, currency, usdKrwRate)}
            />
          </div>
          <div className="mt-2 pt-2 border-t border-[#1F2D3A]/80 flex items-center justify-between text-xs text-[#7A8B9A] tabular-nums">
            <span>적립식 ETF · 미국주식 분할매수 합산</span>
            <span className="text-gray-200 font-semibold">
              순매수 {formatCurrency(summaryStats.netBuyKrw, currency, usdKrwRate)}
            </span>
          </div>
        </motion.div>

        {/* Card 2: 60D Total Sell */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.05 }}
          className="bg-[#131C24] border border-[#1F2D3A] hover:border-[#FF5252]/50 rounded-xl p-5 flex flex-col justify-between transition-colors duration-200 shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold tracking-wider uppercase text-[#7A8B9A]">
              60D CUMULATIVE SELL — 최근 60일 누적 매도금액
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-[#FF5252]/15 text-[#FF5252] border border-[#FF5252]/30">
              <ArrowDownRight className="w-3.5 h-3.5" />
              매도 {summaryStats.sellCount}건
            </span>
          </div>
          <div className="text-2xl font-extrabold text-[#FF5252] tabular-nums tracking-tight my-1">
            <CountUpNumber
              value={summaryStats.totalSellKrw}
              formatter={(v) => formatCurrency(v, currency, usdKrwRate)}
            />
          </div>
          <div className="mt-2 pt-2 border-t border-[#1F2D3A]/80 flex items-center justify-between text-xs text-[#7A8B9A] tabular-nums">
            <span>리밸런싱 · 차익실현 매도 체결</span>
            <span className="text-gray-200 font-semibold">
              전체 {trades.length}건 체결 기록
            </span>
          </div>
        </motion.div>

        {/* Card 3: Total Dividends Received (KRW Converted) */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.1 }}
          className="bg-[#131C24] border border-[#1F2D3A] hover:border-[#2979FF]/50 rounded-xl p-5 flex flex-col justify-between transition-colors duration-200 shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold tracking-wider uppercase text-[#7A8B9A]">
              DIVIDEND INCOME — 해외주식·ETF 배당 수령 합계
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-[#2979FF]/15 text-[#2979FF] border border-[#2979FF]/30">
              <Coins className="w-3.5 h-3.5" />
              총 {summaryStats.divCount}회 수령
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white tabular-nums tracking-tight my-1 flex items-baseline gap-2">
            <span className="text-[#00E676]">
              <CountUpNumber
                value={summaryStats.totalDivPostTaxKrw}
                formatter={(v) => formatCurrency(v, currency, usdKrwRate)}
              />
            </span>
            <span className="text-xs text-[#7A8B9A] font-semibold">
              (세후 달러환산 {formatUSD(summaryStats.totalDivPostTaxUsd)})
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#1F2D3A]/80 flex items-center justify-between text-xs text-[#7A8B9A] tabular-nums">
            <span>세전 원화합계: {formatKRW(summaryStats.totalDivPreTaxKrw)}</span>
            <span className="text-[#00E676] font-semibold">
              환율 ₩{usdKrwRate.toLocaleString('ko-KR')} 적용
            </span>
          </div>
        </motion.div>
      </div>

      {/* 2. Filter Bar (계좌별 & 매매구분별 통합 필터) */}
      <div className="bg-[#131C24] border border-[#1F2D3A] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Account Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#7A8B9A] mr-2 shrink-0">
            <Filter className="w-3.5 h-3.5 text-[#00E676]" />
            계좌 필터:
          </span>
          {ACCOUNT_TABS.map((tab) => {
            const active = selectedAccount === tab;
            return (
              <button
                key={tab}
                onClick={() => setSelectedAccount(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors duration-150 cursor-pointer whitespace-nowrap border ${
                  active
                    ? 'bg-[#00E676] text-[#0B1116] border-[#00E676] shadow-[0_0_12px_rgba(0,230,118,0.25)]'
                    : 'bg-[#0B1116] text-[#7A8B9A] border-[#1F2D3A] hover:text-white hover:border-[#2E4254]'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Trade Side Filter ('전체', '매수', '매도') */}
        <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
          <span className="text-xs font-bold text-[#7A8B9A]">매매구분:</span>
          <div className="inline-flex items-center bg-[#0B1116] p-1 rounded-xl border border-[#1F2D3A] text-xs font-bold">
            {(['전체', '매수', '매도'] as const).map((side) => {
              const active = selectedTradeType === side;
              const activeClass =
                side === '매수'
                  ? 'bg-[#00E676] text-[#0B1116]'
                  : side === '매도'
                  ? 'bg-[#FF5252] text-white'
                  : 'bg-[#2979FF] text-white';
              return (
                <button
                  key={side}
                  onClick={() => setSelectedTradeType(side)}
                  className={`px-3 py-1 rounded-lg transition-colors duration-150 cursor-pointer ${
                    active ? activeClass : 'text-[#7A8B9A] hover:text-white'
                  }`}
                >
                  {side}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Main Content Grid: Left 📜KIS_매매체결DB Table (62%) + Right 💸KIS_배당내역DB Cards (38%) */}
      <div className="grid grid-cols-1 xl:grid-cols-[62fr_38fr] gap-5 items-start">
        {/* Left: 📜KIS_매매체결DB (kisTrades) Table */}
        <div className="bg-[#131C24] border border-[#1F2D3A] rounded-xl p-6 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1F2D3A] pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-[#00E676]" />
                <h3 className="text-sm font-bold tracking-wider uppercase text-white">
                  📜 KIS_매매체결DB (kisTrades) — 계좌별 매매 체결 원장
                </h3>
              </div>
              <p className="text-xs text-[#7A8B9A] mt-1">
                체결일시 · 계좌구분 · 매수(#00E676)/매도(#FF5252) · 체결수량 및 원화환산 정산액
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#0B1116] text-[#00E676] border border-[#1F2D3A] tabular-nums self-start sm:self-auto">
              조회 {filteredTrades.length}건
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#1F2D3A]">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-[#0B1116] border-b border-[#1F2D3A] text-[11px] font-bold uppercase tracking-wider text-[#7A8B9A]">
                  <th className="py-3 pl-3.5 pr-2">체결일시</th>
                  <th className="py-3 px-2.5">계좌구분</th>
                  <th className="py-3 px-2.5 text-center">매수/매도</th>
                  <th className="py-3 px-3">종목명 (코드)</th>
                  <th className="py-3 px-2.5 text-right">수량</th>
                  <th className="py-3 px-3 text-right">체결단가</th>
                  <th className="py-3 pl-3 pr-3.5 text-right">원화환산액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2D3A]/60 text-xs tabular-nums">
                {filteredTrades.length > 0 ? (
                  filteredTrades.map((trd) => {
                    const isBuy = trd.tradeType === '매수';
                    const accBadge = ACCOUNT_BADGE_STYLES[trd.accountCategory];
                    return (
                      <tr
                        key={trd.id}
                        className="hover:bg-[#192530]/70 transition-colors duration-150 group"
                      >
                        {/* 1) 체결일시 */}
                        <td className="py-3.5 pl-3.5 pr-2 text-gray-300 font-mono text-[11px]">
                          {trd.executedAt}
                        </td>

                        {/* 2) 계좌구분 배지 */}
                        <td className="py-3.5 px-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${accBadge}`}
                          >
                            {trd.accountCategory}
                          </span>
                        </td>

                        {/* 3) 매수/매도 배지 (#00E676 vs #FF5252) */}
                        <td className="py-3.5 px-2.5 text-center">
                          <span
                            className={`inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold border ${
                              isBuy
                                ? 'bg-[#00E676]/15 text-[#00E676] border-[#00E676]/40'
                                : 'bg-[#FF5252]/15 text-[#FF5252] border-[#FF5252]/40'
                            }`}
                          >
                            {isBuy ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3" />
                            )}
                            {trd.tradeType}
                          </span>
                        </td>

                        {/* 4) 종목명(코드) */}
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-white group-hover:text-[#00E676] transition-colors">
                            {trd.name}
                          </div>
                          <div className="text-[10px] text-[#7A8B9A] font-mono flex items-center gap-1.5 mt-0.5">
                            <span>{trd.code}</span>
                            <span className="px-1 py-0.2 rounded bg-[#0B1116] text-gray-300 border border-[#1F2D3A]">
                              {trd.market} · {trd.currency}
                            </span>
                          </div>
                        </td>

                        {/* 5) 수량 */}
                        <td className="py-3.5 px-2.5 text-right font-bold text-white">
                          {trd.quantity.toLocaleString('ko-KR')}주
                        </td>

                        {/* 6) 체결단가 */}
                        <td className="py-3.5 px-3 text-right">
                          <div className="font-semibold text-gray-200">
                            {trd.currency === 'USD'
                              ? formatUSD(trd.unitPriceOriginal)
                              : formatKRW(trd.unitPriceOriginal)}
                          </div>
                          {trd.currency === 'USD' && (
                            <div className="text-[10px] text-[#7A8B9A]">
                              ≈ {formatKRW(trd.unitPriceKrw)}
                            </div>
                          )}
                        </td>

                        {/* 7) 원화환산액 */}
                        <td
                          className={`py-3.5 pl-3 pr-3.5 text-right font-extrabold ${
                            isBuy ? 'text-[#00E676]' : 'text-[#FF5252]'
                          }`}
                        >
                          <div>{formatCurrency(trd.amountKrw, currency, usdKrwRate)}</div>
                          {trd.currency === 'USD' && currency === 'KRW' && (
                            <div className="text-[10px] text-[#7A8B9A] font-normal">
                              ({formatUSD(trd.amountOriginal)})
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#7A8B9A]">
                      선택한 필터 조건에 해당하는 매매체결 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: 💸KIS_배당내역DB (kisDividends) Card List */}
        <div className="bg-[#131C24] border border-[#1F2D3A] rounded-xl p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-[#1F2D3A] pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-[#2979FF]" />
                <h3 className="text-sm font-bold tracking-wider uppercase text-white">
                  💸 KIS_배당내역DB (kisDividends) — 배당 수령 카드 리스트
                </h3>
              </div>
              <p className="text-xs text-[#7A8B9A] mt-1">
                배당 기준일 · 종목명 · 세전/세후 달러 배당금 및 원화 환산 수령액
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#0B1116] text-[#2979FF] border border-[#1F2D3A] tabular-nums shrink-0">
              {filteredDividends.length}건
            </span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {filteredDividends.map((div) => {
              const accBadge = ACCOUNT_BADGE_STYLES[div.accountCategory];
              return (
                <div
                  key={div.id}
                  className="bg-[#0B1116]/80 hover:bg-[#16222C] border border-[#1F2D3A] hover:border-[#00E676]/45 rounded-xl p-4 transition-colors duration-150 space-y-3"
                >
                  {/* Top Row: Date, Account Badge, Tax-Free / Tax Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-mono text-[#7A8B9A] tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-[#00E676]" />
                        {div.recordDate}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${accBadge}`}
                      >
                        {div.accountCategory}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#00E676]/12 text-[#00E676] border border-[#00E676]/30">
                      <CheckCircle2 className="w-3 h-3" />
                      {div.taxRatePercent === 0 ? '비과세·과세이연' : `원천징수 ${div.taxRatePercent}%`}
                    </span>
                  </div>

                  {/* Middle Row: Item Name & Code */}
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <div className="text-sm font-extrabold text-white">{div.name}</div>
                      <div className="text-[11px] text-[#7A8B9A] font-mono mt-0.5">
                        티커: <span className="text-gray-300">{div.code}</span>
                        {div.holdingQty ? ` · 보유 ${div.holdingQty}주 기준` : ''}
                      </div>
                    </div>

                    <div className="text-right tabular-nums shrink-0">
                      <div className="text-[10px] text-[#7A8B9A]">원화 환산 수령액(세후)</div>
                      <div className="text-base font-extrabold text-[#00E676]">
                        +{formatCurrency(div.postTaxKrw, currency, usdKrwRate)}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Pre-Tax vs Post-Tax USD & KRW Breakdown */}
                  <div className="pt-2.5 border-t border-[#1F2D3A]/80 grid grid-cols-3 gap-2 text-[11px] tabular-nums bg-[#131C24]/70 rounded-lg px-3 py-2">
                    <div>
                      <div className="text-[#7A8B9A]">세전 배당금($)</div>
                      <div className="font-bold text-gray-200 mt-0.5">
                        {formatUSD(div.preTaxUsd)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#7A8B9A]">세후 배당금($)</div>
                      <div className="font-extrabold text-[#2979FF] mt-0.5">
                        {formatUSD(div.postTaxUsd)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#7A8B9A]">세전 원화환산</div>
                      <div className="font-semibold text-gray-300 mt-0.5">
                        {formatKRW(div.preTaxKrw)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
