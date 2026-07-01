import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  type TextInput as RNTextInput,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { insertTransaction } from '../db/database';
import { getSetting, setSetting } from '../db/database';
import { useBudgetStore } from '../store/useBudgetStore';
import type { Category } from '../store/useBudgetStore';
import { theme } from '../theme';
import { SUBCATEGORIES } from '../constants/subcategories';

type InputMode = 'fast' | 'detailed';

const CATEGORIES: { id: Category; label: string; color: string }[] = [
  { id: 'needs',   label: 'Needs',   color: '#00FF87' },
  { id: 'wants',   label: 'Wants',   color: '#FF2D78' },
  { id: 'savings', label: 'Savings', color: '#00BFFF' },
];

export function ExpenseInput() {
  const [mode, setMode] = useState<InputMode>('fast');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('needs');
  const [subcategory, setSubcategory] = useState('');
  const [customSubcategory, setCustomSubcategory] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const amountRef = useRef<RNTextInput>(null);
  const customRef = useRef<RNTextInput>(null);
  const noteRef = useRef<RNTextInput>(null);

  const triggerRefresh = useBudgetStore((s) => s.triggerRefresh);
  const activeColor = CATEGORIES.find((c) => c.id === category)!.color;

  // Load persisted mode on mount
  useEffect(() => {
    getSetting('input_mode').then((val) => {
      if (val === 'fast' || val === 'detailed') setMode(val);
    });
  }, []);

  function switchMode(m: InputMode) {
    setMode(m);
    setSetting('input_mode', m);
    setSubcategory('');
    setCustomSubcategory('');
    setShowCustomInput(false);
    setError(null);
  }

  function selectCategory(cat: Category) {
    setCategory(cat);
    setSubcategory('');
    setCustomSubcategory('');
    setShowCustomInput(false);
    setError(null);
  }

  function selectSubcategory(s: string) {
    if (s === '__custom__') {
      setSubcategory('__custom__');
      setShowCustomInput(true);
      setTimeout(() => customRef.current?.focus(), 80);
    } else {
      setSubcategory(s);
      setShowCustomInput(false);
      setCustomSubcategory('');
    }
  }

  function validate(): string | null {
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!amount.trim() || isNaN(parsed)) return 'Enter a valid amount.';
    if (parsed <= 0) return 'Amount must be greater than zero.';
    if (parsed > 9_999_999) return 'Amount is too large.';
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setLoading(true);

    const resolvedSub = subcategory === '__custom__' ? customSubcategory.trim() : subcategory;

    try {
      await insertTransaction(
        parseFloat(amount.replace(',', '.')),
        category,
        resolvedSub,
        mode === 'detailed' ? note : '',
      );
      triggerRefresh();
      setAmount('');
      setNote('');
      setSubcategory('');
      setCustomSubcategory('');
      setShowCustomInput(false);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const subcats = SUBCATEGORIES[category];

  return (
    <View style={styles.container}>
      {/* Mode toggle */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeChip, mode === 'fast' && { backgroundColor: `${activeColor}20`, borderColor: activeColor }]}
          onPress={() => switchMode('fast')}
          activeOpacity={0.7}
        >
          <Icon name="lightning-bolt" size={13} color={mode === 'fast' ? activeColor : theme.colors.textMuted} />
          <Text style={[styles.modeLabel, { color: mode === 'fast' ? activeColor : theme.colors.textMuted }]}>Fast</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeChip, mode === 'detailed' && { backgroundColor: `${activeColor}20`, borderColor: activeColor }]}
          onPress={() => switchMode('detailed')}
          activeOpacity={0.7}
        >
          <Icon name="format-list-bulleted" size={13} color={mode === 'detailed' ? activeColor : theme.colors.textMuted} />
          <Text style={[styles.modeLabel, { color: mode === 'detailed' ? activeColor : theme.colors.textMuted }]}>Detailed</Text>
        </TouchableOpacity>
      </View>

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
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Amount input */}
      <View style={[
        styles.inputWrapper,
        error ? styles.inputError : undefined,
        { borderColor: error ? '#FF2D78' : amount ? `${activeColor}60` : theme.colors.border },
      ]}>
        <Text style={[styles.currencySymbol, { color: activeColor }]}>$</Text>
        <TextInput
          ref={amountRef}
          style={styles.amountInput}
          placeholder="0.00"
          placeholderTextColor={theme.colors.textMuted}
          value={amount}
          onChangeText={(v) => { setAmount(v); setError(null); }}
          keyboardType="decimal-pad"
          returnKeyType="done"
          maxLength={12}
          selectionColor={activeColor}
        />
      </View>

      {/* Detailed-mode extras */}
      {mode === 'detailed' && (
        <>
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
            {/* Custom chip */}
            <TouchableOpacity
              style={[styles.subChip, subcategory === '__custom__' && { borderColor: activeColor, backgroundColor: `${activeColor}18` }]}
              onPress={() => selectSubcategory('__custom__')}
              activeOpacity={0.7}
            >
              <Icon name="plus" size={11} color={subcategory === '__custom__' ? activeColor : theme.colors.textMuted} />
              <Text style={[styles.subLabel, { color: subcategory === '__custom__' ? activeColor : theme.colors.textMuted }]}>Custom</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Custom subcategory input */}
          {showCustomInput && (
            <View style={[styles.inputWrapper, { borderColor: `${activeColor}40` }]}>
              <Icon name="tag-outline" size={15} color={theme.colors.textMuted} style={styles.noteIcon} />
              <TextInput
                ref={customRef}
                style={styles.noteInput}
                placeholder="Subcategory name"
                placeholderTextColor={theme.colors.textMuted}
                value={customSubcategory}
                onChangeText={setCustomSubcategory}
                returnKeyType="next"
                onSubmitEditing={() => noteRef.current?.focus()}
                maxLength={40}
                selectionColor={activeColor}
              />
            </View>
          )}

          {/* Note input */}
          <View style={[styles.inputWrapper, { borderColor: note ? `${activeColor}40` : theme.colors.border }]}>
            <Icon name="pencil-outline" size={15} color={theme.colors.textMuted} style={styles.noteIcon} />
            <TextInput
              ref={noteRef}
              style={styles.noteInput}
              placeholder="Add a note (optional)"
              placeholderTextColor={theme.colors.textMuted}
              value={note}
              onChangeText={setNote}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              maxLength={120}
              selectionColor={activeColor}
            />
          </View>
        </>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorRow}>
          <Icon name="alert-circle-outline" size={13} color="#FF2D78" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Submit */}
      <TouchableOpacity onPress={handleSubmit} disabled={loading} activeOpacity={0.8} style={styles.submitOuter}>
        <LinearGradient
          colors={[`${activeColor}CC`, `${activeColor}88`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.submitGradient}
        >
          {loading
            ? <ActivityIndicator color="#000" size="small" />
            : <><Icon name="plus" size={18} color="#000" /><Text style={styles.submitLabel}>Add</Text></>
          }
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
    width: '100%',
  },
  modeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modeLabel: {
    ...theme.typography.labelLarge,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  categoryChip: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  categoryLabel: {
    ...theme.typography.labelLarge,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    height: 48,
  },
  inputError: {
    backgroundColor: 'rgba(255,45,120,0.06)',
  },
  currencySymbol: {
    ...theme.typography.headingLarge,
    marginRight: theme.spacing.xs,
  },
  amountInput: {
    flex: 1,
    ...theme.typography.headingLarge,
    color: theme.colors.textPrimary,
  },
  subRow: {
    gap: theme.spacing.sm,
    paddingVertical: 2,
  },
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
  subLabel: {
    ...theme.typography.labelSmall,
  },
  noteIcon: { marginRight: theme.spacing.sm },
  noteInput: {
    flex: 1,
    ...theme.typography.bodyLarge,
    color: theme.colors.textPrimary,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  errorText: { ...theme.typography.bodyMedium, color: '#FF2D78' },
  submitOuter: { borderRadius: theme.radius.md, overflow: 'hidden' },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 48,
  },
  submitLabel: { ...theme.typography.headingMedium, color: '#000000' },
});
