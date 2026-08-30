import { canonicalSubcategory, subcategoryLabel } from '../subcategories';
import { setActiveLocale } from '../../lib/i18n';

describe('canonicalSubcategory', () => {
  afterEach(() => setActiveLocale('en'));

  it('maps a French translated label back to its canonical (English, stored) form', () => {
    expect(canonicalSubcategory('Courses')).toBe('Groceries');
    expect(canonicalSubcategory('Restaurants')).toBe('Dining');
    expect(canonicalSubcategory("Fonds d'urgence")).toBe('Emergency Fund');
  });

  it('maps the English label back to itself (case-insensitive)', () => {
    expect(canonicalSubcategory('groceries')).toBe('Groceries');
    expect(canonicalSubcategory('GROCERIES')).toBe('Groceries');
  });

  it('returns a custom/free-text subcategory unchanged', () => {
    expect(canonicalSubcategory('Vet bills')).toBe('Vet bills');
  });

  it('round-trips with subcategoryLabel(): translate then canonicalize gets back the original', () => {
    setActiveLocale('fr');
    const translated = subcategoryLabel('Groceries');
    expect(canonicalSubcategory(translated)).toBe('Groceries');
  });
});
