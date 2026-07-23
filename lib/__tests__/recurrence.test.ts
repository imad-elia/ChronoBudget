import { advance } from '../recurrence';

describe('advance', () => {
  it('moves weekly by exactly 7 days', () => {
    const start = new Date(2026, 0, 15, 9, 30, 0).getTime();
    const next = advance(start, 'weekly');
    expect(next - start).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('moves monthly to the same day next month', () => {
    const start = new Date(2026, 2, 15, 10, 0, 0).getTime();
    const next = new Date(advance(start, 'monthly'));
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(3);
    expect(next.getDate()).toBe(15);
  });

  it('rolls over from December to January', () => {
    const start = new Date(2026, 11, 10).getTime();
    const next = new Date(advance(start, 'monthly'));
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(0);
    expect(next.getDate()).toBe(10);
  });

  it('clamps Jan 31 to Feb 28 in a non-leap year', () => {
    const start = new Date(2026, 0, 31).getTime();
    const next = new Date(advance(start, 'monthly'));
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(28);
  });

  it('clamps Jan 31 to Feb 29 in a leap year', () => {
    const start = new Date(2028, 0, 31).getTime();
    const next = new Date(advance(start, 'monthly'));
    expect(next.getFullYear()).toBe(2028);
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(29);
  });

  it('preserves time-of-day across a monthly advance', () => {
    const start = new Date(2026, 2, 15, 14, 22, 33, 100).getTime();
    const next = new Date(advance(start, 'monthly'));
    expect(next.getHours()).toBe(14);
    expect(next.getMinutes()).toBe(22);
    expect(next.getSeconds()).toBe(33);
    expect(next.getMilliseconds()).toBe(100);
  });

  it('moves yearly to the same month/day next year', () => {
    const start = new Date(2026, 5, 1).getTime();
    const next = new Date(advance(start, 'yearly'));
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(5);
    expect(next.getDate()).toBe(1);
  });

  it('clamps Feb 29 (leap) to Feb 28 the following (non-leap) year', () => {
    const start = new Date(2028, 1, 29).getTime();
    const next = new Date(advance(start, 'yearly'));
    expect(next.getFullYear()).toBe(2029);
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(28);
  });
});
