import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenWrapper from '../components/ScreenWrapper';
import UserAvatarButton from '../components/UserAvatarButton';
import { useAppTheme } from '../hooks/useAppTheme';
import { useI18n } from '../hooks/useI18n';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useSettingsStore } from '../store/useSettingsStore';
import { premium } from '../theme/premiumTheme';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { useAuthStore } from '../store/useAuthStore';
import { useWalletStore } from '../store/useWalletStore';
import { useTransitStore } from '../store/useTransitStore';
import { useNotificationsStore } from '../store/useNotificationsStore';
import { useRewardsStore } from '../store/useRewardsStore';
import type { RootTabParamList, RootStackParamList } from '../navigation/types';

const { width } = Dimensions.get('window');
const TILE = (width - spacing.lg * 2 - spacing.sm * 2) / 3;

type HomeNav = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const SERVICES: { icon: keyof typeof Ionicons.glyphMap; labelKey: 'metro' | 'busService' | 'parking' | 'events' | 'shop' | 'wallet'; route: keyof RootTabParamList; color: string; soft: string }[] = [
  { icon: 'train', labelKey: 'metro', route: 'Transit', color: premium.metro, soft: '#E8EEF8' },
  { icon: 'bus', labelKey: 'busService', route: 'Transit', color: premium.transit, soft: '#FEF3E8' },
  { icon: 'car', labelKey: 'parking', route: 'Parking', color: premium.parking, soft: '#E8F1FD' },
  { icon: 'sparkles', labelKey: 'events', route: 'City', color: premium.events, soft: '#F3E8FF' },
  { icon: 'bag-handle', labelKey: 'shop', route: 'Shop', color: premium.shop, soft: '#E6F5EF' },
  { icon: 'wallet', labelKey: 'wallet', route: 'Wallet', color: premium.wallet.primary, soft: premium.wallet.soft },
];

const TIER: Record<string, string> = { BRONZE: '#B8860B', SILVER: '#8B919A', GOLD: '#C9A227', PLATINUM: '#6B7280' };

