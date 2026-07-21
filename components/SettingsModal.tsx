import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useBudgetStore, COUNTRIES, type Category } from '../store/useBudgetStore';
import { theme } from '../theme';
import { t } from '../lib/i18n';
import { setBalance, fetchBalances } from '../db/database';

const BALANCE_CATEGORIES: { id: Category; label: string; color: string }[] = [
  { id: 'needs',   label: t('category.needs'),   color: '#00FF87' },
  { id: 'wants',   label: t('category.wants'),   color: '#FF2D78' },
  { id: 'savings', label: t('category.savings'), color: '#00BFFF' },
];

export function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const country = useBudgetStore((s) => s.country);
  const setCountry = useBudgetStore((s) => s.setCountry);
  const symbol = useBudgetStore((s) => s.symbol);
  const balances = useBudgetStore((s) => s.balances);

  const [drafts, setDrafts] = useState<Record<Category, string>>({
    needs: '', wants: '', savings: '',
  });

  useEffect(() => {
    if (visible) {
      setDrafts({
        needs:   balances.needs   ? String(balances.needs)   : '',
        wants:   balances.wants   ? String(balances.wants)   : '',
        savings: balances.savings ? String(balances.savings) : '',
      });
    }
  }, [visible, balances]);

  async function handleDone() {
    for (const cat of ['needs', 'wants', 'savings'] as Category[]) {
      const val = parseFloat(drafts[cat].replace(',', '.'));
      // Blank or invalid clears the balance (setBalance deletes on <= 0).
      await setBalance(cat, isNaN(val) ? 0 : val);
    }
    useBudgetStore.getState().setBalances(await fetchBalances());
    useBudgetStore.getState().triggerRefresh();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDone}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={StyleSheet.absoluteFillObject as any} activeOpacity={1} onPress={handleDone} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('settings.title').toUpperCase()}</Text>
          <Text style={styles.subtitle}>{t('settings.regionHint')}</Text>

          <Text style={styles.sectionLabel}>{t('settings.country')}</Text>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {COUNTRIES.map((c) => {
              const active = c.code === country;
              return (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => setCountry(c.code)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.countryName, active && styles.countryNameActive]}>{c.name}</Text>
                  <Text style={styles.currencyCode}>{c.symbol} {c.currency}</Text>
                  {active && <Icon name="check" size={16} color="#00FF87" style={styles.check} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.sectionLabel}>{t('settings.balances')}</Text>
          <Text style={styles.balancesHint}>{t('settings.balancesHint')}</Text>
          {BALANCE_CATEGORIES.map((cat) => (
            <View key={cat.id} style={styles.balanceRow}>
              <View style={[styles.balanceDot, { backgroundColor: cat.color }]} />
              <Text style={[styles.balanceLabel, { color: cat.color }]}>{cat.label}</Text>
              <View style={[styles.balanceInputWrap, { borderColor: drafts[cat.id] ? `${cat.color}60` : theme.colors.border }]}>
                <Text style={[styles.balancePrefix, { color: cat.color }]}>{symbol}</Text>
                <TextInput
                  style={styles.balanceInput}
                  placeholder={t('input.amountPlaceholder')}
                  placeholderTextColor={theme.colors.textMuted}
                  value={drafts[cat.id]}
                  onChangeText={(v) => setDrafts((d) => ({ ...d, [cat.id]: v }))}
                  keyboardType="decimal-pad"
                  maxLength={12}
                  selectionColor={cat.color}
                />
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.done} onPress={handleDone} activeOpacity={0.8}>
            <Text style={styles.doneLabel}>{t('settings.done')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay },
  sheet: {
    backgroundColor: theme.colors.bgSecondary,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
    maxHeight: '80%',
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
  sectionLabel: { ...theme.typography.labelLarge, color: theme.colors.textMuted, marginTop: theme.spacing.xs },
  list: { maxHeight: 260 },
  balancesHint: { ...theme.typography.bodyMedium, color: theme.colors.textMuted },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  balanceDot: { width: 8, height: 8, borderRadius: theme.radius.full },
  balanceLabel: { ...theme.typography.labelLarge, width: 64 },
  balanceInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    height: 44,
  },
  balancePrefix: { ...theme.typography.headingMedium, marginRight: theme.spacing.xs },
  balanceInput: { flex: 1, ...theme.typography.bodyLarge, color: theme.colors.textPrimary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    height: 48,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  rowActive: { borderColor: '#00FF87', backgroundColor: 'rgba(0,255,135,0.08)' },
  countryName: { ...theme.typography.bodyLarge, color: theme.colors.textSecondary, flex: 1 },
  countryNameActive: { color: theme.colors.textPrimary },
  currencyCode: { ...theme.typography.bodyMedium, color: theme.colors.textMuted },
  check: { marginLeft: theme.spacing.xs },
  done: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: '#00FF87',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xs,
  },
  doneLabel: { ...theme.typography.headingMedium, color: '#000000' },
});
