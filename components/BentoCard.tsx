import { View, Text, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { theme } from '../theme';
import { formatCurrency } from '../lib/format';
import { t } from '../lib/i18n';

interface BentoCardProps {
  title: string;
  amount: number;
  color: string;
  glowColor: string;
  gradientColors: [string, string, string];
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  limit?: number;
  balance?: number;
}

function progressColor(ratio: number, color: string): string {
  if (ratio >= 1) return '#FF2D78';
  if (ratio >= 0.9) return '#FF6B35';
  if (ratio >= 0.7) return '#FFD166';
  return color;
}

export function BentoCard({ title, amount, color, glowColor, gradientColors, icon, limit, balance }: BentoCardProps) {
  const formatted = formatCurrency(amount);

  const hasBalance = !!balance && balance > 0;
  const remaining = hasBalance ? balance - amount : 0;

  const hasLimit = !!limit && limit > 0;
  const rawRatio = hasLimit ? amount / limit : 0;
  const fillWidth = Math.min(rawRatio, 1);
  const barColor = hasLimit ? progressColor(rawRatio, color) : color;
  const pct = Math.round(rawRatio * 100);
  const over = hasLimit && rawRatio > 1;

  return (
    <View style={[
      styles.wrapper,
      Platform.OS === 'web'
        ? { boxShadow: `0 0 16px ${glowColor}59` } as ViewStyle
        : { shadowColor: glowColor },
    ]}>
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

        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
          {formatted}
        </Text>

        {hasBalance && (
          <Text
            style={[styles.remaining, { color: remaining < 0 ? '#FF2D78' : theme.colors.textSecondary }]}
            numberOfLines={1}
          >
            {formatCurrency(remaining)} {t('card.remaining')}
          </Text>
        )}

        {hasLimit ? (
          <View style={styles.progressSection}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(fillWidth * 100)}%` as `${number}%`, backgroundColor: barColor }]} />
            </View>
            {over && (
              <View style={styles.overBadge}>
                <Icon name="alert-circle" size={11} color="#FF2D78" />
                <Text style={styles.overBadgeText}>OVER</Text>
              </View>
            )}
            <Text style={[styles.progressLabel, { color: barColor }]}>{pct}%</Text>
          </View>
        ) : (
          <View style={[styles.accentLine, { backgroundColor: color }]} />
        )}
      </LinearGradient>
    </View>
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
  },
  accentLine: {
    height: 2,
    width: 40,
    borderRadius: theme.radius.full,
    marginTop: theme.spacing.xs,
    opacity: 0.7,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radius.full,
  },
  progressLabel: {
    ...theme.typography.labelSmall,
    minWidth: 30,
    textAlign: 'right',
  },
  overBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: theme.radius.full,
    backgroundColor: '#FF2D781A',
  },
  overBadgeText: {
    ...theme.typography.labelSmall,
    color: '#FF2D78',
    fontWeight: '700',
  },
});
