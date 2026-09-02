import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  useWindowDimensions,
  StyleSheet,
  Platform,
  Alert,
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
let DocumentPicker: typeof import('expo-document-picker') | null = null;
if (Platform.OS !== 'web') {
  FileSystem = require('expo-file-system/legacy');
  Sharing = require('expo-sharing');
  DocumentPicker = require('expo-document-picker');
}

import { fetchTransactions, deleteTransaction, insertTransactionsBulk } from '../../db/database';
import { EditTransactionModal } from '../../components/EditTransactionModal';
import { useBudgetStore, type Transaction, type Category } from '../../store/useBudgetStore';
import { theme } from '../../theme';
import { formatCurrency, formatSignedAmount } from '../../lib/format';
import { t } from '../../lib/i18n';
import { subcategoryLabel } from '../../constants/subcategories';
import { parseCsv } from '../../lib/csv';

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG = {
  needs:   { labelKey: 'category.needs'   as const, color: '#00FF87', icon: 'home-outline'     as const },
  wants:   { labelKey: 'category.wants'   as const, color: '#FF2D78', icon: 'shopping-outline' as const },
  savings: { labelKey: 'category.savings' as const, color: '#00BFFF', icon: 'piggy-bank-outline' as const },
};

type FilterOption = 'all' | Category;

const FILTERS: { id: FilterOption; labelKey: 'history.filterAll' | 'category.needs' | 'category.wants' | 'category.savings'; color: string }[] = [
  { id: 'all',     labelKey: 'history.filterAll', color: theme.colors.textPrimary },
  { id: 'needs',   labelKey: 'category.needs',     color: '#00FF87' },
  { id: 'wants',   labelKey: 'category.wants',     color: '#FF2D78' },
  { id: 'savings', labelKey: 'category.savings',   color: '#00BFFF' },
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

function HistoryRow({ item, onDelete, onEdit }: { item: Transaction; onDelete: (id: number) => void; onEdit: (tx: Transaction) => void }) {
  const cfg = CATEGORY_CONFIG[item.category];
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const formatted = formatSignedAmount(item);
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
        onPress={() => onEdit(item)}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 20 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 20 }); }}
        activeOpacity={1}
      >
        <View style={[rowStyles.iconWrap, { backgroundColor: `${cfg.color}18`, borderColor: `${cfg.color}40` }]}>
          <Icon name={cfg.icon} size={18} color={cfg.color} />
        </View>
        <View style={rowStyles.meta}>
          <Text style={rowStyles.note} numberOfLines={1}>{(item.subcategory && subcategoryLabel(item.subcategory)) || item.note || t(cfg.labelKey)}</Text>
          <View style={rowStyles.tagRow}>
            <View style={[rowStyles.tag, { backgroundColor: `${cfg.color}18`, borderColor: `${cfg.color}30` }]}>
              <Text style={[rowStyles.tagText, { color: cfg.color }]}>{t(cfg.labelKey)}</Text>
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
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

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
      const CATEGORY_LABEL_KEY = {
        needs: 'category.needs',
        wants: 'category.wants',
        savings: 'category.savings',
      } as const;
      const header = [
        t('csv.header.date'),
        t('csv.header.time'),
        t('csv.header.category'),
        t('csv.header.subcategory'),
        t('csv.header.note'),
        t('csv.header.amount'),
      ].join(',') + '\n';
      const rows = transactions.map((tx) => {
        const d = new Date(tx.timestamp);
        // ISO date/time, not locale-formatted: parseCsv reconstructs the
        // timestamp from these cells and needs an unambiguous format.
        const date = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
        const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
        const categoryLabel = t(CATEGORY_LABEL_KEY[tx.category]);
        return [date, time, categoryLabel, escape(subcategoryLabel(tx.subcategory)), escape(tx.note), tx.amount.toFixed(2)].join(',');
      });
      // Leading BOM so Excel (which sniffs encoding by BOM, not the Blob's
      // charset hint) opens accented characters correctly instead of mojibake.
      const csv = '﻿' + header + rows.join('\n');

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
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: t('history.exportDialogTitle'), UTI: 'public.comma-separated-values-text' });
    } finally {
      setExporting(false);
    }
  }, [transactions, exporting]);

  const applyImportedCsv = useCallback(async (text: string) => {
    const { rows, skipped } = parseCsv(text);
    if (rows.length === 0) {
      Alert.alert(t('history.importEmpty'));
      return;
    }
    await insertTransactionsBulk(rows);
    useBudgetStore.getState().triggerRefresh();
    Alert.alert(
      skipped > 0
        ? t('history.importSuccessSkipped', { count: rows.length, skipped })
        : t('history.importSuccess', { count: rows.length }),
    );
  }, []);

  const handleImport = useCallback(async () => {
    if (importing) return;
    setImporting(true);
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,text/csv';
        const text = await new Promise<string | null>((resolve) => {
          input.onchange = async () => {
            const file = input.files?.[0];
            resolve(file ? await file.text() : null);
          };
          input.click();
        });
        if (text != null) await applyImportedCsv(text);
        return;
      }

      if (!DocumentPicker || !FileSystem) return;
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', '*/*'] });
      if (result.canceled || result.assets.length === 0) return;
      const text = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
      await applyImportedCsv(text);
    } catch {
      Alert.alert(t('history.importError'));
    } finally {
      setImporting(false);
    }
  }, [importing, applyImportedCsv]);

  const sections = groupByDate(transactions);
  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const totalFormatted = formatCurrency(total);
  const activeFilter = FILTERS.find((f) => f.id === filter)!;

  return (
    <View style={styles.screen}>
      <View style={[styles.frame, isWide && styles.frameWide]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.screenTitle}>{t('history.title')}</Text>
          <View style={styles.headerRight}>
            <Text style={[styles.totalBadge, { color: activeFilter.color }]}>{totalFormatted}</Text>
            <TouchableOpacity
              onPress={handleImport}
              disabled={importing}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.exportBtn}
            >
              <Icon
                name={importing ? 'loading' : 'import'}
                size={20}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
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
                  {t(f.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* List */}
        {transactions.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Icon name="receipt-text-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('history.empty')}</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all'
                ? t('history.emptyHintAll')
                : t('history.emptyHintFiltered', { category: t(activeFilter.labelKey) })}
            </Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <HistoryRow item={item} onDelete={handleDelete} onEdit={setEditing} />}
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

        <EditTransactionModal
          transaction={editing}
          onClose={() => setEditing(null)}
        />
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
