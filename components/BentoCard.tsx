import { View, Text, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { createStyleSheet, useStyles } from 'react-native-unistyles';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

interface BentoCardProps {
  title: string;
  amount: number;
  color: string;
  glowColor: string;
  gradientColors: [string, string, string];
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

export function BentoCard({ title, amount, color, glowColor, gradientColors, icon }: BentoCardProps) {
  const { styles } = useStyles(stylesheet);

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);

  return (
    <View style={[styles.wrapper, { shadowColor: glowColor }]}>
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
        <View style={[styles.accentLine, { backgroundColor: color }]} />
      </LinearGradient>
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  wrapper: {
    flex: 1,
    minWidth: 140,
    borderRadius: theme.radius.lg,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
    ...(Platform.OS === 'web' ? { maxWidth: 320 } : {}),
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
  accentLine: {
    height: 2,
    width: 40,
    borderRadius: theme.radius.full,
    marginTop: theme.spacing.xs,
    opacity: 0.7,
  },
}));
