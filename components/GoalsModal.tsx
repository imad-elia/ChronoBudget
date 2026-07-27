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
import type { Goal } from '../store/useBudgetStore';
import { theme } from '../theme';
import { formatCurrency } from '../lib/format';
import { t } from '../lib/i18n';
import { ProgressBar } from './ProgressBar';
import {
  fetchGoals,
  insertGoal,
  updateGoal,
  deleteGoal,
} from '../db/database';

type ModalView = 'list' | 'form';

async function refreshGoals() {
  useBudgetStore.getState().setGoals(await fetchGoals());
}

export function GoalsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const goals = useBudgetStore((s) => s.goals);
  const symbol = useBudgetStore((s) => s.symbol);

  const [view, setView] = useState<ModalView>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setEditingId(null);
    setName('');
    setTargetAmount('');
    setError(null);
  }

  function openAdd() {
    resetForm();
    setView('form');
  }

  function openEdit(goal: Goal) {
    setEditingId(goal.id);
    setName(goal.name);
    setTargetAmount(String(goal.targetAmount));
    setError(null);
    setView('form');
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) { setError(t('goals.namePlaceholder')); return; }
    const target = parseFloat(targetAmount.replace(',', '.'));
    if (isNaN(target)) { setError(t('input.errAmount')); return; }
    if (target <= 0) { setError(t('input.errPositive')); return; }

    setSaving(true);
    try {
      if (editingId != null) {
        await updateGoal(editingId, trimmedName, target);
      } else {
        await insertGoal(trimmedName, target);
      }
      await refreshGoals();
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
    const deleted = await deleteGoal(id);
    if (!deleted) {
      setError(t('goals.deleteBlocked'));
      return;
    }
    await refreshGoals();
    useBudgetStore.getState().triggerRefresh();
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
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('goals.title').toUpperCase()}</Text>
          <Text style={styles.subtitle}>{t('goals.subtitle')}</Text>

          {view === 'list' && (
            <>
              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {goals.length === 0 ? (
                  <View style={styles.empty}>
                    <Icon name="piggy-bank-outline" size={34} color={theme.colors.textMuted} />
                    <Text style={styles.emptyText}>{t('goals.empty')}</Text>
                  </View>
                ) : (
                  goals.map((goal) => {
                    const ratio = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
                    return (
                      <TouchableOpacity
                        key={goal.id}
                        style={styles.row}
                        onPress={() => openEdit(goal)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.rowTop}>
                          <Icon name="piggy-bank-outline" size={16} color={theme.colors.textSecondary} />
                          <Text style={styles.rowName} numberOfLines={1}>{goal.name}</Text>
                          <Text style={styles.rowAmount}>
                            {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                          </Text>
                          <TouchableOpacity
                            testID={`delete-goal-${goal.id}`}
                            onPress={() => handleDelete(goal.id)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={styles.trashBtn}
                          >
                            <Icon name="trash-can-outline" size={18} color={theme.colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                        <ProgressBar ratio={ratio} color="#00BFFF" />
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>

              {error && (
                <View style={styles.errorRow}>
                  <Icon name="alert-circle-outline" size={13} color="#FF2D78" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.actions}>
                <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
                  <Icon name="plus" size={18} color="#000" />
                  <Text style={styles.addLabel}>{t('goals.add')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {view === 'form' && (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.inputWrap}>
                <Icon name="piggy-bank-outline" size={15} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('goals.namePlaceholder')}
                  placeholderTextColor={theme.colors.textMuted}
                  value={name}
                  onChangeText={(v) => { setName(v); setError(null); }}
                  maxLength={40}
                  selectionColor="#00FF87"
                />
              </View>

              <View style={styles.inputWrap}>
                <Text style={styles.prefix}>{symbol}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('goals.targetPlaceholder')}
                  placeholderTextColor={theme.colors.textMuted}
                  value={targetAmount}
                  onChangeText={(v) => { setTargetAmount(v); setError(null); }}
                  keyboardType="decimal-pad"
                  maxLength={12}
                  selectionColor="#00FF87"
                />
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
                  <Text style={styles.saveLabel}>{saving ? '…' : t('goals.save')}</Text>
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

  empty: { alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.xxl },
  emptyText: { ...theme.typography.bodyLarge, color: theme.colors.textMuted },
  row: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  rowName: { ...theme.typography.bodyLarge, color: theme.colors.textPrimary, flex: 1 },
  rowAmount: { ...theme.typography.bodyMedium, color: theme.colors.textSecondary },
  trashBtn: { paddingLeft: theme.spacing.xs },

  actions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: '#00FF87',
  },
  addLabel: { ...theme.typography.headingMedium, color: '#000000' },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    height: 48,
    marginBottom: theme.spacing.sm,
  },
  inputIcon: { marginRight: theme.spacing.sm },
  prefix: { ...theme.typography.headingMedium, color: theme.colors.textPrimary, marginRight: theme.spacing.xs },
  input: { flex: 1, ...theme.typography.bodyLarge, color: theme.colors.textPrimary },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginTop: theme.spacing.sm },
  errorText: { ...theme.typography.bodyMedium, color: '#FF2D78' },
  cancel: {
    flex: 1, height: 48, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelLabel: { ...theme.typography.headingMedium, color: theme.colors.textMuted },
  save: { flex: 2, height: 48, borderRadius: theme.radius.md, backgroundColor: '#00FF87', alignItems: 'center', justifyContent: 'center' },
  saveLabel: { ...theme.typography.headingMedium, color: '#000000' },
});
