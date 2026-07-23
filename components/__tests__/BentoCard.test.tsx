import React from 'react';
import { render, screen } from '@testing-library/react-native';
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

  it('shows a negative (over-balance) remaining line when spend exceeds the balance', async () => {
    await render(<BentoCard {...baseProps} amount={120} balance={100} />);
    expect(screen.getByText(/-\$20\.00/)).toBeTruthy();
  });

  it('shows an OVER badge and percentage past 100% of the limit', async () => {
    await render(<BentoCard {...baseProps} amount={68} limit={50} />);
    expect(screen.getByText('OVER')).toBeTruthy();
    expect(screen.getByText('136%')).toBeTruthy();
  });

  it('does not show an OVER badge under the limit', async () => {
    await render(<BentoCard {...baseProps} amount={30} limit={50} />);
    expect(screen.queryByText('OVER')).toBeNull();
    expect(screen.getByText('60%')).toBeTruthy();
  });
});
