import type { MaterialCommunityIcons } from '@expo/vector-icons';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { formatCompactCurrency, formatCurrency } from '../lib/format';
import { t } from '../lib/i18n';
import { theme } from '../theme';
import { ProgressBar } from './ProgressBar';

interface BentoCardProps {
  title: string;
  amount: number;
  color: string;
  glowColor: string;
  gradientColors: [string, string, string];
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  limit?: number;
  balance?: number;
  onPress?: () => void;
  testID?: string;
}

/** Cross-platform substitute for `adjustsFontSizeToFit`, which RN Web ignores. */
function amountFontSize(formatted: string): number {
  if (formatted.length <= 9) return 32;
  if (formatted.length <= 13) return 26;
  return 21;
}

/** Amounts past this switch to compact form ("$12.3K") so they never clip
 *  on narrow phone-width cards — full precision is one tap away. */
const COMPACT_THRESHOLD = 1000;
function displayAmount(n: number): string {
  return Math.abs(n) >= COMPACT_THRESHOLD ? formatCompactCurrency(n) : formatCurrency(n);
}

export function BentoCard({ title, amount, color, glowColor, gradientColors, icon, limit, balance, onPress, testID }: BentoCardProps) {
  const formatted = displayAmount(amount);

  const hasBalance = !!balance && balance > 0;
  const remaining = hasBalance ? balance - amount : 0;

  const hasLimit = !!limit && limit > 0;
  const rawRatio = hasLimit ? amount / limit : 0;
  const isOverLimit = hasLimit && rawRatio > 1;

  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      testID={testID}
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? title : undefined}
      style={[
        styles.wrapper,
        Platform.OS === 'web'
          ? { boxShadow: `0 0 16px ${glowColor}59` } as ViewStyle
          : { shadowColor: glowColor },
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={[styles.iconRing, { borderColor: color, backgroundColor: `${color}18` }]}>
            <Icon name={icon} size={18} color={color} />
          </View>
          <Text style={[styles.title, { color }]}>{title}</Text>
        </View>

        <Text style={[styles.amount, { fontSize: amountFontSize(formatted) }]} numberOfLines={1}>
          {formatted}
        </Text>

        {hasBalance && (
          remaining < 0 ? (
            // Same pill/badge style as the over-limit case below, so both
            // "spent past X" states read the same — only the leading icon
            // (wallet vs. speedometer) tells you which one this is.
            <View style={styles.overBadge}>
              <Icon name="wallet-outline" size={11} color="#FF2D78" />
              <Text style={styles.overBadgeText} numberOfLines={1}>
                {`${t('card.overby')} ${displayAmount(Math.abs(remaining))}`}
              </Text>
            </View>
          ) : (
            <View style={styles.statRow}>
              <Icon name="wallet-outline" size={11} color={theme.colors.textSecondary} />
              <Text style={styles.remaining} numberOfLines={1}>
                {displayAmount(remaining)} {t('card.remaining')}
              </Text>
            </View>
          )
        )}

        {isOverLimit ? (
          <View style={styles.overBadge}>
            <Icon name="speedometer" size={11} color="#FF2D78" />
            <Text style={styles.overBadgeText} numberOfLines={1}>
              {`${t('card.over')} ${displayAmount(limit!)}`}
            </Text>
          </View>
        ) : hasLimit ? (
          <View style={styles.statRow}>
            <Icon name="speedometer" size={11} color={theme.colors.textMuted} />
            <View style={styles.statRowFill}>
              <ProgressBar ratio={rawRatio} color={color} overLabel={t('card.over')} />
            </View>
          </View>
        ) : (
          <View style={[styles.accentLine, { backgroundColor: color }]} />
        )}
      </LinearGradient>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minWidth: 0,
    borderRadius: theme.radius.lg,
    elevation: 10,
    ...(Platform.OS !== 'web' && {
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
    }),
  },
  gradient: {
    flex: 1,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  iconRing: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.labelLarge,
    textTransform: 'uppercase',
  },
  amount: {
    ...theme.typography.displayMedium,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.xs,
  },
  remaining: {
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  statRowFill: {
    flex: 1,
    minWidth: 0,
  },
  accentLine: {
    height: 2,
    width: 40,
    borderRadius: theme.radius.full,
    marginTop: theme.spacing.xs,
    opacity: 0.7,
  },
  overBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: theme.radius.full,
    backgroundColor: '#FF2D781A',
    maxWidth: '100%',
  },
  overBadgeText: {
    ...theme.typography.labelSmall,
    color: '#FF2D78',
    fontWeight: '700',
    flexShrink: 1,
  },
});
