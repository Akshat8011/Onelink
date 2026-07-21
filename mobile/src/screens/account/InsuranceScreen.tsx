import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FinanceLayout from '../../components/account/FinanceLayout';
import FinanceCard from '../../components/account/FinanceCard';
import GradientMetricCard from '../../components/account/GradientMetricCard';
import PillTabs from '../../components/account/PillTabs';
import DonutChart from '../../components/account/DonutChart';
import ActivityRow from '../../components/account/ActivityRow';
import ProgressBar from '../../components/account/ProgressBar';
import { getFinanceTheme } from '../../theme/financeTheme';
import { useFinanceTheme } from '../../hooks/useFinanceTheme';
import { useI18n } from '../../hooks/useI18n';
import { useSettingsStore } from '../../store/useSettingsStore';
import { spacing, fontSize } from '../../theme/colors';
import { useFinancialStore } from '../../store/useFinancialStore';
import { useWalletStore } from '../../store/useWalletStore';
import { INSURANCE_PLANS, InsurancePlan } from '../../data/financialCatalog';
import { confirmDialog, alertDialog } from '../../utils/dialog';

const TYPE_ICONS: Record<InsurancePlan['type'], keyof typeof Ionicons.glyphMap> = {
  Health: 'medkit', Life: 'heart', Vehicle: 'car', Travel: 'airplane',
};

const TYPE_KEYS: Record<InsurancePlan['type'], 'health' | 'life' | 'vehicle' | 'travel'> = {
  Health: 'health', Life: 'life', Vehicle: 'vehicle', Travel: 'travel',
};

