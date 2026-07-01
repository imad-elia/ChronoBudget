import { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  useWindowDimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
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

import { BentoCard } from '../../components/BentoCard';
import { ExpenseInput } from '../../components/ExpenseInput';
import { OnboardingOverlay } from '../../components/OnboardingOverlay';
import { SettingsModal } from '../../components/SettingsModal';
import { RecurringModal } from '../../components/RecurringModal';
import {
  initDb,
  fetchCategoryTotals,
  fetchRecentTransactions,
  deleteTransaction,
  fetchLimits,
  setLimit,
  getSetting,
  processRecurring,
} from '../../db/database';
import { useBudgetStore, type Transaction, type CategoryTotals, type Category } from '../../store/useBudgetStore';
import { theme } from '../../theme';
import { formatCurrency } from '../../lib/format';
import { t } from '../../lib/i18n';

const BENTO_CONFIG = [
  {
    id: 'needs' as Category,
    title: 'Needs',
    icon: 'home-outline' as const,
    color: '#00FF87',
    glowColor: '#00FF87',
    gradientColors: ['#0A1A12', '#0F2018', '#0A0A0F'] as [string, string, string],
  },
  {
    id: 'wants' as Category,
    title: 'Wants',
    icon: 'shopping-outline' as const,
    color: '#FF2D78',
    glowColor: '#FF2D78',
    gradientColors: ['#1A0A12', '#20080F', '#0A0A0F'] as [string, string, string],
  },
  {
    id: 'savings' as Category,
    title: 'Savings',
    icon: 'piggy-bank-outline' as const,
    color: '#00BFFF',
    glowColor: '#00BFFF',
    gradientColors: ['#0A121A', '#081520', '#0A0A0F'] as [string, string, string],
  },
];

// ─── Transaction row ──────────────────────────────────────────────────────────

function TransactionRow({ item, onDelete }: { item: Transaction; onDelete: (id: number) => void }) {
  const config = BENTO_CONFIG.find((c) => c.id === item.category)!;
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const formatted = formatCurrency(item.amount);
  const date = new Date(item.timestamp).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

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
        <View style={[rowStyles.iconWrap, { backgroundColor: `${config.color}18`, borderColor: `${config.color}40` }]}>
          <Icon name={config.icon} size={18} color={config.color} />
        </View>
        <View style={rowStyles.meta}>
          <Text style={rowStyles.note} numberOfLines={1}>
            {item.subcategory || item.note || config.title}
          </Text>
          <Text style={rowStyles.date}>{date}</Text>
        </View>
        <Text style={[rowStyles.amount, { color: config.color }]}>{formatted}</Text>
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
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, gap: 2 },
  note: { ...theme.typography.bodyLarge, color: theme.colors.textPrimary },
  date: { ...theme.typography.bodyMedium, color: theme.colors.textMuted },
  amount: { ...theme.typography.headingMedium },
  deleteBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});

// ─── Budget limits modal ──────────────────────────────────────────────────────

