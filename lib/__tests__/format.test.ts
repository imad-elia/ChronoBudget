import { useBudgetStore } from '../../store/useBudgetStore';
import { formatCurrency, formatCompactCurrency, formatNumber, formatDate } from '../format';

function seedStore(overrides: Partial<ReturnType<typeof useBudgetStore.getState>> = {}) {
  useBudgetStore.setState({
    locale: 'en-US',
    currency: 'USD',
    symbol: '$',
    currencyDecimals: 2,
    ...overrides,
  });
}

describe('formatCurrency', () => {
  beforeEach(() => seedStore());

  it('formats using Intl for a known locale/currency', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });

  it('falls back to the manual formatter when Intl.NumberFormat throws', () => {
    const spy = jest.spyOn(Intl, 'NumberFormat').mockImplementation(() => {
      throw new Error('unsupported locale/currency');
    });
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    spy.mockRestore();
  });
});

describe('formatCompactCurrency', () => {
  beforeEach(() => seedStore());

  it('renders full value under 1000', () => {
    expect(formatCompactCurrency(42)).toBe('$42.00');
  });

  it('renders the "k" compact form at 1000 and above', () => {
    expect(formatCompactCurrency(1200)).toBe('$1.2k');
  });

  it('renders the "k" compact form for large negative values by magnitude', () => {
    expect(formatCompactCurrency(-1500)).toBe('$-1.5k');
  });
});

describe('formatNumber', () => {
  beforeEach(() => seedStore());

  it('formats using Intl for a known locale', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('falls back to the manual grouped formatter when Intl throws', () => {
    const spy = jest.spyOn(Intl, 'NumberFormat').mockImplementation(() => {
      throw new Error('unsupported locale');
    });
    expect(formatNumber(1234567)).toBe('1,234,567.00');
    spy.mockRestore();
  });
});

describe('formatDate', () => {
  beforeEach(() => seedStore());

  it('formats a timestamp using Intl.DateTimeFormat', () => {
    const ts = new Date(2026, 0, 15).getTime();
    expect(formatDate(ts)).toBe(new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(ts)));
  });

  it('falls back to toLocaleDateString when Intl.DateTimeFormat throws', () => {
    const ts = new Date(2026, 0, 15).getTime();
    const spy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('unsupported locale');
    });
    expect(formatDate(ts)).toBe(new Date(ts).toLocaleDateString());
    spy.mockRestore();
  });
});
