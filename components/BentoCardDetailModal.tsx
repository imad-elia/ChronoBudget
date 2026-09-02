import type { MaterialCommunityIcons } from '@expo/vector-icons';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatCurrency } from '../lib/format';
import { t } from '../lib/i18n';
import { theme } from '../theme';
import { ProgressBar } from './ProgressBar';

interface BentoCardDetailModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  amount: number;
  limit?: number;
  balance?: number;
  /** Drives Limit/Balance math instead of `amount`, and (when provided) swaps
   *  the headline row for a Net saved / Deposited / Withdrawn breakdown — see
   *  the matching prop on BentoCard for the full rationale (Savings only). */
  consumption?: number;
}

/** Full-precision breakdown for one category, reached by tapping its BentoCard.
 *  The card itself abbreviates large amounts to avoid clipping; this sheet
 *  never abbreviates, since showing exact figures is its whole purpose. */
export function BentoCardDetailModal({ visible, onClose, title, icon, color, amount, limit, balance, consumption }: BentoCardDetailModalProps) {
  const spent = consumption ?? amount;

  const hasLimit = !!limit && limit > 0;
  const rawRatio = hasLimit ? spent / limit : 0;
  const isOverLimit = hasLimit && rawRatio > 1;

  const hasBalance = !!balance && balance > 0;
  const remaining = hasBalance ? balance - spent : 0;
  const isOverBalance = hasBalance && remaining < 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={[styles.iconRing, { borderColor: color, backgroundColor: `${color}18` }]}>
              <Icon name={icon} size={20} color={color} />
            </View>
            <Text style={[styles.title, { color }]}>{title}</Text>
          </View>

          {consumption !== undefined ? (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('card.netSaved')}</Text>
                <Text style={styles.rowValue}>{formatCurrency(amount)}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{t('card.deposited')}</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(amount + consumption)}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{t('card.withdrawn')}</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(consumption)}</Text>
              </View>
            </>
          ) : (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('dashboard.totalSpent')}</Text>
              <Text style={styles.rowValue}>{formatCurrency(amount)}</Text>
            </View>
          )}

          {hasLimit && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('card.limit')}</Text>
                <Text style={styles.rowValue}>{formatCurrency(limit)}</Text>
              </View>
              <ProgressBar ratio={rawRatio} color={color} showOverBadge={false} />
              <Text style={isOverLimit ? styles.overLine : styles.subLine}>
                {isOverLimit
                  ? `${t('card.overby')} ${formatCurrency(amount - limit)}`
                  : `${Math.round(rawRatio * 100)}% ${t('card.used').toLowerCase()}`}
              </Text>
            </>
          )}

          {hasBalance && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('card.balance')}</Text>
                <Text style={styles.rowValue}>{formatCurrency(balance)}</Text>
              </View>
              <Text style={isOverBalance ? styles.overLine : styles.subLine}>
                {isOverBalance
                  ? `${t('card.overby')} ${formatCurrency(Math.abs(remaining))}`
                  : `${formatCurrency(remaining)} ${t('card.remaining')}`}
              </Text>
            </>
          )}

          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
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
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center',
    marginBottom: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  iconRing: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.headingMedium,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  rowLabel: { ...theme.typography.bodyMedium, color: theme.colors.textMuted },
  rowValue: { ...theme.typography.bodyLarge, fontWeight: '600', color: theme.colors.textPrimary },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: theme.spacing.md,
    paddingVertical: 2,
  },
  breakdownLabel: { ...theme.typography.labelSmall, color: theme.colors.textMuted },
  breakdownValue: { ...theme.typography.bodyMedium, color: theme.colors.textSecondary },
  subLine: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  overLine: {
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: '#FF2D78',
    marginTop: theme.spacing.xs,
  },
  divider: { height: 1, backgroundColor: theme.colors.divider, marginVertical: theme.spacing.xs },
  doneBtn: {
    height: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
  },
  doneLabel: { ...theme.typography.headingMedium, color: theme.colors.textMuted },
});
