import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PremiumLayout from '../components/PremiumLayout';
import PremiumCard from '../components/PremiumCard';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { useRewardsStore } from '../store/useRewardsStore';
import { useI18n } from '../hooks/useI18n';
import { useAppTheme } from '../hooks/useAppTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';

const TIER: Record<string, { color: string; gradient: [string, string] }> = {
  BRONZE: { color: '#B8860B', gradient: ['#FBF6EA', '#F5E6C8'] },
  SILVER: { color: '#6B7280', gradient: ['#F3F4F6', '#E5E7EB'] },
  GOLD: { color: '#C9A227', gradient: ['#FBF6EA', '#F0DFA8'] },
  PLATINUM: { color: '#374151', gradient: ['#F9FAFB', '#E5E7EB'] },
};

const PARTNER_OFFERS = [
  { id: '1', title: 'Metro 10% off', points: 200, desc: 'Next metro ride discount', icon: 'train' as const },
  { id: '2', title: 'Free parking 1hr', points: 350, desc: 'Smart parking voucher', icon: 'car' as const },
  { id: '3', title: 'Event ₹100 off', points: 500, desc: 'BookMyShow partner offer', icon: 'sparkles' as const },
  { id: '4', title: 'Grocery ₹50 off', points: 250, desc: 'QuickComm shop voucher', icon: 'bag-handle' as const },
];

