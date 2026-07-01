import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { fetchMonthlyTotals } from '../../db/database';
import { useBudgetStore, type MonthlyTotal } from '../../store/useBudgetStore';
import { theme } from '../../theme';
import { formatCompactCurrency } from '../../lib/format';

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'needs'   as const, label: 'Needs',   color: '#00FF87' },
  { id: 'wants'   as const, label: 'Wants',   color: '#FF2D78' },
  { id: 'savings' as const, label: 'Savings', color: '#00BFFF' },
];

function shortMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleString('en-US', { month: 'short' });
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

const BAR_HEIGHT = 180;
const BAR_WIDTH = 14;
const BAR_GAP = 4;

function MonthlyChart({ data }: { data: MonthlyTotal[] }) {
  const maxVal = Math.max(
    ...data.flatMap((m) => [m.needs, m.wants, m.savings]),
    1,
  );

  return (
    <View style={chartStyles.container}>
      {/* Y-axis grid lines */}
      {[1, 0.75, 0.5, 0.25].map((ratio) => (
        <View
          key={ratio}
          style={[chartStyles.gridLine, { bottom: ratio * BAR_HEIGHT + chartStyles.baseline.height }]}
        >
          <Text style={chartStyles.gridLabel}>{formatCompactCurrency(maxVal * ratio)}</Text>
        </View>
      ))}

      {/* Bars */}
      <View style={chartStyles.barsRow}>
        {data.map((month) => {
          const needsH  = (month.needs   / maxVal) * BAR_HEIGHT;
          const wantsH  = (month.wants   / maxVal) * BAR_HEIGHT;
          const savingsH = (month.savings / maxVal) * BAR_HEIGHT;

          return (
            <View key={month.month} style={chartStyles.monthGroup}>
              <View style={chartStyles.barGroup}>
                {/* Needs bar */}
                <View style={chartStyles.barTrack}>
                  {needsH > 0 && (
                    <View style={[chartStyles.bar, { height: needsH, backgroundColor: '#00FF87' }]} />
                  )}
                </View>
                {/* Wants bar */}
                <View style={chartStyles.barTrack}>
                  {wantsH > 0 && (
                    <View style={[chartStyles.bar, { height: wantsH, backgroundColor: '#FF2D78' }]} />
                  )}
                </View>
                {/* Savings bar */}
                <View style={chartStyles.barTrack}>
                  {savingsH > 0 && (
                    <View style={[chartStyles.bar, { height: savingsH, backgroundColor: '#00BFFF' }]} />
                  )}
                </View>
              </View>
              {/* Baseline */}
              <View style={chartStyles.baseline} />
              {/* Month label */}
              <Text style={chartStyles.monthLabel}>{shortMonth(month.month)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    position: 'relative',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    paddingLeft: 36, // space for y-axis labels
  },
  gridLine: {
    position: 'absolute',
    left: 36,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridLabel: {
    ...theme.typography.labelSmall,
    color: theme.colors.textMuted,
    position: 'absolute',
    left: -36,
    width: 34,
    textAlign: 'right',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
    paddingTop: 8, // room for top grid line label
    paddingBottom: 0,
  },
  monthGroup: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
    height: BAR_HEIGHT,
  },
  barTrack: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    justifyContent: 'flex-end',
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: 3,
    minHeight: 2,
  },
  baseline: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  monthLabel: {
    ...theme.typography.labelSmall,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});

// ─── Summary chips ─────────────────────────────────────────────────────────────

function SummaryChips({ data }: { data: MonthlyTotal[] }) {
  const totals = data.reduce(
    (acc, m) => ({
      needs:   acc.needs   + m.needs,
      wants:   acc.wants   + m.wants,
      savings: acc.savings + m.savings,
    }),
    { needs: 0, wants: 0, savings: 0 },
  );

  return (
    <View style={summaryStyles.row}>
      {CATEGORIES.map((cat) => {
        const val = totals[cat.id];
        const formatted = formatCompactCurrency(val);
        return (
          <View key={cat.id} style={[summaryStyles.chip, { borderColor: `${cat.color}30`, backgroundColor: `${cat.color}0D` }]}>
            <Text style={[summaryStyles.chipLabel, { color: cat.color }]}>{cat.label}</Text>
            <Text style={[summaryStyles.chipAmount, { color: cat.color }]}>{formatted}</Text>
          </View>
        );
      })}
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: 4,
  },
  chipLabel: { ...theme.typography.labelSmall },
  chipAmount: { ...theme.typography.headingMedium },
});

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <View style={legendStyles.row}>
      {CATEGORIES.map((cat) => (
        <View key={cat.id} style={legendStyles.item}>
          <View style={[legendStyles.dot, { backgroundColor: cat.color }]} />
          <Text style={legendStyles.label}>{cat.label}</Text>
        </View>
      ))}
    </View>
  );
}

const legendStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    justifyContent: 'center',
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: theme.radius.full },
  label: { ...theme.typography.labelSmall, color: theme.colors.textSecondary },
});

// ─── Trends screen ────────────────────────────────────────────────────────────

export default function TrendsScreen() {
  const [data, setData] = useState<MonthlyTotal[]>([]);
  const [dbReady, setDbReady] = useState(false);

  const refreshCounter = useBudgetStore((s) => s.refreshCounter);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  useEffect(() => { setDbReady(true); }, []);

  useEffect(() => {
    if (!dbReady) return;
    fetchMonthlyTotals(6).then(setData);
  }, [refreshCounter, dbReady]);

  const hasData = data.some((m) => m.needs + m.wants + m.savings > 0);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={[styles.frame, isWide && styles.frameWide]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.screenTitle}>TRENDS</Text>
          <Text style={styles.subtitle}>Last 6 months</Text>
        </View>

        {hasData ? (
          <>
            <SummaryChips data={data} />
            <Legend />
            <MonthlyChart data={data} />
          </>
        ) : (
          <View style={styles.emptyWrap}>
            <Icon name="chart-bar" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptySubtitle}>
              Add transactions on the Dashboard to see your spending trends here.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bgPrimary, alignItems: 'center' },
  frame: { flex: 1, width: '100%' },
  frameWide: { maxWidth: 600, alignSelf: 'center' },
  content: { paddingTop: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  screenTitle: { ...theme.typography.headingLarge, color: theme.colors.textPrimary, letterSpacing: 2 },
  subtitle: { ...theme.typography.bodyMedium, color: theme.colors.textMuted },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xxl * 2,
  },
  emptyTitle: { ...theme.typography.headingMedium, color: theme.colors.textMuted },
  emptySubtitle: { ...theme.typography.bodyMedium, color: theme.colors.textMuted, textAlign: 'center' },
});
