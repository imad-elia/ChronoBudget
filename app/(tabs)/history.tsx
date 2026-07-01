import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  useWindowDimensions,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// expo-file-system and expo-sharing are native-only — lazy import only on native.
// Use the legacy FileSystem API: the default entry's writeAsStringAsync/cacheDirectory
// are deprecated in SDK 54+ and now throw. The legacy entry keeps the classic API.
let FileSystem: typeof import('expo-file-system/legacy') | null = null;
let Sharing: typeof import('expo-sharing') | null = null;
if (Platform.OS !== 'web') {
  FileSystem = require('expo-file-system/legacy');
  Sharing = require('expo-sharing');
}

import { fetchTransactions, deleteTransaction } from '../../db/database';
import { useBudgetStore, type Transaction, type Category } from '../../store/useBudgetStore';
import { theme } from '../../theme';

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG = {
  needs:   { label: 'Needs',   color: '#00FF87', icon: 'home-outline'     as const },
  wants:   { label: 'Wants',   color: '#FF2D78', icon: 'shopping-outline' as const },
  savings: { label: 'Savings', color: '#00BFFF', icon: 'piggy-bank-outline' as const },
};

type FilterOption = 'all' | Category;

const FILTERS: { id: FilterOption; label: string; color: string }[] = [
  { id: 'all',     label: 'All',     color: theme.colors.textPrimary },
  { id: 'needs',   label: 'Needs',   color: '#00FF87' },
  { id: 'wants',   label: 'Wants',   color: '#FF2D78' },
  { id: 'savings', label: 'Savings', color: '#00BFFF' },
];

// ─── Date grouping ────────────────────────────────────────────────────────────

interface Section { title: string; data: Transaction[]; }

function groupByDate(transactions: Transaction[]): Section[] {
  const now = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86_400_000;
  const map = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    const d = new Date(tx.timestamp);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    let key: string;
    if (dayStart === today)     key = 'Today';
    else if (dayStart === yesterday) key = 'Yesterday';
    else key = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tx);
  }

  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

// ─── Transaction row ──────────────────────────────────────────────────────────

