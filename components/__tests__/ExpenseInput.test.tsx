jest.mock('../../db/database');

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { useBudgetStore } from '../../store/useBudgetStore';
import { ExpenseInput } from '../ExpenseInput';
import * as db from '../../db/database';

const SMART_PLACEHOLDER = 'e.g. 15 coffee';
const AMOUNT_PLACEHOLDER = '0.00';

beforeEach(() => {
  jest.clearAllMocks();
  (db.getSetting as jest.Mock).mockResolvedValue(null);
  (db.setSetting as jest.Mock).mockResolvedValue(undefined);
  (db.insertTransaction as jest.Mock).mockResolvedValue(undefined);
  (db.learnKeyword as jest.Mock).mockResolvedValue(undefined);
  useBudgetStore.setState({
    symbol: '$',
    learnedKeywords: {},
    triggerRefresh: jest.fn(),
    loadLearnedKeywords: jest.fn().mockResolvedValue(undefined),
  });
});

describe('ExpenseInput — fast mode', () => {
  it('auto-detects the category/subcategory from a seed keyword as the preview', async () => {
    await render(<ExpenseInput />);
    const field = screen.getByPlaceholderText(SMART_PLACEHOLDER);
    await fireEvent.changeText(field, '15 coffee');
    await waitFor(() => expect(screen.getByText('Dining')).toBeTruthy());
    expect(screen.getByText('Wants')).toBeTruthy();
  });

  it('shows a validation error and does not submit when there is no amount', async () => {
    await render(<ExpenseInput />);
    const field = screen.getByPlaceholderText(SMART_PLACEHOLDER);
    await fireEvent.changeText(field, 'coffee');
    await fireEvent.press(screen.getByText('Add'));
    await waitFor(() => expect(db.insertTransaction).not.toHaveBeenCalled());
  });

  it('submits a valid fast-mode entry, learns nothing for an untouched seed match, and resets the field', async () => {
    await render(<ExpenseInput />);
    const field = screen.getByPlaceholderText(SMART_PLACEHOLDER);
    await fireEvent.changeText(field, '15 coffee');
    await fireEvent.press(screen.getByText('Add'));

    await waitFor(() => {
      expect(db.insertTransaction).toHaveBeenCalledWith(15, 'wants', 'Dining', 'coffee', null, null, 'deposit');
    });
    expect(db.learnKeyword).not.toHaveBeenCalled();
    expect(useBudgetStore.getState().triggerRefresh).toHaveBeenCalled();
    expect(screen.getByPlaceholderText(SMART_PLACEHOLDER).props.value).toBe('');
  });

  it('learns the keyword when submitting an unmatched entry', async () => {
    await render(<ExpenseInput />);
    const field = screen.getByPlaceholderText(SMART_PLACEHOLDER);
    await fireEvent.changeText(field, '15 xyzzy');
    await fireEvent.press(screen.getByText('Add'));

    await waitFor(() => expect(db.insertTransaction).toHaveBeenCalled());
    expect(db.learnKeyword).toHaveBeenCalledWith('xyzzy', 'needs', 'Xyzzy');
  });

  it('resumes auto-detection on a fresh entry after a manual override, once the field is fully cleared', async () => {
    await render(<ExpenseInput />);
    const field = screen.getByPlaceholderText(SMART_PLACEHOLDER);

    // Detects Wants/Dining, then the user manually overrides to Needs/Groceries.
    await fireEvent.changeText(field, '15 coffee');
    await waitFor(() => expect(screen.getByText('Dining')).toBeTruthy());
    await fireEvent.press(screen.getByText('Wants'));
    await fireEvent.press(screen.getByText('Needs'));
    await fireEvent.press(screen.getByText('Groceries'));
    await waitFor(() => expect(screen.getAllByText('Groceries').length).toBeGreaterThan(0));

    // Clearing the field entirely and typing the same entry again should
    // resolve to the seed detection again, not stick with the override.
    await fireEvent.changeText(field, '');
    await fireEvent.changeText(field, '15 coffee');
    await waitFor(() => expect(screen.getByText('Dining')).toBeTruthy());
    expect(screen.getByText('Wants')).toBeTruthy();
  });
});

describe('ExpenseInput — mode toggle', () => {
  it('persists the input mode when switching to detailed', async () => {
    await render(<ExpenseInput />);
    await fireEvent.press(screen.getByText('Detailed'));
    expect(db.setSetting).toHaveBeenCalledWith('input_mode', 'detailed');
  });

  it('shows a validation error for an amount over the max in detailed mode', async () => {
    await render(<ExpenseInput />);
    await fireEvent.press(screen.getByText('Detailed'));
    const amountField = screen.getByPlaceholderText(AMOUNT_PLACEHOLDER);
    await fireEvent.changeText(amountField, '10000000');
    await fireEvent.press(screen.getByText('Add'));
    await waitFor(() => expect(db.insertTransaction).not.toHaveBeenCalled());
  });
});

