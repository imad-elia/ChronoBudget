import { useBudgetStore } from '../store/useBudgetStore';

// Centralized currency / number / date formatting. Reads the active locale +
// currency from the store. Intl.NumberFormat is tried first, but Hermes' bundled
// Intl does not support every locale/currency, so we wrap it in try/catch and
// fall back to a manual "symbol + grouped digits" formatter that always renders.

function grouped(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  const [intPart, fracPart] = fixed.split('.');
  const withSeparators = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fracPart ? `${withSeparators}.${fracPart}` : withSeparators;
}

export function formatCurrency(amount: number): string {
  const { locale, currency, symbol, currencyDecimals } = useBudgetStore.getState();
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: currencyDecimals,
      minimumFractionDigits: currencyDecimals,
    }).format(amount);
  } catch {
    return `${symbol}${grouped(amount, currencyDecimals)}`;
  }
}

/** Compact currency for tight spaces (e.g. "$1.2k"). */
export function formatCompactCurrency(amount: number): string {
  const { symbol, currencyDecimals } = useBudgetStore.getState();
  if (Math.abs(amount) >= 1000) {
    return `${symbol}${(amount / 1000).toFixed(1)}k`;
  }
  return `${symbol}${grouped(amount, currencyDecimals)}`;
}

export function formatNumber(n: number): string {
  const { locale } = useBudgetStore.getState();
  try {
    return new Intl.NumberFormat(locale).format(n);
  } catch {
    return grouped(n, 2);
  }
}

export function formatDate(ts: number): string {
  const { locale } = useBudgetStore.getState();
  const d = new Date(ts);
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}
