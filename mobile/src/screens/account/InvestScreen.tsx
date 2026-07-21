import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FinanceLayout from '../../components/account/FinanceLayout';
import FinanceCard from '../../components/account/FinanceCard';
import GradientMetricCard from '../../components/account/GradientMetricCard';
import PillTabs from '../../components/account/PillTabs';
import ActivityRow from '../../components/account/ActivityRow';
import MiniBarChart from '../../components/account/MiniBarChart';
import { getFinanceTheme } from '../../theme/financeTheme';
import { useFinanceTheme } from '../../hooks/useFinanceTheme';
import { useI18n } from '../../hooks/useI18n';
import { useSettingsStore } from '../../store/useSettingsStore';
import { spacing, fontSize } from '../../theme/colors';
import { useFinancialStore } from '../../store/useFinancialStore';
import { useWalletStore } from '../../store/useWalletStore';
import { NSE_STOCKS, FD_RATES, MUTUAL_FUNDS, liveStockPrice } from '../../data/financialCatalog';
import { confirmDialog, alertDialog } from '../../utils/dialog';

type Tab = 'NSE' | 'FD' | 'MF' | 'PORTFOLIO';

export default function InvestScreen() {
  const { t } = useI18n();
  const isDark = useSettingsStore((s) => s.darkMode);
  const fin = useFinanceTheme();
  const styles = useMemo(() => createStyles(fin), [isDark]);
  const [tab, setTab] = useState<Tab>('NSE');
  const [amount, setAmount] = useState('5000');
  const [selected, setSelected] = useState<string | null>(null);
  const { holdings, load, investStock, investFd, investMf, portfolioValue, holdingValue, withdrawHolding, withdrawAll } = useFinancialStore();
  const { balance } = useWalletStore();

  useEffect(() => { load(); }, []);

  const portfolio = Math.round(portfolioValue());
  const invested = holdings.reduce((s, h) => s + (h.type === 'MF' ? h.units : h.avgPrice), 0);
  const pnl = portfolio - invested;
  const pnlPct = invested > 0 ? ((pnl / invested) * 100).toFixed(1) : '0';

  const invest = () => {
    const amt = Number(amount);
    if (!selected || amt < 100) {
      alertDialog(t('invalidNumber'), t('selectAssetAmount'));
      return;
    }
    if (balance < amt) {
      alertDialog(t('lowBalance'), t('walletBalanceShort', { balance: balance.toLocaleString() }));
      return;
    }
    let ok = false;
    if (tab === 'NSE') ok = investStock(selected, amt);
    else if (tab === 'FD') {
      const fd = FD_RATES.find((f) => f.bank === selected);
      ok = fd ? investFd(fd.bank, amt, fd.rate) : false;
    } else if (tab === 'MF') {
      const mf = MUTUAL_FUNDS.find((m) => m.id === selected);
      ok = mf ? investMf(mf.id, mf.name, amt) : false;
    }
    if (ok) { alertDialog(t('success'), t('investedSuccess', { amount: amt.toLocaleString() })); setSelected(null); }
    else alertDialog(t('failed'), t('investFailed'));
  };

  const onWithdraw = async (holdingId: string, value: number) => {
    const confirmed = await confirmDialog(t('withdrawConfirm'), `₹${value.toLocaleString()}`, t('withdraw'), t('cancel'));
    if (!confirmed) return;
    if (withdrawHolding(holdingId)) alertDialog(t('withdrawn'), t('withdrawnBody', { amount: value.toLocaleString() }));
    else alertDialog(t('failed'), t('withdrawFailed'));
  };

  const onWithdrawAll = async () => {
    if (holdings.length === 0) {
      alertDialog(t('nothingToWithdraw'));
      return;
    }
    const confirmed = await confirmDialog(t('withdrawAllConfirm'), `₹${portfolio.toLocaleString()}`, t('withdrawAll'), t('cancel'));
    if (!confirmed) return;
    const total = withdrawAll();
    if (total > 0) alertDialog(t('withdrawn'), t('withdrawnBody', { amount: total.toLocaleString() }));
    else alertDialog(t('failed'), t('withdrawFailed'));
  };

  const tabs = [
    { key: 'NSE' as Tab, label: t('nseStocks') },
    { key: 'FD' as Tab, label: t('fixedDeposits') },
    { key: 'MF' as Tab, label: t('mutualFunds') },
    { key: 'PORTFOLIO' as Tab, label: t('portfolioTab') },
  ];

  return (
    <FinanceLayout
      title={t('investments')}
      subtitle={t('investSubtitle', { portfolio: portfolio.toLocaleString(), pct: pnlPct })}
      searchPlaceholder={t('searchStocks')}
    >
      <GradientMetricCard
        variant="invest"
        label={t('portfolioValue')}
        value={`₹${(portfolio / 1000).toFixed(1)}K`}
        chartData={[40, 55, 45, 70, 60, 80, 75].map((v) => v * (portfolio / 1000 || 1))}
        footer={[
          { pct: `${holdings.length}`, label: t('assets') },
          { pct: `${pnlPct}%`, label: t('returnLabel') },
          { pct: `₹${balance.toLocaleString()}`, label: t('cash') },
        ]}
      />

      <FinanceCard>
        <Text style={styles.cardTitle}>{t('marketPerformance')}</Text>
        <MiniBarChart data={[12, 18, 15, 22, 19, 25, 21]} height={64} />
        <Text style={styles.hint}>{t('nseSimulated')}</Text>
      </FinanceCard>

      <PillTabs tabs={tabs} active={tab} onChange={(k) => { setTab(k); setSelected(null); }} />

      {tab === 'PORTFOLIO' ? (
        holdings.length === 0 ? (
          <FinanceCard><Text style={styles.empty}>{t('noHoldings')}</Text></FinanceCard>
        ) : (
          <>
            <TouchableOpacity style={styles.withdrawAllBtn} onPress={onWithdrawAll}>
              <Ionicons name="wallet" size={16} color="#fff" />
              <Text style={styles.btnText}>{t('withdrawValue', { amount: portfolio.toLocaleString() })}</Text>
            </TouchableOpacity>
            {holdings.map((h) => {
              const invested = h.type === 'MF' ? h.units : (h.type === 'STOCK' ? h.units * h.avgPrice : h.avgPrice);
              const val = holdingValue(h);
              const gain = val - invested;
              return (
                <FinanceCard key={h.holdingId} padded={false}>
                  <ActivityRow
                    icon="trending-up"
                    iconColor={gain >= 0 ? fin.sections.invest.primary : fin.red}
                    iconBg={gain >= 0 ? fin.sections.invest.soft : (isDark ? '#3D2020' : '#F5EBEB')}
                    title={h.name}
                    category={`${h.type} · ${new Date(h.investedAt).toLocaleDateString('en-IN')}`}
                    amount={`₹${Math.round(val).toLocaleString()}`}
                    change={`${gain >= 0 ? '+' : ''}₹${Math.round(gain)}`}
                    changeUp={gain >= 0}
                  />
                  <TouchableOpacity style={styles.withdrawBtn} onPress={() => onWithdraw(h.holdingId, Math.round(val))}>
                    <Ionicons name="arrow-down-circle" size={15} color={fin.sections.invest.primary} />
                    <Text style={styles.withdrawText}>{t('withdrawValue', { amount: Math.round(val).toLocaleString() })}</Text>
                  </TouchableOpacity>
                </FinanceCard>
              );
            })}
          </>
        )
      ) : (
        <>
          {tab === 'NSE' && NSE_STOCKS.map((stock) => {
            const { price, changePct } = liveStockPrice(stock);
            const sel = selected === stock.symbol;
            return (
              <TouchableOpacity key={stock.symbol} onPress={() => setSelected(stock.symbol)} activeOpacity={0.8}>
                <FinanceCard style={sel ? styles.selected : undefined}>
                  <ActivityRow
                    icon="stats-chart"
                    iconColor={fin.sections.wealth.primary}
                    iconBg={fin.sections.wealth.soft}
                    title={stock.symbol}
                    category={`${stock.name} · ${stock.sector}`}
                    amount={`₹${price.toLocaleString()}`}
                    change={`${Math.abs(changePct)}%`}
                    changeUp={changePct >= 0}
                  />
                </FinanceCard>
              </TouchableOpacity>
            );
          })}
          {tab === 'FD' && FD_RATES.map((fd) => (
            <TouchableOpacity key={fd.bank} onPress={() => setSelected(fd.bank)}>
              <FinanceCard style={selected === fd.bank ? styles.selected : undefined}>
                <ActivityRow icon="lock-closed" iconColor={fin.sections.bills.accent} iconBg={fin.sections.bills.soft} title={fd.bank} category={`${fd.tenure} · min ₹${fd.minAmount}`} amount={`${fd.rate}%`} change="p.a." changeUp />
              </FinanceCard>
            </TouchableOpacity>
          ))}
          {tab === 'MF' && MUTUAL_FUNDS.map((mf) => (
            <TouchableOpacity key={mf.id} onPress={() => setSelected(mf.id)}>
              <FinanceCard style={selected === mf.id ? styles.selected : undefined}>
                <ActivityRow icon="pie-chart" iconColor={fin.sections.loans.primary} iconBg={fin.sections.loans.soft} title={mf.name} category={`${mf.category} · ${mf.risk}`} amount={`+${mf.oneYearReturn}%`} change="1Y" changeUp />
              </FinanceCard>
            </TouchableOpacity>
          ))}

          <FinanceCard>
            <Text style={styles.label}>{t('investmentAmount')}</Text>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholderTextColor={fin.textMuted} />
            <TouchableOpacity style={[styles.btn, !selected && styles.btnOff]} onPress={invest} disabled={!selected}>
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.btnText}>{selected ? t('investIn', { name: selected }) : t('selectAsset')}</Text>
            </TouchableOpacity>
          </FinanceCard>
        </>
      )}
    </FinanceLayout>
  );
}

