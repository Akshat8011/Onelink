import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Dimensions, Linking, Alert, TextInput, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../components/ScreenWrapper';
import EventPoster from '../components/EventPoster';
import { useAppTheme } from '../hooks/useAppTheme';
import { useI18n } from '../hooks/useI18n';
import { type LiveEvent } from '../data/eventsLucknow';
import { fetchAllEvents, formatEventDateLabel } from '../services/eventsScraper';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.82;

type TabType = 'All' | 'Music' | 'Movies' | 'Comedy' | 'Sports' | 'Theatre';

const CATEGORY_MAP: Record<string, string> = {
  MUSIC: 'Music', MOVIE: 'Movies', COMEDY: 'Comedy', SPORTS: 'Sports',
  THEATRE: 'Theatre', WORKSHOP: 'Theatre',
};

const TAB_ICONS: Record<TabType, keyof typeof import('@expo/vector-icons').Ionicons.glyphMap> = {
  All: 'grid', Music: 'musical-notes', Movies: 'film', Comedy: 'happy', Sports: 'football', Theatre: 'ticket'
};

function formatVenueLabel(venue: string, city: string): string {
  if (venue.trim()) return venue;
  return `${city} · check BookMyShow for venue`;
}

function formatPriceLabel(price: number): string {
  if (price > 0) return `From ₹${price}`;
  return '';
}

