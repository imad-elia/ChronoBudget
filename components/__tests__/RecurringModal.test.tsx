jest.mock('../../db/database');

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { useBudgetStore } from '../../store/useBudgetStore';
import { RecurringModal } from '../RecurringModal';
import * as db from '../../db/database';
import type { RecurringRule } from '../../store/useBudgetStore';

const onClose = jest.fn();

const seedRule: RecurringRule = {
  id: 7,
  amount: 50,
  category: 'needs',
  subcategory: 'Rent',
  note: '',
  frequency: 'monthly',
  nextRun: new Date(2026, 7, 1).getTime(),
  active: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  (db.insertRecurring as jest.Mock).mockResolvedValue(undefined);
  (db.updateRecurring as jest.Mock).mockResolvedValue(undefined);
  (db.deleteRecurring as jest.Mock).mockResolvedValue(undefined);
  (db.processRecurring as jest.Mock).mockResolvedValue(0);
  useBudgetStore.setState({
    symbol: '$',
    locale: 'en-US',
    currency: 'USD',
    currencyDecimals: 2,
    recurring: [],
    triggerRefresh: jest.fn(),
    loadRecurring: jest.fn().mockResolvedValue(undefined),
  });
});

describe('RecurringModal — list view', () => {
  it('shows the empty state with no rules', async () => {
    await render(<RecurringModal visible onClose={onClose} />);
    expect(screen.getByText('No recurring rules yet')).toBeTruthy();
  });

  it('renders a seeded rule with its formatted amount and frequency', async () => {
    useBudgetStore.setState({ recurring: [seedRule] });
    await render(<RecurringModal visible onClose={onClose} />);
    expect(screen.getByText('Rent')).toBeTruthy();
    expect(screen.getByText('$50.00')).toBeTruthy();
    expect(screen.getByText(/Monthly/)).toBeTruthy();
  });
});

describe('RecurringModal — add flow', () => {
  it('shows a validation error and does not save with no amount', async () => {
    await render(<RecurringModal visible onClose={onClose} />);
    await fireEvent.press(screen.getByText('Add recurring'));
    await fireEvent.press(screen.getByText('Save rule'));
    await waitFor(() => expect(db.insertRecurring).not.toHaveBeenCalled());
    expect(screen.getByText('Enter a valid amount.')).toBeTruthy();
  });

  it('saves a new rule, posts due occurrences, reloads, and refreshes', async () => {
    await render(<RecurringModal visible onClose={onClose} />);
    await fireEvent.press(screen.getByText('Add recurring'));
    await fireEvent.changeText(screen.getByPlaceholderText('0.00'), '100');
    await fireEvent.press(screen.getByText('Groceries'));
    await fireEvent.press(screen.getByText('Save rule'));

    await waitFor(() => {
      expect(db.insertRecurring).toHaveBeenCalledWith({
        amount: 100,
        category: 'needs',
        subcategory: 'Groceries',
        note: '',
        frequency: 'monthly',
      });
    });
    expect(db.processRecurring).toHaveBeenCalled();
    expect(useBudgetStore.getState().loadRecurring).toHaveBeenCalled();
    expect(useBudgetStore.getState().triggerRefresh).toHaveBeenCalled();

    // Back on the list view after a successful save.
    await waitFor(() => expect(screen.getByText('Add recurring')).toBeTruthy());
  });
});

describe('RecurringModal — edit flow', () => {
  it('prefills the form from an existing rule and calls updateRecurring on save', async () => {
    useBudgetStore.setState({ recurring: [seedRule] });
    await render(<RecurringModal visible onClose={onClose} />);

    await fireEvent.press(screen.getByText('Rent'));
    expect(screen.getByDisplayValue('50')).toBeTruthy();

    await fireEvent.changeText(screen.getByDisplayValue('50'), '75');
    await fireEvent.press(screen.getByText('Save rule'));

    await waitFor(() => {
      expect(db.updateRecurring).toHaveBeenCalledWith(7, {
        amount: 75,
        category: 'needs',
        subcategory: 'Rent',
        note: '',
        frequency: 'monthly',
      });
    });
    expect(db.insertRecurring).not.toHaveBeenCalled();
  });
});

describe('RecurringModal — delete', () => {
  it('deletes a rule and reloads', async () => {
    useBudgetStore.setState({ recurring: [seedRule] });
    await render(<RecurringModal visible onClose={onClose} />);

    await fireEvent.press(screen.getByTestId('delete-recurring-7'));

    await waitFor(() => expect(db.deleteRecurring).toHaveBeenCalledWith(7));
    expect(useBudgetStore.getState().loadRecurring).toHaveBeenCalled();
  });
});