export default function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const theme = useAppTheme();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const { balance, transactions, fetchDashboard, isLoading } = useWalletStore();
  const { activeJourney } = useTransitStore();
  const { unreadCount } = useNotificationsStore();
  const { loyaltyPoints, memberTier } = useRewardsStore();
  const showBalance = useSettingsStore((s) => s.showBalanceOnHome);
  const styles = useThemedStyles((th) => StyleSheet.create({
    scroll: { padding: spacing.lg, paddingBottom: 32 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
    greeting: { color: th.textSecondary, fontSize: fontSize.sm, fontWeight: '500' },
    userName: { color: th.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 },
    iconBtn: {
      width: 42, height: 42, borderRadius: 14, backgroundColor: th.surface,
      alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, ...th.shadowSoft,
    },
    dot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#B45309', borderWidth: 1.5, borderColor: th.surface },
    heroCard: { backgroundColor: th.home.hero, borderRadius: th.radiusLg, padding: spacing.lg, marginBottom: spacing.md, overflow: 'hidden', ...th.shadow },
    heroGlow: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: th.home.heroAccent, opacity: 0.4, right: -40, top: -40 },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: fontSize.sm, fontWeight: '600' },
    tierPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
    tierText: { fontSize: fontSize.xs, fontWeight: '700' },
    heroBalance: { color: '#fff', fontSize: 40, fontWeight: '900', marginVertical: spacing.md, letterSpacing: -1 },
    heroRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: spacing.md },
    heroMetaLbl: { color: 'rgba(255,255,255,0.6)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    heroMetaVal: { color: '#fff', fontWeight: '700', marginTop: 2, fontSize: fontSize.sm },
    heroCta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full },
    heroCtaText: { color: '#fff', fontWeight: '700', fontSize: fontSize.xs },
    statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    statCard: { flex: 1, backgroundColor: th.surface, borderRadius: th.radiusSm, padding: spacing.md, alignItems: 'center', ...th.shadowSoft },
    statVal: { color: th.text, fontWeight: '800', fontSize: fontSize.lg, marginTop: 6 },
    statLbl: { color: th.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2 },
    sectionTitle: { color: th.text, fontSize: fontSize.lg, fontWeight: '800', marginBottom: spacing.md, letterSpacing: -0.3 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: spacing.lg },
    tile: { width: TILE, alignItems: 'center', marginBottom: spacing.md },
    tileIcon: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6, ...th.shadowSoft },
    tileLabel: { color: th.textSecondary, fontSize: fontSize.xs, fontWeight: '600' },
    liveBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: th.surface, borderRadius: th.radius, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: th.home.heroSoft, ...th.shadowSoft },
    liveTag: { backgroundColor: '#B45309', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: spacing.sm },
    liveText: { color: '#fff', fontSize: 9, fontWeight: '800' },
    bannerTitle: { color: th.text, fontWeight: '700' },
    bannerSub: { color: th.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
    empty: { backgroundColor: th.surface, borderRadius: th.radius, padding: spacing.xl, alignItems: 'center', ...th.shadowSoft },
    emptyTitle: { color: th.text, fontWeight: '700', marginTop: spacing.sm },
    emptySub: { color: th.textMuted, fontSize: fontSize.sm, marginTop: 4 },
    txnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: th.surface, borderRadius: th.radiusSm, padding: spacing.md, marginBottom: spacing.sm, ...th.shadowSoft },
    txnIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    txnDesc: { color: th.text, fontWeight: '600', fontSize: fontSize.sm },
    txnTime: { color: th.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    txnAmt: { fontWeight: '800', fontSize: fontSize.sm },
  }));

  useEffect(() => { fetchDashboard(); }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('goodMorning');
    if (h < 17) return t('goodAfternoon');
    return t('goodEvening');
  };

  const userName = user?.name || t('guest');
  const tierColor = TIER[memberTier] || TIER.BRONZE;

  return (
    <ScreenWrapper edges={['top']} style={{ backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchDashboard} tintColor={theme.home.hero} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={22} color={theme.text} />
            {unreadCount > 0 && <View style={styles.dot} />}
          </TouchableOpacity>
          <UserAvatarButton size={42} />
        </View>

        {/* Hero wallet */}
        <TouchableOpacity style={styles.heroCard} activeOpacity={0.92} onPress={() => navigation.navigate('Wallet')}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>{t('oneLinkWallet')}</Text>
            <View style={[styles.tierPill, { borderColor: tierColor + '88' }]}>
              <Ionicons name="star" size={11} color={tierColor} />
              <Text style={[styles.tierText, { color: tierColor }]}>{memberTier}</Text>
            </View>
          </View>
          <Text style={styles.heroBalance}>
            {showBalance ? `₹${balance.toLocaleString('en-IN')}` : '••••••'}
          </Text>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroMetaLbl}>{user?.isCardPaired ? t('cardUid') : t('rfidCard')}</Text>
              <Text style={styles.heroMetaVal}>
                {user?.isCardPaired ? (user.cardUid || '—') : t('notPaired')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.heroMetaLbl}>{t('loyalty')}</Text>
              <Text style={styles.heroMetaVal}>{loyaltyPoints.toLocaleString()} pts</Text>
            </View>
          </View>
          <View style={styles.heroCta}>
            <Text style={styles.heroCtaText}>{t('openWallet')}</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Rewards')}>
            <Ionicons name="gift" size={20} color={premium.rewards.secondary} />
            <Text style={styles.statVal}>{loyaltyPoints}</Text>
            <Text style={styles.statLbl}>{t('rewards')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} activeOpacity={1}>
            <Ionicons name="time" size={20} color={theme.home.hero} />
            <Text style={styles.statVal}>{transactions.length}</Text>
            <Text style={styles.statLbl}>{t('recentHistory')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings" size={20} color={premium.settings.primary} />
            <Text style={styles.statVal}>⚙</Text>
            <Text style={styles.statLbl}>{t('settings')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>{t('exploreServicesTitle')}</Text>
        <View style={styles.grid}>
          {SERVICES.map((s) => (
            <TouchableOpacity key={s.labelKey} style={styles.tile} onPress={() => navigation.navigate(s.route)} activeOpacity={0.8}>
              <View style={[styles.tileIcon, { backgroundColor: theme.isDark ? theme.surfaceMuted : s.soft }]}>
                <Ionicons name={s.icon} size={24} color={s.color} />
              </View>
              <Text style={styles.tileLabel}>{t(s.labelKey)}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.tile} onPress={() => navigation.navigate('Canteen')}>
            <View style={[styles.tileIcon, { backgroundColor: theme.isDark ? theme.surfaceMuted : '#FFF7ED' }]}>
              <Ionicons name="restaurant" size={24} color={premium.canteen} />
            </View>
            <Text style={styles.tileLabel}>{t('canteen')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tile} onPress={() => navigation.navigate('VehicleInfo')}>
            <View style={[styles.tileIcon, { backgroundColor: theme.isDark ? theme.surfaceMuted : premium.settings.soft }]}>
              <Ionicons name="car-sport" size={24} color={premium.settings.primary} />
            </View>
            <Text style={styles.tileLabel}>{t('vehicle')}</Text>
          </TouchableOpacity>
        </View>

        {activeJourney && (
          <TouchableOpacity style={styles.liveBanner} onPress={() => navigation.navigate('Transit')}>
            <View style={styles.liveTag}><Text style={styles.liveText}>{t('live')}</Text></View>
            <Ionicons name="train" size={22} color={theme.metro} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={styles.bannerTitle}>{t('metroJourneyActive')}</Text>
              <Text style={styles.bannerSub}>{activeJourney.entryStation} · {activeJourney.durationMinutes} min</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>{t('recentActivity')}</Text>
        {transactions.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={36} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>{t('noActivity')}</Text>
            <Text style={styles.emptySub}>{t('transactionsAppear')}</Text>
          </View>
        ) : (
          transactions.slice(0, 5).map((txn) => {
            const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
              METRO: 'train', PARKING: 'car', SHOPPING: 'bag-handle', TOP_UP: 'add-circle', EVENT: 'sparkles',
            };
            const credit = txn.type === 'CREDIT';
            return (
              <View key={txn.transactionId} style={styles.txnRow}>
                <View style={[styles.txnIcon, { backgroundColor: credit ? '#E6F5EF' : '#FEF2F2' }]}>
                  <Ionicons name={icons[txn.category] || 'swap-horizontal'} size={18} color={credit ? premium.shop : '#B45309'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnDesc} numberOfLines={1}>{txn.description}</Text>
                  <Text style={styles.txnTime}>
                    {new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={[styles.txnAmt, { color: credit ? premium.shop : '#B45309' }]}>
                  {credit ? '+' : '-'}₹{Math.abs(txn.amount).toLocaleString()}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
