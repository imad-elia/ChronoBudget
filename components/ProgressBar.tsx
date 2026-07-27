import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { theme } from '../theme';

export function progressColor(ratio: number, color: string): string {
  if (ratio >= 1) return '#FF2D78';
  if (ratio >= 0.9) return '#FF6B35';
  if (ratio >= 0.7) return '#FFD166';
  return color;
}

interface ProgressBarProps {
  ratio: number; // amount / limit, can exceed 1
  color: string;
  showOverBadge?: boolean;
  overLabel?: string;
}

export function ProgressBar({ ratio, color, showOverBadge = true, overLabel }: ProgressBarProps) {
  const fillWidth = Math.min(ratio, 1);
  const barColor = progressColor(ratio, color);
  const pct = Math.round(ratio * 100);
  const over = ratio > 1;

  return (
    <View style={styles.section}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(fillWidth * 100)}%` as `${number}%`, backgroundColor: barColor }]} />
      </View>
      {showOverBadge && over && overLabel && (
        <View style={styles.overBadge}>
          <Icon name="alert-circle" size={11} color="#FF2D78" />
          <Text style={styles.overBadgeText}>{overLabel}</Text>
        </View>
      )}
      <Text style={[styles.label, { color: barColor }]}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  track: {
    flex: 1,
    height: 3,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: theme.radius.full,
  },
  label: {
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
