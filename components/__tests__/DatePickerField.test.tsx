import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { useBudgetStore } from '../../store/useBudgetStore';
import { DatePickerField } from '../DatePickerField';

beforeEach(() => {
  useBudgetStore.setState({ locale: 'en-US' });
});

describe('DatePickerField', () => {
  it('shows the default "Today" label when no value is set, and expands to the current month on tap', async () => {
    const onChange = jest.fn();
    await render(<DatePickerField value={undefined} onChange={onChange} activeColor="#00FF87" />);

    expect(screen.getByText('Today')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('date-picker-toggle'));

    const now = new Date();
    const expectedMonth = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now);
    expect(screen.getByText(expectedMonth)).toBeTruthy();
  });

  it('navigates to the next/previous month and updates the header label', async () => {
    const onChange = jest.fn();
    await render(<DatePickerField value={undefined} onChange={onChange} activeColor="#00FF87" />);
    await fireEvent.press(screen.getByTestId('date-picker-toggle'));

    const now = new Date();
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const expectedNextLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(nextMonthDate);

    await fireEvent.press(screen.getByTestId('chevron-right-btn'));
    expect(screen.getByText(expectedNextLabel)).toBeTruthy();
  });

  it('calls onChange with a local-noon timestamp for the tapped day', async () => {
    const onChange = jest.fn();
    await render(<DatePickerField value={undefined} onChange={onChange} activeColor="#00FF87" />);
    await fireEvent.press(screen.getByTestId('date-picker-toggle'));

    await fireEvent.press(screen.getByTestId('date-picker-day-15'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const ts = onChange.mock.calls[0][0];
    const d = new Date(ts);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(12);
  });
});
