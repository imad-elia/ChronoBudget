import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { fetchMonthlyTotals, fetchQuarterlyTotals, fetchYearlyTotals, getSetting, setSetting } from '../../db/database';
import { useBudgetStore, type MonthlyTotal, type QuarterlyTotal, type YearlyTotal } from '../../store/useBudgetStore';
import { theme } from '../../theme';
import { formatCompactCurrency } from '../../lib/format';
import { t, getActiveLocale } from '../../lib/i18n';
import type { StringKey } from '../../constants/i18n/en';

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'needs'   as const, labelKey: 'category.needs'   as const, color: '#00FF87' },
  { id: 'wants'   as const, labelKey: 'category.wants'   as const, color: '#FF2D78' },
  { id: 'savings' as const, labelKey: 'category.savings' as const, color: '#00BFFF' },
];

type RangeId = '1m' | '3m' | '6m' | '1y' | '3y' | '5y' | 'all';
type Granularity = 'month' | 'quarter' | 'year';

const RANGE_OPTIONS: { id: RangeId; granularity: Granularity; count: number | 'all'; chipLabelKey: StringKey; subtitleKey: StringKey }[] = [
  { id: '1m',  granularity: 'month',   count: 1,     chipLabelKey: 'trends.range1m', subtitleKey: 'trends.subtitle1m' },
  { id: '3m',  granularity: 'month',   count: 3,     chipLabelKey: 'trends.range3m', subtitleKey: 'trends.subtitle3m' },
  { id: '6m',  granularity: 'month',   count: 6,     chipLabelKey: 'trends.range6m', subtitleKey: 'trends.subtitle6m' },
  { id: '1y',  granularity: 'month',   count: 12,    chipLabelKey: 'trends.range1y', subtitleKey: 'trends.subtitle1y' },
  { id: '3y',  granularity: 'quarter', count: 12,    chipLabelKey: 'trends.range3y', subtitleKey: 'trends.subtitle3y' },
  { id: '5y',  granularity: 'year',    count: 5,     chipLabelKey: 'trends.range5y', subtitleKey: 'trends.subtitle5y' },
  { id: 'all', granularity: 'year',    count: 'all', chipLabelKey: 'trends.rangeAll', subtitleKey: 'trends.subtitleAll' },
];
const DEFAULT_RANGE: RangeId = '6m';

// One level of tap-to-drill from a year/quarter bar down into its months —
// see the trends-adaptive-granularity decision note. Not persisted: unlike
// `range`, this is a transient exploration state.
type Drill = { level: 'year'; year: number } | { level: 'quarter'; year: number; quarter: number };

function quarterPrefix(): string {
  // French convention is "trimestre" (T1-T4), not the English "Q1-Q4".
  return getActiveLocale() === 'fr' ? 'T' : 'Q';
}

function shortMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleString('en-US', { month: 'short' });
}

// ─── Normalized chart data ─────────────────────────────────────────────────────
// The chart draws from this shape regardless of granularity — only label
// formatting differs per granularity; the bar-drawing/scaling/scroll logic
// below is entirely granularity-agnostic.

interface ChartBar {
  key: string;
  label: string;
  needs: number;
  wants: number;
  savings: number;
}

function monthToBar(m: MonthlyTotal): ChartBar {
  return { key: m.month, label: shortMonth(m.month), needs: m.needs, wants: m.wants, savings: m.savings };
}

function quarterToBar(q: QuarterlyTotal): ChartBar {
  const [year, qNum] = q.quarter.split('-Q');
  return { key: q.quarter, label: `${quarterPrefix()}${qNum} '${year.slice(2)}`, needs: q.needs, wants: q.wants, savings: q.savings };
}

