import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FinanceLayout from '../../components/account/FinanceLayout';
import FinanceCard from '../../components/account/FinanceCard';
import GradientMetricCard from '../../components/account/GradientMetricCard';
import PillTabs from '../../components/account/PillTabs';
import ActivityRow from '../../components/account/ActivityRow';
import ProgressBar from '../../components/account/ProgressBar';
import MiniBarChart from '../../components/account/MiniBarChart';
import { getFinanceTheme } from '../../theme/financeTheme';
import { useFinanceTheme } from '../../hooks/useFinanceTheme';
import { useI18n } from '../../hooks/useI18n';
import { useSettingsStore } from '../../store/useSettingsStore';
import { spacing, fontSize } from '../../theme/colors';
import { useFinancialStore } from '../../store/useFinancialStore';
import { LOAN_PRODUCTS, calcEmi } from '../../data/financialCatalog';
import { confirmDialog, alertDialog } from '../../utils/dialog';

const LOAN_TYPE_KEYS: Record<string, 'personalLoan' | 'homeLoan' | 'vehicleLoan' | 'educationLoan'> = {
  'Personal Loan': 'personalLoan',
  'Home Loan': 'homeLoan',
  'Vehicle Loan': 'vehicleLoan',
  'Education Loan': 'educationLoan',
};