export default function InsuranceScreen() {
  const { t } = useI18n();
  const isDark = useSettingsStore((s) => s.darkMode);
  const fin = useFinanceTheme();
  const styles = useMemo(() => createStyles(fin), [isDark]);
  const [filter, setFilter] = useState<InsurancePlan['type'] | 'ALL'>('ALL');
  const { policies, load, buyPolicy } = useFinancialStore();
  const { balance } = useWalletStore();

  useEffect(() => { load(); }, []);

  const types: (InsurancePlan['type'] | 'ALL')[] = ['ALL', 'Health', 'Life', 'Vehicle', 'Travel'];
  const plans = filter === 'ALL' ? INSURANCE_PLANS : INSURANCE_PLANS.filter((p) => p.type === filter);
  const active = policies.filter((p) => p.active);
  const totalCover = active.reduce((s, p) => s + p.coverAmount, 0);
  const monthlyPrem = active.reduce((s, p) => s + p.monthlyPremium, 0);

  const byType = types.slice(1).map((type) => ({
    type,
    count: INSURANCE_PLANS.filter((p) => p.type === type).length,
  }));

  const typeLabel = (type: InsurancePlan['type'] | 'ALL') => {
    if (type === 'ALL') return t('all');
    return t(TYPE_KEYS[type]);
  };

  const purchase = async (plan: InsurancePlan) => {
    if (balance < plan.monthlyPremium) {
      alertDialog(t('lowBalance'), t('lowBalancePremium', { amount: plan.monthlyPremium }));
      return;
    }
    const confirmed = await confirmDialog(t('buyPolicy'), `${plan.provider} — ${plan.planName}\n₹${plan.monthlyPremium}/month`, t('buy'), t('cancel'));
    if (!confirmed) return;
    if (buyPolicy(plan.id)) alertDialog(t('policyActive'), t('policyPurchased'));
    else alertDialog(t('failed'), t('couldNotPurchase'));
  };

  return (
    <FinanceLayout title={t('insuranceLabel')} subtitle={t('insuranceSubtitle', { n: active.length, cover: totalCover.toLocaleString() })}>
      <GradientMetricCard
        variant="insurance"
        label={t('totalCoverage')}
        value={`₹${(totalCover / 100000).toFixed(1)}L`}
        footer={[
          { pct: `${active.length}`, label: t('policies') },
          { pct: `₹${monthlyPrem}`, label: t('perMonth') },
          { pct: `${plans.length}`, label: t('plans') },
        ]}
      />

      <View style={styles.split}>
        <FinanceCard style={styles.half}>
          <Text style={styles.cardTitle}>{t('coverageMix')}</Text>
          <DonutChart
            centerLabel={`${active.length}`}
            centerSub={t('activeLabel')}
            size={100}
            segments={byType.map((b, i) => ({
              value: b.count,
              color: [fin.sections.insurance.primary, fin.sections.insurance.secondary, fin.sections.wealth.primary, fin.sections.bills.accent][i],
            }))}
          />
        </FinanceCard>
        <FinanceCard style={styles.half}>
          <Text style={styles.cardTitle}>{t('premiumBudget')}</Text>
          <Text style={styles.bigAmt}>₹{monthlyPrem}</Text>
          <Text style={styles.hint}>{t('perMonthShort')}</Text>
          <ProgressBar progress={Math.min(100, monthlyPrem / 50)} color={fin.sections.insurance.accent} height={8} />
          <Text style={styles.hint}>{t('walletBalanceShort', { balance: balance.toLocaleString() })}</Text>
        </FinanceCard>
      </View>

      <PillTabs
        tabs={types.map((type) => ({ key: type, label: typeLabel(type) }))}
        active={filter}
        onChange={setFilter}
      />

      {active.length > 0 && (
        <>
          <Text style={styles.section}>{t('yourPolicies')}</Text>
          {active.map((pol) => (
            <FinanceCard key={pol.policyId}>
              <ActivityRow icon="shield-checkmark" iconColor={fin.sections.insurance.primary} iconBg={fin.sections.insurance.soft} title={pol.planName} category={`${pol.provider} · ${pol.type}`} amount={`₹${pol.coverAmount.toLocaleString()}`} status={t('activeLabel')} />
              <Text style={styles.hint}>{t('policyNextDue', { premium: pol.monthlyPremium, date: new Date(pol.nextDueDate).toLocaleDateString('en-IN') })}</Text>
            </FinanceCard>
          ))}
        </>
      )}

      <Text style={styles.section}>{t('availablePlans')}</Text>
      {plans.map((plan) => (
        <FinanceCard key={plan.id}>
          <View style={styles.planHead}>
            <View style={[styles.planIcon, { backgroundColor: fin.sections.insurance.soft }]}>
              <Ionicons name={TYPE_ICONS[plan.type]} size={22} color={fin.sections.insurance.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.planName}>{plan.provider}</Text>
              <Text style={styles.planSub}>{plan.planName} · {typeLabel(plan.type)}</Text>
            </View>
            <Text style={styles.premium}>₹{plan.monthlyPremium}<Text style={styles.perMo}>{t('perMonth')}</Text></Text>
          </View>

          <View style={styles.coverBadge}>
            <Ionicons name="shield" size={14} color={fin.green} />
            <Text style={styles.coverText}>{t('coverUpTo', { amount: plan.coverAmount.toLocaleString() })}</Text>
          </View>

          <Text style={styles.detailLbl}>{t('eligibility')}</Text>
          <Text style={styles.detail}>{plan.eligibility}</Text>

          {plan.waitingPeriod && (
            <>
              <Text style={styles.detailLbl}>{t('waitingPeriod')}</Text>
              <Text style={styles.detail}>{plan.waitingPeriod}</Text>
            </>
          )}

          <Text style={styles.detailLbl}>{t('benefits')}</Text>
          {plan.benefits.map((b) => (
            <View key={b} style={styles.benefitRow}>
              <Ionicons name="checkmark" size={14} color={fin.green} />
              <Text style={styles.benefit}>{b}</Text>
            </View>
          ))}

          <TouchableOpacity style={styles.btn} onPress={() => purchase(plan)}>
            <Text style={styles.btnText}>{t('getCovered', { amount: plan.monthlyPremium })}</Text>
          </TouchableOpacity>
        </FinanceCard>
      ))}
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
    section: { color: fin.text, fontWeight: '800', fontSize: fontSize.md, marginBottom: spacing.sm, marginTop: spacing.sm },
    planHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    planIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    planName: { color: fin.text, fontWeight: '800', fontSize: fontSize.md },
    planSub: { color: fin.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
    premium: { color: fin.sections.insurance.primary, fontWeight: '900', fontSize: fontSize.lg },
    perMo: { fontSize: fontSize.xs, fontWeight: '600' },
    coverBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
    coverText: { color: fin.green, fontWeight: '600', fontSize: fontSize.sm },
    detailLbl: { color: fin.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: spacing.sm, letterSpacing: 0.5 },
    detail: { color: fin.textSecondary, fontSize: fontSize.sm, marginTop: 4, lineHeight: 20 },
    benefitRow: { flexDirection: 'row', gap: 6, marginTop: 4, alignItems: 'flex-start' },
    benefit: { color: fin.textSecondary, fontSize: fontSize.sm, flex: 1 },
    btn: { backgroundColor: fin.sidebar, borderRadius: 20, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
    btnText: { color: '#fff', fontWeight: '800' },
  });
}
