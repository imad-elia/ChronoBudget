import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import * as Localization from 'expo-localization';
import { setSetting, setBalance, fetchBalances } from '../db/database';
import { useBudgetStore, COUNTRIES, type Category } from '../store/useBudgetStore';
import { findCountry } from '../constants/countries';
import { theme } from '../theme';
import { t } from '../lib/i18n';
import type { StringKey } from '../constants/i18n/en';

interface Props {
  visible: boolean;
  onDone: () => void;
}

interface Step {
  icon: string;
  titleKey: StringKey;
  bodyKey: StringKey;
}

const STEPS: Step[] = [
  {
    icon: 'chart-timeline-variant',
    titleKey: 'onboarding.tourWelcomeTitle',
    bodyKey: 'onboarding.tourWelcomeBody',
  },
  {
    icon: 'lightning-bolt',
    titleKey: 'onboarding.tourFastTitle',
    bodyKey: 'onboarding.tourFastBody',
  },
  {
    icon: 'format-list-bulleted',
    titleKey: 'onboarding.tourDetailedTitle',
    bodyKey: 'onboarding.tourDetailedBody',
  },
  {
    icon: 'tune-variant',
    titleKey: 'onboarding.tourLimitsTitle',
    bodyKey: 'onboarding.tourLimitsBody',
  },
];

// Every tour step anchors its card by the top edge at this fraction of
// screen height, so the card never jumps between centered/bottom-pinned
// positions across steps — only its bottom edge moves as text length varies.
const TOUR_TOP_RATIO = 0.16;

const BALANCE_CATEGORIES: { id: Category; color: string }[] = [
  { id: 'needs',   color: '#00FF87' },
  { id: 'wants',   color: '#FF2D78' },
  { id: 'savings', color: '#00BFFF' },
];

const CATEGORY_LABEL_KEY = {
  needs: 'category.needs',
  wants: 'category.wants',
  savings: 'category.savings',
} as const;

