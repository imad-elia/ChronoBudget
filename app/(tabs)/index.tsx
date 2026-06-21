import { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BentoCard } from '../../components/BentoCard';
import { ExpenseInput } from '../../components/ExpenseInput';
import {
  initDb,
  fetchCategoryTotals,
  fetchRecentTransactions,
  deleteTransaction,
} from '../../db/database';
import { useBudgetStore, type Transaction, type CategoryTotals } from '../../store/useBudgetStore';

const BENTO_CONFIG = [
  {
    id: 'needs' as const,
    title: 'Needs',
    icon: 'home-outline' as const,
    color: '#00FF87',
    glowColor: '#00FF87',
    gradientColors: ['#0A1A12', '#0F2018', '#0A0A0F'] as [string, string, string],
  },
  {
    id: 'wants' as const,
    title: 'Wants',
    icon: 'shopping-outline' as const,
    color: '#FF2D78',
    glowColor: '#FF2D78',
    gradientColors: ['#1A0A12', '#20080F', '#0A0A0F'] as [string, string, string],
  },
  {
    id: 'savings' as const,
    title: 'Savings',
    icon: 'piggy-bank-outline' as const,
    color: '#00BFFF',
    glowColor: '#00BFFF',
    gradientColors: ['#0A121A', '#081520', '#0A0A0F'] as [string, string, string],
  },
];

// ─── Transaction row ──────────────────────────────────────────────────────────

function TransactionRow({
  item,
  onDelete,
}: {
  item: Transaction;
  onDelete: (id: number) => void;
}) {
  const config = BENTO_CONFIG.find((c) => c.id === item.category)!;
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePressIn() { scale.value = withSpring(0.97, { damping: 20 }); }
  function handlePressOut() { scale.value = withSpring(1, { damping: 20 }); }

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(item.amount);

  const date = new Date(item.timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18).stiffness(120)}
      exiting={FadeOutUp.springify().damping(18)}
      layout={LinearTransition.springify().damping(18)}
      style={animStyle}
    >
      <TouchableOpacity
        style={rowSheet.row}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={[rowSheet.iconWrap, { backgroundColor: `${config.color}18`, borderColor: `${config.color}40` }]}>
          <Icon name={config.icon} size={18} color={config.color} />
        </View>
        <View style={rowSheet.meta}>
          <Text style={rowSheet.note} numberOfLines={1}>
            {item.note || config.title}
          </Text>
          <Text style={rowSheet.date}>{date}</Text>
        </View>
        <Text style={[rowSheet.amount, { color: config.color }]}>{formatted}</Text>
        <TouchableOpacity
          style={rowSheet.deleteBtn}
          onPress={() => onDelete(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="close" size={14} color="#4A5168" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const rowSheet = StyleSheet.create((theme) => ({
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
  meta: {
    flex: 1,
    gap: 2,
  },
  note: {
    ...theme.typography.bodyLarge,
    color: theme.colors.textPrimary,
  },
  date: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textMuted,
  },
  amount: {
    ...theme.typography.headingMedium,
  },
  deleteBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

// ─── Dashboard header ─────────────────────────────────────────────────────────

function DashboardHeader({ totals }: { totals: CategoryTotals }) {
  const total = totals.needs + totals.wants + totals.savings;

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(total);

  return (
    <View style={headerSheet.container}>
      <Text style={headerSheet.label}>TOTAL SPENT</Text>
      <Text style={headerSheet.balance} numberOfLines={1} adjustsFontSizeToFit>
        {formatted}
      </Text>
      <View style={headerSheet.grid}>
        {BENTO_CONFIG.map((c) => (
          <BentoCard
            key={c.id}
            title={c.title}
            amount={totals[c.id]}
            color={c.color}
            glowColor={c.glowColor}
            gradientColors={c.gradientColors}
            icon={c.icon}
          />
        ))}
      </View>
      <Text style={headerSheet.sectionLabel}>RECENT</Text>
    </View>
  );
}

const headerSheet = StyleSheet.create((theme) => ({
  container: {
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  label: {
    ...theme.typography.labelLarge,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  balance: {
    ...theme.typography.displayLarge,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    ...theme.typography.labelLarge,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
}));

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={emptySheet.wrap}>
      <Icon name="receipt-text-outline" size={40} color="#4A5168" />
      <Text style={emptySheet.text}>No transactions yet</Text>
    </View>
  );
}

const emptySheet = StyleSheet.create((theme) => ({
  wrap: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  text: {
    ...theme.typography.bodyLarge,
    color: theme.colors.textMuted,
  },
}));

// ─── Dashboard screen ─────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const [totals, setTotals] = useState<CategoryTotals>({ needs: 0, wants: 0, savings: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dbReady, setDbReady] = useState(false);

  const refreshCounter = useBudgetStore((s) => s.refreshCounter);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  useEffect(() => {
    initDb().then(() => setDbReady(true));
  }, []);

  useEffect(() => {
    if (!dbReady) return;
    fetchCategoryTotals().then(setTotals);
    fetchRecentTransactions(30).then(setTransactions);
  }, [refreshCounter, dbReady]);

  const handleDelete = useCallback(async (id: number) => {
    await deleteTransaction(id);
    useBudgetStore.getState().triggerRefresh();
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionRow item={item} onDelete={handleDelete} />
    ),
    [handleDelete],
  );

  const keyExtractor = useCallback((item: Transaction) => String(item.id), []);

  return (
    <View style={styles.screen}>
      <View style={[styles.frame, isWide && styles.frameWide]}>
        <FlatList
          data={transactions}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={<DashboardHeader totals={totals} />}
          ListEmptyComponent={<EmptyState />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          itemLayoutAnimation={LinearTransition.springify().damping(18)}
        />

        <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
          <ExpenseInput />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
    alignItems: 'center',
  },
  frame: {
    flex: 1,
    width: '100%',
  },
  frameWide: {
    maxWidth: 600,
    width: '100%',
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
  },
  footer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.bgSecondary,
  },
}));
