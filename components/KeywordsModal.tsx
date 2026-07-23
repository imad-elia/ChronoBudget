import { useState, useEffect, useCallback } from 'react';
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
import type { Category } from '../store/useBudgetStore';
import { theme } from '../theme';
import { SUBCATEGORIES } from '../constants/subcategories';
import { t } from '../lib/i18n';
import { learnKeyword, deleteLearnedKeyword } from '../db/database';

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
  visible: boolean;
  onClose: () => void;
}

export function KeywordsModal({ visible, onClose }: Props) {
  const learnedKeywords = useBudgetStore((s) => s.learnedKeywords);
  const loadLearnedKeywords = useBudgetStore((s) => s.loadLearnedKeywords);

  const [adding, setAdding] = useState(false);
  const [word, setWord] = useState('');
  const [category, setCategory] = useState<Category>('needs');
  const [subcategory, setSubcategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeColor = colorFor(category);
  const subcats = SUBCATEGORIES[category];
  const entries = Object.entries(learnedKeywords).sort(([a], [b]) => a.localeCompare(b));

  useEffect(() => {
    if (visible) {
      loadLearnedKeywords();
      setAdding(false);
    }
  }, [visible, loadLearnedKeywords]);

  const resetForm = useCallback(() => {
    setWord('');
    setCategory('needs');
    setSubcategory('');
    setError(null);
    setAdding(false);
  }, []);

  function selectCategory(cat: Category) {
    setCategory(cat);
    setSubcategory('');
  }

  function startEdit(key: string) {
    const entry = learnedKeywords[key];
    setWord(key);
    setCategory(entry.category);
    setSubcategory(entry.subcategory);
    setError(null);
    setAdding(true);
  }

  async function handleSave() {
    const cleanWord = word.trim().toLowerCase();
    if (!cleanWord) { setError(t('keywords.errWord')); return; }
    if (!subcategory) { setError(t('keywords.errSubcategory')); return; }

    setSaving(true);
    try {
      await learnKeyword(cleanWord, category, subcategory);
      await loadLearnedKeywords();
      resetForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(key: string) {
    await deleteLearnedKeyword(key);
    await loadLearnedKeywords();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill as any} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('keywords.title').toUpperCase()}</Text>
          <Text style={styles.subtitle}>{t('keywords.hint')}</Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {entries.length === 0 && !adding && (
              <Text style={styles.empty}>{t('keywords.empty')}</Text>
            )}

            {!adding && entries.map(([key, entry]) => {
              const color = colorFor(entry.category);
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.row}
                  onPress={() => startEdit(key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowWord}>{key}</Text>
                    <Text style={[styles.rowSub, { color }]}>{CATEGORY_LABEL[entry.category]} · {entry.subcategory}</Text>
                  </View>
                  <TouchableOpacity
                    testID={`delete-keyword-${key}`}
                    onPress={() => handleDelete(key)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="close" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}

            {adding && (
              <View style={styles.form}>
                <View style={[styles.inputWrap, { borderColor: word ? `${activeColor}60` : theme.colors.border }]}>
                  <Icon name="text" size={15} color={theme.colors.textMuted} style={styles.wordIcon} />
                  <TextInput
                    style={styles.wordInput}
                    placeholder={t('keywords.wordPlaceholder')}
                    placeholderTextColor={theme.colors.textMuted}
                    value={word}
                    onChangeText={(v) => { setWord(v); setError(null); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={40}
                    selectionColor={activeColor}
                  />
                </View>

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
                        onPress={() => { setSubcategory(s); setError(null); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.subLabel, { color: active ? activeColor : theme.colors.textMuted }]}>{s}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {error && (
                  <View style={styles.errorRow}>
                    <Icon name="alert-circle-outline" size={13} color="#FF2D78" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.actions}>
                  <TouchableOpacity style={styles.cancel} onPress={resetForm} activeOpacity={0.7}>
                    <Text style={styles.cancelLabel}>{t('keywords.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.save} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
                    <Text style={styles.saveLabel}>{saving ? '…' : t('keywords.save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {!adding && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setAdding(true)} activeOpacity={0.8}>
              <Icon name="plus" size={16} color="#00FF87" />
              <Text style={styles.addLabel}>{t('keywords.add')}</Text>
            </TouchableOpacity>
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
  list: { maxHeight: 360 },
  empty: { ...theme.typography.bodyMedium, color: theme.colors.textMuted, textAlign: 'center', paddingVertical: theme.spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    height: 52,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: theme.radius.full },
  rowText: { flex: 1 },
  rowWord: { ...theme.typography.bodyLarge, color: theme.colors.textPrimary },
  rowSub: { ...theme.typography.labelSmall },
  form: { gap: theme.spacing.sm },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    height: 48,
  },
  wordIcon: { marginRight: theme.spacing.sm },
  wordInput: { flex: 1, ...theme.typography.bodyLarge, color: theme.colors.textPrimary },
  categoryRow: { flexDirection: 'row', gap: theme.spacing.sm },
  categoryChip: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  categoryLabel: { ...theme.typography.labelLarge, textTransform: 'uppercase' },
  subRow: { gap: theme.spacing.sm, paddingVertical: 2 },
  subChip: {
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  subLabel: { ...theme.typography.labelSmall },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  errorText: { ...theme.typography.bodyMedium, color: '#FF2D78' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  cancel: {
    flex: 1, height: 48, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelLabel: { ...theme.typography.headingMedium, color: theme.colors.textMuted },
  save: { flex: 2, height: 48, borderRadius: theme.radius.md, backgroundColor: '#00FF87', alignItems: 'center', justifyContent: 'center' },
  saveLabel: { ...theme.typography.headingMedium, color: '#000000' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    height: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#00FF8740',
    marginTop: theme.spacing.xs,
  },
  addLabel: { ...theme.typography.headingMedium, color: '#00FF87' },
});