export default function RewardsScreen() {
  const { loyaltyPoints, memberTier, redemptionHistory, load, redeemPoints, getTierBenefits } = useRewardsStore();
  const { t } = useI18n();
  const theme = useAppTheme();
  const styles = useThemedStyles((th) => StyleSheet.create({
    hero: { borderRadius: th.radiusLg, padding: spacing.lg, marginBottom: spacing.md, ...th.shadow },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full, borderWidth: 1.5, backgroundColor: th.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)' },
    tierName: { fontWeight: '800', fontSize: fontSize.sm },
    heroLabel: { color: th.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
    heroPoints: { color: th.text, fontSize: 48, fontWeight: '900', marginVertical: spacing.sm, letterSpacing: -1 },
    heroHint: { color: th.textMuted, fontSize: fontSize.xs },
    section: { color: th.text, fontSize: fontSize.md, fontWeight: '800', marginBottom: spacing.sm, marginTop: spacing.sm, letterSpacing: -0.3 },
    benefitRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
    benefitBorder: { borderBottomWidth: 1, borderBottomColor: th.border },
    benefitLabel: { color: th.textSecondary, fontSize: fontSize.sm },
    benefitValue: { color: th.text, fontSize: fontSize.sm, fontWeight: '700' },
    input: { backgroundColor: th.surfaceMuted, borderRadius: th.radiusSm, padding: spacing.md, color: th.text, fontSize: fontSize.xl, fontWeight: '800', marginBottom: spacing.sm },
    quickRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    chip: { backgroundColor: th.surfaceMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full },
    chipActive: { backgroundColor: th.rewards.soft, borderWidth: 1, borderColor: th.rewards.secondary },
    chipText: { color: th.textSecondary, fontWeight: '700' },
    chipTextActive: { color: th.rewards.primary },
    primaryBtn: { backgroundColor: th.rewards.secondary, padding: spacing.md, borderRadius: th.radiusSm, alignItems: 'center' },
    primaryBtnText: { color: '#fff', fontWeight: '800' },
    offerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: th.surface, borderRadius: th.radius, padding: spacing.md, marginBottom: spacing.sm, ...th.shadowSoft },
    offerIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: th.rewards.soft, alignItems: 'center', justifyContent: 'center' },
    offerTitle: { color: th.text, fontWeight: '700', fontSize: fontSize.md },
    offerDesc: { color: th.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    offerPts: { alignItems: 'center', backgroundColor: th.rewards.soft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
    offerPtsText: { color: th.rewards.primary, fontWeight: '900', fontSize: fontSize.md },
    offerPtsLbl: { color: th.rewards.secondary, fontSize: 9, fontWeight: '700' },
    historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
    historyDesc: { color: th.text, fontSize: fontSize.sm, fontWeight: '600' },
    historyDate: { color: th.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    historyCredit: { color: th.shop, fontWeight: '800' },
    empty: { color: th.textMuted, textAlign: 'center', padding: spacing.md },
  }));

  const [redeemInput, setRedeemInput] = useState('500');
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, []);

  const tier = TIER[memberTier] || TIER.GOLD;
  const benefits = getTierBenefits();

  const handleRedeem = async () => {
    const points = parseInt(redeemInput, 10);
    if (!Number.isFinite(points)) {
      Alert.alert(t('invalidNumber'), t('enterValidNumber'));
      return;
    }
    setBusy(true);
    const result = await redeemPoints(points);
    setBusy(false);
    Alert.alert(result.success ? t('success') : t('failed'), result.message);
    if (result.success) setRedeemInput('500');
  };

  const handlePartnerOffer = (offer: typeof PARTNER_OFFERS[0]) => {
    if (loyaltyPoints < offer.points) {
      Alert.alert(t('notEnoughPoints'), t('needPoints', { n: offer.points }));
      return;
    }
    Alert.alert(t('claimOffer'), `${offer.title}\n${offer.desc}`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('claim'),
        onPress: async () => {
          setBusy(true);
          const result = await redeemPoints(offer.points);
          setBusy(false);
          Alert.alert(result.success ? t('offerClaimed') : t('failed'), result.message);
        },
      },
    ]);
  };

  return (
    <PremiumLayout title={t('rewards')} subtitle={t('loyaltyOffers')} accent={theme.rewards.secondary}>
      <View style={[styles.hero, { backgroundColor: theme.isDark ? theme.surfaceMuted : tier.gradient[0] }]}>
        <View style={styles.heroTop}>
          <View style={[styles.tierBadge, { borderColor: tier.color }]}>
            <Ionicons name="star" size={14} color={tier.color} />
            <Text style={[styles.tierName, { color: tier.color }]}>{memberTier}</Text>
          </View>
          <Text style={styles.heroLabel}>{t('yourPoints')}</Text>
        </View>
        <Text style={styles.heroPoints}>{loyaltyPoints.toLocaleString()}</Text>
        <Text style={styles.heroHint}>{t('pointsRate')}</Text>
      </View>

      <Text style={styles.section}>{t('tierBenefits')}</Text>
      <PremiumCard>
        {benefits.map((b, i) => (
          <View key={b.label} style={[styles.benefitRow, i < benefits.length - 1 && styles.benefitBorder]}>
            <Text style={styles.benefitLabel}>{b.label}</Text>
            <Text style={styles.benefitValue}>{b.value}</Text>
          </View>
        ))}
      </PremiumCard>

      <Text style={styles.section}>{t('redeemPoints')}</Text>
      <PremiumCard>
        <TextInput style={styles.input} value={redeemInput} onChangeText={setRedeemInput} keyboardType="numeric" placeholder="500" placeholderTextColor={theme.textMuted} />
        <View style={styles.quickRow}>
          {['100', '250', '500', '1000'].map((v) => (
            <TouchableOpacity key={v} style={[styles.chip, redeemInput === v && styles.chipActive]} onPress={() => setRedeemInput(v)}>
              <Text style={[styles.chipText, redeemInput === v && styles.chipTextActive]}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleRedeem} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('redeemWallet')}</Text>}
        </TouchableOpacity>
      </PremiumCard>

      <Text style={styles.section}>{t('partnerOffers')}</Text>
      {PARTNER_OFFERS.map((offer) => (
        <TouchableOpacity key={offer.id} style={styles.offerCard} onPress={() => handlePartnerOffer(offer)} activeOpacity={0.85}>
          <View style={styles.offerIcon}>
            <Ionicons name={offer.icon} size={22} color={theme.rewards.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.offerTitle}>{offer.title}</Text>
            <Text style={styles.offerDesc}>{offer.desc}</Text>
          </View>
          <View style={styles.offerPts}>
            <Text style={styles.offerPtsText}>{offer.points}</Text>
            <Text style={styles.offerPtsLbl}>{t('pts')}</Text>
          </View>
        </TouchableOpacity>
      ))}

      <Text style={styles.section}>{t('redemptionHistory')}</Text>
      <PremiumCard>
        {redemptionHistory.length === 0 ? (
          <Text style={styles.empty}>{t('noRedemptions')}</Text>
        ) : (
          redemptionHistory.slice(0, 10).map((r, i) => (
            <View key={r.id} style={[styles.historyRow, i < Math.min(redemptionHistory.length, 10) - 1 && styles.benefitBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyDesc}>{r.description}</Text>
                <Text style={styles.historyDate}>{new Date(r.date).toLocaleString()}</Text>
              </View>
              <Text style={styles.historyCredit}>+₹{r.creditAmount}</Text>
            </View>
          ))
        )}
      </PremiumCard>
    </PremiumLayout>
  );
}