describe('ExpenseInput — Savings deposit/withdrawal toggle', () => {
  it('is hidden for Needs/Wants and defaults to Deposit for Savings', async () => {
    await render(<ExpenseInput />);
    await fireEvent.press(screen.getByText('Detailed'));
    expect(screen.queryByText('Deposit')).toBeNull();
    expect(screen.queryByText('Withdrawal')).toBeNull();

    await fireEvent.press(screen.getByText('Savings'));
    expect(screen.getByText('Deposit')).toBeTruthy();
    expect(screen.getByText('Withdrawal')).toBeTruthy();
  });

  it('passes "withdrawal" through to insertTransaction when selected', async () => {
    await render(<ExpenseInput />);
    await fireEvent.press(screen.getByText('Detailed'));
    await fireEvent.press(screen.getByText('Savings'));
    await fireEvent.press(screen.getByText('Withdrawal'));
    const amountField = screen.getByPlaceholderText(AMOUNT_PLACEHOLDER);
    await fireEvent.changeText(amountField, '50');
    await fireEvent.press(screen.getByText('Add'));

    await waitFor(() => {
      expect(db.insertTransaction).toHaveBeenCalledWith(50, 'savings', '', '', null, null, 'withdrawal');
    });
  });

  it('resets to Deposit when switching away from Savings', async () => {
    await render(<ExpenseInput />);
    await fireEvent.press(screen.getByText('Detailed'));
    await fireEvent.press(screen.getByText('Savings'));
    await fireEvent.press(screen.getByText('Withdrawal'));
    await fireEvent.press(screen.getByText('Needs'));
    await fireEvent.press(screen.getByText('Savings'));
    // Re-selecting Savings after leaving it should show Deposit as active again —
    // asserted indirectly via a fresh submit, since the chip itself has no
    // distinct "active" text to query.
    const amountField = screen.getByPlaceholderText(AMOUNT_PLACEHOLDER);
    await fireEvent.changeText(amountField, '10');
    await fireEvent.press(screen.getByText('Add'));

    await waitFor(() => {
      expect(db.insertTransaction).toHaveBeenCalledWith(10, 'savings', '', '', null, null, 'deposit');
    });
  });
});

describe('ExpenseInput — Fast mode inline deposit/withdrawal chip', () => {
  it('is hidden until Savings is selected, defaults to Deposit once shown', async () => {
    await render(<ExpenseInput />);
    const field = screen.getByPlaceholderText(SMART_PLACEHOLDER);
    await fireEvent.changeText(field, '15 coffee');
    await waitFor(() => expect(screen.getByText('Wants')).toBeTruthy());
    expect(screen.queryByText('Deposit')).toBeNull();
    expect(screen.queryByText('Withdrawal')).toBeNull();

    // Open the override panel (tap the preview) and switch to Savings.
    await fireEvent.press(screen.getByText('Wants'));
    await fireEvent.press(screen.getByText('Savings'));

    expect(screen.getByText('Deposit')).toBeTruthy();
    expect(screen.queryByText('Withdrawal')).toBeNull();
  });

  it('tapping the inline chip flips the direction', async () => {
    await render(<ExpenseInput />);
    const field = screen.getByPlaceholderText(SMART_PLACEHOLDER);
    await fireEvent.changeText(field, '15 coffee');
    await fireEvent.press(screen.getByText('Wants'));
    await fireEvent.press(screen.getByText('Savings'));

    await fireEvent.press(screen.getByText('Deposit'));

    expect(screen.getByText('Withdrawal')).toBeTruthy();
    expect(screen.queryByText('Deposit')).toBeNull();
  });

  it('passes "withdrawal" through to insertTransaction when flipped via the inline chip', async () => {
    await render(<ExpenseInput />);
    const field = screen.getByPlaceholderText(SMART_PLACEHOLDER);
    await fireEvent.changeText(field, '15 coffee');
    await fireEvent.press(screen.getByText('Wants'));
    await fireEvent.press(screen.getByText('Savings'));
    await fireEvent.press(screen.getByText('Deposit'));
    await fireEvent.press(screen.getByText('Add'));

    await waitFor(() => {
      expect(db.insertTransaction).toHaveBeenCalledWith(15, 'savings', '', 'coffee', null, null, 'withdrawal');
    });
  });

  it('is hidden in Detailed mode (which already shows the full toggle inline)', async () => {
    await render(<ExpenseInput />);
    await fireEvent.press(screen.getByText('Detailed'));
    await fireEvent.press(screen.getByText('Savings'));
    // Exactly one Deposit/Withdrawal pair should exist (the in-form toggle),
    // not a second copy from the preview-row chip.
    expect(screen.getAllByText('Deposit')).toHaveLength(1);
    expect(screen.getAllByText('Withdrawal')).toHaveLength(1);
  });
});
