jest.mock('../../db/database');

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { useBudgetStore } from '../../store/useBudgetStore';
import { GoalsModal } from '../GoalsModal';
import * as db from '../../db/database';
import type { Goal } from '../../store/useBudgetStore';

const onClose = jest.fn();

const seedGoal: Goal = {
  id: 3,
  name: 'Car repair fund',
  targetAmount: 2000,
  currentAmount: 500,
};

beforeEach(() => {
  jest.clearAllMocks();
  (db.insertGoal as jest.Mock).mockResolvedValue(undefined);
  (db.updateGoal as jest.Mock).mockResolvedValue(undefined);
  (db.deleteGoal as jest.Mock).mockResolvedValue(true);
  (db.fetchGoals as jest.Mock).mockResolvedValue([]);
  useBudgetStore.setState({
    symbol: '$',
    goals: [],
    setGoals: jest.fn(),
    triggerRefresh: jest.fn(),
  });
});

describe('GoalsModal — list view', () => {
  it('shows the empty state with no goals', async () => {
    await render(<GoalsModal visible onClose={onClose} />);
    expect(screen.getByText('No goals yet')).toBeTruthy();
  });

  it('renders a seeded goal with its progress', async () => {
    useBudgetStore.setState({ goals: [seedGoal] });
    await render(<GoalsModal visible onClose={onClose} />);
    expect(screen.getByText('Car repair fund')).toBeTruthy();
    expect(screen.getByText('$500.00 / $2,000.00')).toBeTruthy();
    expect(screen.getByText('25%')).toBeTruthy();
  });
});

describe('GoalsModal — add flow', () => {
  it('shows a validation error and does not save with no target amount', async () => {
    await render(<GoalsModal visible onClose={onClose} />);
    await fireEvent.press(screen.getByText('Add goal'));
    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Car repair fund'), 'Vacation');
    await fireEvent.press(screen.getByText('Save goal'));
    await waitFor(() => expect(db.insertGoal).not.toHaveBeenCalled());
    expect(screen.getByText('Enter a valid amount.')).toBeTruthy();
  });

  it('saves a new goal, reloads, and refreshes', async () => {
    await render(<GoalsModal visible onClose={onClose} />);
    await fireEvent.press(screen.getByText('Add goal'));
    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Car repair fund'), 'Vacation');
    await fireEvent.changeText(screen.getByPlaceholderText('Target amount'), '1000');
    await fireEvent.press(screen.getByText('Save goal'));

    await waitFor(() => {
      expect(db.insertGoal).toHaveBeenCalledWith('Vacation', 1000);
    });
    expect(db.fetchGoals).toHaveBeenCalled();
    expect(useBudgetStore.getState().triggerRefresh).toHaveBeenCalled();

    await waitFor(() => expect(screen.getByText('Add goal')).toBeTruthy());
  });
});

describe('GoalsModal — edit flow', () => {
  it('prefills the form from an existing goal and calls updateGoal on save', async () => {
    useBudgetStore.setState({ goals: [seedGoal] });
    await render(<GoalsModal visible onClose={onClose} />);

    await fireEvent.press(screen.getByText('Car repair fund'));
    expect(screen.getByDisplayValue('2000')).toBeTruthy();

    await fireEvent.changeText(screen.getByDisplayValue('2000'), '2500');
    await fireEvent.press(screen.getByText('Save goal'));

    await waitFor(() => {
      expect(db.updateGoal).toHaveBeenCalledWith(3, 'Car repair fund', 2500);
    });
    expect(db.insertGoal).not.toHaveBeenCalled();
  });
});

describe('GoalsModal — delete flow', () => {
  it('deletes a goal with no references', async () => {
    useBudgetStore.setState({ goals: [seedGoal] });
    await render(<GoalsModal visible onClose={onClose} />);

    await fireEvent.press(screen.getByTestId('delete-goal-3'));

    await waitFor(() => expect(db.deleteGoal).toHaveBeenCalledWith(3));
    expect(useBudgetStore.getState().triggerRefresh).toHaveBeenCalled();
  });

  it('shows an error when deletion is blocked by referencing transactions', async () => {
    (db.deleteGoal as jest.Mock).mockResolvedValue(false);
    useBudgetStore.setState({ goals: [seedGoal] });
    await render(<GoalsModal visible onClose={onClose} />);

    await fireEvent.press(screen.getByTestId('delete-goal-3'));

    await waitFor(() => {
      expect(screen.getByText('This goal has transactions and can’t be deleted.')).toBeTruthy();
    });
  });
});
