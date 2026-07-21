import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Linking,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../components/ScreenWrapper';
import MetroMapComponent from '../components/MetroMapComponent';
import { colors, spacing, borderRadius, fontSize, shadows } from '../theme/colors';
import { useAppTheme } from '../hooks/useAppTheme';
import { useI18n } from '../hooks/useI18n';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTransitStore } from '../store/useTransitStore';
import { getStationsBetween } from '../data/mockData';
import { getBusRoutes, getChaloAppUrl, type ChaloRoute } from '../services/chaloBusApi';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type TransitMode = 'METRO' | 'BUS';

function generateQrPattern(token: string, size: number) {
  const rows: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      const hash = (token.charCodeAt((r * size + c) % token.length) + r * 7 + c * 13) % 2;
      row.push(hash === 0 || (r < 3 && c < 3) || (r < 3 && c >= size - 3) || (r >= size - 3 && c < 3));
    }
    rows.push(row);
  }
  return rows;
}

export default function TransitScreen() {
  const theme = useAppTheme();
  const { t } = useI18n();
  const styles = useThemedStyles((th) =>
    StyleSheet.create({
      mapHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: th.surface,
        borderBottomWidth: 1,
        borderBottomColor: th.border,
      },
      mapHeaderText: { color: colors.metro, fontSize: fontSize.sm, fontWeight: '700', flex: 1 },
      mapToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        backgroundColor: colors.metro + '15',
        borderRadius: borderRadius.full,
      },
      mapToggleBtnActive: { backgroundColor: colors.metro },
      mapToggleText: { color: colors.metro, fontSize: fontSize.xs, fontWeight: '700' },
      scroll: { flex: 1 },
      content: { padding: spacing.lg, paddingBottom: 24 },
      modeToggle: {
        flexDirection: 'row',
        backgroundColor: th.surface,
        borderRadius: borderRadius.full,
        padding: 4,
        marginBottom: spacing.lg,
        ...shadows.soft,
      },
      modeBtn: {
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.full,
      },
      modeBtnActive: { backgroundColor: colors.metro },
      modeText: { color: th.textSecondary, fontWeight: '600', fontSize: fontSize.md },
      modeTextActive: { color: colors.white, fontWeight: '700' },
      bookingCard: {
        backgroundColor: colors.metro,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        ...shadows.elevated,
        marginBottom: spacing.lg,
      },
      stationsRow: { flexDirection: 'row', alignItems: 'center' },
      stationNodes: { alignItems: 'center', marginRight: spacing.md },
      originDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.metroGreen },
      connectorLine: { width: 2, height: 32, backgroundColor: 'rgba(255,255,255,0.4)', marginVertical: 4 },
      destDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.metroRed },
      stationInputs: { flex: 1 },
      stationText: { color: colors.white, fontSize: fontSize.lg, fontWeight: '700', paddingVertical: spacing.sm },
      stationPlaceholder: { opacity: 0.6, fontWeight: '500' },
      divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
      swapBtn: { padding: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: borderRadius.md },
      resetRow: { marginTop: spacing.sm, alignItems: 'flex-end' },
      resetText: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.sm },
      cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.2)',
        paddingTop: spacing.lg,
      },
      bookBtn: { backgroundColor: colors.white, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
      bookBtnText: { color: colors.metro, fontWeight: '700', fontSize: fontSize.md },
      fareDisplay: { color: colors.white, fontSize: fontSize.xxl, fontWeight: '800' },
      routeCard: {
        backgroundColor: th.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        ...shadows.card,
        marginBottom: spacing.lg,
      },
      routeRow: { flexDirection: 'row' },
      routeLine: { alignItems: 'center', marginRight: spacing.md, paddingTop: 4 },
      routeDotOutline: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.metroGreen, backgroundColor: th.surface },
      routeLineBar: { width: 2, flex: 1, minHeight: 24, backgroundColor: colors.metro, marginVertical: 4 },
      routeStation: { fontSize: fontSize.md, fontWeight: '700', color: th.text, marginVertical: 4 },
      viewStopsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: spacing.xs },
      viewStopsText: { color: colors.metro, fontSize: fontSize.sm, fontWeight: '600' },
      intermediateStop: { color: th.textMuted, fontSize: fontSize.sm, marginLeft: spacing.sm, marginVertical: 2 },
      chaloBanner: {
        backgroundColor: th.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
        ...shadows.card,
      },
      chaloLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
      chaloLogo: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.metro, alignItems: 'center', justifyContent: 'center' },
      chaloTitle: { color: th.text, fontWeight: '700', fontSize: fontSize.md },
      chaloSub: { color: th.textMuted, fontSize: fontSize.xs, marginTop: 2 },
      chaloAppBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colors.metro, borderRadius: borderRadius.full },
      chaloAppText: { color: colors.metro, fontSize: fontSize.xs, fontWeight: '700' },
      lastUpdated: { color: th.textMuted, fontSize: fontSize.xs, marginBottom: spacing.sm, textAlign: 'right' },
      busLoading: { alignItems: 'center', paddingVertical: spacing.xxl },
      busLoadingText: { color: th.textMuted, marginTop: spacing.md, fontSize: fontSize.md },
      routeSection: { marginBottom: spacing.lg },
      routeSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
      routeSectionTitle: { color: th.text, fontWeight: '700', fontSize: fontSize.md, marginBottom: spacing.sm, marginTop: spacing.xs },
      filterToggle: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full, borderWidth: 1, borderColor: th.border },
      filterToggleActive: { backgroundColor: colors.metro, borderColor: colors.metro },
      filterToggleText: { color: th.textSecondary, fontSize: fontSize.xs, fontWeight: '700' },
      filterToggleTextActive: { color: colors.white },
      routeScroll: { marginBottom: spacing.sm },
      routeChip: {
        backgroundColor: th.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginRight: spacing.sm,
        borderWidth: 1,
        borderColor: th.border,
        minWidth: 120,
        ...shadows.soft,
      },
      routeChipActive: { backgroundColor: colors.metro, borderColor: colors.metro },
      routeChipNo: { color: colors.metro, fontWeight: '800', fontSize: fontSize.lg },
      routeChipNoActive: { color: colors.white },
      routeChipName: { color: th.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
      routeChipNameActive: { color: 'rgba(255,255,255,0.9)' },
      routeInfo: {
        backgroundColor: th.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        ...shadows.card,
      },
      routeInfoTitle: { color: th.text, fontWeight: '800', fontSize: fontSize.md, marginBottom: spacing.sm },
      routeInfoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.sm },
      routeInfoText: { color: th.text, fontWeight: '600', fontSize: fontSize.sm, flex: 1 },
      routeInfoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.metro + '12', paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm },
      routeInfoBadgeText: { color: colors.metro, fontSize: fontSize.xs, fontWeight: '600' },
      timingRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
      timingBox: { flex: 1, backgroundColor: th.surfaceMuted, borderRadius: borderRadius.sm, padding: spacing.xs, alignItems: 'center' },
      timingLabel: { color: th.textMuted, fontSize: 9, fontWeight: '600' },
      timingValue: { color: th.text, fontSize: 10, fontWeight: '800', marginTop: 2 },
      stopsTitle: { color: th.text, fontWeight: '700', fontSize: fontSize.sm, marginBottom: spacing.sm, marginTop: spacing.sm },
      timingSectionTitle: { color: th.text, fontWeight: '700', fontSize: fontSize.sm, marginBottom: spacing.xs },
      stopListItem: { flexDirection: 'row', marginBottom: 0 },
      stopListLeft: { width: 24, alignItems: 'center' },
      stopListDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.metro, zIndex: 1 },
      stopListDotStart: { backgroundColor: '#22C55E' },
      stopListDotEnd: { backgroundColor: '#EF4444' },
      stopListLine: { width: 2, flex: 1, minHeight: 28, backgroundColor: colors.metro + '50', marginVertical: 0 },
      stopListContent: { flex: 1, paddingBottom: spacing.sm, paddingLeft: spacing.sm },
      stopListNum: { color: th.textMuted, fontSize: 10, fontWeight: '600' },
      stopListName: { color: th.text, fontSize: fontSize.sm, fontWeight: '600' },
      allRoutesTitle: { color: th.text, fontWeight: '800', fontSize: fontSize.lg, marginTop: spacing.lg, marginBottom: spacing.sm },
      routeSummaryCard: {
        backgroundColor: th.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        ...shadows.card,
        borderWidth: 1,
        borderColor: th.border,
      },
      routeSummaryCardActive: { borderColor: colors.metro, borderWidth: 2 },
      routeSummaryLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
      routeSummaryNo: { width: 52, height: 52, borderRadius: borderRadius.md, backgroundColor: colors.metro, alignItems: 'center', justifyContent: 'center' },
      routeSummaryNoText: { color: colors.white, fontWeight: '800', fontSize: fontSize.sm },
      routeSummaryName: { color: th.text, fontWeight: '700', fontSize: fontSize.sm },
      routeSummaryStops: { color: th.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
      routeSummaryMeta: { color: th.textMuted, fontSize: 10, marginTop: 4 },
      cabCard: { backgroundColor: th.surface, borderRadius: borderRadius.lg, padding: spacing.lg, ...shadows.card, marginTop: spacing.md },
      cabTitle: { color: th.text, fontSize: fontSize.lg, fontWeight: '700', marginBottom: 4 },
      cabSub: { color: th.textMuted, fontSize: fontSize.sm, marginBottom: spacing.lg },
      cabBrands: { flexDirection: 'row', gap: spacing.md },
      uberBtn: { flex: 1, backgroundColor: colors.gray900, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center' },
      uberText: { color: colors.white, fontSize: fontSize.lg, fontWeight: '700' },
      rapidoBtn: { flex: 1, backgroundColor: '#F9C100', borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center' },
      rapidoText: { color: colors.gray900, fontSize: fontSize.lg, fontWeight: '800' },
      modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
      pickerModal: {
        backgroundColor: th.surface,
        borderTopLeftRadius: borderRadius.xxl,
        borderTopRightRadius: borderRadius.xxl,
        paddingTop: spacing.xl,
        maxHeight: SCREEN_HEIGHT * 0.75,
      },
      pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        marginBottom: spacing.md,
      },
      pickerTitle: { color: th.text, fontSize: fontSize.xl, fontWeight: '700' },
      pickerCount: { color: th.textMuted, fontSize: fontSize.sm },
      pickerList: { flexGrow: 0 },
      pickerOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: th.border,
      },
      stationNumBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.metro + '15',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
      },
      stationNumText: { color: colors.metro, fontSize: 10, fontWeight: '700' },
      pickerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.metro, marginRight: spacing.md },
      pickerOptionText: { color: th.text, fontSize: fontSize.md, fontWeight: '500' },
      pickerCancel: { alignItems: 'center', paddingVertical: spacing.lg, borderTopWidth: 1, borderTopColor: th.border },
      pickerCancelText: { color: colors.metroRed, fontSize: fontSize.md, fontWeight: '600' },
      qrModal: {
        backgroundColor: th.surface,
        borderTopLeftRadius: borderRadius.xxl,
        borderTopRightRadius: borderRadius.xxl,
        padding: spacing.xl,
        paddingBottom: 48,
        alignItems: 'center',
      },
      modalClose: { position: 'absolute', top: spacing.lg, right: spacing.lg, zIndex: 1 },
      qrTitle: { color: th.text, fontSize: fontSize.xl, fontWeight: '700', marginTop: spacing.sm },
      qrId: { color: th.textMuted, fontSize: fontSize.sm, marginBottom: spacing.lg },
      qrRoute: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
      qrStation: { color: th.text, fontSize: fontSize.md, fontWeight: '700' },
      qrCodeContainer: { padding: spacing.md, backgroundColor: th.surface, borderWidth: 1, borderColor: th.border, borderRadius: borderRadius.md, marginBottom: spacing.sm },
      qrBlock: { width: 14, height: 14 },
      qrToken: { color: th.textMuted, fontSize: fontSize.xs, letterSpacing: 2, marginBottom: spacing.md },
      qrPrice: { color: th.text, fontSize: fontSize.xxl, fontWeight: '800', marginBottom: spacing.xs },
      qrHint: { color: th.textMuted, fontSize: fontSize.sm },
    })
  );

  const {
    activeTicket,
    metroStations,
    busRoutes,
    isLoading,
    fetchOptions,
    fetchActiveJourney,
    bookTicket,
    setupRealtimeUpdates,
  } = useTransitStore();

  const [mode, setMode] = useState<TransitMode>('METRO');
  const [selectedFrom, setSelectedFrom] = useState('');
  const [selectedTo, setSelectedTo] = useState('');
  const [showPicker, setShowPicker] = useState<'from' | 'to' | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [showStops, setShowStops] = useState(false);
  const [showMetroMap, setShowMetroMap] = useState(false);

  const [chaloRoutes, setChaloRoutes] = useState<ChaloRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<ChaloRoute | null>(null);
  const [busLoading, setBusLoading] = useState(false);

  useEffect(() => {
    fetchOptions();
    fetchActiveJourney();
    setupRealtimeUpdates();
  }, []);

  useEffect(() => {
    if (mode === 'BUS') {
      loadBusData();
    }
  }, [mode]);

  const loadBusData = async () => {
    setBusLoading(true);
    try {
      const routes = await getBusRoutes('lucknow');
      setChaloRoutes(routes);
      if (routes.length > 0 && !selectedRoute) setSelectedRoute(routes[0]);
    } catch (e) {
      console.error('Bus data load error', e);
    } finally {
      setBusLoading(false);
    }
  };

  const swapStations = () => {
    const tmp = selectedFrom;
    setSelectedFrom(selectedTo);
    setSelectedTo(tmp);
  };

  const stationList = mode === 'METRO' ? metroStations : [];

  let previewFare = 10;
  if (selectedFrom && selectedTo && stationList.length > 0) {
    const startIndex = stationList.indexOf(selectedFrom);
    const endIndex = stationList.indexOf(selectedTo);
    if (startIndex !== -1 && endIndex !== -1) {
      const travel = Math.abs(endIndex - startIndex);
      if (travel === 1) previewFare = 10;
      else if (travel === 2) previewFare = 15;
      else if (travel >= 3 && travel <= 6) previewFare = 20;
      else if (travel >= 7 && travel <= 9) previewFare = 30;
      else if (travel >= 10 && travel <= 13) previewFare = 40;
      else if (travel >= 14 && travel <= 17) previewFare = 50;
      else if (travel >= 18) previewFare = 60;
    }
  }

  let intermediateStops: string[] = [];
  try {
    if (selectedFrom && selectedTo && stationList.length > 0) {
      intermediateStops = getStationsBetween(selectedFrom, selectedTo, stationList) || [];
    }
  } catch (e) {
    console.error('getStationsBetween error', e);
  }

  const handleBook = async () => {
    if (!selectedFrom || !selectedTo) {
      Alert.alert(t('selectStations'), t('chooseBoth'));
      return;
    }
    if (selectedFrom === selectedTo) {
      Alert.alert(t('invalidRoute'), t('differentStations'));
      return;
    }
    if (activeTicket) {
      setShowQR(true);
      return;
    }
    const success = await bookTicket(selectedFrom, selectedTo, mode);
    if (success) setShowQR(true);
    else Alert.alert(t('bookingFailed'), t('insufficientBalance'));
  };

  const openCab = (provider: 'uber' | 'rapido') => {
    const url = provider === 'uber' ? 'https://m.uber.com/looking' : 'https://m.rapido.bike';
    const providerLabel = provider === 'uber' ? 'Uber' : 'Rapido';
    Linking.openURL(url).catch(() =>
      Alert.alert(t('unableToOpen'), t('providerLaunchFailed', { provider: providerLabel }))
    );
  };

  const openChaloApp = () => {
    Linking.openURL(getChaloAppUrl()).catch(() =>
      Alert.alert(t('unableToOpen'), t('chaloOpenFailed'))
    );
  };

  const qrToken = activeTicket?.qrToken || 'DEMO';
  const qrPattern = generateQrPattern(qrToken, 8);

  return (
    <ScreenWrapper edges={['top']} style={{ backgroundColor: theme.metroBg }}>
      <View style={styles.mapHeader}>
        <Ionicons name="location" size={16} color={colors.metro} />
        <Text style={styles.mapHeaderText}>
          {mode === 'METRO' ? t('lucknowMetro') : t('lucknowBus')}
        </Text>
        {mode === 'METRO' && (
          <TouchableOpacity
            style={[styles.mapToggleBtn, showMetroMap && styles.mapToggleBtnActive]}
            onPress={() => setShowMetroMap(!showMetroMap)}
          >
            <Ionicons name="map" size={16} color={showMetroMap ? colors.white : colors.metro} />
            <Text style={[styles.mapToggleText, showMetroMap && { color: colors.white }]}>
              {showMetroMap ? t('hideMap') : t('viewMap')}
            </Text>
          </TouchableOpacity>
        )}
        {mode === 'BUS' && (
          <TouchableOpacity style={styles.mapToggleBtn} onPress={loadBusData}>
            <Ionicons name="refresh" size={16} color={colors.metro} />
            <Text style={styles.mapToggleText}>{t('refresh')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || busLoading}
            onRefresh={mode === 'METRO' ? fetchOptions : loadBusData}
            tintColor={colors.metro}
          />
        }
      >
        {showMetroMap && mode === 'METRO' && (
          <MetroMapComponent
            stations={metroStations}
            selectedFrom={selectedFrom}
            selectedTo={selectedTo}
            onStationPress={(station) => {
              if (!selectedFrom) {
                setSelectedFrom(station);
              } else if (!selectedTo) {
                setSelectedTo(station);
              } else {
                setSelectedFrom(station);
                setSelectedTo('');
              }
            }}
          />
        )}

        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'METRO' && styles.modeBtnActive]}
            onPress={() => { setMode('METRO'); setSelectedFrom(''); setSelectedTo(''); }}
          >
            <Ionicons name="train" size={16} color={mode === 'METRO' ? colors.white : theme.textSecondary} />
            <Text style={[styles.modeText, mode === 'METRO' && styles.modeTextActive]}>{t('metro')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'BUS' && styles.modeBtnActive]}
            onPress={() => { setMode('BUS'); setSelectedFrom(''); setSelectedTo(''); }}
          >
            <Ionicons name="bus" size={16} color={mode === 'BUS' ? colors.white : theme.textSecondary} />
            <Text style={[styles.modeText, mode === 'BUS' && styles.modeTextActive]}>{t('cityBus')}</Text>
          </TouchableOpacity>
        </View>

        {mode === 'METRO' && (
          <>
            <View style={styles.bookingCard}>
              <View style={styles.stationsRow}>
                <View style={styles.stationNodes}>
                  <View style={styles.originDot} />
                  <View style={styles.connectorLine} />
                  <View style={styles.destDot} />
                </View>
                <View style={styles.stationInputs}>
                  <TouchableOpacity onPress={() => setShowPicker('from')}>
                    <Text style={[styles.stationText, !selectedFrom && styles.stationPlaceholder]}>
                      {selectedFrom || t('selectDeparture')}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.divider} />
                  <TouchableOpacity onPress={() => setShowPicker('to')}>
                    <Text style={[styles.stationText, !selectedTo && styles.stationPlaceholder]}>
                      {selectedTo || t('selectDestination')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.swapBtn} onPress={swapStations}>
                  <Ionicons name="swap-vertical" size={20} color={colors.white} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.resetRow}
                onPress={() => { setSelectedFrom(''); setSelectedTo(''); setShowStops(false); }}
              >
                <Text style={styles.resetText}>{t('resetRoute')}</Text>
              </TouchableOpacity>

              <View style={styles.cardFooter}>
                <TouchableOpacity style={styles.bookBtn} onPress={handleBook}>
                  <Text style={styles.bookBtnText}>
                    {activeTicket ? t('viewQrTicket') : t('bookTicket')}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.fareDisplay}>₹{previewFare}</Text>
              </View>
            </View>

            {selectedFrom && selectedTo && (
              <View style={styles.routeCard}>
                <View style={styles.routeRow}>
                  <View style={styles.routeLine}>
                    <View style={styles.routeDotOutline} />
                    <View style={styles.routeLineBar} />
                    <View style={[styles.routeDotOutline, { borderColor: colors.metroRed }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeStation}>{selectedFrom}</Text>
                    <TouchableOpacity style={styles.viewStopsBtn} onPress={() => setShowStops(!showStops)}>
                      <Text style={styles.viewStopsText}>
                        {showStops ? t('hideStops') : t('viewStopsCount', { n: intermediateStops.length })}
                      </Text>
                      <Ionicons name={showStops ? 'chevron-up' : 'chevron-down'} size={14} color={colors.metro} />
                    </TouchableOpacity>
                    {showStops && intermediateStops.slice(1, -1).map((stop) => (
                      <Text key={stop} style={styles.intermediateStop}>· {stop}</Text>
                    ))}
                    <Text style={styles.routeStation}>{selectedTo}</Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        {mode === 'BUS' && (
          <>
            <View style={styles.chaloBanner}>
              <View style={styles.chaloLeft}>
                <View style={styles.chaloLogo}>
                  <Ionicons name="bus" size={20} color={colors.white} />
                </View>
                <View>
                  <Text style={styles.chaloTitle}>{t('lctslCityBus')}</Text>
                  <Text style={styles.chaloSub}>{t('routesOfficialTimetable', { n: chaloRoutes.length })}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.chaloAppBtn} onPress={openChaloApp}>
                <Text style={styles.chaloAppText}>{t('viewInApp')}</Text>
                <Ionicons name="open-outline" size={14} color={colors.metro} />
              </TouchableOpacity>
            </View>

            {busLoading ? (
              <View style={styles.busLoading}>
                <ActivityIndicator color={colors.metro} size="large" />
                <Text style={styles.busLoadingText}>{t('loadingRoutes')}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.routeSectionTitle}>{t('selectRouteCount', { n: chaloRoutes.length })}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.routeScroll}>
                  {chaloRoutes.map((route) => (
                    <TouchableOpacity
                      key={route.routeId}
                      style={[styles.routeChip, selectedRoute?.routeId === route.routeId && styles.routeChipActive]}
                      onPress={() => setSelectedRoute(route)}
                    >
                      <Text style={[styles.routeChipNo, selectedRoute?.routeId === route.routeId && styles.routeChipNoActive]}>
                        {route.routeNumber}
                      </Text>
                      <Text style={[styles.routeChipName, selectedRoute?.routeId === route.routeId && styles.routeChipNameActive]} numberOfLines={2}>
                        {route.fromStop} → {route.toStop}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {selectedRoute && (
                  <View style={styles.routeInfo}>
                    <Text style={styles.routeInfoTitle}>{selectedRoute.routeNumber} · {selectedRoute.routeName}</Text>
                    <View style={styles.routeInfoRow}>
                      <Ionicons name="location" size={14} color={colors.metro} />
                      <Text style={styles.routeInfoText}>{selectedRoute.fromStop}</Text>
                      <Ionicons name="arrow-forward" size={14} color={theme.textMuted} />
                      <Text style={styles.routeInfoText} numberOfLines={1}>{selectedRoute.toStop}</Text>
                    </View>
                    <View style={styles.routeInfoRow}>
                      <View style={styles.routeInfoBadge}>
                        <Ionicons name="time" size={12} color={colors.metro} />
                        <Text style={styles.routeInfoBadgeText}>{selectedRoute.frequency}</Text>
                      </View>
                      <View style={styles.routeInfoBadge}>
                        <Ionicons name="business" size={12} color={colors.metro} />
                        <Text style={styles.routeInfoBadgeText}>{selectedRoute.depot}</Text>
                      </View>
                      <View style={styles.routeInfoBadge}>
                        <Ionicons name="speedometer" size={12} color={colors.metro} />
                        <Text style={styles.routeInfoBadgeText}>{selectedRoute.distance.toFixed(1)} km</Text>
                      </View>
                    </View>

                    <Text style={styles.timingSectionTitle}>{t('operatingHours')}</Text>
                    <View style={styles.timingRow}>
                      <View style={styles.timingBox}>
                        <Text style={styles.timingLabel}>{t('upFirst')}</Text>
                        <Text style={styles.timingValue}>{selectedRoute.operationalHours.start}</Text>
                      </View>
                      <View style={styles.timingBox}>
                        <Text style={styles.timingLabel}>{t('upLast')}</Text>
                        <Text style={styles.timingValue}>{selectedRoute.operationalHours.end}</Text>
                      </View>
                      <View style={styles.timingBox}>
                        <Text style={styles.timingLabel}>{t('downFirst')}</Text>
                        <Text style={styles.timingValue}>{selectedRoute.returnHours.start}</Text>
                      </View>
                      <View style={styles.timingBox}>
                        <Text style={styles.timingLabel}>{t('downLast')}</Text>
                        <Text style={styles.timingValue}>{selectedRoute.returnHours.end}</Text>
                      </View>
                    </View>

                    <Text style={styles.stopsTitle}>{t('allStopsCount', { n: selectedRoute.stops.length })}</Text>
                    {selectedRoute.stops.map((stop, idx) => (
                      <View key={stop.id} style={styles.stopListItem}>
                        <View style={styles.stopListLeft}>
                          <View style={[styles.stopListDot, idx === 0 && styles.stopListDotStart, idx === selectedRoute.stops.length - 1 && styles.stopListDotEnd]} />
                          {idx < selectedRoute.stops.length - 1 && <View style={styles.stopListLine} />}
                        </View>
                        <View style={styles.stopListContent}>
                          <Text style={styles.stopListNum}>{t('stopNumber', { n: idx + 1 })}</Text>
                          <Text style={styles.stopListName}>{stop.name}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={styles.allRoutesTitle}>{t('allBusRoutes')}</Text>
                {chaloRoutes.map((route) => (
                  <TouchableOpacity
                    key={route.routeId}
                    style={[styles.routeSummaryCard, selectedRoute?.routeId === route.routeId && styles.routeSummaryCardActive]}
                    onPress={() => setSelectedRoute(route)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.routeSummaryLeft}>
                      <View style={styles.routeSummaryNo}>
                        <Text style={styles.routeSummaryNoText}>{route.routeNumber}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.routeSummaryName} numberOfLines={1}>{route.routeName}</Text>
                        <Text style={styles.routeSummaryStops} numberOfLines={1}>
                          {route.fromStop} → {route.toStop}
                        </Text>
                        <Text style={styles.routeSummaryMeta}>
                          {route.frequency} · {route.depot} · {route.operationalHours.start}–{route.operationalHours.end}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                  </TouchableOpacity>
                ))}
              </>
            )}
          </>
        )}

        <View style={styles.cabCard}>
          <Text style={styles.cabTitle}>{t('lastMile')}</Text>
          <Text style={styles.cabSub}>{t('bookCabComplete')}</Text>
          <View style={styles.cabBrands}>
            <TouchableOpacity style={styles.uberBtn} onPress={() => openCab('uber')}>
              <Text style={styles.uberText}>Uber</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rapidoBtn} onPress={() => openCab('rapido')}>
              <Text style={styles.rapidoText}>Rapido</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal visible={showPicker !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {showPicker === 'from' ? t('selectDepartureTitle') : t('selectDestinationTitle')}
              </Text>
              <Text style={styles.pickerCount}>{t('stationsCount', { n: metroStations.length })}</Text>
            </View>
            <FlatList
              data={metroStations}
              keyExtractor={(item) => item}
              style={styles.pickerList}
              showsVerticalScrollIndicator={true}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={() => {
                    if (showPicker === 'from') setSelectedFrom(item);
                    else setSelectedTo(item);
                    setShowPicker(null);
                  }}
                >
                  <View style={styles.stationNumBadge}>
                    <Text style={styles.stationNumText}>{index + 1}</Text>
                  </View>
                  <View style={styles.pickerDot} />
                  <Text style={styles.pickerOptionText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowPicker(null)}>
              <Text style={styles.pickerCancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showQR} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.qrModal}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowQR(false)}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.qrTitle}>{t('validTicket')}</Text>
            <Text style={styles.qrId}>#{activeTicket?.journeyId}</Text>
            <View style={styles.qrRoute}>
              <Text style={styles.qrStation}>{selectedFrom}</Text>
              <Ionicons name="arrow-forward" size={18} color={theme.textMuted} />
              <Text style={styles.qrStation}>{selectedTo}</Text>
            </View>
            <View style={styles.qrCodeContainer}>
              {qrPattern.map((row, ri) => (
                <View key={ri} style={{ flexDirection: 'row' }}>
                  {row.map((filled, ci) => (
                    <View
                      key={ci}
                      style={[styles.qrBlock, { backgroundColor: filled ? colors.gray900 : colors.white }]}
                    />
                  ))}
                </View>
              ))}
            </View>
            <Text style={styles.qrToken}>{qrToken}</Text>
            <Text style={styles.qrPrice}>{t('total', { amount: activeTicket?.fare || previewFare })}</Text>
            <Text style={styles.qrHint}>{t('scanGate')}</Text>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}
