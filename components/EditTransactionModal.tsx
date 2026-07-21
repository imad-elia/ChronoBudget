import { useState, useEffect } from 'react';
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
import { useBudgetStore } from '../store/useBudgetStore';
import type { Category, Transaction } from '../store/useBudgetStore';
import { theme } from '../theme';
import { SUBCATEGORIES } from '../constants/subcategories';
import { t } from '../lib/i18n';
import { updateTransaction, deleteTransaction } from '../db/database';

const CATEGORIES: { id: Category; color: string }[] = [
  { id: 'needs',   color: '#00FF87' },
  { id: 'wants',   color: '#FF2D78' },
  { id: 'savings', color: '#00BFFF' },
];

const CATEGORY_LABEL: Record<Category, string> = {
  needs: t('category.needs'),
  wants: t('category.wants'),
  savings: t('category.savings'),
};

function colorFor(cat: Category): string {
  return CATEGORIES.find((c) => c.id === cat)!.color;
}

interface Props {
  transaction: Transaction | null;
  onClose: () => void;
}

export function EditTransactionModal({ transaction, onClose }: Props) {
  const symbol = useBudgetStore((s) => s.symbol);

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('needs');
  const [subcategory, setSubcategory] = useState('');
  const [customSubcategory, setCustomSubcategory] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeColor = colorFor(category);
  const subcats = SUBCATEGORIES[category];

  // Prefill from the transaction each time the modal opens for one.
  useEffect(() => {
    if (!transaction) return;
    setAmount(String(transaction.amount));
    setCategory(transaction.category);
    // A stored subcategory that isn't one of the preset chips is a custom one.
    const presets = SUBCATEGORIES[transaction.category] as readonly string[];
    if (transaction.subcategory && !presets.includes(transaction.subcategory)) {
      setSubcategory('__custom__');
      setCustomSubcategory(transaction.subcategory);
      setShowCustomInput(true);
    } else {
      setSubcategory(transaction.subcategory);
      setCustomSubcategory('');
      setShowCustomInput(false);
    }
    setNote(transaction.note);
    setError(null);
  }, [transaction]);

  function selectCategory(cat: Category) {
    setCategory(cat);
    setSubcategory('');
    setCustomSubcategory('');
    setShowCustomInput(false);
  }

  function selectSubcategory(s: string) {
    if (s === '__custom__') {
      setSubcategory('__custom__');
      setShowCustomInput(true);
    } else {
      setSubcategory(s);
      setShowCustomInput(false);
      setCustomSubcategory('');
    }
  }

  async function handleSave() {
    if (!transaction) return;
    const amt = parseFloat(amount.replace(',', '.'));
    if (isNaN(amt)) { setError(t('input.errAmount')); return; }
    if (amt <= 0) { setError(t('input.errPositive')); return; }
    if (amt > 9_999_999) { setError(t('input.errTooLarge')); return; }

    const resolvedSub = subcategory === '__custom__' ? customSubcategory.trim() : subcategory;
    setSaving(true);
    try {
      await updateTransaction(transaction.id, {
        amount: amt,
        category,
        subcategory: resolvedSub,
        note,
      });
      useBudgetStore.getState().triggerRefresh();
      onClose();
    } catch {
      setError(t('input.errSave'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!transaction) return;
    await deleteTransaction(transaction.id);
    useBudgetStore.getState().triggerRefresh();
    onClose();
  }

  return (
    <Modal visible={transaction != null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill as any} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('edit.title').toUpperCase()}</Text>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Category chips */}
            <View style={styles.categoryRow}>
              {CATEGORIES.map((cat) => {
                const active = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryChip, active && { borderColor: cat.color, backgroundColor: `${cat.color}18` }]}
                    onPress={() => selectCategory(cat.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.categoryLabel, { color: active ? cat.color : theme.colors.textMuted }]}>
                      {CATEGORY_LABEL[cat.id]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Amount */}
            <View style={[styles.inputWrap, { borderColor: amount ? `${activeColor}60` : theme.colors.border }]}>
              <Text style={[styles.prefix, { color: activeColor }]}>{symbol}</Text>
              <TextInput
                style={styles.amountInput}
                placeholder={t('input.amountPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                value={amount}
                onChangeText={(v) => { setAmount(v); setError(null); }}
                keyboardType="decimal-pad"
                maxLength={12}
                selectionColor={activeColor}
              />
            </View>

            {/* Subcategory chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.subRow}
              keyboardShouldPersistTaps="handled"
            >
              {subcats.map((s) => {
                const active = subcategory === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.subChip, active && { borderColor: activeColor, backgroundColor: `${activeColor}18` }]}
                    onPress={() => selectSubcategory(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.subLabel, { color: active ? activeColor : theme.colors.textMuted }]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.subChip, subcategory === '__custom__' && { borderColor: activeColor, backgroundColor: `${activeColor}18` }]}
                onPress={() => selectSubcategory('__custom__')}
                activeOpacity={0.7}
              >
                <Icon name="plus" size={11} color={subcategory === '__custom__' ? activeColor : theme.colors.textMuted} />
                <Text style={[styles.subLabel, { color: subcategory === '__custom__' ? activeColor : theme.colors.textMuted }]}>{t('input.custom')}</Text>
              </TouchableOpacity>
            </ScrollView>

            {showCustomInput && (
              <View style={[styles.inputWrap, { borderColor: `${activeColor}40` }]}>
                <Icon name="tag-outline" size={15} color={theme.colors.textMuted} style={styles.noteIcon} />
                <TextInput
                  style={styles.noteInput}
                  placeholder={t('input.subcategoryPlaceholder')}
                  placeholderTextColor={theme.colors.textMuted}
                  value={customSubcategory}
                  onChangeText={setCustomSubcategory}
                  maxLength={40}
                  selectionColor={activeColor}
                />
              </View>
            )}

            {/* Note */}
            <View style={[styles.inputWrap, { borderColor: note ? `${activeColor}40` : theme.colors.border }]}>
              <Icon name="pencil-outline" size={15} color={theme.colors.textMuted} style={styles.noteIcon} />
              <TextInput
                style={styles.noteInput}
                placeholder={t('input.notePlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                value={note}
                onChangeText={setNote}
                maxLength={120}
                selectionColor={activeColor}
              />
            </View>

            {error && (
              <View style={styles.errorRow}>
                <Icon name="alert-circle-outline" size={13} color="#FF2D78" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Icon name="trash-can-outline" size={18} color="#FF2D78" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancel} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelLabel}>{t('edit.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.save} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
                <Text style={styles.saveLabel}>{saving ? '…' : t('edit.save')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
    maxHeight: '82%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: { ...theme.typography.labelLarge, color: theme.colors.textPrimary, textAlign: 'center', letterSpacing: 2, marginBottom: theme.spacing.xs },
  form: { maxHeight: 420 },
  categoryRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  categoryChip: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  categoryLabel: { ...theme.typography.labelLarge, textTransform: 'uppercase' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    height: 48,
    marginBottom: theme.spacing.sm,
  },
  prefix: { ...theme.typography.headingLarge, marginRight: theme.spacing.xs },
  amountInput: { flex: 1, ...theme.typography.headingLarge, color: theme.colors.textPrimary },
  noteIcon: { marginRight: theme.spacing.sm },
  noteInput: { flex: 1, ...theme.typography.bodyLarge, color: theme.colors.textPrimary },
  subRow: { gap: theme.spacing.sm, paddingVertical: 2, marginBottom: theme.spacing.sm },
  subChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  subLabel: { ...theme.typography.labelSmall },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginTop: theme.spacing.sm },
  errorText: { ...theme.typography.bodyMedium, color: '#FF2D78' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  deleteBtn: {
    width: 48, height: 48, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: '#FF2D7840',
    alignItems: 'center', justifyContent: 'center',
  },
  cancel: {
    flex: 1, height: 48, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelLabel: { ...theme.typography.headingMedium, color: theme.colors.textMuted },
  save: { flex: 2, height: 48, borderRadius: theme.radius.md, backgroundColor: '#00FF87', alignItems: 'center', justifyContent: 'center' },
  saveLabel: { ...theme.typography.headingMedium, color: '#000000' },
});
