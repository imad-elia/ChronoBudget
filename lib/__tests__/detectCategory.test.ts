import { parseEntry, detectCategory, learnKey } from '../detectCategory';

describe('parseEntry', () => {
  it('parses "amount description"', () => {
    expect(parseEntry('15 coffee')).toEqual({ amount: 15, description: 'coffee' });
  });

  it('parses "description amount"', () => {
    expect(parseEntry('coffee 15')).toEqual({ amount: 15, description: 'coffee' });
  });

  it('supports a decimal point', () => {
    expect(parseEntry('15.50 lunch')).toEqual({ amount: 15.5, description: 'lunch' });
  });

  it('supports a comma decimal separator', () => {
    expect(parseEntry('15,50 lunch')).toEqual({ amount: 15.5, description: 'lunch' });
  });

  it('strips a leading currency symbol from the amount token', () => {
    expect(parseEntry('$15 coffee')).toEqual({ amount: 15, description: 'coffee' });
  });

  it('returns a null amount when no numeric token is present', () => {
    expect(parseEntry('coffee')).toEqual({ amount: null, description: 'coffee' });
  });

  it('returns an empty result for empty input', () => {
    expect(parseEntry('')).toEqual({ amount: null, description: '' });
    expect(parseEntry('   ')).toEqual({ amount: null, description: '' });
  });

  it('only consumes the first numeric token as the amount', () => {
    expect(parseEntry('15 coffee 2')).toEqual({ amount: 15, description: 'coffee 2' });
  });
});

describe('detectCategory', () => {
  it('matches a seed keyword', () => {
    expect(detectCategory('coffee')).toEqual({
      category: 'wants',
      subcategory: 'Dining',
      matched: true,
    });
  });

  it('matches the first token that hits in a multi-word description', () => {
    expect(detectCategory('morning coffee run')).toEqual({
      category: 'wants',
      subcategory: 'Dining',
      matched: true,
    });
  });

  it('prefers the learned map over the seed keyword map', () => {
    const learned = { coffee: { category: 'savings' as const, subcategory: 'Custom' } };
    expect(detectCategory('coffee', learned)).toEqual({
      category: 'savings',
      subcategory: 'Custom',
      matched: true,
    });
  });

  it('falls back to the default category with a title-cased subcategory on no match', () => {
    expect(detectCategory('xyzzy plugh')).toEqual({
      category: 'needs',
      subcategory: 'Xyzzy Plugh',
      matched: false,
    });
  });

  it('strips punctuation before tokenizing', () => {
    expect(detectCategory('coffee!!')).toEqual({
      category: 'wants',
      subcategory: 'Dining',
      matched: true,
    });
  });

  it('returns an unmatched empty result for empty input', () => {
    expect(detectCategory('')).toEqual({ category: 'needs', subcategory: '', matched: false });
  });
});

describe('learnKey', () => {
  it('extracts the first meaningful token, lowercased', () => {
    expect(learnKey('Gymbox Membership')).toBe('gymbox');
  });

  it('strips punctuation from the first token', () => {
    expect(learnKey('  Coffee!, black')).toBe('coffee');
  });

  it('returns an empty string for empty input', () => {
    expect(learnKey('')).toBe('');
    expect(learnKey('   ')).toBe('');
  });
});