function HistoryRow({ item, onDelete }: { item: Transaction; onDelete: (id: number) => void }) {
  const cfg = CATEGORY_CONFIG[item.category];
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.amount);
  const time = new Date(item.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18).stiffness(120)}
      exiting={FadeOutUp.springify().damping(18)}
      layout={LinearTransition.springify().damping(18)}
    >
      <Animated.View style={animStyle}>
      <TouchableOpacity
        style={rowStyles.row}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 20 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 20 }); }}
        activeOpacity={1}
      >
        <View style={[rowStyles.iconWrap, { backgroundColor: `${cfg.color}18`, borderColor: `${cfg.color}40` }]}>
          <Icon name={cfg.icon} size={18} color={cfg.color} />
        </View>
        <View style={rowStyles.meta}>
          <Text style={rowStyles.note} numberOfLines={1}>{item.subcategory || item.note || cfg.label}</Text>
          <View style={rowStyles.tagRow}>
            <View style={[rowStyles.tag, { backgroundColor: `${cfg.color}18`, borderColor: `${cfg.color}30` }]}>
              <Text style={[rowStyles.tagText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <Text style={rowStyles.time}>{time}</Text>
          </View>
        </View>
        <Text style={[rowStyles.amount, { color: cfg.color }]}>{formatted}</Text>
        <TouchableOpacity
          style={rowStyles.deleteBtn}
          onPress={() => onDelete(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="close" size={14} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  iconWrap: { width: 40, height: 40, borderRadius: theme.radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, gap: 4 },
  note: { ...theme.typography.bodyLarge, color: theme.colors.textPrimary },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  tag: { paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: theme.radius.full, borderWidth: 1 },
  tagText: { ...theme.typography.labelSmall },
  time: { ...theme.typography.bodyMedium, color: theme.colors.textMuted },
  amount: { ...theme.typography.headingMedium },
  deleteBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});

// ─── History screen ───────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [dbReady, setDbReady] = useState(false);
  const [exporting, setExporting] = useState(false);

  const refreshCounter = useBudgetStore((s) => s.refreshCounter);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  useEffect(() => { setDbReady(true); }, []);

  useEffect(() => {
    if (!dbReady) return;
    const cat = filter === 'all' ? undefined : filter;
    fetchTransactions(500, cat).then(setTransactions);
  }, [refreshCounter, dbReady, filter]);

  const handleDelete = useCallback(async (id: number) => {
    await deleteTransaction(id);
    useBudgetStore.getState().triggerRefresh();
  }, []);

  const handleExport = useCallback(async () => {
    if (exporting || transactions.length === 0) return;
    setExporting(true);
    try {
      const header = 'Date,Time,Category,Subcategory,Note,Amount\n';
      const rows = transactions.map((t) => {
        const d = new Date(t.timestamp);
        const date = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
        const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
        return [date, time, t.category, escape(t.subcategory), escape(t.note), t.amount.toFixed(2)].join(',');
      });
      const csv = header + rows.join('\n');

      if (Platform.OS === 'web') {
        // Browser download via a Blob + temporary anchor — no native module needed.
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chronobudget-export.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      if (!FileSystem || !Sharing) return;
      const uri = `${FileSystem.cacheDirectory}chronobudget-export.csv`;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export transactions', UTI: 'public.comma-separated-values-text' });
    } finally {
      setExporting(false);
    }
  }, [transactions, exporting]);

  const sections = groupByDate(transactions);
  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const totalFormatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total);
  const activeFilter = FILTERS.find((f) => f.id === filter)!;

  return (
    <View style={styles.screen}>
      <View style={[styles.frame, isWide && styles.frameWide]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.screenTitle}>HISTORY</Text>
          <View style={styles.headerRight}>
            <Text style={[styles.totalBadge, { color: activeFilter.color }]}>{totalFormatted}</Text>
            {transactions.length > 0 && (
              <TouchableOpacity
                onPress={handleExport}
                disabled={exporting}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.exportBtn}
              >
                <Icon
                  name={exporting ? 'loading' : 'export-variant'}
                  size={20}
                  color={theme.colors.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter chips */}
        <View style={styles.filters}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, active && { borderColor: f.color, backgroundColor: `${f.color}18` }]}
                onPress={() => setFilter(f.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterLabel, { color: active ? f.color : theme.colors.textMuted }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* List */}
        {transactions.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Icon name="receipt-text-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No transactions</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all'
                ? 'Add your first expense on the Dashboard.'
                : `No ${activeFilter.label} transactions yet.`}
            </Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <HistoryRow item={item} onDelete={handleDelete} />}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionCount}>
                  {section.data.length} {section.data.length === 1 ? 'item' : 'items'}
                </Text>
              </View>
            )}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bgPrimary, alignItems: 'center' },
  frame: { flex: 1, width: '100%' },
  frameWide: { maxWidth: 600 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  screenTitle: { ...theme.typography.headingLarge, color: theme.colors.textPrimary, letterSpacing: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  totalBadge: { ...theme.typography.headingMedium },
  exportBtn: { padding: 2 },
  filters: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  filterChip: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  filterLabel: { ...theme.typography.labelLarge },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.bgPrimary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  sectionTitle: { ...theme.typography.labelLarge, color: theme.colors.textMuted, letterSpacing: 1 },
  sectionCount: { ...theme.typography.labelSmall, color: theme.colors.textMuted },
  listContent: { paddingHorizontal: theme.spacing.md },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, paddingHorizontal: theme.spacing.xl },
  emptyTitle: { ...theme.typography.headingMedium, color: theme.colors.textMuted },
  emptySubtitle: { ...theme.typography.bodyMedium, color: theme.colors.textMuted, textAlign: 'center' },
});
