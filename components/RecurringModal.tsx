import { useState } from 'react';
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
import type { Category, Frequency, RecurringRule } from '../store/useBudgetStore';
import { theme } from '../theme';
import { SUBCATEGORIES } from '../constants/subcategories';
import { formatCurrency, formatDate } from '../lib/format';
import { t } from '../lib/i18n';
import {
  insertRecurring,
  updateRecurring,
  deleteRecurring,
  processRecurring,
} from '../db/database';

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

const FREQUENCIES: { id: Frequency; labelKey: 'recurring.weekly' | 'recurring.monthly' | 'recurring.yearly' }[] = [
  { id: 'weekly',  labelKey: 'recurring.weekly' },
  { id: 'monthly', labelKey: 'recurring.monthly' },
  { id: 'yearly',  labelKey: 'recurring.yearly' },
];

const FREQUENCY_LABEL: Record<Frequency, string> = {
  weekly: t('recurring.weekly'),
  monthly: t('recurring.monthly'),
  yearly: t('recurring.yearly'),
};

function colorFor(cat: Category): string {
  return CATEGORIES.find((c) => c.id === cat)!.color;
}

export function RecurringModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const rules = useBudgetStore((s) => s.recurring);
  const symbol = useBudgetStore((s) => s.symbol);

  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('needs');
  const [subcategory, setSubcategory] = useState('');
  const [customSubcategory, setCustomSubcategory] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeColor = colorFor(category);
  const subcats = SUBCATEGORIES[category];

  function resetForm() {
    setEditingId(null);
    setAmount('');
    setCategory('needs');
    setSubcategory('');
    setCustomSubcategory('');
    setShowCustomInput(false);
    setNote('');
    setFrequency('monthly');
    setError(null);
  }

  function openAdd() {
    resetForm();
    setView('form');
  }

  function openEdit(rule: RecurringRule) {
    setEditingId(rule.id);
    setAmount(String(rule.amount));
    setCategory(rule.category);
    setSubcategory(rule.subcategory);
    setCustomSubcategory('');
    setShowCustomInput(false);
    setNote(rule.note);
    setFrequency(rule.frequency);
    setError(null);
    setView('form');
  }

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
    const amt = parseFloat(amount.replace(',', '.'));
    if (isNaN(amt)) { setError(t('input.errAmount')); return; }
    if (amt <= 0) { setError(t('input.errPositive')); return; }
    if (amt > 9_999_999) { setError(t('input.errTooLarge')); return; }

    const resolvedSub = subcategory === '__custom__' ? customSubcategory.trim() : subcategory;
    setSaving(true);
    try {
      const fields = { amount: amt, category, subcategory: resolvedSub, note, frequency };
      if (editingId != null) {
        await updateRecurring(editingId, fields);
      } else {
        await insertRecurring(fields);
      }
      // Post any now-due occurrences (a new rule's first charge posts immediately)
      // and refresh dashboard/history/trends.
      await processRecurring();
      await useBudgetStore.getState().loadRecurring();
      useBudgetStore.getState().triggerRefresh();
      resetForm();
      setView('list');
    } catch {
      setError(t('input.errSave'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await deleteRecurring(id);
    await useBudgetStore.getState().loadRecurring();
  }

  function handleClose() {
    setView('list');
    resetForm();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={StyleSheet.absoluteFillObject as any} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('recurring.title').toUpperCase()}</Text>
          <Text style={styles.subtitle}>{t('recurring.subtitle')}</Text>

          {view === 'list' ? (
            <>
              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {rules.length === 0 ? (
                  <View style={styles.empty}>
                    <Icon name="autorenew" size={34} color={theme.colors.textMuted} />
                    <Text style={styles.emptyText}>{t('recurring.empty')}</Text>
                  </View>
                ) : (
                  rules.map((rule) => {
                    const c = colorFor(rule.category);
                    const label = rule.subcategory || rule.note || CATEGORY_LABEL[rule.category];
                    return (
                      <TouchableOpacity
                        key={rule.id}
                        style={styles.ruleRow}
                        onPress={() => openEdit(rule)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.dot, { backgroundColor: c }]} />
                        <View style={styles.ruleInfo}>
                          <Text style={styles.ruleLabel} numberOfLines={1}>{label}</Text>
                          <Text style={styles.ruleMeta} numberOfLines={1}>
                            {FREQUENCY_LABEL[rule.frequency]} · {t('recurring.next', { date: formatDate(rule.nextRun) })}
                          </Text>
                        </View>
                        <Text style={[styles.ruleAmount, { color: c }]}>{formatCurrency(rule.amount)}</Text>
                        <TouchableOpacity
                          testID={`delete-recurring-${rule.id}`}
                          onPress={() => handleDelete(rule.id)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={styles.trashBtn}
                        >
                          <Icon name="trash-can-outline" size={18} color={theme.colors.textMuted} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>

              <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
                <Icon name="plus" size={18} color="#000" />
                <Text style={styles.addLabel}>{t('recurring.add')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                  placeholder={t('recurring.amountPlaceholder')}
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
                  placeholder={t('recurring.notePlaceholder')}
                  placeholderTextColor={theme.colors.textMuted}
                  value={note}
                  onChangeText={setNote}
                  maxLength={120}
                  selectionColor={activeColor}
                />
              </View>

              {/* Frequency pills */}
              <Text style={styles.fieldLabel}>{t('recurring.frequency')}</Text>
              <View style={styles.freqRow}>
                {FREQUENCIES.map((f) => {
                  const active = frequency === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.freqChip, active && { borderColor: activeColor, backgroundColor: `${activeColor}18` }]}
                      onPress={() => setFrequency(f.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.freqLabel, { color: active ? activeColor : theme.colors.textMuted }]}>{t(f.labelKey)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {error && (
                <View style={styles.errorRow}>
                  <Icon name="alert-circle-outline" size={13} color="#FF2D78" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancel} onPress={() => { setView('list'); resetForm(); }} activeOpacity={0.7}>
                  <Text style={styles.cancelLabel}>{t('recurring.done')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.save} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
                  <Text style={styles.saveLabel}>{saving ? '…' : t('recurring.save')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
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
  title: { ...theme.typography.labelLarge, color: theme.colors.textPrimary, textAlign: 'center', letterSpacing: 2 },
  subtitle: { ...theme.typography.bodyMedium, color: theme.colors.textMuted, textAlign: 'center', marginBottom: theme.spacing.xs },
  list: { maxHeight: 380 },

  // List view
  empty: { alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.xxl },
  emptyText: { ...theme.typography.bodyLarge, color: theme.colors.textMuted },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    height: 56,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: theme.radius.full },
  ruleInfo: { flex: 1 },
  ruleLabel: { ...theme.typography.bodyLarge, color: theme.colors.textPrimary },
  ruleMeta: { ...theme.typography.labelSmall, color: theme.colors.textMuted, marginTop: 2 },
  ruleAmount: { ...theme.typography.headingMedium },
  trashBtn: { paddingLeft: theme.spacing.xs },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: '#00FF87',
    marginTop: theme.spacing.xs,
  },
  addLabel: { ...theme.typography.headingMedium, color: '#000000' },

  // Form view
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
  fieldLabel: { ...theme.typography.labelLarge, color: theme.colors.textMuted, marginBottom: theme.spacing.xs },
  freqRow: { flexDirection: 'row', gap: theme.spacing.sm },
  freqChip: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  freqLabel: { ...theme.typography.labelLarge },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginTop: theme.spacing.sm },
  errorText: { ...theme.typography.bodyMedium, color: '#FF2D78' },
  actions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  cancel: {
    flex: 1, height: 48, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelLabel: { ...theme.typography.headingMedium, color: theme.colors.textMuted },
  save: { flex: 2, height: 48, borderRadius: theme.radius.md, backgroundColor: '#00FF87', alignItems: 'center', justifyContent: 'center' },
  saveLabel: { ...theme.typography.headingMedium, color: '#000000' },
});