function createStyles(fin: ReturnType<typeof getFinanceTheme>) {
  return StyleSheet.create({
    cardTitle: { color: fin.text, fontWeight: '800', fontSize: fontSize.md, marginBottom: spacing.sm },
    hint: { color: fin.textMuted, fontSize: fontSize.xs, marginTop: spacing.sm },
    empty: { color: fin.textSecondary, textAlign: 'center' },
    selected: { borderWidth: 2, borderColor: fin.sections.invest.primary },
    label: { color: fin.textSecondary, fontSize: fontSize.xs, fontWeight: '600', marginBottom: 8 },
    input: {
      backgroundColor: fin.bg, borderRadius: 14, padding: spacing.md,
      color: fin.text, fontSize: fontSize.md, marginBottom: spacing.md,
    },
    btn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: fin.sidebar, borderRadius: 20, padding: spacing.md,
    },
    btnOff: { opacity: 0.45 },
    btnText: { color: '#fff', fontWeight: '800' },
    withdrawAllBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: fin.sections.invest.primary, borderRadius: 20, padding: spacing.md, marginBottom: spacing.sm,
    },
    withdrawBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 10, marginHorizontal: spacing.md, marginBottom: spacing.md, marginTop: 4,
      borderRadius: 14, borderWidth: 1, borderColor: fin.sections.invest.primary + '55',
    },
    withdrawText: { color: fin.sections.invest.primary, fontWeight: '700', fontSize: fontSize.sm },
  });
}