export default function CityScreen() {
  const theme = useAppTheme();
  const { t } = useI18n();
  const [allEvents, setAllEvents] = useState<LiveEvent[]>([]);
  const [displayEvents, setDisplayEvents] = useState<LiveEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => { loadEvents(false); }, []);

  useEffect(() => {
    filterAndSearch(activeTab, searchQuery);
  }, [activeTab, searchQuery, allEvents]);

  const loadEvents = async (forceRefresh: boolean) => {
    if (forceRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setLoadError(null);

    try {
      const events = await fetchAllEvents('lucknow', { forceRefresh });
      if (!events.length) {
        setLoadError('No live events found. Pull to refresh.');
      }
      setAllEvents(events);
      const latestScrape = events.reduce<string | null>((latest, event) => {
        const ts = event.scrapedAt;
        if (!ts) return latest;
        if (!latest || new Date(ts).getTime() > new Date(latest).getTime()) return ts;
        return latest;
      }, null);
      setLastUpdated(latestScrape || new Date().toISOString());
    } catch (e) {
      console.error('Events load error', e);
      setLoadError('Could not load live events. Pull to refresh.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = useCallback(async () => {
    await loadEvents(true);
  }, []);

  const filterAndSearch = (tab: TabType, query: string) => {
    let filtered = allEvents;
    if (tab !== 'All') {
      filtered = filtered.filter(e => {
        const cat = CATEGORY_MAP[e.category] || e.category;
        return cat === tab;
      });
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q) ||
        (e.artist || '').toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    }
    setDisplayEvents(filtered);
  };

  const handleBookEvent = async (event: LiveEvent) => {
    const url = event.bookingUrl || event.bookMyShowUrl;
    if (url) {
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert('Error', 'Could not open booking link.');
      }
    } else {
      Alert.alert('Booking', 'No booking link available for this event.');
    }
  };

  const tabs: TabType[] = ['All', 'Music', 'Movies', 'Comedy', 'Sports', 'Theatre'];
  const featured = displayEvents.slice(0, 5);
  const upcoming = displayEvents.slice(5);

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      MUSIC: '#6366F1', MOVIE: '#F59E0B', COMEDY: '#10B981', SPORTS: '#EF4444', THEATRE: '#8B5CF6'
    };
    return colors[cat] || '#6366F1';
  };

  const getSourceBadge = (source: string) => {
    if (source === 'bookmyshow') return { color: '#F84464', label: 'BookMyShow' };
    if (source === 'paytm_insider') return { color: '#00BAF2', label: 'Insider' };
    return { color: '#6366F1', label: 'OneLink' };
  };

  return (
    <ScreenWrapper edges={['top']} style={{ backgroundColor: theme.bg }}>
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.logoContainer, { backgroundColor: theme.events + '22' }]}>
              <Ionicons name="sparkles" size={22} color={theme.rewards.secondary} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>{t('events')}</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>{t('lucknowLive')}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSearch(!showSearch)}>
              <Ionicons name={showSearch ? 'close' : 'search'} size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, isRefreshing && styles.iconBtnActive]}
              onPress={onRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#6366F1" />
              ) : (
                <Ionicons name="refresh" size={20} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        {showSearch && (
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="#888" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search events, artists, venues..."
              placeholderTextColor="#555"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#555" />
              </TouchableOpacity>
            )}
          </View>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
        >
          {/* Category Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsWrap} contentContainerStyle={styles.tabsContent}>
            {tabs.map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
                onPress={() => setActiveTab(tab)}
              >
                <Ionicons name={TAB_ICONS[tab]} size={14} color={activeTab === tab ? '#FFF' : '#888'} />
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Stats */}
          <View style={styles.statsBanner}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{displayEvents.length}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{displayEvents.filter(e => e.category === 'MOVIE').length}</Text>
              <Text style={styles.statLabel}>Movies</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>Live</Text>
              <Text style={styles.statLabel}>BookMyShow</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={styles.liveRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveLabel}>LIVE</Text>
              </View>
              <Text style={styles.statLabel}>{lastUpdated ? 'BookMyShow' : 'Updated'}</Text>
            </View>
          </View>

          {isLoading && displayEvents.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#6366F1" size="large" />
              <Text style={styles.loadingText}>Loading live BookMyShow data...</Text>
            </View>
          ) : displayEvents.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-outline" size={56} color="#333" />
              <Text style={styles.emptyText}>No events found</Text>
              <Text style={styles.emptySubText}>{loadError || 'Try a different category or pull to refresh'}</Text>
              <TouchableOpacity onPress={onRefresh} style={styles.resetFilterBtn}>
                <Text style={styles.resetFilterText}>Refresh live data</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Featured */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Featured</Text>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE DATA</Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContent}
                snapToInterval={CARD_WIDTH + 16}
                decelerationRate="fast"
              >
                {featured.map(event => {
                  const sourceBadge = getSourceBadge(event.source);
                  const whenLabel = event.displayTime || formatEventDateLabel(event.date, event.showTime);
                  const venueLabel = formatVenueLabel(event.venue, event.city);
                  const priceLabel = formatPriceLabel(event.price);
                  return (
                    <TouchableOpacity
                      key={event.eventId}
                      style={styles.eventCard}
                      onPress={() => handleBookEvent(event)}
                      activeOpacity={0.92}
                    >
                      <View style={styles.cardPosterWrap}>
                        <EventPoster
                          imageUrl={event.imageUrl}
                          category={event.category}
                          style={styles.cardPoster}
                        />
                        <View style={[styles.sourceBadge, { backgroundColor: sourceBadge.color }]}>
                          <Text style={styles.sourceBadgeText}>{sourceBadge.label}</Text>
                        </View>
                        <View style={[styles.catBadge, { backgroundColor: getCategoryColor(event.category) + 'DD' }]}>
                          <Text style={styles.catBadgeText}>{event.category}</Text>
                        </View>
                        {priceLabel ? (
                          <View style={styles.priceTag}>
                            <Text style={styles.priceText}>{priceLabel}</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.cardBody}>
                        <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                        {event.artist && (
                          <View style={styles.metaRow}>
                            <Ionicons name="person" size={13} color="#AAA" />
                            <Text style={styles.metaText}>{event.artist}</Text>
                          </View>
                        )}
                        <View style={styles.metaRow}>
                          <Ionicons name="calendar-outline" size={13} color="#AAA" />
                          <Text style={styles.metaText}>{whenLabel}</Text>
                        </View>
                        <View style={styles.metaRow}>
                          <Ionicons name="location-outline" size={13} color="#AAA" />
                          <Text style={styles.metaText} numberOfLines={2}>{venueLabel}</Text>
                        </View>
                        <View style={styles.bottomRow}>
                          <Text style={styles.attendingText}>
                            {event.userRating
                              ? `${event.userRating} liked`
                              : event.ticketsSold > 0
                                ? `${event.ticketsSold.toLocaleString()} likes`
                                : event.censorRating || event.language || 'Live on BookMyShow'}
                          </Text>
                          <View style={styles.bookBtn}>
                            <Text style={styles.bookBtnText}>Book Now</Text>
                            <Ionicons name="arrow-forward" size={14} color="#FFF" />
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Upcoming */}
              {upcoming.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>More Events</Text>
                    <Text style={styles.countBadge}>{upcoming.length} more</Text>
                  </View>
                  <View style={styles.listSection}>
                    {upcoming.map(event => {
                      const sourceBadge = getSourceBadge(event.source);
                      const whenLabel = event.displayTime || formatEventDateLabel(event.date, event.showTime);
                      const venueLabel = formatVenueLabel(event.venue, event.city);
                      const priceLabel = formatPriceLabel(event.price);
                      return (
                        <TouchableOpacity
                          key={event.eventId}
                          style={styles.listCard}
                          onPress={() => handleBookEvent(event)}
                          activeOpacity={0.88}
                        >
                          <EventPoster
                            imageUrl={event.imageUrl}
                            category={event.category}
                            style={styles.listImage}
                          />
                          <View style={styles.listContent}>
                            <View style={styles.listTopRow}>
                              <View style={[styles.smallCatBadge, { backgroundColor: getCategoryColor(event.category) + '33' }]}>
                                <Text style={[styles.smallCatText, { color: getCategoryColor(event.category) }]}>{event.category}</Text>
                              </View>
                              <View style={[styles.smallCatBadge, { backgroundColor: sourceBadge.color + '22' }]}>
                                <Text style={[styles.smallCatText, { color: sourceBadge.color }]}>{sourceBadge.label}</Text>
                              </View>
                            </View>
                            <Text style={styles.listTitle} numberOfLines={2}>{event.title}</Text>
                            {event.artist && <Text style={styles.listArtist} numberOfLines={1}>{event.artist}</Text>}
                            <View style={styles.listMeta}>
                              <Ionicons name="calendar-outline" size={11} color="#666" />
                              <Text style={styles.listMetaText}>{whenLabel}</Text>
                            </View>
                            <View style={styles.listMeta}>
                              <Ionicons name="location-outline" size={11} color="#666" />
                              <Text style={styles.listMetaText} numberOfLines={2}>{venueLabel}</Text>
                            </View>
                            <View style={styles.listBottom}>
                              <Text style={styles.listPrice}>{priceLabel || 'Book on BMS'}</Text>
                              <TouchableOpacity style={styles.listBookBtn} onPress={() => handleBookEvent(event)}>
                                <Text style={styles.listBookText}>Book</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D11' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  headerSubtitle: { color: '#666', fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  iconBtnActive: { opacity: 0.7 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1A1A2E', marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A3E' },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14 },
  tabsWrap: { marginBottom: 16 },
  tabsContent: { paddingHorizontal: 20, gap: 10, paddingVertical: 2 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#1A1A2E', borderRadius: 20, borderWidth: 1, borderColor: '#2A2A3E' },
  activeTab: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  tabText: { color: '#666', fontSize: 13, fontWeight: '600' },
  activeTabText: { color: '#FFF', fontWeight: '700' },
  statsBanner: { flexDirection: 'row', backgroundColor: '#1A1A2E', marginHorizontal: 20, marginBottom: 20, paddingVertical: 16, borderRadius: 16, justifyContent: 'space-around', borderWidth: 1, borderColor: '#2A2A3E' },
  statItem: { alignItems: 'center' },
  statNumber: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#666', fontSize: 10, marginTop: 4 },
  statDivider: { width: 1, backgroundColor: '#2A2A3E' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  liveLabel: { color: '#22C55E', fontWeight: '800', fontSize: 12 },
  loadingBox: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { color: '#666', marginTop: 12, fontSize: 14 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyText: { color: '#FFF', fontWeight: '700', fontSize: 18, marginTop: 16 },
  emptySubText: { color: '#666', fontSize: 13, marginTop: 8, textAlign: 'center' },
  resetFilterBtn: { marginTop: 16, backgroundColor: '#6366F1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  resetFilterText: { color: '#FFF', fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 8, marginBottom: 16 },
  sectionTitle: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16A34A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  liveText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  countBadge: { color: '#888', fontSize: 13, fontWeight: '600' },
  carouselContent: { paddingHorizontal: 20, gap: 16, paddingBottom: 8 },
  eventCard: { width: CARD_WIDTH, borderRadius: 24, overflow: 'hidden', backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#2A2A3E' },
  cardPosterWrap: { width: '100%', height: CARD_WIDTH * 0.72, backgroundColor: '#111', position: 'relative' },
  cardPoster: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardBody: { padding: 16 },
  sourceBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  sourceBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  catBadge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  catBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  priceTag: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  priceText: { color: '#000', fontSize: 13, fontWeight: '800' },
  eventTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 8, lineHeight: 24 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  metaText: { color: '#AAA', fontSize: 13, flex: 1 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  attendingText: { color: '#888', fontSize: 12 },
  bookBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#6366F1', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  bookBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  listSection: { paddingHorizontal: 20, gap: 12 },
  listCard: { flexDirection: 'row', backgroundColor: '#1A1A2E', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2A2A3E' },
  listImage: { width: 100, height: 140, resizeMode: 'cover', backgroundColor: '#111' },
  listContent: { flex: 1, padding: 12 },
  listTopRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  smallCatBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  smallCatText: { fontSize: 10, fontWeight: '700' },
  listTitle: { color: '#FFF', fontWeight: '700', fontSize: 14, lineHeight: 18, marginBottom: 4 },
  listArtist: { color: '#888', fontSize: 12, marginBottom: 4 },
  listMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  listMetaText: { color: '#666', fontSize: 11, flex: 1 },
  listBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  listPrice: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  listBookBtn: { backgroundColor: '#6366F1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  listBookText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
});
