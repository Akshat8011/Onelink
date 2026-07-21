import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FinanceLayout from '../../components/account/FinanceLayout';
import FinanceCard from '../../components/account/FinanceCard';
import GradientMetricCard from '../../components/account/GradientMetricCard';
import ActivityRow from '../../components/account/ActivityRow';
import ProgressBar from '../../components/account/ProgressBar';
import DonutChart from '../../components/account/DonutChart';
import { getFinanceTheme } from '../../theme/financeTheme';
import { useFinanceTheme } from '../../hooks/useFinanceTheme';
import { useI18n } from '../../hooks/useI18n';
import { useSettingsStore } from '../../store/useSettingsStore';
import { spacing, fontSize } from '../../theme/colors';
import { useFinancialStore } from '../../store/useFinancialStore';
import { useWalletStore } from '../../store/useWalletStore';
import { billPenalty } from '../../data/financialCatalog';
import { confirmDialog, alertDialog } from '../../utils/dialog';

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export default function BillsScreen() {
  const { t } = useI18n();
  const isDark = useSettingsStore((s) => s.darkMode);
  const fin = useFinanceTheme();
  const styles = useMemo(() => createStyles(fin), [isDark]);
  const { bills, load, payBill } = useFinancialStore();
  const { balance } = useWalletStore();

  useEffect(() => { load(); }, []);

  const unpaid = bills.filter((b) => !b.isPaid);
  const paid = bills.filter((b) => b.isPaid);
  const totalDue = unpaid.reduce((s, b) => s + b.amount + billPenalty(b.amount, b.dueDate, b.penaltyPerDay), 0);
  const overdue = unpaid.filter((b) => daysUntil(b.dueDate) < 0);
  const paidPct = bills.length ? (paid.length / bills.length) * 100 : 100;

  const handlePay = async (billId: string, name: string, total: number) => {
    if (balance < total) {
      alertDialog(t('lowBalance'), t('needHave', { need: total.toLocaleString(), have: balance.toLocaleString() }));
      return;
    }
    const confirmed = await confirmDialog(t('payBillQuestion'), `${name}\n₹${total.toLocaleString()}`, t('payNow'), t('cancel'));
    if (!confirmed) return;
    if (payBill(billId)) alertDialog(t('paidSuccess'), t('billPaidSuccess'));
    else alertDialog(t('failed'), t('checkWalletBalance'));
  };

  const catIcon = (cat: string): keyof typeof Ionicons.glyphMap => {
    const m: Record<string, keyof typeof Ionicons.glyphMap> = {
      UTILITY: 'flash', TELECOM: 'wifi', default: 'receipt',
    };
    return m[cat] || m.default;
  };

  const billStatus = (days: number) => {
    if (days < 0) return t('daysOverdue', { n: Math.abs(days) });
    if (days === 0) return t('dueToday');
    return t('daysLeft', { n: days });
  };

  return (
    <FinanceLayout title={t('billsNav')} subtitle={t('billsSubtitle', { n: unpaid.length, balance: balance.toLocaleString() })}>
      <GradientMetricCard
        variant="bills"
        label={t('totalDue')}
        value={`₹${totalDue.toLocaleString()}`}
        footer={[
          { pct: `${unpaid.length}`, label: t('pendingSection') },
          { pct: `${overdue.length}`, label: t('overdue') },
          { pct: `${paid.length}`, label: t('paidLabel') },
        ]}
      />

      <View style={styles.split}>
        <FinanceCard style={styles.half}>
          <Text style={styles.cardTitle}>{t('paymentStatus')}</Text>
          <DonutChart
            centerLabel={`${Math.round(paidPct)}%`}
            centerSub={t('paidLabel')}
            size={100}
            segments={[
              { value: paid.length || 1, color: fin.sections.invest.primary },
              { value: unpaid.length || 1, color: fin.sections.bills.primary },
            ]}
          />
        </FinanceCard>
        <FinanceCard style={styles.half}>
          <Text style={styles.cardTitle}>{t('billHealth')}</Text>
          <Text style={styles.bigAmt}>{overdue.length}</Text>
          <Text style={styles.hint}>{t('overdueBills')}</Text>
          <ProgressBar progress={paidPct} color={fin.sections.invest.primary} height={8} />
          <Text style={styles.hint}>{t('billsPaidOf', { paid: paid.length, total: bills.length })}</Text>
        </FinanceCard>
      </View>

      <FinanceCard>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle" size={18} color={fin.sections.bills.accent} />
          <Text style={styles.info}>{t('penaltyInfo')}</Text>
        </View>
      </FinanceCard>

      <Text style={styles.section}>{t('pendingSection')}</Text>
      {unpaid.length === 0 ? (
        <FinanceCard><Text style={styles.empty}>{t('allBillsPaid')}</Text></FinanceCard>
      ) : (
        unpaid.map((bill) => {
          const penalty = billPenalty(bill.amount, bill.dueDate, bill.penaltyPerDay);
          const total = bill.amount + penalty;
          const days = daysUntil(bill.dueDate);
          const isOverdue = days < 0;

          return (
            <FinanceCard key={bill.billId}>
              <ActivityRow
                icon={catIcon(bill.category)}
                iconColor={isOverdue ? fin.red : fin.sections.bills.accent}
                iconBg={isOverdue ? (isDark ? '#3D2020' : '#F5EBEB') : fin.sections.bills.soft}
                title={bill.name}
                category={`${bill.provider} · ${new Date(bill.dueDate).toLocaleDateString('en-IN')}`}
                amount={`₹${total.toLocaleString()}`}
                status={billStatus(days)}
              />
              {penalty > 0 && <Text style={styles.penalty}>{t('includesPenalty', { penalty })}</Text>}
              <TouchableOpacity style={styles.payBtn} onPress={() => handlePay(bill.billId, bill.name, total)}>
                <Ionicons name="card" size={16} color="#fff" />
                <Text style={styles.payText}>{t('payAmount', { amount: total.toLocaleString() })}</Text>
              </TouchableOpacity>
            </FinanceCard>
          );
        })
      )}

      {paid.length > 0 && (
        <>
          <Text style={styles.section}>{t('recentlyPaid')}</Text>
          {paid.map((bill) => (
            <FinanceCard key={bill.billId} style={{ opacity: 0.75 }}>
              <ActivityRow
                icon="checkmark-circle"
                iconColor={fin.green}
                iconBg={isDark ? '#1A3D2E' : '#E8F8EE'}
                title={bill.name}
                category={bill.provider}
                amount={`₹${bill.amount.toLocaleString()}`}
                status={t('paidLabel')}
              />
            </FinanceCard>
          ))}
        </>
      )}
    </FinanceLayout>
  );
}

function createStyles(fin: ReturnType<typeof getFinanceTheme>) {
  return StyleSheet.create({
    split: { flexDirection: 'row', gap: spacing.sm },
    half: { flex: 1 },
    cardTitle: { color: fin.text, fontWeight: '800', fontSize: fontSize.sm, marginBottom: spacing.sm },
    bigAmt: { color: fin.text, fontSize: 28, fontWeight: '900' },
    hint: { color: fin.textMuted, fontSize: fontSize.xs, marginTop: 4 },
    infoRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    info: { flex: 1, color: fin.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
    section: { color: fin.text, fontWeight: '800', fontSize: fontSize.md, marginBottom: spacing.sm, marginTop: spacing.sm },
    empty: { color: fin.textSecondary, textAlign: 'center' },
    penalty: { color: fin.red, fontSize: fontSize.xs, marginTop: 4, marginBottom: spacing.sm },
    payBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: fin.sidebar, borderRadius: 20, padding: spacing.sm, marginTop: spacing.sm,
    },
    payText: { color: '#fff', fontWeight: '800' },
  });
}
