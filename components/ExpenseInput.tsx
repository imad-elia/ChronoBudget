import { useState, useRef, useEffect, useMemo } from 'react';
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
import { insertTransaction, learnKeyword } from '../db/database';
import { getSetting, setSetting } from '../db/database';
import { useBudgetStore } from '../store/useBudgetStore';
import type { Category } from '../store/useBudgetStore';
import { theme } from '../theme';
import { SUBCATEGORIES } from '../constants/subcategories';
import { parseEntry, detectCategory, learnKey } from '../lib/detectCategory';
import { t } from '../lib/i18n';

type InputMode = 'fast' | 'detailed';

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

export function ExpenseInput() {
  const [mode, setMode] = useState<InputMode>('fast');
  const [raw, setRaw] = useState('');          // fast-mode smart field
  const [amount, setAmount] = useState('');    // detailed-mode amount field
  const [note, setNote] = useState('');        // detailed-mode note
  const [category, setCategory] = useState<Category>('needs');
  const [subcategory, setSubcategory] = useState('');
  const [customSubcategory, setCustomSubcategory] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [overridden, setOverridden] = useState(false);
  const [showOverride, setShowOverride] = useState(false); // fast-mode override panel
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const rawRef = useRef<RNTextInput>(null);
  const customRef = useRef<RNTextInput>(null);
  const noteRef = useRef<RNTextInput>(null);

  const triggerRefresh = useBudgetStore((s) => s.triggerRefresh);
  const learned = useBudgetStore((s) => s.learnedKeywords);
  const symbol = useBudgetStore((s) => s.symbol);
  const activeColor = CATEGORIES.find((c) => c.id === category)!.color;

  // Description that feeds the classifier: parsed out of the smart field in
  // Fast mode, or the note in Detailed mode.
  const description = mode === 'fast' ? parseEntry(raw).description : note;
  const detection = useMemo(
    () => detectCategory(description, learned),
    [description, learned],
  );

  // Auto-apply detection unless the user has manually overridden. Fast mode
  // always follows the guess (even a no-match custom subcategory); Detailed mode
  // only auto-selects on a real keyword match so it never fights manual picks.
  useEffect(() => {
    if (overridden) return;
    if (mode === 'fast') {
      setCategory(detection.category);
      setSubcategory(detection.subcategory);
    } else if (detection.matched) {
      setCategory(detection.category);
      setSubcategory(detection.subcategory);
    }
  }, [detection, overridden, mode]);

  // Load persisted mode on mount
  useEffect(() => {
    getSetting('input_mode').then((val) => {
      if (val === 'fast' || val === 'detailed') setMode(val);
    });
  }, []);

  function resetFields() {
    setRaw('');
    setAmount('');
    setNote('');
    setSubcategory('');
    setCustomSubcategory('');
    setShowCustomInput(false);
    setOverridden(false);
    setShowOverride(false);
  }

  function switchMode(m: InputMode) {
    setMode(m);
    setSetting('input_mode', m);
    setSubcategory('');
    setCustomSubcategory('');
    setShowCustomInput(false);
    setOverridden(false);
    setShowOverride(false);
    setError(null);
  }

  function selectCategory(cat: Category) {
    setCategory(cat);
    setSubcategory('');
    setCustomSubcategory('');
    setShowCustomInput(false);
    setOverridden(true);
    setError(null);
  }

  function selectSubcategory(s: string) {
    setOverridden(true);
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

  function currentAmount(): number | null {
    if (mode === 'fast') return parseEntry(raw).amount;
    const p = parseFloat(amount.replace(',', '.'));
    return isNaN(p) ? null : p;
  }

  function validate(): string | null {
    const a = currentAmount();
    if (a === null) return t('input.errAmount');
    if (a <= 0) return t('input.errPositive');
    if (a > 9_999_999) return t('input.errTooLarge');
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setLoading(true);

    const amt = currentAmount()!;
    const resolvedSub = subcategory === '__custom__' ? customSubcategory.trim() : subcategory;

    try {
      await insertTransaction(
        amt,
        category,
        resolvedSub,
        mode === 'detailed' ? note : '',
      );

      // Learn from corrections and confirmed no-matches so the guess improves
      // next time. Skip when the seed dictionary already got it right untouched.
      if (overridden || !detection.matched) {
        const key = learnKey(description);
        if (key) {
          await learnKeyword(key, category, resolvedSub);
          await useBudgetStore.getState().loadLearnedKeywords();
        }
      }

      triggerRefresh();
      resetFields();
    } catch {
      setError(t('input.errSave'));
    } finally {
      setLoading(false);
    }
  }

  const subcats = SUBCATEGORIES[category];
  const hasEntry = mode === 'fast' ? raw.trim().length > 0 : note.trim().length > 0;
  const subDisplay =
    subcategory === '__custom__'
      ? (customSubcategory.trim() || t('input.custom'))
      : subcategory;

  const renderCategoryChips = () => (
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
  );

  const renderSubcategoryChips = () => (
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
  );

  // Live "goes to" preview shown once the user has typed something.
  const renderPreview = () => {
    if (!hasEntry) return null;
    return (
      <View style={styles.previewRow}>
        <Icon name="arrow-right-thin" size={15} color={activeColor} />
        <Text style={[styles.previewCategory, { color: activeColor }]}>{CATEGORY_LABEL[category]}</Text>
        {subDisplay ? (
          <>
            <Text style={styles.previewDot}>·</Text>
            <Text style={styles.previewSub}>{subDisplay}</Text>
          </>
        ) : null}
        {mode === 'fast' && (
          <TouchableOpacity
            style={styles.changeBtn}
            onPress={() => setShowOverride((v) => !v)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="pencil-outline" size={12} color={theme.colors.textMuted} />
            <Text style={styles.changeLabel}>{t('input.change')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

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
          <Text style={[styles.modeLabel, { color: mode === 'fast' ? activeColor : theme.colors.textMuted }]}>{t('input.fast')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeChip, mode === 'detailed' && { backgroundColor: `${activeColor}20`, borderColor: activeColor }]}
          onPress={() => switchMode('detailed')}
          activeOpacity={0.7}
        >
          <Icon name="format-list-bulleted" size={13} color={mode === 'detailed' ? activeColor : theme.colors.textMuted} />
          <Text style={[styles.modeLabel, { color: mode === 'detailed' ? activeColor : theme.colors.textMuted }]}>{t('input.detailed')}</Text>
        </TouchableOpacity>
      </View>

      {mode === 'fast' ? (
        <>
          {/* Smart single field: "15 coffee" */}
          <View style={[
            styles.inputWrapper,
            error ? styles.inputError : undefined,
            { borderColor: error ? '#FF2D78' : raw ? `${activeColor}60` : theme.colors.border },
          ]}>
            <Text style={[styles.currencySymbol, { color: activeColor }]}>⚡</Text>
            <TextInput
              ref={rawRef}
              style={styles.smartInput}
              placeholder={t('input.smartPlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
              value={raw}
              onChangeText={(v) => { setRaw(v); setError(null); }}
              returnKeyType="done"
              maxLength={60}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleSubmit}
              selectionColor={activeColor}
            />
          </View>

          {renderPreview()}

          {/* Override panel (revealed via "change") */}
          {showOverride && (
            <>
              {renderCategoryChips()}
              {renderSubcategoryChips()}
              {showCustomInput && (
                <View style={[styles.inputWrapper, { borderColor: `${activeColor}40` }]}>
                  <Icon name="tag-outline" size={15} color={theme.colors.textMuted} style={styles.noteIcon} />
                  <TextInput
                    ref={customRef}
                    style={styles.noteInput}
                    placeholder={t('input.subcategoryPlaceholder')}
                    placeholderTextColor={theme.colors.textMuted}
                    value={customSubcategory}
                    onChangeText={setCustomSubcategory}
                    returnKeyType="done"
                    maxLength={40}
                    selectionColor={activeColor}
                  />
                </View>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {/* Category chips */}
          {renderCategoryChips()}

          {/* Amount input */}
          <View style={[
            styles.inputWrapper,
            error ? styles.inputError : undefined,
            { borderColor: error ? '#FF2D78' : amount ? `${activeColor}60` : theme.colors.border },
          ]}>
            <Text style={[styles.currencySymbol, { color: activeColor }]}>{symbol}</Text>
            <TextInput
              style={styles.amountInput}
              placeholder={t('input.amountPlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
              value={amount}
              onChangeText={(v) => { setAmount(v); setError(null); }}
              keyboardType="decimal-pad"
              returnKeyType="done"
              maxLength={12}
              selectionColor={activeColor}
            />
          </View>

          {/* Subcategory chips */}
          {renderSubcategoryChips()}

          {/* Custom subcategory input */}
          {showCustomInput && (
            <View style={[styles.inputWrapper, { borderColor: `${activeColor}40` }]}>
              <Icon name="tag-outline" size={15} color={theme.colors.textMuted} style={styles.noteIcon} />
              <TextInput
                ref={customRef}
                style={styles.noteInput}
                placeholder={t('input.subcategoryPlaceholder')}
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

          {/* Note input (also feeds auto-suggest) */}
          <View style={[styles.inputWrapper, { borderColor: note ? `${activeColor}40` : theme.colors.border }]}>
            <Icon name="pencil-outline" size={15} color={theme.colors.textMuted} style={styles.noteIcon} />
            <TextInput
              ref={noteRef}
              style={styles.noteInput}
              placeholder={t('input.notePlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
              value={note}
              onChangeText={(v) => { setNote(v); setError(null); }}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              maxLength={120}
              selectionColor={activeColor}
            />
          </View>

          {renderPreview()}
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
            : <><Icon name="plus" size={18} color="#000" /><Text style={styles.submitLabel}>{t('input.add')}</Text></>
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
  smartInput: {
    flex: 1,
    ...theme.typography.bodyLarge,
    color: theme.colors.textPrimary,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
  },
  previewCategory: {
    ...theme.typography.labelLarge,
    textTransform: 'uppercase',
  },
  previewDot: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textMuted,
  },
  previewSub: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  changeLabel: {
    ...theme.typography.labelSmall,
    color: theme.colors.textMuted,
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