export function OnboardingOverlay({ visible, onDone }: Props) {
  const [phase, setPhase] = useState<'country' | 'balance' | 'tour'>('country');
  const [balanceDrafts, setBalanceDrafts] = useState<Record<Category, string>>({
    needs: '', wants: '', savings: '',
  });
  const [step, setStep] = useState(0);
  const storeCountry = useBudgetStore((s) => s.country);
  const setCountry = useBudgetStore((s) => s.setCountry);
  const symbol = useBudgetStore((s) => s.symbol);
  const [picked, setPicked] = useState(storeCountry);
  const listRef = useRef<ScrollView>(null);
  const { height: windowHeight } = useWindowDimensions();
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Pre-fill from the device region for the user to approve.
  useEffect(() => {
    const region = Localization.getLocales?.()[0]?.regionCode;
    const match = findCountry(region);
    if (match) setPicked(match.code);
  }, []);

  // Scroll the pre-selected (default) country into view once, so it's
  // obvious what will be applied if the user taps Continue without picking
  // one. Only runs on the initial default — not on every manual selection.
  const scrolledToDefault = useRef(false);
  useEffect(() => {
    if (scrolledToDefault.current) return;
    const index = COUNTRIES.findIndex((c) => c.code === picked);
    if (index < 0) return;
    scrolledToDefault.current = true;
    const id = setTimeout(() => {
      listRef.current?.scrollTo({ y: Math.max(0, index * ROW_HEIGHT - ROW_HEIGHT), animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [picked]);

  async function handleContinueCountry() {
    await setCountry(picked);
    setPhase('balance');
  }

  async function handleContinueBalance() {
    for (const cat of ['needs', 'wants', 'savings'] as Category[]) {
      const val = parseFloat(balanceDrafts[cat].replace(',', '.'));
      if (!isNaN(val) && val > 0) await setBalance(cat, val);
    }
    useBudgetStore.getState().setBalances(await fetchBalances());
    setPhase('tour');
  }

  async function handleDone() {
    await setSetting('onboarding_complete', '1');
    onDone();
  }

  function handleNext() {
    if (isLast) {
      handleDone();
    } else {
      setStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (step === 0) {
      setPhase('balance');
    } else {
      setStep((s) => s - 1);
    }
  }

  if (phase === 'country') {
    return (
      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={StyleSheet.absoluteFill} />
          <View style={[styles.card, styles.cardCenter, styles.cardCountry, { maxHeight: windowHeight - 80 }]}>
            {/* Everything except the Continue button lives in this scrollable
                region, so the button is always visible no matter how short
                the screen is (small phones, landscape, split view). */}
            <ScrollView
              style={countryStyles.scrollArea}
              contentContainerStyle={countryStyles.scrollAreaContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
            <View style={styles.iconWrap}>
              <Icon name="earth" size={32} color={theme.colors.neonGreen} />
            </View>
            <Text style={styles.title}>{t('onboarding.countryTitle')}</Text>
            <Text style={styles.body}>{t('onboarding.countrySubtitle')}</Text>

            <View style={countryStyles.panel}>
              <View style={countryStyles.headerRow}>
                <Text style={countryStyles.headerLabel}>{t('onboarding.countryColumn')}</Text>
                <Text style={countryStyles.headerLabel}>{t('onboarding.currencyColumn')}</Text>
              </View>
              <ScrollView
                ref={listRef}
                style={countryStyles.list}
                contentContainerStyle={countryStyles.listContent}
                showsVerticalScrollIndicator
                indicatorStyle="white"
                nestedScrollEnabled
              >
                {COUNTRIES.map((c) => {
                  const active = c.code === picked;
                  return (
                    <TouchableOpacity
                      key={c.code}
                      style={[countryStyles.row, active && countryStyles.rowActive]}
                      onPress={() => setPicked(c.code)}
                      activeOpacity={0.7}
                    >
                      <Text style={[countryStyles.name, active && countryStyles.nameActive]}>{c.name}</Text>
                      <View style={countryStyles.currencyWrap}>
                        <Text style={[countryStyles.currency, active && countryStyles.currencyActive]}>{c.symbol} {c.currency}</Text>
                        {active
                          ? <Icon name="check-circle" size={16} color={theme.colors.neonGreen} style={countryStyles.check} />
                          : <View style={countryStyles.checkPlaceholder} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            <Text style={countryStyles.hint}>{t('onboarding.countryHint')}</Text>
            </ScrollView>

            <TouchableOpacity
              style={countryStyles.continueBtn}
              onPress={handleContinueCountry}
              activeOpacity={0.8}
            >
              <Text style={styles.nextLabel}>{t('onboarding.continue')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  if (phase === 'balance') {
    return (
      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlay}
        >
          <View style={StyleSheet.absoluteFill as any} />
          <View style={[styles.card, styles.cardCenter, styles.cardCountry, { maxHeight: windowHeight - 80 }]}>
            <ScrollView
              style={countryStyles.scrollArea}
              contentContainerStyle={countryStyles.scrollAreaContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.iconWrap}>
                <Icon name="wallet-outline" size={32} color={theme.colors.neonGreen} />
              </View>
              <Text style={styles.title}>{t('onboarding.balanceTitle')}</Text>
              <Text style={styles.body}>{t('onboarding.balanceSubtitle')}</Text>

              {BALANCE_CATEGORIES.map((cat) => (
                <View key={cat.id} style={balanceStyles.row}>
                  <View style={[balanceStyles.dot, { backgroundColor: cat.color }]} />
                  <Text style={[balanceStyles.label, { color: cat.color }]}>{t(CATEGORY_LABEL_KEY[cat.id])}</Text>
                  <View style={[balanceStyles.inputWrap, { borderColor: balanceDrafts[cat.id] ? `${cat.color}60` : theme.colors.border }]}>
                    <Text style={[balanceStyles.prefix, { color: cat.color }]}>{symbol}</Text>
                    <TextInput
                      style={balanceStyles.input}
                      placeholder={t('input.amountPlaceholder')}
                      placeholderTextColor={theme.colors.textMuted}
                      value={balanceDrafts[cat.id]}
                      onChangeText={(v) => setBalanceDrafts((d) => ({ ...d, [cat.id]: v }))}
                      keyboardType="decimal-pad"
                      maxLength={12}
                      selectionColor={cat.color}
                    />
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={countryStyles.continueBtn}
              onPress={handleContinueBalance}
              activeOpacity={0.8}
            >
              <Text style={styles.nextLabel}>{t('onboarding.continue')}</Text>
            </TouchableOpacity>
            <View style={countryStyles.bottomLinks}>
              <TouchableOpacity onPress={() => setPhase('country')} activeOpacity={0.6}>
                <Text style={styles.skipLabel}>{t('onboarding.back')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPhase('tour')} activeOpacity={0.6}>
                <Text style={styles.skipLabel}>{t('onboarding.balanceSkip')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        {/* Backdrop */}
        <View style={StyleSheet.absoluteFill} />

        {/* Card — top-anchored at a fixed fraction of screen height on every
            step, so it never jumps position; height stays auto, so a longer
            step just extends further down instead of moving or recentering. */}
        <View
          style={[
            styles.card,
            styles.cardTour,
            { top: Math.round(windowHeight * TOUR_TOP_RATIO) },
          ]}
        >
          {/* Step dots */}
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === step && styles.dotActive]}
              />
            ))}
          </View>

          {/* Icon */}
          <View style={styles.iconWrap}>
            <Icon name={current.icon as any} size={32} color={theme.colors.neonGreen} />
          </View>

          {/* Text */}
          <Text style={styles.title}>{t(current.titleKey)}</Text>
          <Text style={styles.body}>{t(current.bodyKey)}</Text>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: theme.colors.neonGreen }]}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <Text style={styles.nextLabel}>{isLast ? t('onboarding.gotIt') : t('onboarding.next')}</Text>
            </TouchableOpacity>
          </View>

          {/* Back / Skip links */}
          <View style={styles.bottomLinks}>
            <TouchableOpacity onPress={handleBack} activeOpacity={0.6}>
              <Text style={styles.skipLabel}>{t('onboarding.back')}</Text>
            </TouchableOpacity>
            {!isLast && (
              <TouchableOpacity onPress={handleDone} activeOpacity={0.6}>
                <Text style={styles.skipLabel}>{t('onboarding.skipTutorial')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  cardCenter: {
    marginHorizontal: 24,
    alignSelf: 'center',
    width: '88%',
    maxWidth: 420,
  },
  cardCountry: {
    // Cap comes from windowHeight at render time; children must be able to
    // shrink (see countryStyles.panel/list) so the Continue button always fits.
    overflow: 'hidden',
  },
  cardTour: {
    position: 'absolute',
    width: '88%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.textMuted,
  },
  dotActive: {
    backgroundColor: theme.colors.neonGreen,
    width: 18,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.full,
    backgroundColor: `${theme.colors.neonGreen}15`,
    borderWidth: 1,
    borderColor: `${theme.colors.neonGreen}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.headingLarge,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    ...theme.typography.bodyLarge,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
    width: '100%',
  },
  nextBtn: {
    flex: 2,
    height: 46,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextLabel: {
    ...theme.typography.headingMedium,
    color: '#000000',
  },
  bottomLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  skipLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textMuted,
    textDecorationLine: 'underline',
  },
});

const balanceStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    width: '100%',
  },
  dot: { width: 8, height: 8, borderRadius: theme.radius.full },
  label: { ...theme.typography.labelLarge, width: 64 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    height: 44,
  },
  prefix: { ...theme.typography.headingMedium, marginRight: theme.spacing.xs },
  input: { flex: 1, ...theme.typography.bodyLarge, color: theme.colors.textPrimary },
});

const ROW_HEIGHT = 54; // row height (46) + marginBottom (theme.spacing.sm = 8)

const countryStyles = StyleSheet.create({
  // Deliberately does NOT reuse styles.nextBtn: its flex:2 (meant for the
  // tour card's horizontal actions row) collapses the button to 0 height in
  // this vertical layout on native Yoga, even when flexGrow/flexBasis are
  // overridden — Yoga treats flexBasis:'auto' as unset, so flex's implicit
  // basis 0 wins. Keep this style flex-free and self-contained.
  continueBtn: {
    width: '100%',
    height: 46,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.neonGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollAreaContent: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  panel: {
    width: '100%',
    marginVertical: theme.spacing.xs,
    backgroundColor: theme.colors.bgTertiary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.glassBorder,
  },
  headerLabel: {
    ...theme.typography.labelSmall,
    color: theme.colors.textMuted,
    letterSpacing: 1,
  },
  list: { width: '100%', height: ROW_HEIGHT * 4.5 },
  listContent: { padding: theme.spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    height: 46,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  rowActive: { borderColor: theme.colors.neonGreen, backgroundColor: `${theme.colors.neonGreen}14` },
  name: { ...theme.typography.bodyLarge, color: theme.colors.textSecondary, flex: 1 },
  nameActive: { color: theme.colors.textPrimary },
  currencyWrap: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  currency: { ...theme.typography.bodyMedium, color: theme.colors.textMuted },
  currencyActive: { color: theme.colors.textPrimary },
  check: { width: 16 },
  checkPlaceholder: { width: 16 },
  hint: {
    ...theme.typography.labelSmall,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  bottomLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
});
