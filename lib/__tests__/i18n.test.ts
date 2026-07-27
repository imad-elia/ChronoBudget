import { t, setActiveLocale } from '../i18n';

describe('i18n', () => {
  afterEach(() => setActiveLocale('en'));

  it('resolves English strings by default', () => {
    expect(t('settings.title')).toBe('Settings');
  });

  it('resolves French strings once the locale is set', () => {
    setActiveLocale('fr-FR');
    expect(t('settings.title')).toBe('Paramètres');
    expect(t('category.needs')).toBe('Besoins');
  });

  it('matches locale by language prefix', () => {
    setActiveLocale('fr-CA');
    expect(t('settings.title')).toBe('Paramètres');
  });

  it('falls back to English for an unregistered locale', () => {
    setActiveLocale('de-DE');
    expect(t('settings.title')).toBe('Settings');
  });

  it('falls back to the key itself if missing from every bundle', () => {
    expect(t('not.a.real.key' as never)).toBe('not.a.real.key');
  });

  it('supports {placeholder} interpolation in a non-English bundle', () => {
    setActiveLocale('fr');
    expect(t('recurring.next', { date: 'Jan 5' })).toBe('prochaine le Jan 5');
  });
});
