import { View, Text, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { theme } from '../theme';
import { formatCurrency } from '../lib/format';
import { t } from '../lib/i18n';
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
}

export function BentoCard({ title, amount, color, glowColor, gradientColors, icon, limit, balance }: BentoCardProps) {
  const formatted = formatCurrency(amount);

  const hasBalance = !!balance && balance > 0;
  const remaining = hasBalance ? balance - amount : 0;

  const hasLimit = !!limit && limit > 0;
  const rawRatio = hasLimit ? amount / limit : 0;

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
          <ProgressBar ratio={rawRatio} color={color} overLabel={t('card.over')} />
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
});