function yearToBar(y: YearlyTotal): ChartBar {
  return { key: y.year, label: y.year, needs: y.needs, wants: y.wants, savings: y.savings };
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

const BAR_HEIGHT = 180;
const BAR_WIDTH = 14;
const BAR_GAP = 4;

function TrendsChart({ data, onBarPress }: { data: ChartBar[]; onBarPress?: (key: string) => void }) {
  const maxVal = Math.max(
    ...data.flatMap((m) => [m.needs, m.wants, m.savings]),
    1,
  );
  const BarWrapper = onBarPress ? TouchableOpacity : View;

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

      {/* Bars — horizontally scrollable so longer ranges (1yr+) don't squeeze
          bars illegibly thin; short ranges still fill the row edge-to-edge
          via flexGrow/flex, same as before, since minWidth only kicks in
          once the row's natural content width exceeds the container. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={chartStyles.barsRow}
      >
        {data.map((bar) => {
          const needsH  = (bar.needs   / maxVal) * BAR_HEIGHT;
          const wantsH  = (bar.wants   / maxVal) * BAR_HEIGHT;
          const savingsH = (bar.savings / maxVal) * BAR_HEIGHT;

          return (
            <BarWrapper
              key={bar.key}
              style={chartStyles.monthGroup}
              onPress={onBarPress ? () => onBarPress(bar.key) : undefined}
              activeOpacity={onBarPress ? 0.7 : undefined}
            >
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
              {/* Bar label (month/quarter/year, depending on granularity) */}
              <Text style={chartStyles.monthLabel}>{bar.label}</Text>
            </BarWrapper>
          );
        })}
      </ScrollView>
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
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
    paddingTop: 8, // room for top grid line label
    paddingBottom: 0,
  },
  monthGroup: {
    flex: 1,
    // Lets a short range (≤ ~6 months) keep filling the row edge-to-edge via
    // flex:1 exactly as before; once flex:1 would shrink groups below this
    // floor (12+ months), they hold this width instead and the ScrollView
    // above scrolls horizontally rather than squeezing bars illegibly thin.
    minWidth: 34,
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

function SummaryChips({ data }: { data: ChartBar[] }) {
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
            <Text style={[summaryStyles.chipLabel, { color: cat.color }]}>{t(cat.labelKey)}</Text>
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
          <Text style={legendStyles.label}>{t(cat.labelKey)}</Text>
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
  const [data, setData] = useState<ChartBar[]>([]);
  const [dbReady, setDbReady] = useState(false);
  const [range, setRange] = useState<RangeId>(DEFAULT_RANGE);
  const [drill, setDrill] = useState<Drill | null>(null);

  const refreshCounter = useBudgetStore((s) => s.refreshCounter);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  useEffect(() => { setDbReady(true); }, []);

  // Load the persisted range on mount, same pattern as ExpenseInput's input_mode.
  useEffect(() => {
    getSetting('trends_range').then((val) => {
      if (RANGE_OPTIONS.some((r) => r.id === val)) setRange(val as RangeId);
    });
  }, []);

  const activeRange = RANGE_OPTIONS.find((r) => r.id === range)!;
  // Drilling in always shows months — a single year or quarter never repeats
  // a month name, so no further ambiguity to solve at this level.
  const granularity: Granularity = drill ? 'month' : activeRange.granularity;

  useEffect(() => {
    if (!dbReady) return;
    if (drill) {
      const startMonth = drill.level === 'year'
        ? `${drill.year}-01`
        : `${drill.year}-${String((drill.quarter - 1) * 3 + 1).padStart(2, '0')}`;
      const endMonth = drill.level === 'year'
        ? `${drill.year}-12`
        : `${drill.year}-${String((drill.quarter - 1) * 3 + 3).padStart(2, '0')}`;
      fetchMonthlyTotals({ startMonth, endMonth }).then((res) => setData(res.map(monthToBar)));
    } else if (activeRange.granularity === 'month') {
      fetchMonthlyTotals(activeRange.count as number).then((res) => setData(res.map(monthToBar)));
    } else if (activeRange.granularity === 'quarter') {
      fetchQuarterlyTotals(activeRange.count as number).then((res) => setData(res.map(quarterToBar)));
    } else {
      fetchYearlyTotals(activeRange.count).then((res) => setData(res.map(yearToBar)));
    }
  }, [refreshCounter, dbReady, range, drill]);

  function selectRange(id: RangeId) {
    setRange(id);
    setDrill(null); // range chips always mean "reset to this top-level view"
    setSetting('trends_range', id);
  }

  function handleBarPress(key: string) {
    if (granularity === 'year') {
      setDrill({ level: 'year', year: Number(key) });
    } else if (granularity === 'quarter') {
      const [year, quarter] = key.split('-Q');
      setDrill({ level: 'quarter', year: Number(year), quarter: Number(quarter) });
    }
    // month granularity: nothing finer to drill into.
  }

  const hasData = data.some((m) => m.needs + m.wants + m.savings > 0);

  const drillLabel = drill
    ? drill.level === 'year'
      ? String(drill.year)
      : `${quarterPrefix()}${drill.quarter} ${drill.year}`
    : null;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={[styles.frame, isWide && styles.frameWide]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.screenTitle}>{t('trends.title')}</Text>
          {drillLabel ? (
            <TouchableOpacity
              testID="trends-drill-back"
              style={styles.backPill}
              onPress={() => setDrill(null)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="chevron-left" size={16} color={theme.colors.neonBlue} />
              <Text style={styles.backLabel}>{drillLabel}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.subtitle}>{t(activeRange.subtitleKey)}</Text>
          )}
        </View>

        {/* Range picker */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.rangeScroll}
          contentContainerStyle={styles.rangeRow}
        >
          {RANGE_OPTIONS.map((r) => {
            const active = r.id === range;
            return (
              <TouchableOpacity
                key={r.id}
                testID={`trends-range-${r.id}`}
                style={[styles.rangeChip, active && styles.rangeChipActive]}
                onPress={() => selectRange(r.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.rangeLabel, active && styles.rangeLabelActive]}>
                  {t(r.chipLabelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {hasData ? (
          <>
            <SummaryChips data={data} />
            <Legend />
            <TrendsChart data={data} onBarPress={granularity === 'month' ? undefined : handleBarPress} />
          </>
        ) : (
          <View style={styles.emptyWrap}>
            <Icon name="chart-bar" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('trends.empty')}</Text>
            <Text style={styles.emptySubtitle}>
              {t('trends.emptyHint')}
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
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backLabel: { ...theme.typography.bodyMedium, color: theme.colors.neonBlue, fontWeight: '600' },
  rangeScroll: { flexGrow: 0 },
  rangeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  rangeChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rangeChipActive: {
    borderColor: theme.colors.neonBlue,
    backgroundColor: `${theme.colors.neonBlue}18`,
  },
  rangeLabel: { ...theme.typography.labelLarge, color: theme.colors.textMuted },
  rangeLabelActive: { color: theme.colors.neonBlue },
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
