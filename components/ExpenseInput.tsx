import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  type TextInput as RNTextInput,
} from 'react-native';
import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { insertTransaction } from '../db/database';
import { useBudgetStore } from '../store/useBudgetStore';
import type { Category } from '../store/useBudgetStore';

const CATEGORIES: { id: Category; label: string; color: string }[] = [
  { id: 'needs', label: 'Needs', color: '#00FF87' },
  { id: 'wants', label: 'Wants', color: '#FF2D78' },
  { id: 'savings', label: 'Savings', color: '#00BFFF' },
];

export function ExpenseInput() {
  const { styles } = useStyles(stylesheet);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<Category>('needs');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const noteRef = useRef<RNTextInput>(null);

  const triggerRefresh = useBudgetStore((s) => s.triggerRefresh);
  const activeColor = CATEGORIES.find((c) => c.id === category)!.color;

  function validate(): string | null {
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!amount.trim() || isNaN(parsed)) return 'Enter a valid amount.';
    if (parsed <= 0) return 'Amount must be greater than zero.';
    if (parsed > 9_999_999) return 'Amount is too large.';
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError(null);
    setLoading(true);
    try {
      await insertTransaction(parseFloat(amount.replace(',', '.')), category, note);
      triggerRefresh();
      setAmount('');
      setNote('');
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.categoryRow}>
        {CATEGORIES.map((cat) => {
          const active = category === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, active && { borderColor: cat.color, backgroundColor: `${cat.color}18` }]}
              onPress={() => { setCategory(cat.id); setError(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.categoryLabel, { color: active ? cat.color : '#4A5168' }]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.inputWrapper, error ? styles.inputError : undefined, { borderColor: error ? '#FF2D78' : amount ? `${activeColor}60` : 'rgba(255,255,255,0.06)' }]}>
        <Text style={[styles.currencySymbol, { color: activeColor }]}>$</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="0.00"
          placeholderTextColor="#4A5168"
          value={amount}
          onChangeText={(v) => { setAmount(v); setError(null); }}
          keyboardType="decimal-pad"
          returnKeyType="next"
          onSubmitEditing={() => noteRef.current?.focus()}
          maxLength={12}
          selectionColor={activeColor}
        />
      </View>

      <View style={[styles.inputWrapper, { borderColor: note ? `${activeColor}40` : 'rgba(255,255,255,0.06)' }]}>
        <Icon name="pencil-outline" size={16} color="#4A5168" style={styles.noteIcon} />
        <TextInput
          ref={noteRef}
          style={styles.noteInput}
          placeholder="Add a note (optional)"
          placeholderTextColor="#4A5168"
          value={note}
          onChangeText={setNote}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
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

      <TouchableOpacity onPress={handleSubmit} disabled={loading} activeOpacity={0.8} style={styles.submitOuter}>
        <LinearGradient
          colors={[`${activeColor}CC`, `${activeColor}88`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.submitGradient}
        >
          {loading
            ? <ActivityIndicator color="#000" size="small" />
            : (<><Icon name="plus" size={18} color="#000" /><Text style={styles.submitLabel}>Add Transaction</Text></>)
          }
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    gap: theme.spacing.sm,
    width: '100%',
    ...(Platform.OS === 'web' ? { maxWidth: 480 } : {}),
  },
  categoryRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  categoryChip: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    height: 52,
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
    // @ts-ignore — web only
    outlineStyle: Platform.OS === 'web' ? 'none' : undefined,
  },
  noteIcon: { marginRight: theme.spacing.sm },
  noteInput: {
    flex: 1,
    ...theme.typography.bodyLarge,
    color: theme.colors.textPrimary,
    // @ts-ignore — web only
    outlineStyle: Platform.OS === 'web' ? 'none' : undefined,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  errorText: { ...theme.typography.bodyMedium, color: '#FF2D78' },
  submitOuter: { borderRadius: theme.radius.md, overflow: 'hidden', marginTop: theme.spacing.xs },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 52,
  },
  submitLabel: { ...theme.typography.headingMedium, color: '#000000' },
}));
