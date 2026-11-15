import { CurrencyCode } from '../types/portfolio';

/**
 * Formats a number as full Korean Won currency: ₩56,900,584
 */
export function formatKRW(value: number | undefined | null, showSymbol = true): string {
  const num = Number(value) || 0;
  const rounded = Math.round(num);
  const formatted = Math.abs(rounded).toLocaleString('ko-KR');
  if (rounded < 0) {
    return showSymbol ? `-₩${formatted}` : `-${formatted}원`;
  }
  return showSymbol ? `₩${formatted}` : `${formatted}원`;
}

/**
 * Formats USD amounts: $20,312.48
 */
export function formatUSD(value: number | undefined | null, decimals = 2): string {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return num < 0 ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Multi-currency formatter: takes a KRW amount and converts to USD if currency === 'USD'
 */
export function formatCurrency(
  krwValue: number | undefined | null,
  currency: CurrencyCode = 'KRW',
  usdKrwRate = 1336.565,
  usdDecimals = 2
): string {
  const val = Number(krwValue) || 0;
  if (currency === 'USD') {
    const rate = usdKrwRate > 0 ? usdKrwRate : 1336.565;
    return formatUSD(val / rate, usdDecimals);
  }
  return formatKRW(val);
}

/**
 * Multi-currency signed P/L formatter: +₩218,929 or +$163.80
 */
export function formatSignedCurrency(
  krwValue: number | undefined | null,
  currency: CurrencyCode = 'KRW',
  usdKrwRate = 1336.565
): string {
  const val = Number(krwValue) || 0;
  if (currency === 'USD') {
    const rate = usdKrwRate > 0 ? usdKrwRate : 1336.565;
    const usd = val / rate;
    if (usd > 0.004) return `+${formatUSD(usd, 2)}`;
    if (usd < -0.004) return formatUSD(usd, 2);
    return '$0.00';
  }
  return formatSignedKRW(val);
}

/**
 * Multi-currency compact formatter for chart axes & badges
 */
export function formatCompactCurrency(
  krwValue: number | undefined | null,
  currency: CurrencyCode = 'KRW',
  usdKrwRate = 1336.565
): string {
  const val = Number(krwValue) || 0;
  if (currency === 'USD') {
    const rate = usdKrwRate > 0 ? usdKrwRate : 1336.565;
    const usd = val / rate;
    const abs = Math.abs(usd);
    const sign = usd < 0 ? '-' : '';
    if (abs >= 1_000_000) {
      return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    }
    if (abs >= 1_000) {
      return `${sign}$${(abs / 1_000).toFixed(1)}k`;
    }
    return `${sign}$${abs.toFixed(0)}`;
  }
  return formatCompactKRW(val);
}

/**
 * Formats a number in compact Korean units (억 / 만원) for chart axes & badges
 */
export function formatCompactKRW(value: number | undefined | null): string {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 100_000_000) {
    const eok = Math.floor(abs / 100_000_000);
    const man = Math.round((abs % 100_000_000) / 10_000);
    return man > 0 ? `${sign}${eok}억 ${man.toLocaleString('ko-KR')}만` : `${sign}${eok}억`;
  }
  if (abs >= 10_000) {
    const man = Math.round(abs / 10_000);
    return `${sign}${man.toLocaleString('ko-KR')}만원`;
  }
  return `${sign}₩${Math.round(abs).toLocaleString('ko-KR')}`;
}

/**
 * Formats percentage with explicit + or - sign (does NOT multiply by 100)
 */
export function formatSignedPercent(value: number | undefined | null, decimals = 2): string {
  const num = Number(value) || 0;
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}%`;
}

/**
 * Formats signed KRW P/L: +₩218,929 or -₩15,200
 */
export function formatSignedKRW(value: number | undefined | null): string {
  const num = Math.round(Number(value) || 0);
  if (num > 0) return `+₩${num.toLocaleString('ko-KR')}`;
  if (num < 0) return `-₩${Math.abs(num).toLocaleString('ko-KR')}`;
  return `₩0`;
}

/**
 * Converts an ISO string or Date into KST YYYY.MM.DD format
 */
export function formatDateKST(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '-';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${year}.${month}.${day}`;
}

/**
 * Formats short YY.MM for X-axis labels
 */
export function formatShortDateKST(dateInput: string | Date): string {
  const full = formatDateKST(dateInput);
  if (full.length >= 10) {
    return `${full.slice(2, 4)}.${full.slice(5, 7)}`;
  }
  return full;
}

/**
 * Formats timestamp as HH:MM:SS (KST)
 */
export function formatTimeKST(dateInput: string | Date | number | undefined | null): string {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
