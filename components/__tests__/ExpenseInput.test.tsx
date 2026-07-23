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
      expect(db.insertTransaction).toHaveBeenCalledWith(15, 'wants', 'Dining', '');
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
