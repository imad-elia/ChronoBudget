import { parseEntry, detectCategory, learnKey } from '../detectCategory';
import { setActiveLocale } from '../i18n';

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

describe('detectCategory — fuzzy/stemming fallback', () => {
  it('resolves an unseeded consonant+y plural via stemming ("bakeries" → "bakery")', () => {
    expect(detectCategory('bakeries')).toEqual({
      category: 'needs',
      subcategory: 'Groceries',
      matched: true,
    });
  });

  it('resolves an unseeded -ing form that drops a silent e ("commuting" → "commute")', () => {
    expect(detectCategory('commuting')).toEqual({
      category: 'needs',
      subcategory: 'Transport',
      matched: true,
    });
  });

  it('resolves a single-character typo via bounded Levenshtein ("grocry" → "grocery")', () => {
    expect(detectCategory('grocry')).toEqual({
      category: 'needs',
      subcategory: 'Groceries',
      matched: true,
    });
  });

  it('still falls through to the default category for a far-off non-match', () => {
    expect(detectCategory('xyzzyplugh')).toEqual({
      category: 'needs',
      subcategory: 'Xyzzyplugh',
      matched: false,
    });
  });

  it('lets an exact match on a later token win over a fuzzy match on an earlier one', () => {
    expect(detectCategory('grocry coffee')).toEqual({
      category: 'wants',
      subcategory: 'Dining',
      matched: true,
    });
  });

  it('prefers the learned map over the seed map for a fuzzy candidate', () => {
    const learned = { grocery: { category: 'savings' as const, subcategory: 'Custom' } };
    expect(detectCategory('grocry', learned)).toEqual({
      category: 'savings',
      subcategory: 'Custom',
      matched: true,
    });
  });

  it('never fuzzy-matches a token shorter than 3 characters', () => {
    expect(detectCategory('ab')).toEqual({
      category: 'needs',
      subcategory: 'Ab',
      matched: false,
    });
  });
});

describe('detectCategory — French dictionary', () => {
  beforeEach(() => setActiveLocale('fr-FR'));
  afterEach(() => setActiveLocale('en-US'));

  it('matches a French seed keyword', () => {
    expect(detectCategory('boulangerie')).toEqual({
      category: 'needs',
      subcategory: 'Groceries',
      matched: true,
    });
  });

  it('matches an accented French word against its unaccented dictionary key', () => {
    expect(detectCategory('café')).toEqual({
      category: 'wants',
      subcategory: 'Dining',
      matched: true,
    });
  });

  it('parses "amount description" with an amount before a French description', () => {
    expect(detectCategory('12 boulangerie')).toEqual({
      category: 'needs',
      subcategory: 'Groceries',
      matched: true,
    });
  });

  it('resolves a French plural via stemming ("factures" → "facture")', () => {
    expect(detectCategory('factures')).toEqual({
      category: 'needs',
      subcategory: 'Bills',
      matched: true,
    });
  });

  it('resolves a simple French -s plural via stemming ("epiceries" → "epicerie")', () => {
    expect(detectCategory('epiceries')).toEqual({
      category: 'needs',
      subcategory: 'Groceries',
      matched: true,
    });
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