export default function LoanScreen() {
  const { t } = useI18n();
  const isDark = useSettingsStore((s) => s.darkMode);
  const fin = useFinanceTheme();
  const styles = useMemo(() => createStyles(fin), [isDark]);
  const { loans, load, takeLoan, totalLoanDue } = useFinancialStore();
  const [principal, setPrincipal] = useState('500000');
  const [rate, setRate] = useState('10.5');
  const [tenureYears, setTenureYears] = useState('5');
  const [loanType, setLoanType] = useState('Personal Loan');
  const [selectedBank, setSelectedBank] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const tenureMonths = Number(tenureYears) * 12;
  const calc = useMemo(() => calcEmi(Number(principal), Number(rate), tenureMonths), [principal, rate, tenureMonths]);
  const outstanding = totalLoanDue();
  const loanTypes = [...new Set(LOAN_PRODUCTS.map((p) => p.type))];
  const filtered = LOAN_PRODUCTS.filter((p) => p.type === loanType);
  const paidPct = loans.length ? Math.min(35, loans.length * 12) : 0;

  const loanTypeLabel = (type: string) => {
    const key = LOAN_TYPE_KEYS[type];
    return key ? t(key) : type.replace(' Loan', '');
  };

  const applyLoan = async () => {
    const p = Number(principal);
    const r = Number(rate);
    if (!selectedBank || p < 10000) {
      alertDialog(t('selectBankAlert'), t('chooseBankMin'));
      return;
    }
    const product = LOAN_PRODUCTS.find((x) => x.bank === selectedBank && x.type === loanType);
    if (product && p > product.maxAmount) {
      alertDialog(t('limitExceeded'), t('maxAmount', { amount: product.maxAmount.toLocaleString() }));
      return;
    }
    const confirmed = await confirmDialog(t('confirmLoan'), t('emiConfirm', { emi: calc.emi.toLocaleString(), total: calc.totalPayment.toLocaleString() }), t('apply'), t('cancel'));
    if (!confirmed) return;
    if (takeLoan(selectedBank!, loanType, p, r, tenureMonths)) alertDialog(t('disbursed'), t('creditedWallet', { amount: p.toLocaleString() }));
    else alertDialog(t('failed'), t('couldNotProcess'));
  };

  return (
    <FinanceLayout
      title={t('loansNav')}
      subtitle={t('loansSubtitle', { amount: outstanding.toLocaleString() })}
      rightAction={{ label: t('calculator'), onPress: () => {} }}
    >
      <GradientMetricCard
        variant="loans"
        label={t('monthlyEmi')}
        value={`₹${calc.emi.toLocaleString()}`}
        chartData={[calc.emi * 0.8, calc.emi, calc.emi * 0.95, calc.emi * 1.05, calc.emi, calc.emi * 0.9, calc.emi]}
        footer={[
          { pct: `₹${(calc.totalInterest / 1000).toFixed(0)}K`, label: t('interest') },
          { pct: `${tenureYears}yr`, label: t('tenure') },
          { pct: `${rate}%`, label: t('rateLabel') },
        ]}
      />

      <FinanceCard>
        <Text style={styles.cardTitle}>{t('repaymentProgress')}</Text>
        <ProgressBar progress={paidPct} color={fin.sections.loans.accent} height={10} />
        <Text style={styles.hint}>{t('activeLoansRemaining', { n: loans.length, amount: outstanding.toLocaleString() })}</Text>
      </FinanceCard>

      <FinanceCard>
        <Text style={styles.cardTitle}>{t('emiTrend')}</Text>
        <MiniBarChart data={[calc.emi * 0.7, calc.emi * 0.85, calc.emi, calc.emi, calc.emi * 1.1, calc.emi, calc.emi * 0.95]} height={56} colors={[fin.sections.loans.primary, fin.sections.loans.secondary, fin.sections.loans.accent]} />
      </FinanceCard>

      <PillTabs
        tabs={loanTypes.map((lt) => ({ key: lt, label: loanTypeLabel(lt) }))}
        active={loanType}
        onChange={(lt) => { setLoanType(lt); setSelectedBank(null); }}
      />

      <FinanceCard>
        <Text style={styles.label}>{t('loanAmount')}</Text>
        <TextInput style={styles.input} value={principal} onChangeText={setPrincipal} keyboardType="numeric" placeholderTextColor={fin.textMuted} />
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('ratePa')}</Text>
            <TextInput style={styles.input} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholderTextColor={fin.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('years')}</Text>
            <TextInput style={styles.input} value={tenureYears} onChangeText={setTenureYears} keyboardType="numeric" placeholderTextColor={fin.textMuted} />
          </View>
        </View>
        <View style={styles.resultRow}>
          <View style={styles.resultBox}>
            <Text style={styles.resultLbl}>{t('totalPay')}</Text>
            <Text style={styles.resultVal}>₹{calc.totalPayment.toLocaleString()}</Text>
          </View>
          <View style={styles.resultBox}>
            <Text style={styles.resultLbl}>{t('interest')}</Text>
            <Text style={[styles.resultVal, { color: fin.sections.loans.accent }]}>₹{calc.totalInterest.toLocaleString()}</Text>
          </View>
        </View>
      </FinanceCard>

      <Text style={styles.section}>{t('compareBanks')}</Text>
      {filtered.map((p) => {
        const mid = (p.rateMin + p.rateMax) / 2;
        const preview = calcEmi(Number(principal), mid, tenureMonths);
        const sel = selectedBank === p.bank;
        return (
          <TouchableOpacity key={p.bank} onPress={() => { setSelectedBank(p.bank); setRate(String(mid)); }}>
            <FinanceCard style={sel ? styles.selected : undefined}>
              <ActivityRow
                icon="business"
                iconColor={fin.sections.loans.primary}
                iconBg={fin.sections.loans.soft}
                title={p.bank}
                category={`${p.rateMin}–${p.rateMax}% · up to ₹${(p.maxAmount / 100000).toFixed(0)}L`}
                amount={`₹${preview.emi.toLocaleString()}`}
                change="/mo"
                changeUp
              />
            </FinanceCard>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity style={[styles.btn, !selectedBank && styles.btnOff]} onPress={applyLoan} disabled={!selectedBank}>
        <Ionicons name="checkmark-circle" size={18} color="#fff" />
        <Text style={styles.btnText}>{selectedBank ? t('applyWith', { bank: selectedBank }) : t('selectBankBtn')}</Text>
      </TouchableOpacity>

      {loans.length > 0 && (
        <>
          <Text style={styles.section}>{t('activeLoansSection')}</Text>
          {loans.map((l) => (
            <FinanceCard key={l.loanId}>
              <ActivityRow icon="cash" iconColor={fin.purple} title={l.bankName} category={l.loanType} amount={`₹${l.remainingPrincipal.toLocaleString()}`} status={`${t('emi')} ₹${l.emi.toLocaleString()}`} />
              <Text style={styles.hint}>{t('nextDue', { date: new Date(l.nextEmiDate).toLocaleDateString('en-IN'), rate: l.rate })}</Text>
            </FinanceCard>
          ))}
        </>
      )}
    </FinanceLayout>
  );
}

function createStyles(fin: ReturnType<typeof getFinanceTheme>) {
  return StyleSheet.create({
    cardTitle: { color: fin.text, fontWeight: '800', fontSize: fontSize.md, marginBottom: spacing.sm },
    hint: { color: fin.textMuted, fontSize: fontSize.xs, marginTop: spacing.sm },
    section: { color: fin.text, fontWeight: '800', fontSize: fontSize.md, marginBottom: spacing.sm, marginTop: spacing.sm },
    label: { color: fin.textSecondary, fontSize: fontSize.xs, fontWeight: '600', marginBottom: 6 },
    input: { backgroundColor: fin.bg, borderRadius: 14, padding: spacing.md, color: fin.text, marginBottom: spacing.sm },
    row2: { flexDirection: 'row', gap: spacing.sm },
    resultRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    resultBox: { flex: 1, backgroundColor: fin.bg, borderRadius: 14, padding: spacing.sm, alignItems: 'center' },
    resultLbl: { color: fin.textMuted, fontSize: 10 },
    resultVal: { color: fin.text, fontWeight: '800', marginTop: 4 },
    selected: { borderWidth: 2, borderColor: fin.sections.loans.primary },
    btn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: fin.sidebar, borderRadius: 22, padding: spacing.md, marginTop: spacing.sm,
    },
    btnOff: { opacity: 0.45 },
    btnText: { color: '#fff', fontWeight: '800' },
  });
}
