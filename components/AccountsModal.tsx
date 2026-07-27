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
import type { Account } from '../store/useBudgetStore';
import { theme } from '../theme';
import { formatCurrency } from '../lib/format';
import { t } from '../lib/i18n';
import {
  fetchAccounts,
  insertAccount,
  updateAccount,
  deleteAccount,
  insertTransfer,
} from '../db/database';

type ModalView = 'list' | 'form' | 'transfer';

async function refreshAccounts() {
  useBudgetStore.getState().setAccounts(await fetchAccounts());
}

export function AccountsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const accounts = useBudgetStore((s) => s.accounts);
  const symbol = useBudgetStore((s) => s.symbol);

  const [view, setView] = useState<ModalView>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');

  function resetForm() {
    setEditingId(null);
    setName('');
    setBalance('');
    setError(null);
  }

  function resetTransfer() {
    setFromId(accounts[0]?.id ?? null);
    setToId(accounts[1]?.id ?? null);
    setTransferAmount('');
    setTransferNote('');
    setError(null);
  }

  function openAdd() {
    resetForm();
    setView('form');
  }

  function openEdit(account: Account) {
    setEditingId(account.id);
    setName(account.name);
    setBalance(String(account.balance));
    setError(null);
    setView('form');
  }

  function openTransfer() {
    resetTransfer();
    setView('transfer');
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) { setError(t('accounts.namePlaceholder')); return; }

    setSaving(true);
    try {
      if (editingId != null) {
        await updateAccount(editingId, trimmedName);
      } else {
        const bal = parseFloat(balance.replace(',', '.'));
        await insertAccount(trimmedName, isNaN(bal) ? 0 : bal);
      }
      await refreshAccounts();
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
    const deleted = await deleteAccount(id);
    if (!deleted) {
      setError(t('accounts.deleteBlocked'));
      return;
    }
    await refreshAccounts();
    useBudgetStore.getState().triggerRefresh();
  }

  async function handleTransfer() {
    if (fromId == null || toId == null || fromId === toId) {
      setError(t('accounts.errSameAccount'));
      return;
    }
    const amt = parseFloat(transferAmount.replace(',', '.'));
    if (isNaN(amt)) { setError(t('input.errAmount')); return; }
    if (amt <= 0) { setError(t('input.errPositive')); return; }

    setSaving(true);
    try {
      await insertTransfer(fromId, toId, amt, transferNote);
      await refreshAccounts();
      useBudgetStore.getState().triggerRefresh();
      resetTransfer();
      setView('list');
    } catch {
      setError(t('input.errSave'));
    } finally {
      setSaving(false);
    }
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
          <Text style={styles.title}>{t('accounts.title').toUpperCase()}</Text>
          <Text style={styles.subtitle}>{t('accounts.subtitle')}</Text>

          {view === 'list' && (
            <>
              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {accounts.length === 0 ? (
                  <View style={styles.empty}>
                    <Icon name="bank-outline" size={34} color={theme.colors.textMuted} />
                    <Text style={styles.emptyText}>{t('accounts.empty')}</Text>
                  </View>
                ) : (
                  accounts.map((account) => (
                    <TouchableOpacity
                      key={account.id}
                      style={styles.row}
                      onPress={() => openEdit(account)}
                      activeOpacity={0.7}
                    >
                      <Icon name="bank-outline" size={16} color={theme.colors.textSecondary} />
                      <Text style={styles.rowName} numberOfLines={1}>{account.name}</Text>
                      <Text style={[styles.rowBalance, account.balance < 0 && styles.rowBalanceNegative]}>
                        {formatCurrency(account.balance)}
                      </Text>
                      <TouchableOpacity
                        testID={`delete-account-${account.id}`}
                        onPress={() => handleDelete(account.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={styles.trashBtn}
                      >
                        <Icon name="trash-can-outline" size={18} color={theme.colors.textMuted} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>

              {error && (
                <View style={styles.errorRow}>
                  <Icon name="alert-circle-outline" size={13} color="#FF2D78" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.actions}>
                {accounts.length >= 2 && (
                  <TouchableOpacity style={styles.transferBtn} onPress={openTransfer} activeOpacity={0.8}>
                    <Icon name="swap-horizontal" size={18} color={theme.colors.textPrimary} />
                    <Text style={styles.transferLabel}>{t('accounts.transfer')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
                  <Icon name="plus" size={18} color="#000" />
                  <Text style={styles.addLabel}>{t('accounts.add')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {view === 'form' && (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.inputWrap}>
                <Icon name="bank-outline" size={15} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('accounts.namePlaceholder')}
                  placeholderTextColor={theme.colors.textMuted}
                  value={name}
                  onChangeText={(v) => { setName(v); setError(null); }}
                  maxLength={40}
                  selectionColor="#00FF87"
                />
              </View>

              {editingId == null && (
                <View style={styles.inputWrap}>
                  <Text style={styles.prefix}>{symbol}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t('accounts.balancePlaceholder')}
                    placeholderTextColor={theme.colors.textMuted}
                    value={balance}
                    onChangeText={setBalance}
                    keyboardType="decimal-pad"
                    maxLength={12}
                    selectionColor="#00FF87"
                  />
                </View>
              )}

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
                  <Text style={styles.saveLabel}>{saving ? '…' : t('accounts.save')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {view === 'transfer' && (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>{t('accounts.from')}</Text>
              <View style={styles.pickerRow}>
                {accounts.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.pickerChip, fromId === a.id && styles.pickerChipActive]}
                    onPress={() => { setFromId(a.id); setError(null); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerLabel, fromId === a.id && styles.pickerLabelActive]} numberOfLines={1}>{a.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>{t('accounts.to')}</Text>
              <View style={styles.pickerRow}>
                {accounts.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.pickerChip, toId === a.id && styles.pickerChipActive]}
                    onPress={() => { setToId(a.id); setError(null); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerLabel, toId === a.id && styles.pickerLabelActive]} numberOfLines={1}>{a.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.inputWrap}>
                <Text style={styles.prefix}>{symbol}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('recurring.amountPlaceholder')}
                  placeholderTextColor={theme.colors.textMuted}
                  value={transferAmount}
                  onChangeText={(v) => { setTransferAmount(v); setError(null); }}
                  keyboardType="decimal-pad"
                  maxLength={12}
                  selectionColor="#00FF87"
                />
              </View>

              <View style={styles.inputWrap}>
                <Icon name="pencil-outline" size={15} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('accounts.notePlaceholder')}
                  placeholderTextColor={theme.colors.textMuted}
                  value={transferNote}
                  onChangeText={setTransferNote}
                  maxLength={120}
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
                <TouchableOpacity style={styles.cancel} onPress={() => { setView('list'); resetTransfer(); }} activeOpacity={0.7}>
                  <Text style={styles.cancelLabel}>{t('recurring.done')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.save} onPress={handleTransfer} disabled={saving} activeOpacity={0.8}>
                  <Text style={styles.saveLabel}>{saving ? '…' : t('accounts.transfer')}</Text>
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
  rowName: { ...theme.typography.bodyLarge, color: theme.colors.textPrimary, flex: 1 },
  rowBalance: { ...theme.typography.headingMedium, color: theme.colors.textSecondary },
  rowBalanceNegative: { color: '#FF2D78' },
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
  transferBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  transferLabel: { ...theme.typography.headingMedium, color: theme.colors.textPrimary },

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

  fieldLabel: { ...theme.typography.labelLarge, color: theme.colors.textMuted, marginBottom: theme.spacing.xs },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  pickerChip: {
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pickerChipActive: { borderColor: '#00FF87', backgroundColor: 'rgba(0,255,135,0.08)' },
  pickerLabel: { ...theme.typography.labelSmall, color: theme.colors.textMuted },
  pickerLabelActive: { color: theme.colors.textPrimary },

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
