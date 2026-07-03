import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import * as Localization from 'expo-localization';
import { setSetting } from '../db/database';
import { useBudgetStore, COUNTRIES } from '../store/useBudgetStore';
import { findCountry } from '../constants/countries';
import { theme } from '../theme';
import { t } from '../lib/i18n';

interface Props {
  visible: boolean;
  onDone: () => void;
}

interface Step {
  icon: string;
  title: string;
  body: string;
  // Approximate position of the highlight tooltip (from bottom of screen)
  // undefined = center (welcome screen)
  anchorFromBottom?: number;
}

const STEPS: Step[] = [
  {
    icon: 'chart-timeline-variant',
    title: 'Welcome to ChronoBudget',
    body: 'Track your spending in seconds. Split your money into Needs, Wants, and Savings — and stay on top of your budget effortlessly.',
  },
  {
    icon: 'lightning-bolt',
    title: 'Fast Mode',
    body: 'Tap ⚡ Fast for the quickest entry — just pick a category and type an amount. Done in two taps.',
    anchorFromBottom: 220,
  },
  {
    icon: 'format-list-bulleted',
    title: 'Detailed Mode',
    body: 'Switch to ☰ Detailed to add a subcategory (e.g. Groceries, Rent) and an optional note for more context.',
    anchorFromBottom: 220,
  },
  {
    icon: 'tune-variant',
    title: 'Budget Limits',
    body: 'Tap the sliders icon at the top of the dashboard to set monthly spending limits. Each category card shows your progress.',
    anchorFromBottom: undefined, // center — header is too high to anchor reliably
  },
];

export function OnboardingOverlay({ visible, onDone }: Props) {
  const [phase, setPhase] = useState<'country' | 'tour'>('country');
  const [step, setStep] = useState(0);
  const storeCountry = useBudgetStore((s) => s.country);
  const setCountry = useBudgetStore((s) => s.setCountry);
  const [picked, setPicked] = useState(storeCountry);
  const listRef = useRef<ScrollView>(null);
  const { height: windowHeight } = useWindowDimensions();
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

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

  const useAnchor = current.anchorFromBottom !== undefined;

  if (phase === 'country') {
    return (
      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={StyleSheet.absoluteFillObject as any} />
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
              style={[styles.nextBtn, countryStyles.continueBtn, { backgroundColor: theme.colors.neonGreen }]}
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

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        {/* Backdrop */}
        <View style={StyleSheet.absoluteFillObject as any} />

        {/* Card — anchored near bottom for steps 1-2, centered otherwise */}
        <View
          style={[
            styles.card,
            useAnchor
              ? [styles.cardAnchored, { bottom: current.anchorFromBottom }]
              : styles.cardCenter,
          ]}
        >
          {/* Arrow pointing down (for anchored tooltips) */}
          {useAnchor && <View style={styles.arrowDown} />}

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
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>

          {/* Actions */}
          <View style={styles.actions}>
            {!isFirst && (
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)} activeOpacity={0.7}>
                <Text style={styles.backLabel}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: theme.colors.neonGreen }]}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <Text style={styles.nextLabel}>{isLast ? 'Got it ✓' : 'Next →'}</Text>
            </TouchableOpacity>
          </View>

          {/* Skip */}
          {!isLast && (
            <TouchableOpacity onPress={handleDone} activeOpacity={0.6} style={styles.skipBtn}>
              <Text style={styles.skipLabel}>Skip tutorial</Text>
            </TouchableOpacity>
          )}
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
  cardAnchored: {
    position: 'absolute',
    width: '88%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  arrowDown: {
    position: 'absolute',
    bottom: -12,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: theme.colors.bgSecondary,
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
  backBtn: {
    flex: 1,
    height: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLabel: {
    ...theme.typography.headingMedium,
    color: theme.colors.textMuted,
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
  skipBtn: {
    marginTop: -theme.spacing.xs,
  },
  skipLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textMuted,
    textDecorationLine: 'underline',
  },
});

const ROW_HEIGHT = 54; // row height (46) + marginBottom (theme.spacing.sm = 8)

const countryStyles = StyleSheet.create({
  // styles.nextBtn has flex:2 for the tour card's horizontal actions row; in
  // this vertical layout that collapses the button to 0 height, so reset it.
  continueBtn: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '100%',
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
});