function LimitsModal({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: () => void }) {
  const limits = useBudgetStore((s) => s.limits);
  const [drafts, setDrafts] = useState({
    needs:   limits.needs   > 0 ? String(limits.needs)   : '',
    wants:   limits.wants   > 0 ? String(limits.wants)   : '',
    savings: limits.savings > 0 ? String(limits.savings) : '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDrafts({
        needs:   limits.needs   > 0 ? String(limits.needs)   : '',
        wants:   limits.wants   > 0 ? String(limits.wants)   : '',
        savings: limits.savings > 0 ? String(limits.savings) : '',
      });
    }
  }, [visible, limits]);

  async function handleSave() {
    setSaving(true);
    for (const cat of ['needs', 'wants', 'savings'] as Category[]) {
      const val = parseFloat(drafts[cat].replace(',', '.'));
      await setLimit(cat, isNaN(val) || val <= 0 ? 0 : val);
    }
    const newLimits = await fetchLimits();
    useBudgetStore.getState().setLimits(newLimits);
    setSaving(false);
    onSave();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={modalStyles.overlay}
      >
        <TouchableOpacity style={StyleSheet.absoluteFillObject as any} activeOpacity={1} onPress={onClose} />
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.title}>BUDGET LIMITS</Text>
          <Text style={modalStyles.subtitle}>Set monthly spending limits per category. Leave blank to remove.</Text>

          {BENTO_CONFIG.map((cat) => (
            <View key={cat.id} style={modalStyles.row}>
              <View style={[modalStyles.dot, { backgroundColor: cat.color }]} />
              <Text style={[modalStyles.label, { color: cat.color }]}>{cat.title}</Text>
              <View style={[modalStyles.inputWrap, { borderColor: drafts[cat.id] ? `${cat.color}60` : theme.colors.border }]}>
                <Text style={[modalStyles.prefix, { color: cat.color }]}>$</Text>
                <TextInput
                  style={modalStyles.input}
                  placeholder="No limit"
                  placeholderTextColor={theme.colors.textMuted}
                  value={drafts[cat.id]}
                  onChangeText={(v) => setDrafts((d) => ({ ...d, [cat.id]: v }))}
                  keyboardType="decimal-pad"
                  selectionColor={cat.color}
                />
              </View>
            </View>
          ))}

          <View style={modalStyles.actions}>
            <TouchableOpacity style={modalStyles.cancel} onPress={onClose} activeOpacity={0.7}>
              <Text style={modalStyles.cancelLabel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modalStyles.save} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
              <Text style={modalStyles.saveLabel}>{saving ? 'Saving…' : 'Save Limits'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay },
  sheet: {
    backgroundColor: theme.colors.bgSecondary,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: { ...theme.typography.labelLarge, color: theme.colors.textPrimary, textAlign: 'center', letterSpacing: 2 },
  subtitle: { ...theme.typography.bodyMedium, color: theme.colors.textMuted, textAlign: 'center', marginBottom: theme.spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  dot: { width: 8, height: 8, borderRadius: theme.radius.full },
  label: { ...theme.typography.labelLarge, width: 56 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    height: 44,
  },
  prefix: { ...theme.typography.headingMedium, marginRight: theme.spacing.xs },
  input: { flex: 1, ...theme.typography.bodyLarge, color: theme.colors.textPrimary },
  actions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  cancel: {
    flex: 1, height: 48, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelLabel: { ...theme.typography.headingMedium, color: theme.colors.textMuted },
  save: { flex: 2, height: 48, borderRadius: theme.radius.md, backgroundColor: '#00FF87', alignItems: 'center', justifyContent: 'center' },
  saveLabel: { ...theme.typography.headingMedium, color: '#000000' },
});

// ─── Dashboard header ─────────────────────────────────────────────────────────

function DashboardHeader({ totals, onOpenLimits, onOpenSettings, onOpenRecurring, topInset }: { totals: CategoryTotals; onOpenLimits: () => void; onOpenSettings: () => void; onOpenRecurring: () => void; topInset: number }) {
  const limits = useBudgetStore((s) => s.limits);
  // Subscribe to currency so the header re-renders when the user changes country.
  useBudgetStore((s) => s.currency);
  const total = totals.needs + totals.wants + totals.savings;
  const formatted = formatCurrency(total);

  return (
    <View style={[headerStyles.container, { paddingTop: topInset + theme.spacing.lg }]}>
      <View style={headerStyles.titleRow}>
        <View style={headerStyles.titleSpacer} />
        <View style={headerStyles.titleCenter}>
          <Text style={headerStyles.label}>{t('dashboard.totalSpent').toUpperCase()}</Text>
          <Text style={headerStyles.balance} numberOfLines={1} adjustsFontSizeToFit>{formatted}</Text>
        </View>
        <View style={headerStyles.headerActions}>
          <TouchableOpacity style={headerStyles.iconBtn} onPress={onOpenRecurring} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="autorenew" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={headerStyles.iconBtn} onPress={onOpenSettings} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="cog-outline" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={headerStyles.iconBtn} onPress={onOpenLimits} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="tune-variant" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={headerStyles.grid}>
        {BENTO_CONFIG.map((c) => (
          <BentoCard
            key={c.id}
            title={c.title}
            amount={totals[c.id]}
            color={c.color}
            glowColor={c.glowColor}
            gradientColors={c.gradientColors}
            icon={c.icon}
            limit={limits[c.id]}
          />
        ))}
      </View>
      <Text style={headerStyles.sectionLabel}>RECENT</Text>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  container: { paddingBottom: theme.spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: theme.spacing.lg },
  titleSpacer: { width: 96 },
  titleCenter: { flex: 1, alignItems: 'center' },
  headerActions: { width: 96, flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm, paddingTop: 4 },
  iconBtn: { alignItems: 'flex-end' },
  label: { ...theme.typography.labelLarge, color: theme.colors.textMuted, textAlign: 'center', marginBottom: theme.spacing.xs },
  balance: { ...theme.typography.displayLarge, color: theme.colors.textPrimary, textAlign: 'center' },
  grid: { flexDirection: 'row', gap: 10, marginBottom: theme.spacing.lg },
  sectionLabel: { ...theme.typography.labelLarge, color: theme.colors.textMuted, marginBottom: theme.spacing.sm },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={emptyStyles.wrap}>
      <Icon name="receipt-text-outline" size={40} color={theme.colors.textMuted} />
      <Text style={emptyStyles.text}>No transactions yet</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: theme.spacing.xxl, gap: theme.spacing.md },
  text: { ...theme.typography.bodyLarge, color: theme.colors.textMuted },
});

