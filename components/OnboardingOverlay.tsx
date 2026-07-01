import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { setSetting } from '../db/database';
import { theme } from '../theme';

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
  const [step, setStep] = useState(0);
  const { height } = useWindowDimensions();
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

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
              ? { position: 'absolute', bottom: current.anchorFromBottom, left: 24, right: 24 }
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
