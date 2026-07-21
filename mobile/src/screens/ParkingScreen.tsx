import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, TextInput, Alert, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenWrapper from '../components/ScreenWrapper';
import { colors, spacing, borderRadius, fontSize, shadows } from '../theme/colors';
import { useAppTheme } from '../hooks/useAppTheme';
import { useI18n } from '../hooks/useI18n';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useMobilityStore, type ParkingReceipt } from '../store/useMobilityStore';
import { useAuthStore } from '../store/useAuthStore';
import { getChargingStations, searchChargersByCity, POPULAR_CITIES, type TransformedCharger } from '../services/openChargeMapApi';
import type { RootTabParamList, RootStackParamList } from '../navigation/types';

type ParkingNav = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Parking'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function ParkingScreen() {
  const navigation = useNavigation<ParkingNav>();
  const theme = useAppTheme();
  const { t } = useI18n();
  const styles = useThemedStyles((th) => StyleSheet.create({
    container: { flex: 1 },
    content: { paddingBottom: 100 },
    header: { backgroundColor: th.parkingHeader, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xl, borderBottomLeftRadius: borderRadius.xl, borderBottomRightRadius: borderRadius.xl, ...shadows.elevated },
    headerTop: { marginBottom: spacing.lg },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: { color: colors.white, fontSize: fontSize.xxxl, fontWeight: '800' },
    headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: fontSize.sm, marginTop: 4 },
    searchRow: { flexDirection: 'row', gap: spacing.sm },
    citySearchRow: { flexDirection: 'row', gap: spacing.sm },
    activeCityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
    activeCityText: { color: th.parking, fontSize: fontSize.sm, fontWeight: '700' },
    cityScroll: { marginHorizontal: spacing.lg, marginBottom: spacing.sm },
    cityChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: th.surface, borderRadius: borderRadius.full, borderWidth: 1, borderColor: th.border, marginRight: spacing.sm },
    cityChipActive: { backgroundColor: th.parking, borderColor: th.parking },
    cityChipText: { color: th.textSecondary, fontWeight: '600', fontSize: fontSize.sm },
    cityChipTextActive: { color: colors.white },
    searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: th.surface, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...shadows.soft },
    searchInput: { flex: 1, fontSize: fontSize.md, color: th.text, paddingVertical: 4 },
    searchSubmit: { backgroundColor: th.parking, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    tabToggle: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: th.surfaceMuted, borderRadius: borderRadius.full, padding: 4 },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm, borderRadius: borderRadius.full },
    tabBtnActive: { backgroundColor: th.parking },
    tabBtnText: { color: th.parking, fontWeight: '700', fontSize: fontSize.sm },
    tabBtnTextActive: { color: colors.white },
    vehicleCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: th.surface, borderRadius: borderRadius.lg, padding: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...shadows.card },
    vehicleLabel: { color: th.text, fontSize: fontSize.md, fontWeight: '700' },
    vehicleHint: { color: th.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    vehicleRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    numberPlate: { flexDirection: 'row', borderWidth: 2, borderColor: th.text, borderRadius: 6, overflow: 'hidden', backgroundColor: th.surface },
    indBar: { backgroundColor: '#1E3A8A', paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center' },
    indText: { color: colors.white, fontSize: 8, fontWeight: 'bold', transform: [{ rotate: '-90deg' }] },
    plateText: { paddingHorizontal: 12, paddingVertical: 6, fontSize: fontSize.lg, fontWeight: 'bold', color: th.text, letterSpacing: 1 },
    evHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: spacing.lg, marginTop: spacing.xl },
    sectionTitle: { color: th.text, fontSize: fontSize.xl, fontWeight: '800', marginHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
    evCount: { color: th.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
    sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: spacing.lg, marginBottom: spacing.md },
    sourceBadgeText: { color: th.parking, fontSize: fontSize.xs, fontWeight: '600' },
    filterScroll: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
    filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: th.surface, borderRadius: borderRadius.full, borderWidth: 1, borderColor: th.border, marginRight: spacing.sm },
    filterChipActive: { backgroundColor: th.parking, borderColor: th.parking },
    filterChipText: { color: th.textSecondary, fontWeight: '600', fontSize: fontSize.sm },
    filterChipTextActive: { color: colors.white },
    loadingBox: { alignItems: 'center', paddingVertical: spacing.xxl },
    loadingText: { color: th.textMuted, marginTop: spacing.md, fontSize: fontSize.md },
    errorBox: { alignItems: 'center', marginHorizontal: spacing.lg, paddingVertical: spacing.xxl, backgroundColor: th.surfaceMuted, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: th.border },
    errorText: { color: colors.error, fontWeight: '600', marginTop: spacing.sm, textAlign: 'center' },
    retryBtn: { marginTop: spacing.md, backgroundColor: colors.error, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
    retryText: { color: colors.white, fontWeight: '700' },
    emptyBox: { alignItems: 'center', marginHorizontal: spacing.lg, paddingVertical: spacing.xxl },
    emptyText: { color: th.text, fontWeight: '700', fontSize: fontSize.lg, marginTop: spacing.sm },
    emptySubText: { color: th.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
    chargerCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: th.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: th.border, ...shadows.card },
    chargerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm },
    chargerIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: th.parking, alignItems: 'center', justifyContent: 'center' },
    chargerName: { color: th.text, fontWeight: '700', fontSize: fontSize.md },
    chargerAddress: { color: th.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full, marginBottom: 4, alignSelf: 'flex-end' },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 11, fontWeight: '700' },
    distanceText: { color: th.textMuted, fontSize: 11, textAlign: 'right' },
    connectorsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
    connectorChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: th.parking + '12', paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm },
    connectorChipText: { color: th.parking, fontWeight: '600', fontSize: 11 },
    fastTag: { backgroundColor: colors.parkingRed, color: colors.white, fontSize: 9, fontWeight: '800', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, marginLeft: 2 },
    chargerBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
    chargerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
    chargerMetaText: { color: th.textMuted, fontSize: 11 },
    directionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: th.parking, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
    directionBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
    activeSessionCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: th.goldSoft, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.parkingYellow, ...shadows.soft },
    activeSessionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    livePulse: { backgroundColor: colors.parkingYellow, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm, marginRight: spacing.sm },
    liveText: { color: th.text, fontSize: fontSize.xs, fontWeight: '800' },
    activeSessionTitle: { color: th.text, fontSize: fontSize.lg, fontWeight: '700' },
    activeStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg, backgroundColor: th.surface, padding: spacing.md, borderRadius: borderRadius.md },
    activeStat: { flex: 1 },
    activeStatLabel: { color: th.textMuted, fontSize: fontSize.xs, marginBottom: 2 },
    activeStatValue: { color: th.text, fontSize: fontSize.xl, fontWeight: '800' },
    sessionHint: { color: th.textMuted, fontSize: fontSize.xs, marginTop: spacing.sm, textAlign: 'center' },
    statusSummary: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: spacing.lg, marginTop: spacing.lg, paddingVertical: spacing.sm, backgroundColor: th.surfaceMuted, borderRadius: borderRadius.full },
    statusItem: { flexDirection: 'row', alignItems: 'center' },
    statusDotSmall: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
    statusItemText: { color: th.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
    parkingGridCard: { marginHorizontal: spacing.lg, backgroundColor: th.surfaceMuted, borderRadius: borderRadius.xl, padding: spacing.md, marginTop: spacing.sm },
    zoneTitle: { color: th.text, fontSize: fontSize.md, fontWeight: '700', marginBottom: spacing.md },
    spotGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
    spotCard: { width: '31%', backgroundColor: th.surface, borderRadius: borderRadius.md, borderWidth: 1, overflow: 'hidden', ...shadows.soft },
    spotHeader: { paddingVertical: spacing.sm, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: th.border },
    spotId: { fontSize: fontSize.md, fontWeight: '800' },
    spotStatus: { textAlign: 'center', fontSize: 10, fontWeight: '600', color: th.textMuted, marginTop: spacing.xs, textTransform: 'uppercase' },
    spotRate: { textAlign: 'center', fontSize: 10, color: th.textSecondary, marginBottom: spacing.xs },
    receiptCard: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: th.surface, borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: th.border, ...shadows.soft },
    receiptTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
    receiptSpot: { color: th.text, fontWeight: '800', fontSize: fontSize.md },
    receiptAmount: { color: th.parking, fontWeight: '800', fontSize: fontSize.md },
    receiptMeta: { color: th.textMuted, fontSize: fontSize.xs },
    parkingSubToggle: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.sm },
    parkingSubBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center', backgroundColor: th.surface, borderWidth: 1, borderColor: th.border },
    parkingSubBtnActive: { backgroundColor: th.parking, borderColor: th.parking },
    parkingSubBtnText: { color: th.textSecondary, fontWeight: '700', fontSize: fontSize.sm },
    parkingSubBtnTextActive: { color: colors.white },
    analysisCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: th.surface, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: th.border, ...shadows.card },
    analysisTitle: { color: th.text, fontSize: fontSize.lg, fontWeight: '800', marginBottom: spacing.md },
    analysisGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    analysisStat: { width: '47%', backgroundColor: th.surfaceMuted, borderRadius: borderRadius.md, padding: spacing.sm },
    analysisStatLabel: { color: th.textMuted, fontSize: fontSize.xs },
    analysisStatValue: { color: th.text, fontSize: fontSize.lg, fontWeight: '800', marginTop: 2 },
    zoneBreakdown: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: th.border },
    zoneBreakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    zoneBreakdownText: { color: th.textSecondary, fontSize: fontSize.xs },
    spotName: { textAlign: 'center', fontSize: 9, fontWeight: '700', color: th.text, marginTop: 2, paddingHorizontal: 2 },
    spotTimer: { textAlign: 'center', fontSize: 9, fontWeight: '600', color: th.parking, marginTop: 2 },
    spotMineBadge: { textAlign: 'center', fontSize: 8, fontWeight: '800', color: colors.parkingYellow, marginTop: 2, textTransform: 'uppercase' },
    receiptDetailRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    receiptDetailLabel: { color: th.textMuted, fontSize: fontSize.xs },
    receiptDetailValue: { color: th.textSecondary, fontSize: fontSize.xs, fontWeight: '600' },
    emptyReceipts: { marginHorizontal: spacing.lg, padding: spacing.xl, alignItems: 'center', backgroundColor: th.surfaceMuted, borderRadius: borderRadius.lg },
  }));

  const { spots, userSpot, parkingReceipts, isLoading, fetchMobilityData, fetchParkingReceipts, reserveSpot, setupRealtimeUpdates } = useMobilityStore();
  const user = useAuthStore((s) => s.user);
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('UP 32 XX 1234');
  const [elapsedMin, setElapsedMin] = useState(0);
  const [activeTab, setActiveTab] = useState<'PARKING' | 'EV'>('PARKING');
  const [parkingView, setParkingView] = useState<'spots' | 'receipts'>('spots');
  const [nowTick, setNowTick] = useState(Date.now());

  // EV Charger state from OpenChargeMap
  const [evChargers, setEvChargers] = useState<TransformedCharger[]>([]);
  const [evLoading, setEvLoading] = useState(false);
  const [evError, setEvError] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'CCS' | 'CHAdeMO' | 'Type 2'>('All');
  const [cityQuery, setCityQuery] = useState('');
  const [activeCity, setActiveCity] = useState('Lucknow');
  const [activeCountry, setActiveCountry] = useState('India');

  const translateSpotStatus = (status: string) => {
    if (status === 'FREE') return t('free');
    if (status === 'OCCUPIED') return t('occupied');
    if (status === 'RESERVED') return t('reserved');
    return status;
  };

  useEffect(() => {
    fetchMobilityData();
    fetchParkingReceipts();
    setupRealtimeUpdates();
    loadChargers();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const activeSpot = spots.find(s => s.spotId === userSpot);
    if (!userSpot || !activeSpot?.entryTime) { setElapsedMin(0); return; }
    const ms = nowTick - new Date(activeSpot.entryTime).getTime();
    setElapsedMin(Math.max(0, Math.floor(ms / 60000)));
  }, [userSpot, spots, nowTick]);

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const isMySpot = (spot: typeof spots[0]) =>
    spot.spotId === userSpot || (!!user?.userId && spot.occupiedBy === user.userId);

  const getSpotTimerText = (spot: typeof spots[0]) => {
    if (spot.status === 'OCCUPIED' && spot.entryTime) {
      const mins = Math.max(0, Math.floor((nowTick - new Date(spot.entryTime).getTime()) / 60000));
      return formatDuration(mins);
    }
    if (spot.status === 'RESERVED' && spot.reservedUntil) {
      const mins = Math.max(0, Math.floor((new Date(spot.reservedUntil).getTime() - nowTick) / 60000));
      return mins > 0 ? `${formatDuration(mins)} left` : 'Expiring';
    }
    return null;
  };

  const getSpotLabel = (spot: typeof spots[0]) => {
    if (spot.status === 'FREE') return translateSpotStatus('FREE');
    const name = isMySpot(spot) ? (user?.name ?? 'You') : (spot.occupantName ?? 'Guest');
    if (spot.status === 'OCCUPIED') return isMySpot(spot) ? `Booked · ${name}` : `Allocated · ${name}`;
    return isMySpot(spot) ? `Reserved · ${name}` : `Reserved · ${name}`;
  };

  const receiptAnalysis = (() => {
    const list = parkingReceipts;
    const totalSpent = list.reduce((s, r) => s + (r.amount ?? 0), 0);
    const totalMinutes = list.reduce((s, r) => s + (r.durationMinutes ?? 0), 0);
    const sessions = list.length;
    const avgDuration = sessions ? Math.round(totalMinutes / sessions) : 0;
    const avgCost = sessions ? Math.round(totalSpent / sessions) : 0;
    const zoneMap: Record<string, { visits: number; spent: number }> = {};
    for (const r of list) {
      const z = r.zone || r.spotId?.[0] || '?';
      if (!zoneMap[z]) zoneMap[z] = { visits: 0, spent: 0 };
      zoneMap[z].visits += 1;
      zoneMap[z].spent += r.amount ?? 0;
    }
    const topZone = Object.entries(zoneMap).sort((a, b) => b[1].visits - a[1].visits)[0];
    return { totalSpent, sessions, avgDuration, avgCost, zoneMap, topZone };
  })();

  const loadChargersForCity = async (cityName: string, lat?: number, lng?: number) => {
    setEvLoading(true);
    setEvError('');
    setActiveCity(cityName);
    try {
      let chargers: TransformedCharger[] = [];
      if (lat !== undefined && lng !== undefined) {
        chargers = await getChargingStations(lat, lng, 30, 50);
        setActiveCountry((POPULAR_CITIES.find(c => c.name === cityName) as { country?: string } | undefined)?.country || '');
      } else {
        const result = await searchChargersByCity(cityName, 30, 50);
        if (!result.location) {
          setEvError(t('cityNotFound', { city: cityName }));
          setEvChargers([]);
          return;
        }
        chargers = result.chargers;
        setActiveCountry('country' in result.location ? String(result.location.country || '') : '');
        setActiveCity(result.location.name);
      }
      setEvChargers(chargers);
      if (chargers.length === 0) setEvError(t('noChargersNearCity', { city: cityName }));
    } catch {
      setEvError(t('couldNotLoadChargers'));
    } finally {
      setEvLoading(false);
    }
  };

  const loadChargers = () => loadChargersForCity('Lucknow', 26.8467, 80.9462);

  const handleCitySearch = () => {
    if (!cityQuery.trim()) return;
    loadChargersForCity(cityQuery.trim());
  };

  const handleReserve = (spotId: string) => {
    if (userSpot) {
      Alert.alert(
        'One spot at a time',
        `You already have spot ${userSpot}. Vacate it at the Pi kiosk before booking another.`,
      );
      return;
    }
    Alert.alert(t('reserveSpotTitle'), t('confirmReserveSpot', { id: spotId }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('reserve'), onPress: () => reserveSpot(spotId) },
    ]);
  };

  const getSpotColor = (status: string) => {
    if (status === 'FREE') return colors.parkingGreen;
    if (status === 'OCCUPIED') return colors.parkingRed;
    if (status === 'RESERVED') return colors.parkingYellow;
    return colors.gray300;
  };

  const freeCount = spots.filter(s => s.status === 'FREE').length;
  const occupiedCount = spots.filter(s => s.status === 'OCCUPIED').length;
  const reservedCount = spots.filter(s => s.status === 'RESERVED').length;
  const activeSpotDetails = spots.find(s => s.spotId === userSpot);
  const estimatedCharges = activeSpotDetails ? elapsedMin * activeSpotDetails.ratePerMinute : 0;

  const displayChargers = evChargers.filter(c => {
    if (filterType === 'All') return true;
    return c.connectors.some(conn => conn.type.includes(filterType));
  });

  const zoneA = spots.filter(s => s.zone === 'A' && (!searchQuery || s.spotId.toLowerCase().includes(searchQuery.toLowerCase())));
  const zoneB = spots.filter(s => s.zone === 'B' && (!searchQuery || s.spotId.toLowerCase().includes(searchQuery.toLowerCase())));
  const zoneC = spots.filter(s => s.zone === 'C' && (!searchQuery || s.spotId.toLowerCase().includes(searchQuery.toLowerCase())));
  const zoneD = spots.filter(s => s.zone === 'D' && (!searchQuery || s.spotId.toLowerCase().includes(searchQuery.toLowerCase())));
  const zoneE = spots.filter(s => s.zone === 'E' && (!searchQuery || s.spotId.toLowerCase().includes(searchQuery.toLowerCase())));

  const renderZone = (title: string, zoneSpots: typeof spots) => (
    <>
      <Text style={[styles.zoneTitle, title !== t('zoneA') ? { marginTop: spacing.lg } : undefined]}>{title}</Text>
      <View style={styles.spotGrid}>
        {zoneSpots.map(spot => {
          const mine = isMySpot(spot);
          const timerText = getSpotTimerText(spot);
          const canReserve = spot.status === 'FREE' && !userSpot;
          return (
            <TouchableOpacity
              key={spot.spotId}
              style={[styles.spotCard, { borderColor: getSpotColor(spot.status), borderWidth: mine ? 2 : 1 }]}
              onPress={() => { if (canReserve) handleReserve(spot.spotId); }}
              disabled={!canReserve}
            >
              <View style={[styles.spotHeader, { backgroundColor: getSpotColor(spot.status) + '20' }]}>
                <Text style={[styles.spotId, { color: getSpotColor(spot.status) }]}>{spot.spotId}</Text>
              </View>
              <Text style={styles.spotStatus} numberOfLines={2}>{getSpotLabel(spot)}</Text>
              {mine && spot.status !== 'FREE' && <Text style={styles.spotMineBadge}>Your spot</Text>}
              {timerText && <Text style={styles.spotTimer}>{spot.status === 'OCCUPIED' ? `⏱ ${timerText}` : `⏳ ${timerText}`}</Text>}
              {spot.status === 'FREE' && <Text style={styles.spotRate}>₹{spot.ratePerMinute}{t('perMin')}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  const renderReceiptCard = (r: ParkingReceipt) => {
    const rate = r.ratePerMinute ?? (r.durationMinutes ? Math.round(r.amount / r.durationMinutes) : 0);
    return (
      <View key={r.receiptId} style={styles.receiptCard}>
        <View style={styles.receiptTop}>
          <Text style={styles.receiptSpot}>{r.spotId} · Zone {r.zone}</Text>
          <Text style={styles.receiptAmount}>₹{r.amount}</Text>
        </View>
        <Text style={styles.receiptMeta}>
          {new Date(r.entryTime).toLocaleString()} → {new Date(r.exitTime).toLocaleString()}
        </Text>
        <View style={styles.receiptDetailRow}>
          <Text style={styles.receiptDetailLabel}>Duration</Text>
          <Text style={styles.receiptDetailValue}>{formatDuration(r.durationMinutes)}</Text>
        </View>
        <View style={styles.receiptDetailRow}>
          <Text style={styles.receiptDetailLabel}>Rate</Text>
          <Text style={styles.receiptDetailValue}>₹{rate}/min</Text>
        </View>
        <View style={styles.receiptDetailRow}>
          <Text style={styles.receiptDetailLabel}>Receipt ID</Text>
          <Text style={styles.receiptDetailValue}>{r.receiptId}</Text>
        </View>
      </View>
    );
  };

  const openChargerDirection = (lat: number, lng: number, name: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${name}`;
    Linking.openURL(url).catch(() => Alert.alert(t('error'), t('couldNotOpenMaps')));
  };

  return (
    <ScreenWrapper edges={['top']} style={{ backgroundColor: theme.bg }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || evLoading}
            onRefresh={() => { fetchMobilityData(); fetchParkingReceipts(); loadChargers(); }}
            tintColor={theme.parking}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="car" size={22} color={colors.white} style={{ marginRight: spacing.sm }} />
              <Text style={styles.headerTitle}>{t('smartMobility')}</Text>
            </View>
            <Text style={styles.headerSub}>{t('parkingEv')}</Text>
          </View>
          {activeTab === 'EV' ? (
            <View style={styles.citySearchRow}>
              <View style={styles.searchBar}>
                <Ionicons name="globe-outline" size={18} color={theme.textMuted} style={{ marginRight: spacing.sm }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('searchCity')}
                  placeholderTextColor={theme.textMuted}
                  value={cityQuery}
                  onChangeText={setCityQuery}
                  onSubmitEditing={handleCitySearch}
                />
                {cityQuery.length > 0 && (
                  <TouchableOpacity onPress={handleCitySearch} style={styles.searchSubmit}>
                    <Ionicons name="search" size={16} color={colors.white} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.searchRow}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={theme.textMuted} style={{ marginRight: spacing.sm }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('searchSpot')}
                  placeholderTextColor={theme.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>
          )}
        </View>

        {/* Tab toggle */}
        <View style={styles.tabToggle}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'EV' && styles.tabBtnActive]} onPress={() => setActiveTab('EV')}>
            <Ionicons name="flash" size={16} color={activeTab === 'EV' ? colors.white : theme.parking} />
            <Text style={[styles.tabBtnText, activeTab === 'EV' && styles.tabBtnTextActive]}>{t('evChargers')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'PARKING' && styles.tabBtnActive]} onPress={() => setActiveTab('PARKING')}>
            <Ionicons name="car" size={16} color={activeTab === 'PARKING' ? colors.white : theme.parking} />
            <Text style={[styles.tabBtnText, activeTab === 'PARKING' && styles.tabBtnTextActive]}>{t('parkingSpots')}</Text>
          </TouchableOpacity>
        </View>

        {/* Vehicle Card */}
        <TouchableOpacity
          style={styles.vehicleCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('VehicleInfo', { plate: vehicleNumber })}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.vehicleLabel}>{t('myVehicle')}</Text>
            <Text style={styles.vehicleHint}>{t('tapRto')}</Text>
          </View>
          <View style={styles.vehicleRight}>
            <View style={styles.numberPlate}>
              <View style={styles.indBar}><Text style={styles.indText}>IND</Text></View>
              <Text style={styles.plateText}>{vehicleNumber}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </View>
        </TouchableOpacity>

        {/* ─────────── EV CHARGERS TAB ─────────── */}
        {activeTab === 'EV' && (
          <>
            <View style={styles.evHeaderRow}>
              <Text style={styles.sectionTitle}>{t('evChargingStations')}</Text>
              <Text style={styles.evCount}>{t('chargersFound', { n: displayChargers.length })}</Text>
            </View>

            {/* Active city */}
            <View style={styles.activeCityBadge}>
              <Ionicons name="location" size={14} color={theme.parking} />
              <Text style={styles.activeCityText}>{activeCity}{activeCountry ? `, ${activeCountry}` : ''}</Text>
            </View>

            {/* Popular cities */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cityScroll}>
              {POPULAR_CITIES.map((city) => (
                <TouchableOpacity
                  key={city.name}
                  style={[styles.cityChip, activeCity === city.name && styles.cityChipActive]}
                  onPress={() => { setCityQuery(''); loadChargersForCity(city.name, city.lat, city.lng); }}
                >
                  <Text style={[styles.cityChipText, activeCity === city.name && styles.cityChipTextActive]}>
                    {city.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Source badge */}
            <View style={styles.sourceBadge}>
              <Ionicons name="globe-outline" size={14} color={theme.parking} />
              <Text style={styles.sourceBadgeText}>{t('openChargeMapSource')}</Text>
            </View>

            {/* Filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {(['All', 'CCS', 'CHAdeMO', 'Type 2'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, filterType === f && styles.filterChipActive]}
                  onPress={() => setFilterType(f)}
                >
                  <Text style={[styles.filterChipText, filterType === f && styles.filterChipTextActive]}>
                    {f === 'All' ? t('all') : f}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {evLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={theme.parking} size="large" />
                <Text style={styles.loadingText}>{t('fetchingChargers')}</Text>
              </View>
            ) : evError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={40} color={colors.error} />
                <Text style={styles.errorText}>{evError}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={loadChargers}>
                  <Text style={styles.retryText}>{t('retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : displayChargers.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="flash-outline" size={40} color={theme.textMuted} />
                <Text style={styles.emptyText}>{t('noChargersFound')}</Text>
                <Text style={styles.emptySubText}>{t('trySearchCity')}</Text>
              </View>
            ) : (
              displayChargers.map((charger) => (
                <View key={charger.id} style={styles.chargerCard}>
                  <View style={styles.chargerTop}>
                    <View style={styles.chargerIconWrap}>
                      <Ionicons name="flash" size={20} color={colors.white} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chargerName} numberOfLines={2}>{charger.name}</Text>
                      <Text style={styles.chargerAddress} numberOfLines={1}>
                        {charger.address}, {charger.city}
                      </Text>
                    </View>
                    <View>
                      <View style={[styles.statusBadge, { backgroundColor: charger.isOperational ? colors.parkingGreen + '20' : colors.parkingRed + '20' }]}>
                        <View style={[styles.statusDot, { backgroundColor: charger.isOperational ? colors.parkingGreen : colors.parkingRed }]} />
                        <Text style={[styles.statusText, { color: charger.isOperational ? colors.parkingGreen : colors.parkingRed }]}>
                          {charger.isOperational ? t('operational') : t('offline')}
                        </Text>
                      </View>
                      {charger.distance > 0 && (
                        <Text style={styles.distanceText}>{t('kmAway', { n: charger.distance })}</Text>
                      )}
                    </View>
                  </View>

                  {/* Connectors */}
                  {charger.connectors.length > 0 && (
                    <View style={styles.connectorsWrap}>
                      {charger.connectors.slice(0, 4).map((conn, i) => (
                        <View key={i} style={styles.connectorChip}>
                          <Ionicons name="flash" size={10} color={theme.parking} />
                          <Text style={styles.connectorChipText}>
                            {conn.type.replace('IEC ', '').replace('SAE ', '')} · {conn.powerKw}kW
                          </Text>
                          {conn.isFastCharge && (
                            <Text style={styles.fastTag}>{t('fast')}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.chargerBottom}>
                    <View style={styles.chargerMeta}>
                      <Ionicons name="business-outline" size={12} color={theme.textMuted} />
                      <Text style={styles.chargerMetaText} numberOfLines={1}>{charger.operator}</Text>
                    </View>
                    <View style={styles.chargerMeta}>
                      <Ionicons name="people-outline" size={12} color={theme.textMuted} />
                      <Text style={styles.chargerMetaText}>{charger.usageType}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.directionBtn}
                      onPress={() => openChargerDirection(charger.latitude, charger.longitude, charger.name)}
                    >
                      <Ionicons name="navigate" size={14} color={colors.white} />
                      <Text style={styles.directionBtnText}>{t('directions')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* ─────────── PARKING SPOTS TAB ─────────── */}
        {activeTab === 'PARKING' && (
          <>
            <View style={styles.parkingSubToggle}>
              <TouchableOpacity
                style={[styles.parkingSubBtn, parkingView === 'spots' && styles.parkingSubBtnActive]}
                onPress={() => setParkingView('spots')}
              >
                <Text style={[styles.parkingSubBtnText, parkingView === 'spots' && styles.parkingSubBtnTextActive]}>Live Spots</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.parkingSubBtn, parkingView === 'receipts' && styles.parkingSubBtnActive]}
                onPress={() => setParkingView('receipts')}
              >
                <Text style={[styles.parkingSubBtnText, parkingView === 'receipts' && styles.parkingSubBtnTextActive]}>Receipts & Analysis</Text>
              </TouchableOpacity>
            </View>

            {parkingView === 'spots' && (
              <>
                {userSpot && activeSpotDetails && (
                  <View style={styles.activeSessionCard}>
                    <View style={styles.activeSessionHeader}>
                      <View style={styles.livePulse}><Text style={styles.liveText}>{t('active')}</Text></View>
                      <Text style={styles.activeSessionTitle}>
                        {activeSpotDetails.status === 'RESERVED' ? 'Reserved' : 'Booked'} · {user?.name ?? 'You'} · {t('spotLabel', { id: userSpot })}
                      </Text>
                    </View>
                    <View style={styles.activeStatsRow}>
                      <View style={styles.activeStat}>
                        <Text style={styles.activeStatLabel}>
                          {activeSpotDetails.status === 'RESERVED' ? 'Time remaining' : t('elapsedTime')}
                        </Text>
                        <Text style={styles.activeStatValue}>
                          {activeSpotDetails.status === 'RESERVED' && activeSpotDetails.reservedUntil
                            ? getSpotTimerText(activeSpotDetails) ?? '—'
                            : `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m`}
                        </Text>
                      </View>
                      <View style={styles.activeStat}>
                        <Text style={styles.activeStatLabel}>{t('currentCharges')}</Text>
                        <Text style={styles.activeStatValue}>₹{estimatedCharges}</Text>
                      </View>
                    </View>
                    <Text style={styles.sessionHint}>Vacate at the Pi kiosk — tap your spot and card to pay & leave</Text>
                  </View>
                )}

                <View style={styles.statusSummary}>
                  <View style={styles.statusItem}><View style={[styles.statusDotSmall, { backgroundColor: colors.parkingGreen }]} /><Text style={styles.statusItemText}>{t('freeCount', { n: freeCount })}</Text></View>
                  <View style={styles.statusItem}><View style={[styles.statusDotSmall, { backgroundColor: colors.parkingRed }]} /><Text style={styles.statusItemText}>{t('occupiedCount', { n: occupiedCount })}</Text></View>
                  <View style={styles.statusItem}><View style={[styles.statusDotSmall, { backgroundColor: colors.parkingYellow }]} /><Text style={styles.statusItemText}>{t('reservedCount', { n: reservedCount })}</Text></View>
                </View>

                <Text style={styles.sectionTitle}>{t('availableSpots')}</Text>
                <View style={styles.parkingGridCard}>
                  {renderZone(t('zoneA'), zoneA)}
                  {renderZone(t('zoneB'), zoneB)}
                  {renderZone('Zone C', zoneC)}
                  {renderZone('Zone D', zoneD)}
                  {renderZone('Zone E', zoneE)}
                </View>
              </>
            )}

            {parkingView === 'receipts' && (
              <>
                <View style={styles.analysisCard}>
                  <Text style={styles.analysisTitle}>Parking Analysis</Text>
                  <View style={styles.analysisGrid}>
                    <View style={styles.analysisStat}>
                      <Text style={styles.analysisStatLabel}>Total spent</Text>
                      <Text style={styles.analysisStatValue}>₹{receiptAnalysis.totalSpent}</Text>
                    </View>
                    <View style={styles.analysisStat}>
                      <Text style={styles.analysisStatLabel}>Sessions</Text>
                      <Text style={styles.analysisStatValue}>{receiptAnalysis.sessions}</Text>
                    </View>
                    <View style={styles.analysisStat}>
                      <Text style={styles.analysisStatLabel}>Avg duration</Text>
                      <Text style={styles.analysisStatValue}>{formatDuration(receiptAnalysis.avgDuration)}</Text>
                    </View>
                    <View style={styles.analysisStat}>
                      <Text style={styles.analysisStatLabel}>Avg cost</Text>
                      <Text style={styles.analysisStatValue}>₹{receiptAnalysis.avgCost}</Text>
                    </View>
                  </View>
                  {receiptAnalysis.topZone && (
                    <View style={styles.zoneBreakdown}>
                      <Text style={[styles.analysisStatLabel, { marginBottom: spacing.xs }]}>Most used zone</Text>
                      <Text style={styles.analysisStatValue}>
                        Zone {receiptAnalysis.topZone[0]} · {receiptAnalysis.topZone[1].visits} visits · ₹{receiptAnalysis.topZone[1].spent}
                      </Text>
                      {Object.entries(receiptAnalysis.zoneMap).map(([zone, stats]) => (
                        <View key={zone} style={styles.zoneBreakdownRow}>
                          <Text style={styles.zoneBreakdownText}>Zone {zone}</Text>
                          <Text style={styles.zoneBreakdownText}>{stats.visits} visits · ₹{stats.spent}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <Text style={styles.sectionTitle}>Parking Receipts</Text>
                {parkingReceipts.length === 0 ? (
                  <View style={styles.emptyReceipts}>
                    <Ionicons name="receipt-outline" size={36} color={theme.textMuted} />
                    <Text style={[styles.emptyText, { fontSize: fontSize.md }]}>No parking receipts yet</Text>
                    <Text style={styles.emptySubText}>Exit parking at the Pi kiosk to generate a receipt</Text>
                  </View>
                ) : (
                  parkingReceipts.map(renderReceiptCard)
                )}
              </>
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenWrapper>
  );
}