// ─── Dashboard screen ─────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const [totals, setTotals] = useState<CategoryTotals>({ needs: 0, wants: 0, savings: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dbReady, setDbReady] = useState(false);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const refreshCounter = useBudgetStore((s) => s.refreshCounter);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  useEffect(() => {
    initDb()
      .then(async () => {
        // Post any due/missed recurring occurrences before the first fetch so
        // they're already reflected in totals and the recent list.
        await processRecurring();
        // Load locale/currency, learned keywords, and recurring rules before
        // revealing the UI so amounts render in the right currency and the smart
        // input can classify.
        await Promise.all([
          useBudgetStore.getState().loadLocale(),
          useBudgetStore.getState().loadLearnedKeywords(),
          useBudgetStore.getState().loadRecurring(),
        ]);
        setDbReady(true);
        const done = await getSetting('onboarding_complete');
        if (!done) setShowOnboarding(true);
      })
      .catch((err: unknown) => {
        console.warn('Database initialization failed:', err);
      });
  }, []);

  useEffect(() => {
    if (!dbReady) return;
    fetchCategoryTotals().then(setTotals);
    fetchRecentTransactions(30).then(setTransactions);
    fetchLimits().then((l) => useBudgetStore.getState().setLimits(l));
  }, [refreshCounter, dbReady]);

  const handleDelete = useCallback(async (id: number) => {
    await deleteTransaction(id);
    useBudgetStore.getState().triggerRefresh();
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => <TransactionRow item={item} onDelete={handleDelete} />,
    [handleDelete],
  );

  return (
    <View style={screenStyles.screen}>
      <KeyboardAvoidingView
        style={[screenStyles.frame, isWide && screenStyles.frameWide]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={transactions}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListHeaderComponent={
            <DashboardHeader totals={totals} onOpenLimits={() => setLimitsOpen(true)} onOpenSettings={() => setSettingsOpen(true)} onOpenRecurring={() => setRecurringOpen(true)} topInset={insets.top} />
          }
          ListEmptyComponent={<EmptyState />}
          contentContainerStyle={[screenStyles.listContent, { paddingBottom: insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          itemLayoutAnimation={LinearTransition.springify().damping(18)}
        />
        <View style={[screenStyles.footer, { paddingBottom: insets.bottom + 8 }]}>
          <ExpenseInput />
        </View>
      </KeyboardAvoidingView>

      <LimitsModal
        visible={limitsOpen}
        onClose={() => setLimitsOpen(false)}
        onSave={() => useBudgetStore.getState().triggerRefresh()}
      />

      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <RecurringModal
        visible={recurringOpen}
        onClose={() => setRecurringOpen(false)}
      />

      <OnboardingOverlay
        visible={showOnboarding}
        onDone={() => setShowOnboarding(false)}
      />
    </View>
  );
}

const screenStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bgPrimary, alignItems: 'center' },
  frame: { flex: 1, width: '100%' },
  frameWide: { maxWidth: 600 },
  listContent: { paddingHorizontal: theme.spacing.md },
  footer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.bgSecondary,
  },
});
