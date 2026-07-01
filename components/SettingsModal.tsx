import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useBudgetStore, COUNTRIES } from '../store/useBudgetStore';
import { theme } from '../theme';
import { t } from '../lib/i18n';

export function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const country = useBudgetStore((s) => s.country);
  const setCountry = useBudgetStore((s) => s.setCountry);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject as any} activeOpacity={1} onPress={onClose} />
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

          <TouchableOpacity style={styles.done} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.doneLabel}>{t('settings.done')}</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  list: { maxHeight: 340 },
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
