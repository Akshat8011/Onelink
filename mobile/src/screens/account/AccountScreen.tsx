import React, { useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenWrapper from '../../components/ScreenWrapper';
import FinanceCard from '../../components/account/FinanceCard';
import GradientMetricCard from '../../components/account/GradientMetricCard';
import DonutChart from '../../components/account/DonutChart';
import MiniBarChart from '../../components/account/MiniBarChart';
import ActivityRow from '../../components/account/ActivityRow';
import ProgressBar from '../../components/account/ProgressBar';
import { getFinanceTheme, sectionStyle } from '../../theme/financeTheme';
import { spacing, fontSize } from '../../theme/colors';
import { useAuthStore } from '../../store/useAuthStore';
import { useWalletStore } from '../../store/useWalletStore';
import { useRewardsStore } from '../../store/useRewardsStore';
import { useFinancialStore } from '../../store/useFinancialStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useI18n } from '../../hooks/useI18n';
import { billPenalty } from '../../data/financialCatalog';
import type { RootStackParamList } from '../../navigation/types';

import type { FinSection } from '../../theme/financeTheme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = 'Invest' | 'Loans' | 'Insurance' | 'Bills' | 'AccountDetails' | 'Settings';

const NAV: { icon: keyof typeof Ionicons.glyphMap; route: Route; labelKey: 'profile' | 'investNav' | 'loansNav' | 'cover' | 'billsNav' | 'more'; section: FinSection }[] = [
  { icon: 'grid', route: 'AccountDetails', labelKey: 'profile', section: 'profile' },
  { icon: 'trending-up', route: 'Invest', labelKey: 'investNav', section: 'invest' },
  { icon: 'calculator', route: 'Loans', labelKey: 'loansNav', section: 'loans' },
  { icon: 'shield', route: 'Insurance', labelKey: 'cover', section: 'insurance' },
  { icon: 'receipt', route: 'Bills', labelKey: 'billsNav', section: 'bills' },
  { icon: 'settings', route: 'Settings', labelKey: 'more', section: 'profile' },
];

function firstName(name?: string) {
  return (name || 'User').split(' ')[0];
}

export default function AccountScreen() {
  const navigation = useNavigation<Nav>();
  const isDark = useSettingsStore((s) => s.darkMode);
  const fin = useMemo(() => getFinanceTheme(isDark), [isDark]);
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(fin), [isDark]);
  const { user, logout } = useAuthStore();
  const { balance, transactions, fetchDashboard } = useWalletStore();
  const { memberTier, loyaltyPoints } = useRewardsStore();
  const { load, portfolioValue, totalLoanDue, pendingBillsTotal, policies, loans, holdings, bills } = useFinancialStore();

  useEffect(() => { load(); fetchDashboard(); }, []);

  const initial = (user?.name || 'U').charAt(0).toUpperCase();
  const portfolio = Math.round(portfolioValue());
  const netWorth = balance + portfolio;
  const billsDue = pendingBillsTotal();
  const loanDue = totalLoanDue();
  const invested = holdings.reduce((s, h) => s + (h.type === 'MF' ? h.units : h.avgPrice), 0);
  const retPct = invested > 0 ? (((portfolio - invested) / invested) * 100).toFixed(1) : '4.2';

  const weekData = useMemo(() => {
    const days = Array(7).fill(0);
    const seed = user?.userId?.length ?? 5;
    transactions.filter((t) => t.type === 'DEBIT').forEach((t) => {
      const d = Math.floor((Date.now() - new Date(t.date).getTime()) / 86400000);
      if (d >= 0 && d < 7) days[6 - d] += t.amount;
    });
    return days.map((v, i) => v || 300 + ((seed + i * 97) % 500));
  }, [transactions, user?.userId]);

  const unpaid = bills.filter((b) => !b.isPaid);
  const billPaidPct = bills.length ? ((bills.length - unpaid.length) / bills.length) * 100 : 100;

  const signOut = () => {
    const go = () => logout();
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(t('signOutQuestion'))) go();
      return;
    }
    Alert.alert(t('signOutQuestion'), '', [{ text: t('cancel'), style: 'cancel' }, { text: t('signOut'), style: 'destructive', onPress: go }]);
  };

  return (
    <ScreenWrapper edges={['top']} style={{ backgroundColor: fin.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Home' } as never)}
            hitSlop={12}
          >
            <Ionicons name="home" size={20} color={fin.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>{t('finance')}</Text>
            <View style={styles.contextPill}>
              <Ionicons name="wallet" size={12} color={fin.textSecondary} />
              <Text style={styles.contextText}>{memberTier} · {loyaltyPoints} {t('pts')}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.searchBtn}>
              <Ionicons name="search" size={18} color={fin.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate('AccountDetails')}>
              <Text style={styles.avatarText}>{initial}</Text>
              {unpaid.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unpaid.length}</Text></View>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Dark nav rail */}
        <View style={styles.navRail}>
          {NAV.map((n) => (
            <TouchableOpacity key={n.route} style={styles.navItem} onPress={() => navigation.navigate(n.route)}>
              <View style={[styles.navIcon, { backgroundColor: sectionStyle(n.section, isDark).primary }]}>
                <Ionicons name={n.icon} size={20} color="#fff" />
              </View>
              <Text style={styles.navLabel}>{t(n.labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.greeting}>{t('hiUser', { name: firstName(user?.name) })}</Text>

        {user?.isAdmin && (
          <TouchableOpacity
            style={styles.adminBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Admin')}
          >
            <View style={styles.adminIcon}>
              <Ionicons name="shield-checkmark" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.adminTitle}>Admin Panel</Text>
              <Text style={styles.adminSub}>Manage users, activity & kiosk sounds</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        <View style={styles.body}>
        <GradientMetricCard
          variant="wealth"
          label={t('totalNetWorth')}
          value={`₹${(netWorth / 1000).toFixed(1)}K`}
          chartData={weekData}
          footer={[
            { pct: `₹${(balance / 1000).toFixed(0)}K`, label: t('cash') },
            { pct: `₹${(portfolio / 1000).toFixed(0)}K`, label: t('invested') },
            { pct: `${retPct}%`, label: t('returns') },
          ]}
        />

        <View style={styles.twoCol}>
          {/* Donut allocation */}
          <FinanceCard style={styles.half}>
            <Text style={styles.cardTitle}>{t('allocation')}</Text>
            <View style={styles.donutWrap}>
              <DonutChart
                centerLabel={`₹${(netWorth / 1000).toFixed(0)}K`}
                centerSub={t('totalLabel')}
                segments={[
                  { value: balance, color: fin.sections.wealth.primary },
                  { value: portfolio || 1, color: fin.sections.invest.primary },
                  { value: billsDue || 1, color: fin.sections.bills.primary },
                  { value: loanDue || 1, color: fin.sections.loans.primary },
                ]}
                size={110}
              />
            </View>
            <View style={styles.legend}>
              {[
                { c: fin.sections.wealth.primary, l: t('cash') },
                { c: fin.sections.invest.primary, l: t('portfolioLabel') },
                { c: fin.sections.bills.primary, l: t('billsNav') },
                { c: fin.sections.loans.primary, l: t('loansNav') },
              ].map((x) => (
                <View key={x.l} style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: x.c }]} />
                  <Text style={styles.legendText}>{x.l}</Text>
                </View>
              ))}
            </View>
          </FinanceCard>

          {/* Side metrics */}
          <View style={styles.half}>
            <FinanceCard style={{ marginBottom: spacing.sm, padding: spacing.md }}>
              <Text style={styles.miniLabel}>{t('billsDue')}</Text>
              <Text style={styles.miniVal}>₹{billsDue.toLocaleString()}</Text>
              <ProgressBar progress={100 - billPaidPct} color={fin.sections.bills.accent} height={6} />
              <Text style={styles.miniSub}>{t('pendingCount', { n: unpaid.length })}</Text>
            </FinanceCard>
            <FinanceCard style={{ padding: spacing.md }}>
              <Text style={styles.miniLabel}>{t('loanOutstanding')}</Text>
              <Text style={styles.miniVal}>₹{loanDue.toLocaleString()}</Text>
              <ProgressBar progress={loanDue > 0 ? 65 : 0} color={fin.sections.loans.accent} height={6} />
              <Text style={styles.miniSub}>{t('activeLoans', { n: loans.length })}</Text>
            </FinanceCard>
          </View>
        </View>

        {/* Weekly bar chart */}
        <FinanceCard>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{t('weeklySpending')}</Text>
            <Text style={styles.cardMeta}>{t('weeklyVsLast')}</Text>
          </View>
          <MiniBarChart data={weekData} height={72} />
          <View style={styles.daysRow}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <Text key={i} style={[styles.dayLbl, i === 4 && styles.dayActive]}>{d}</Text>
            ))}
          </View>
        </FinanceCard>

        {/* Activity */}
        <FinanceCard>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{t('recentActivity')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Wallet' } as never)}>
              <Text style={styles.link}>{t('seeAll')}</Text>
            </TouchableOpacity>
          </View>
          {transactions.slice(0, 5).map((t) => (
            <ActivityRow
              key={t.transactionId}
              icon={t.type === 'CREDIT' ? 'arrow-down' : 'arrow-up'}
              iconColor={t.type === 'CREDIT' ? fin.sections.invest.primary : fin.sections.bills.accent}
              iconBg={t.type === 'CREDIT' ? fin.sections.invest.soft : fin.sections.bills.soft}
              title={t.description}
              category={t.category}
              amount={`${t.type === 'CREDIT' ? '+' : '-'}₹${t.amount.toLocaleString()}`}
            />
          ))}
        </FinanceCard>

        {/* Upcoming bills & EMIs */}
        <FinanceCard>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{t('upcoming')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Bills')}>
              <Text style={styles.link}>{t('manage')}</Text>
            </TouchableOpacity>
          </View>
          {unpaid.slice(0, 3).map((b) => {
            const pen = billPenalty(b.amount, b.dueDate, b.penaltyPerDay);
            const overdue = new Date(b.dueDate) < new Date();
            return (
              <ActivityRow
                key={b.billId}
                icon="receipt"
                iconColor={fin.sections.bills.primary}
                iconBg={fin.sections.bills.soft}
                title={b.name}
                category={b.provider}
                amount={`-₹${(b.amount + pen).toLocaleString()}`}
                status={overdue ? t('overdue') : t('dueSoon')}
                onPress={() => navigation.navigate('Bills')}
              />
            );
          })}
          {loans.slice(0, 2).map((l) => (
            <ActivityRow
              key={l.loanId}
              icon="cash"
              iconColor={fin.sections.loans.primary}
              iconBg={fin.sections.loans.soft}
              title={`${l.loanType} ${t('emi')}`}
              category={l.bankName}
              amount={`-₹${l.emi.toLocaleString()}`}
              status={t('scheduled')}
              onPress={() => navigation.navigate('Loans')}
            />
          ))}
          {unpaid.length === 0 && loans.length === 0 && (
            <Text style={styles.empty}>{t('allClear')}</Text>
          )}
        </FinanceCard>

        {/* Insurance summary */}
        <FinanceCard>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{t('insuranceLabel')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Insurance')}>
              <Text style={styles.link}>{t('viewPlans')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.insRow}>
            <View style={styles.insStat}>
              <Text style={styles.insNum}>{policies.filter((p) => p.active).length}</Text>
              <Text style={styles.insLbl}>{t('activeLabel')}</Text>
            </View>
            <View style={styles.insStat}>
              <Text style={styles.insNum}>{holdings.length}</Text>
              <Text style={styles.insLbl}>{t('holdings')}</Text>
            </View>
            <View style={styles.insStat}>
              <Text style={[styles.insNum, { color: fin.sections.invest.primary }]}>+{retPct}%</Text>
              <Text style={styles.insLbl}>{t('returns')}</Text>
            </View>
          </View>
        </FinanceCard>

        <TouchableOpacity style={styles.signOut} onPress={signOut}>
          <Ionicons name="log-out-outline" size={18} color={fin.red} />
          <Text style={styles.signOutText}>{t('signOut')}</Text>
        </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

function createStyles(fin: ReturnType<typeof getFinanceTheme>) {
  return StyleSheet.create({
  scroll: { paddingBottom: 48 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
  },
  homeBtn: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: fin.surface,
    alignItems: 'center', justifyContent: 'center', ...fin.shadowSoft,
  },
  pageTitle: { fontSize: 30, fontWeight: '900', color: fin.text, letterSpacing: -1 },
  contextPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6,
    backgroundColor: fin.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start',
    ...fin.shadowSoft,
  },
  contextText: { color: fin.textSecondary, fontSize: fontSize.xs, fontWeight: '600' },
  headerRight: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchBtn: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: fin.surface,
    alignItems: 'center', justifyContent: 'center', ...fin.shadowSoft,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: fin.sidebar,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  badge: {
    position: 'absolute', top: -4, right: -4, backgroundColor: fin.red,
    width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  navRail: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginHorizontal: spacing.lg, backgroundColor: fin.sidebar,
    borderRadius: fin.radiusLg, paddingVertical: spacing.md, marginBottom: spacing.md,
    ...fin.shadow,
  },
  navItem: { alignItems: 'center', gap: 4 },
  navIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: fin.sidebarMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  navLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '600' },
  greeting: { paddingHorizontal: spacing.lg, fontSize: fontSize.md, color: fin.textSecondary, marginBottom: spacing.sm, fontWeight: '600' },
  twoCol: { flexDirection: 'row', gap: spacing.sm },
  body: { paddingHorizontal: spacing.lg },
  half: { flex: 1, padding: spacing.sm },
  donutWrap: { alignItems: 'center', marginVertical: spacing.sm },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 9, color: fin.textSecondary },
  cardTitle: { color: fin.text, fontWeight: '800', fontSize: fontSize.md },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cardMeta: { color: fin.sections.invest.primary, fontSize: fontSize.xs, fontWeight: '700' },
  miniLabel: { color: fin.textSecondary, fontSize: 10, fontWeight: '600' },
  miniVal: { color: fin.text, fontWeight: '800', fontSize: fontSize.lg, marginVertical: 4 },
  miniSub: { color: fin.textMuted, fontSize: 10, marginTop: 4 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  dayLbl: { color: fin.textMuted, fontSize: 10, fontWeight: '600', flex: 1, textAlign: 'center' },
  dayActive: { color: fin.gold, fontWeight: '800' },
  link: { color: fin.sections.wealth.primary, fontWeight: '700', fontSize: fontSize.xs },
  insRow: { flexDirection: 'row', justifyContent: 'space-around' },
  insStat: { alignItems: 'center' },
  insNum: { fontSize: 22, fontWeight: '900', color: fin.text },
  insLbl: { fontSize: 10, color: fin.textSecondary, marginTop: 2 },
  empty: { color: fin.textSecondary, textAlign: 'center', padding: spacing.md },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.lg, padding: spacing.md },
  signOutText: { color: fin.red, fontWeight: '700' },
  adminBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: '#B91C1C', borderRadius: fin.radiusLg, padding: spacing.md,
    ...fin.shadow,
  },
  adminIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  adminTitle: { color: '#fff', fontWeight: '800', fontSize: fontSize.md },
  adminSub: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.xs, marginTop: 2 },
  });
}
