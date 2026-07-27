import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useBudgetStore } from '../store/useBudgetStore';
import { theme } from '../theme';
import { formatDate } from '../lib/format';
import { t } from '../lib/i18n';

const WEEKDAY_COUNT = 7;

function startOfLocalDay(year: number, month: number, day: number): number {
  return new Date(year, month, day, 12, 0, 0, 0).getTime();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function DatePickerField({
  value,
  onChange,
  activeColor,
}: {
  value: number | undefined;
  onChange: (ts: number) => void;
  activeColor: string;
}) {
  const locale = useBudgetStore((s) => s.locale);
  const [expanded, setExpanded] = useState(false);
  const today = new Date();
  const selected = value != null ? new Date(value) : undefined;
  const [viewYear, setViewYear] = useState((selected ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState((selected ?? today).getMonth());

  const monthLabel = (() => {
    try {
      return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(viewYear, viewMonth, 1));
    } catch {
      return new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
  })();

  const weekdayLabels = (() => {
    const base = new Date(2024, 0, 7); // a Sunday
    return Array.from({ length: WEEKDAY_COUNT }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      try {
        return new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(d);
      } catch {
        return d.toLocaleDateString(undefined, { weekday: 'narrow' });
      }
    });
  })();

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function goToMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function pickDay(day: number) {
    onChange(startOfLocalDay(viewYear, viewMonth, day));
  }

  function pickToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    onChange(startOfLocalDay(today.getFullYear(), today.getMonth(), today.getDate()));
  }

  const closedLabel = value != null ? formatDate(value) : t('recurring.startDateDefault');

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.closedRow, { borderColor: expanded ? `${activeColor}60` : theme.colors.border }]}
        onPress={() => setExpanded((e) => !e)}
        activeOpacity={0.7}
        testID="date-picker-toggle"
      >
        <Icon name="calendar-blank-outline" size={16} color={theme.colors.textMuted} style={styles.closedIcon} />
        <Text style={styles.closedLabel}>{closedLabel}</Text>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textMuted} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.panel}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => goToMonth(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="chevron-left-btn">
              <Icon name="chevron-left" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity onPress={() => goToMonth(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="chevron-right-btn">
              <Icon name="chevron-right" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {weekdayLabels.map((label, i) => (
              <Text key={i} style={styles.weekdayLabel}>{label}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (day == null) return <View key={`blank-${i}`} style={styles.cell} />;
              const cellDate = new Date(viewYear, viewMonth, day);
              const isSelected = selected != null && isSameDay(cellDate, selected);
              const isToday = isSameDay(cellDate, today);
              return (
                <View key={day} style={styles.cell}>
                  <TouchableOpacity
                    style={[
                      styles.dayBtn,
                      isSelected && { borderColor: activeColor, backgroundColor: `${activeColor}18` },
                      !isSelected && isToday && styles.dayBtnToday,
                    ]}
                    onPress={() => pickDay(day)}
                    activeOpacity={0.7}
                    testID={`date-picker-day-${day}`}
                  >
                    <Text style={[styles.dayLabel, isSelected && { color: activeColor }]}>{day}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <TouchableOpacity style={styles.todayBtn} onPress={pickToday} activeOpacity={0.7} testID="date-picker-today">
            <Text style={[styles.todayLabel, { color: activeColor }]}>{t('recurring.startDateDefault')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const CELL_WIDTH = `${100 / WEEKDAY_COUNT}%` as const;

const styles = StyleSheet.create({
  container: { marginBottom: theme.spacing.sm },
  closedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    height: 48,
  },
  closedIcon: { marginRight: theme.spacing.sm },
  closedLabel: { flex: 1, ...theme.typography.bodyLarge, color: theme.colors.textPrimary },
  panel: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.bgTertiary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    padding: theme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
  },
  monthLabel: { ...theme.typography.labelLarge, color: theme.colors.textPrimary, textTransform: 'capitalize' },
  weekdayRow: { flexDirection: 'row' },
  weekdayLabel: {
    width: CELL_WIDTH,
    textAlign: 'center',
    ...theme.typography.labelSmall,
    color: theme.colors.textMuted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL_WIDTH, alignItems: 'center', paddingVertical: 2 },
  dayBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnToday: { borderColor: theme.colors.glassBorder },
  dayLabel: { ...theme.typography.bodyMedium, color: theme.colors.textSecondary },
  todayBtn: { alignItems: 'center', paddingTop: theme.spacing.sm },
  todayLabel: { ...theme.typography.labelLarge },
});
