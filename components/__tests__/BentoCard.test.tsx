import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useBudgetStore } from '../../store/useBudgetStore';
import { BentoCard } from '../BentoCard';

const baseProps = {
  title: 'Needs',
  color: '#00E5A0',
  glowColor: '#00E5A0',
  gradientColors: ['#111', '#222', '#333'] as [string, string, string],
  icon: 'home' as const,
};

beforeEach(() => {
  useBudgetStore.setState({
    locale: 'en-US',
    currency: 'USD',
    symbol: '$',
    currencyDecimals: 2,
  });
});

describe('BentoCard', () => {
  it('renders the formatted amount', async () => {
    await render(<BentoCard {...baseProps} amount={42} />);
    expect(screen.getByText('$42.00')).toBeTruthy();
  });

  it('shows no "remaining" line when no balance is set', async () => {
    await render(<BentoCard {...baseProps} amount={42} />);
    expect(screen.queryByText(/left/)).toBeNull();
  });

  it('shows a positive remaining line under the limit', async () => {
    await render(<BentoCard {...baseProps} amount={42} balance={100} />);
    expect(screen.getByText(/\$58\.00/)).toBeTruthy();
  });

  it('shows an "OVER BY $amount" badge (same style as the limit badge) when spend exceeds the balance', async () => {
    await render(<BentoCard {...baseProps} amount={120} balance={100} />);
    expect(screen.getByText('OVER BY $20.00')).toBeTruthy();
    expect(screen.queryByText(/-\$20\.00/)).toBeNull();
    expect(screen.queryByText(/left/)).toBeNull();
  });

  it('shows a compact "OVER $limit" badge, not a percentage, past 100% of the limit', async () => {
    await render(<BentoCard {...baseProps} amount={68} limit={50} />);
    expect(screen.getByText('OVER $50.00')).toBeTruthy();
    expect(screen.queryByText('136%')).toBeNull();
  });

  it('shows both an over-balance badge and an over-limit badge distinctly when both are exceeded', async () => {
    await render(<BentoCard {...baseProps} amount={120} balance={100} limit={50} />);
    expect(screen.getByText('OVER BY $20.00')).toBeTruthy();
    expect(screen.getByText('OVER $50.00')).toBeTruthy();
  });

  it('does not show an OVER badge under the limit', async () => {
    await render(<BentoCard {...baseProps} amount={30} limit={50} />);
    expect(screen.queryByText(/OVER/)).toBeNull();
    expect(screen.getByText('60%')).toBeTruthy();
  });

  describe('large amounts (>= $1K) use compact form to avoid clipping on phone widths', () => {
    it('compacts the main amount', async () => {
      await render(<BentoCard {...baseProps} amount={12345.67} />);
      expect(screen.getByText('$12.3K')).toBeTruthy();
      expect(screen.queryByText('$12,345.67')).toBeNull();
    });

    it('leaves amounts under the threshold at full precision', async () => {
      await render(<BentoCard {...baseProps} amount={999.99} />);
      expect(screen.getByText('$999.99')).toBeTruthy();
    });

    it('compacts the "remaining" line', async () => {
      await render(<BentoCard {...baseProps} amount={5000} balance={20000} />);
      expect(screen.getByText(/\$15\.0K/)).toBeTruthy();
    });

    it('compacts the over-balance badge', async () => {
      await render(<BentoCard {...baseProps} amount={25000} balance={10000} />);
      expect(screen.getByText('OVER BY $15.0K')).toBeTruthy();
    });

    it('compacts the over-limit badge', async () => {
      await render(<BentoCard {...baseProps} amount={15000} limit={10000} />);
      expect(screen.getByText('OVER $10.0K')).toBeTruthy();
    });
  });

  describe('tap to open detail sheet', () => {
    it('calls onPress when tapped', async () => {
      const onPress = jest.fn();
      await render(<BentoCard {...baseProps} amount={42} onPress={onPress} testID="bento-card-needs" />);
      fireEvent.press(screen.getByTestId('bento-card-needs'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('renders as a non-interactive card when onPress is omitted', async () => {
      await render(<BentoCard {...baseProps} amount={42} />);
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('consumption prop (Savings: Limit/Balance react to withdrawals only)', () => {
    it('without consumption, Limit/Balance still react to the plain amount (Needs/Wants, unchanged)', async () => {
      await render(<BentoCard {...baseProps} amount={68} limit={50} />);
      expect(screen.getByText('OVER $50.00')).toBeTruthy();
    });

    it('a deposit-heavy net amount does NOT trip the limit when consumption (withdrawn) is low', async () => {
      // amount=500 (net saved this month) would be well over a $50 limit on its
      // own, but consumption=10 (only $10 actually withdrawn) should be what's
      // compared against the limit instead.
      await render(<BentoCard {...baseProps} amount={500} limit={50} consumption={10} />);
      expect(screen.queryByText(/OVER/)).toBeNull();
      expect(screen.getByText('20%')).toBeTruthy(); // 10 / 50
    });

    it('a high consumption (withdrawn) trips the limit even when the net amount is low', async () => {
      await render(<BentoCard {...baseProps} amount={5} limit={50} consumption={68} />);
      expect(screen.getByText('OVER $50.00')).toBeTruthy();
    });

    it('balance remaining is computed against consumption, not the net amount', async () => {
      // balance=100, amount=500 (net saved) would show as over-balance using
      // amount alone; consumption=20 (withdrawn) should be used instead.
      await render(<BentoCard {...baseProps} amount={500} balance={100} consumption={20} />);
      expect(screen.getByText(/\$80\.00/)).toBeTruthy(); // 100 - 20
      expect(screen.queryByText(/OVER/)).toBeNull();
    });
  });
});
