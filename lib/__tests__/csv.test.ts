import { parseCsv } from '../csv';

const HEADER = 'Date,Time,Category,Subcategory,Note,Amount';

describe('parseCsv', () => {
  it('parses a well-formed export back into rows', () => {
    const csv = [
      HEADER,
      '2026-07-15,09:30,needs,"Groceries","Weekly shop",42.50',
      '2026-07-16,18:05,wants,"Dining","",12.00',
    ].join('\n');

    const { rows, skipped } = parseCsv(csv);
    expect(skipped).toBe(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ amount: 42.5, category: 'needs', subcategory: 'Groceries', note: 'Weekly shop' });
    expect(rows[1]).toMatchObject({ amount: 12, category: 'wants', subcategory: 'Dining', note: '' });

    const d = new Date(rows[0].timestamp);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July (0-indexed)
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(30);
  });

  it('unescapes doubled quotes inside a quoted field', () => {
    const csv = `${HEADER}\n2026-07-15,09:30,needs,"Groceries","She said ""hi""",10.00`;
    const { rows } = parseCsv(csv);
    expect(rows[0].note).toBe('She said "hi"');
  });

  it('works without a header row', () => {
    const csv = '2026-07-15,09:30,needs,"Groceries","",10.00';
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(1);
  });

  it('skips a row with the wrong number of fields instead of aborting the whole import', () => {
    const csv = [HEADER, '2026-07-15,09:30,needs,"Groceries",10.00', '2026-07-16,10:00,wants,"Dining","",5.00'].join('\n');
    const { rows, skipped } = parseCsv(csv);
    expect(skipped).toBe(1);
    expect(rows).toHaveLength(1);
  });

  it('skips a row with a non-numeric or non-positive amount', () => {
    const csv = [
      HEADER,
      '2026-07-15,09:30,needs,"Groceries","",abc',
      '2026-07-15,09:30,needs,"Groceries","",0',
      '2026-07-15,09:30,needs,"Groceries","",-5',
    ].join('\n');
    const { rows, skipped } = parseCsv(csv);
    expect(rows).toHaveLength(0);
    expect(skipped).toBe(3);
  });

  it('skips a row with an unparsable date', () => {
    const csv = [HEADER, 'not-a-date,09:30,needs,"Groceries","",10.00'].join('\n');
    const { rows, skipped } = parseCsv(csv);
    expect(rows).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('falls back to the smart classifier when the Category cell is invalid or empty', () => {
    const csv = [HEADER, '2026-07-15,09:30,,"","coffee",4.50'].join('\n');
    const { rows } = parseCsv(csv);
    expect(rows[0]).toMatchObject({ category: 'wants', subcategory: 'Dining' });
  });

  it('returns an empty result for an empty file', () => {
    expect(parseCsv('')).toEqual({ rows: [], skipped: 0 });
  });
});
