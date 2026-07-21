import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FinanceLayout from '../../components/account/FinanceLayout';
import FinanceCard from '../../components/account/FinanceCard';
import ActivityRow from '../../components/account/ActivityRow';
import ProgressBar from '../../components/account/ProgressBar';
import NfcPairingCard from '../../components/NfcPairingCard';
import { getFinanceTheme } from '../../theme/financeTheme';
import { useFinanceTheme } from '../../hooks/useFinanceTheme';
import { useI18n } from '../../hooks/useI18n';
import { useSettingsStore } from '../../store/useSettingsStore';
import { spacing, fontSize } from '../../theme/colors';
import { useAuthStore } from '../../store/useAuthStore';
import { useWalletStore } from '../../store/useWalletStore';
import { useRewardsStore } from '../../store/useRewardsStore';

export default function AccountDetailsScreen() {
  const { t } = useI18n();
  const isDark = useSettingsStore((s) => s.darkMode);
  const fin = useFinanceTheme();
  const styles = useMemo(() => createStyles(fin), [isDark]);
  const { user, updateNfcCard } = useAuthStore();
  const { banks, cards } = useWalletStore();
  const { memberTier, loyaltyPoints } = useRewardsStore();

  const initial = (user?.name || 'U').charAt(0).toUpperCase();
  const kycComplete = user?.isCardPaired ? 85 : 45;

  const rows = [
    { icon: 'person' as const, labelKey: 'fullName' as const, value: user?.name || '—' },
    { icon: 'at' as const, labelKey: 'username' as const, value: user?.username || user?.name || '—' },
    { icon: 'mail' as const, labelKey: 'email' as const, value: user?.email || '—' },
    { icon: 'call' as const, labelKey: 'phone' as const, value: user?.phone || t('notLinked') },
    { icon: 'star' as const, labelKey: 'memberTier' as const, value: memberTier },
  ];

  const handleToggleBlock = async (blocked: boolean) => {
    const ok = await updateNfcCard({ isBlocked: blocked });
    if (!ok) Alert.alert(t('settings'), t('connectionError'));
  };

  return (
    <FinanceLayout title={t('profile')} subtitle={t('profileSubtitle')}>
      <FinanceCard>
        <View style={styles.profileHead}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <Text style={styles.tier}>{memberTier} · {loyaltyPoints} {t('loyaltyPts')}</Text>
          </View>
        </View>
        <Text style={styles.kycLbl}>{t('profileCompletion')}</Text>
        <ProgressBar progress={kycComplete} color={fin.sections.profile.accent} height={8} />
        <Text style={styles.kycSub}>
          {t('percentComplete', { n: kycComplete })} · {user?.isCardPaired ? t('cardLinked') : t('pairRfid')}
        </Text>
      </FinanceCard>

      <NfcPairingCard showControls onToggleBlock={handleToggleBlock} />

      <Text style={styles.section}>{t('personalInfo')}</Text>
      {rows.map((r) => (
        <FinanceCard key={r.labelKey} padded={false}>
          <ActivityRow icon={r.icon} iconColor={fin.text} iconBg={fin.bg} title={r.value} category={t(r.labelKey)} />
        </FinanceCard>
      ))}

      <Text style={styles.section}>{t('linkedCards')}</Text>
      {cards.length === 0 ? (
        <FinanceCard><Text style={styles.empty}>{t('noCardsLinked')}</Text></FinanceCard>
      ) : (
        cards.map((c) => (
          <FinanceCard key={c.cardId}>
            <View style={styles.cardRow}>
              <View style={[styles.cardChip, { backgroundColor: c.colorHex || fin.sidebar }]}>
                <Ionicons name="card" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bankName}>{c.bankName}</Text>
                <Text style={styles.bankMeta}>{c.network} · ••{c.cardNumberLast4}</Text>
              </View>
              <Text style={styles.cardType}>{c.cardType}</Text>
            </View>
          </FinanceCard>
        ))
      )}

      <Text style={styles.section}>{t('bankAccounts')}</Text>
      {banks.length === 0 ? (
        <FinanceCard><Text style={styles.empty}>{t('noBanksLinked')}</Text></FinanceCard>
      ) : (
        banks.map((b) => (
          <FinanceCard key={b.accountId}>
            <ActivityRow
              icon="business"
              iconColor={fin.blue}
              iconBg={isDark ? fin.sidebarMuted : '#EEF2FF'}
              title={b.bankName}
              category={`${b.accountType} · ••${b.accountNumberLast4}`}
              amount={`₹${b.balance.toLocaleString()}`}
            />
          </FinanceCard>
        ))
      )}

      <FinanceCard>
        <Text style={styles.uidLbl}>{t('userId')}</Text>
        <Text style={styles.uid}>{user?.userId || '—'}</Text>
      </FinanceCard>
    </FinanceLayout>
  );
}

function createStyles(fin: ReturnType<typeof getFinanceTheme>) {
  return StyleSheet.create({
    profileHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
    avatar: {
      width: 64, height: 64, borderRadius: 20, backgroundColor: fin.sidebar,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: '#fff', fontSize: 26, fontWeight: '900' },
    name: { color: fin.text, fontWeight: '800', fontSize: fontSize.lg },
    email: { color: fin.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
    tier: { color: fin.gold, fontSize: fontSize.xs, fontWeight: '700', marginTop: 4 },
    kycLbl: { color: fin.textSecondary, fontSize: fontSize.xs, fontWeight: '600', marginBottom: 6 },
    kycSub: { color: fin.textMuted, fontSize: fontSize.xs, marginTop: 6 },
    section: { color: fin.text, fontWeight: '800', fontSize: fontSize.md, marginBottom: spacing.sm, marginTop: spacing.sm },
    empty: { color: fin.textSecondary, textAlign: 'center' },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    cardChip: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    bankName: { color: fin.text, fontWeight: '700' },
    bankMeta: { color: fin.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
    cardType: { color: fin.textMuted, fontSize: fontSize.xs, fontWeight: '600' },
    uidLbl: { color: fin.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    uid: { color: fin.textSecondary, fontSize: fontSize.xs, marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  });
}
