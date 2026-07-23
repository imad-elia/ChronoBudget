jest.mock('../../db/database');

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { useBudgetStore } from '../../store/useBudgetStore';
import { KeywordsModal } from '../KeywordsModal';
import * as db from '../../db/database';

const onClose = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (db.learnKeyword as jest.Mock).mockResolvedValue(undefined);
  (db.deleteLearnedKeyword as jest.Mock).mockResolvedValue(undefined);
  useBudgetStore.setState({
    learnedKeywords: {},
    loadLearnedKeywords: jest.fn().mockResolvedValue(undefined),
  });
});

describe('KeywordsModal — list', () => {
  it('shows the empty state with no learned keywords', async () => {
    await render(<KeywordsModal visible onClose={onClose} />);
    expect(screen.getByText('No custom keywords yet.')).toBeTruthy();
  });

  it('lists a learned keyword with its category/subcategory', async () => {
    useBudgetStore.setState({
      learnedKeywords: { gymbox: { category: 'wants', subcategory: 'Entertainment' } },
    });
    await render(<KeywordsModal visible onClose={onClose} />);
    expect(screen.getByText('gymbox')).toBeTruthy();
    expect(screen.getByText(/Wants.*Entertainment/)).toBeTruthy();
  });
});

describe('KeywordsModal — add flow', () => {
  it('shows a validation error when the word is empty', async () => {
    await render(<KeywordsModal visible onClose={onClose} />);
    await fireEvent.press(screen.getByText('Add keyword'));
    await fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(screen.getByText('Enter a word.')).toBeTruthy());
    expect(db.learnKeyword).not.toHaveBeenCalled();
  });

  it('shows a validation error when no subcategory is chosen', async () => {
    await render(<KeywordsModal visible onClose={onClose} />);
    await fireEvent.press(screen.getByText('Add keyword'));
    await fireEvent.changeText(screen.getByPlaceholderText('Word (e.g. "gymbox")'), 'gymbox');
    await fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(screen.getByText('Choose a subcategory.')).toBeTruthy());
    expect(db.learnKeyword).not.toHaveBeenCalled();
  });

  it('saves a valid new keyword and reloads', async () => {
    await render(<KeywordsModal visible onClose={onClose} />);
    await fireEvent.press(screen.getByText('Add keyword'));
    await fireEvent.changeText(screen.getByPlaceholderText('Word (e.g. "gymbox")'), 'Gymbox');
    await fireEvent.press(screen.getByText('Wants'));
    await fireEvent.press(screen.getByText('Entertainment'));
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(db.learnKeyword).toHaveBeenCalledWith('gymbox', 'wants', 'Entertainment');
    });
    expect(useBudgetStore.getState().loadLearnedKeywords).toHaveBeenCalled();
  });
});

describe('KeywordsModal — edit flow', () => {
  it('prefills the form when tapping an existing entry', async () => {
    useBudgetStore.setState({
      learnedKeywords: { gymbox: { category: 'wants', subcategory: 'Entertainment' } },
    });
    await render(<KeywordsModal visible onClose={onClose} />);
    await fireEvent.press(screen.getByText('gymbox'));
    expect(screen.getByDisplayValue('gymbox')).toBeTruthy();
  });
});

describe('KeywordsModal — delete', () => {
  it('deletes a keyword and reloads', async () => {
    useBudgetStore.setState({
      learnedKeywords: { gymbox: { category: 'wants', subcategory: 'Entertainment' } },
    });
    await render(<KeywordsModal visible onClose={onClose} />);
    await fireEvent.press(screen.getByTestId('delete-keyword-gymbox'));

    await waitFor(() => expect(db.deleteLearnedKeyword).toHaveBeenCalledWith('gymbox'));
    expect(useBudgetStore.getState().loadLearnedKeywords).toHaveBeenCalled();
  });
});
