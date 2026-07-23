jest.mock('../../db/database');

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { useBudgetStore } from '../../store/useBudgetStore';
import { EditTransactionModal } from '../EditTransactionModal';
import * as db from '../../db/database';
import type { Transaction } from '../../store/useBudgetStore';

const onClose = jest.fn();

const baseTransaction: Transaction = {
  id: 42,
  amount: 25,
  category: 'wants',
  subcategory: 'Dining',
  note: 'lunch',
  timestamp: Date.now(),
};

beforeEach(() => {
  jest.clearAllMocks();
  useBudgetStore.setState({ symbol: '$' });
});

describe('EditTransactionModal', () => {
  it('prefills from a preset subcategory', async () => {
    await render(<EditTransactionModal transaction={baseTransaction} onClose={onClose} />);
    expect(screen.getByDisplayValue('25')).toBeTruthy();
    expect(screen.getByDisplayValue('lunch')).toBeTruthy();
  });

  it('detects a non-preset subcategory as custom and shows it in the custom input', async () => {
    const custom = { ...baseTransaction, subcategory: 'Something Unusual' };
    await render(<EditTransactionModal transaction={custom} onClose={onClose} />);
    expect(screen.getByDisplayValue('Something Unusual')).toBeTruthy();
  });

  it('shows a validation error and does not save when the amount is invalid', async () => {
    await render(<EditTransactionModal transaction={baseTransaction} onClose={onClose} />);
    await fireEvent.changeText(screen.getByDisplayValue('25'), '0');
    await fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(db.updateTransaction).not.toHaveBeenCalled());
  });

  it('saves a valid edit and triggers refresh + close', async () => {
    (db.updateTransaction as jest.Mock).mockResolvedValue(undefined);
    await render(<EditTransactionModal transaction={baseTransaction} onClose={onClose} />);

    await fireEvent.changeText(screen.getByDisplayValue('25'), '30');
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(db.updateTransaction).toHaveBeenCalledWith(42, {
        amount: 30,
        category: 'wants',
        subcategory: 'Dining',
        note: 'lunch',
      });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('deletes the transaction and triggers refresh + close', async () => {
    (db.deleteTransaction as jest.Mock).mockResolvedValue(undefined);
    await render(<EditTransactionModal transaction={baseTransaction} onClose={onClose} />);

    await fireEvent.press(screen.getByTestId('delete-transaction'));

    await waitFor(() => expect(db.deleteTransaction).toHaveBeenCalledWith(42));
    expect(onClose).toHaveBeenCalled();
  });
});
