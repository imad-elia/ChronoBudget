import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useBudgetStore } from '../../store/useBudgetStore';
import { BentoCardDetailModal } from '../BentoCardDetailModal';

const baseProps = {
  visible: true,
  onClose: jest.fn(),
  title: 'Needs',
  icon: 'home' as const,
  color: '#00E5A0',
};

beforeEach(() => {
  jest.clearAllMocks();
  useBudgetStore.setState({
    locale: 'en-US',
    currency: 'USD',
    symbol: '$',
    currencyDecimals: 2,
  });
});

describe('BentoCardDetailModal', () => {
  it('always shows the exact spent amount, never compacted', async () => {
    await render(<BentoCardDetailModal {...baseProps} amount={12345.67} />);
    expect(screen.getByText('$12,345.67')).toBeTruthy();
    expect(screen.queryByText('$12.3K')).toBeNull();
  });

  it('shows limit + exact percentage when a limit is set, under the limit', async () => {
    await render(<BentoCardDetailModal {...baseProps} amount={30} limit={50} />);
    expect(screen.getByText('$50.00')).toBeTruthy();
    expect(screen.getByText('60% used')).toBeTruthy();
    expect(screen.queryByText(/OVER/)).toBeNull();
  });

  it('shows an exact "OVER BY" line when over the limit', async () => {
    await render(<BentoCardDetailModal {...baseProps} amount={15068} limit={10000} />);
    expect(screen.getByText('OVER BY $5,068.00')).toBeTruthy();
  });

  it('shows balance + exact remaining when under the balance', async () => {
    await render(<BentoCardDetailModal {...baseProps} amount={42} balance={100} />);
    expect(screen.getByText('$100.00')).toBeTruthy();
    expect(screen.getByText('$58.00 left')).toBeTruthy();
  });

  it('shows an exact "OVER BY" amount when over the balance', async () => {
    await render(<BentoCardDetailModal {...baseProps} amount={25000} balance={10000} />);
    expect(screen.getByText('OVER BY $15,000.00')).toBeTruthy();
  });

  it('shows both limit and balance breakdowns together, each with its own exact overage', async () => {
    await render(<BentoCardDetailModal {...baseProps} amount={120} balance={100} limit={50} />);
    expect(screen.getByText('OVER BY $70.00')).toBeTruthy(); // over-limit: 120 - 50
    expect(screen.getByText('OVER BY $20.00')).toBeTruthy(); // over-balance: 120 - 100
  });

  it('calls onClose when the backdrop is tapped', async () => {
    const onClose = jest.fn();
    await render(<BentoCardDetailModal {...baseProps} amount={42} onClose={onClose} />);
    fireEvent.press(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe('consumption prop (Savings: Net saved / Deposited / Withdrawn breakdown)', () => {
    it('shows Net saved + a Deposited/Withdrawn breakdown instead of "Spent This Month" when consumption is provided', async () => {
      // amount=350 is net (deposits - withdrawals); consumption=150 is withdrawn,
      // so deposited is derived as amount + consumption = 500.
      await render(<BentoCardDetailModal {...baseProps} amount={350} consumption={150} />);
      expect(screen.getByText('Net saved this month')).toBeTruthy();
      expect(screen.getByText('$350.00')).toBeTruthy();
      expect(screen.getByText('Deposited')).toBeTruthy();
      expect(screen.getByText('$500.00')).toBeTruthy();
      expect(screen.getByText('Withdrawn')).toBeTruthy();
      expect(screen.getByText('$150.00')).toBeTruthy();
      expect(screen.queryByText('Spent This Month')).toBeNull();
    });

    it('Needs/Wants (no consumption prop) keep the plain "Spent This Month" row', async () => {
      await render(<BentoCardDetailModal {...baseProps} amount={350} />);
      expect(screen.getByText('Spent This Month')).toBeTruthy();
      expect(screen.queryByText('Net saved this month')).toBeNull();
    });

    it('limit consumption reacts to withdrawn (consumption), not the net saved amount', async () => {
      // amount=500 (net saved) would trip a $50 limit on its own; consumption=10
      // (withdrawn) should be what's actually compared against the limit.
      await render(<BentoCardDetailModal {...baseProps} amount={500} limit={50} consumption={10} />);
      expect(screen.getByText('20% used')).toBeTruthy(); // 10 / 50
      expect(screen.queryByText(/OVER/)).toBeNull();
    });

    it('balance remaining reacts to withdrawn (consumption), not the net saved amount', async () => {
      await render(<BentoCardDetailModal {...baseProps} amount={500} balance={100} consumption={20} />);
      expect(screen.getByText('$80.00 left')).toBeTruthy(); // 100 - 20
    });
  });
});
