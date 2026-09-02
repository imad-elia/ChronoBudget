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
});
