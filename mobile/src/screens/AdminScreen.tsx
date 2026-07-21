import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ScreenWrapper from '../components/ScreenWrapper';
import { useAppTheme } from '../hooks/useAppTheme';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import api from '../services/api';

const ADMIN_PIN = '1980';
const AUTO_REFRESH_MS = 12000;

type Tab = 'overview' | 'analytics' | 'activity' | 'users' | 'transit' | 'parking' | 'canteen' | 'sounds';

interface Overview {
  totalUsers: number; pairedCards: number; blockedCards: number; totalWalletBalance: number;
  totalTransactions: number; transactionsToday: number; spendToday: number; topUpToday: number;
  activeMetroJourneys: number; occupiedParking: number;
}
interface Activity {
  id: string; userName: string; type: string; category: string; amount: number;
  description: string; balanceAfter: number; status: string; createdAt: string;
}
interface AdminUser {
  userId: string; name: string; username?: string; balance: number; cardBlocked: boolean;
  isCardPaired: boolean; loyaltyPoints: number; memberTier: string; isAdmin: boolean;
}
interface SoundItem {
  key: string; custom: boolean; fileName: string | null; size: number; mimeType: string | null; updatedAt: string | null;
}
interface Analytics {
  totalDebit: number; totalCredit: number; totalRefund: number;
  categoryBreakdown: { category: string; debit: number; credit: number; count: number }[];
  dailyTrend: { date: string; debit: number; credit: number; count: number }[];
  topUsers: { name: string; username?: string; balance: number; memberTier: string; loyaltyPoints: number }[];
}
interface Transit {
  totalJourneys: number; activeJourneys: number; completedJourneys: number; penaltyJourneys: number;
  metroRevenue: number; metroTxns: number;
  recent: { id: string; userName: string; entryStation: string; exitStation: string | null; fare: number | null; status: string; entryTime: string }[];
}
interface Parking {
  totalSpots: number; free: number; occupied: number; reserved: number; parkingRevenue: number; parkingTxns: number;
  occupiedSpots: { spotId: string; zone: string; userName: string; entryTime: string | null }[];
}
interface CanteenAdmin {
  totalOrders: number; preparing: number; ready: number; collected: number; ordersToday: number;
  nowServing: number; canteenRevenue: number; canteenTxns: number; revenueToday: number;
  topItems: { name: string; qty: number; revenue: number }[];
  recent: {
    orderId: string; orderNumber: number; userName: string; total: number; status: string;
    itemCount: number; paidAt: string; receiptId: string;
  }[];
  oldestPending: number | null;
}

const SOUND_LABELS: Record<string, string> = {
  home: 'Homepage / Background music', services: 'Services screen chime', tap: 'Tap sound',
  press: 'Button press', back: 'Back navigation', cardTap: 'Card tap (reader)',
  transit: 'Open Transit', shop: 'Open Shop', parking: 'Open Parking', canteen: 'Open Canteen',
  success: 'Payment success', denied: 'Denied / Access error',
};

const TABS: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'overview', label: 'Overview', icon: 'stats-chart' },
  { id: 'analytics', label: 'Analytics', icon: 'analytics' },
  { id: 'activity', label: 'Activity', icon: 'pulse' },
  { id: 'users', label: 'Users', icon: 'people' },
  { id: 'transit', label: 'Transit', icon: 'train' },
  { id: 'parking', label: 'Parking', icon: 'car' },
  { id: 'canteen', label: 'Canteen', icon: 'restaurant' },
  { id: 'sounds', label: 'Sounds', icon: 'musical-notes' },
];

function inr(n: number) { return '₹' + Math.round(n || 0).toLocaleString('en-IN'); }
function num(n: number) { return (n || 0).toLocaleString('en-IN'); }

function pickAudioFile(): Promise<{ dataUri: string; mimeType: string; fileName: string } | null> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return resolve(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUri: String(reader.result), mimeType: file.type || 'audio/mpeg', fileName: file.name });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
function playUrl(url: string) {
  if (Platform.OS !== 'web' || typeof Audio === 'undefined') return;
  try { const a = new Audio(url); a.volume = 0.9; a.play().catch(() => {}); } catch { /* ignore */ }
}
function webPrompt(msg: string): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.prompt(msg);
  return null;
}
function webConfirm(msg: string): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.confirm(msg);
  return false;
}

export default function AdminScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const styles = makeStyles(theme);

  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [transit, setTransit] = useState<Transit | null>(null);
  const [parking, setParking] = useState<Parking | null>(null);
  const [canteen, setCanteen] = useState<CanteenAdmin | null>(null);
  const [sounds, setSounds] = useState<SoundItem[]>([]);
  const [query, setQuery] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const queryRef = useRef(query);
  queryRef.current = query;

  const loadTab = useCallback(async (which: Tab, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      if (which === 'overview') { const { data } = await api.get('/v1/admin/overview'); setOverview(data.overview); }
      else if (which === 'analytics') { const { data } = await api.get('/v1/admin/analytics', { params: { days: 7 } }); setAnalytics(data.analytics); }
      else if (which === 'activity') { const { data } = await api.get('/v1/admin/activity', { params: { limit: 80 } }); setActivity(data.activity || []); }
      else if (which === 'users') { const { data } = await api.get('/v1/admin/users', { params: { q: queryRef.current, limit: 150 } }); setUsers(data.users || []); }
      else if (which === 'transit') { const { data } = await api.get('/v1/admin/transit'); setTransit(data.transit); }
      else if (which === 'parking') { const { data } = await api.get('/v1/admin/parking'); setParking(data.parking); }
      else if (which === 'canteen') { const { data } = await api.get('/v1/admin/canteen'); setCanteen(data.canteen); }
      else if (which === 'sounds') { const { data } = await api.get('/v1/admin/sounds'); setSounds(data.sounds || []); }
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load data');
    } finally { if (!silent) setLoading(false); }
  }, []);

  // Load on tab change + auto-refresh every 12s (silent) for live data.
  useEffect(() => {
    if (!unlocked) return;
    loadTab(tab);
    const id = setInterval(() => loadTab(tab, true), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [tab, unlocked, loadTab]);

  const submitPin = () => {
    if (pin === ADMIN_PIN) { setUnlocked(true); setPinError(false); }
    else { setPinError(true); setPin(''); }
  };

  const toggleBlock = async (u: AdminUser) => {
    try {
      await api.post(`/v1/admin/users/${u.userId}/${u.cardBlocked ? 'unblock' : 'block'}`);
      setUsers((prev) => prev.map((x) => (x.userId === u.userId ? { ...x, cardBlocked: !x.cardBlocked } : x)));
    } catch (e: any) { setError(e?.response?.data?.error || 'Action failed'); }
  };
  const adjustFunds = async (u: AdminUser, type: 'credit' | 'debit') => {
    const raw = webPrompt(`${type === 'credit' ? 'Add funds to' : 'Deduct funds from'} ${u.name}\nAmount (₹):`);
    if (raw == null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Invalid amount'); return; }
    try {
      const { data } = await api.post(`/v1/admin/users/${u.userId}/adjust`, { type, amount });
      setUsers((prev) => prev.map((x) => (x.userId === u.userId ? { ...x, balance: data.newBalance } : x)));
    } catch (e: any) { setError(e?.response?.data?.error || 'Adjustment failed'); }
  };
  const toggleAdmin = async (u: AdminUser) => {
    if (!webConfirm(`${u.isAdmin ? 'Remove admin from' : 'Make admin'} ${u.name}?`)) return;
    try {
      await api.post(`/v1/admin/users/${u.userId}/admin`, { isAdmin: !u.isAdmin });
      setUsers((prev) => prev.map((x) => (x.userId === u.userId ? { ...x, isAdmin: !x.isAdmin } : x)));
    } catch (e: any) { setError(e?.response?.data?.error || 'Role update failed'); }
  };

  const uploadSound = async (key: string) => {
    const picked = await pickAudioFile();
    if (!picked) return;
    setBusyKey(key); setError(null);
    try {
      await api.post(`/v1/admin/sounds/${key}`, { dataUri: picked.dataUri, mimeType: picked.mimeType, fileName: picked.fileName });
      await loadTab('sounds', true);
    } catch (e: any) { setError(e?.response?.data?.error || 'Upload failed (max 3 MB, must be audio)'); }
    finally { setBusyKey(null); }
  };
  const resetSound = async (key: string) => {
    setBusyKey(key); setError(null);
    try { await api.delete(`/v1/admin/sounds/${key}`); await loadTab('sounds', true); }
    catch (e: any) { setError(e?.response?.data?.error || 'Reset failed'); }
    finally { setBusyKey(null); }
  };
  const previewSound = (key: string) => {
    const base = (api.defaults.baseURL || '').replace(/\/$/, '');
    playUrl(`${base}/v1/kiosk/sounds/${key}?t=${Date.now()}`);
  };

  // ── PIN gate ──
  if (!unlocked) {
    return (
      <ScreenWrapper edges={['top']} style={{ backgroundColor: theme.bg }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Admin Panel</Text>
        </View>
        <View style={styles.pinWrap}>
          <View style={styles.pinLock}><Ionicons name="lock-closed" size={30} color="#DC2626" /></View>
          <Text style={styles.pinTitle}>Enter Admin PIN</Text>
          <Text style={styles.pinSub}>This panel is password protected.</Text>
          <TextInput
            style={[styles.pinInput, pinError && { borderColor: '#DC2626' }]}
            value={pin}
            onChangeText={(v) => { setPin(v.replace(/[^0-9]/g, '').slice(0, 8)); setPinError(false); }}
            placeholder="••••"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={8}
            onSubmitEditing={submitPin}
            autoFocus
          />
          {pinError && <Text style={styles.pinErr}>Incorrect PIN. Try again.</Text>}
          <TouchableOpacity style={styles.pinBtn} onPress={submitPin}>
            <Text style={styles.pinBtnText}>Unlock</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={['top']} style={{ backgroundColor: theme.bg }}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Admin Panel</Text>
          <Text style={styles.subtitle}>
            {lastUpdated ? `Live · updated ${lastUpdated.toLocaleTimeString('en-IN')}` : 'Manage everything'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => loadTab(tab)}>
          <Ionicons name="refresh" size={18} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {TABS.map((tb) => (
            <TouchableOpacity key={tb.id} style={[styles.tabBtn, tab === tb.id && styles.tabBtnActive]} onPress={() => setTab(tb.id)}>
              <Ionicons name={tb.icon} size={15} color={tab === tb.id ? '#fff' : theme.textSecondary} />
              <Text style={[styles.tabText, tab === tb.id && styles.tabTextActive]}>{tb.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="warning" size={14} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        {loading && <ActivityIndicator color={theme.metro} style={{ marginVertical: spacing.lg }} />}

        {/* OVERVIEW */}
        {tab === 'overview' && overview && (
          <View style={styles.metricGrid}>
            {[
              { label: 'Total Users', value: num(overview.totalUsers), icon: 'people', color: '#3B82F6' },
              { label: 'Paired Cards', value: num(overview.pairedCards), icon: 'card', color: '#22C55E' },
              { label: 'Blocked Cards', value: num(overview.blockedCards), icon: 'lock-closed', color: '#DC2626' },
              { label: 'Wallet Float', value: inr(overview.totalWalletBalance), icon: 'wallet', color: '#C4A35A' },
              { label: 'Transactions', value: num(overview.totalTransactions), icon: 'swap-horizontal', color: '#8B5CF6' },
              { label: 'Txns Today', value: num(overview.transactionsToday), icon: 'today', color: '#0EA5E9' },
              { label: 'Spend Today', value: inr(overview.spendToday), icon: 'trending-down', color: '#F97316' },
              { label: 'Top-ups Today', value: inr(overview.topUpToday), icon: 'trending-up', color: '#10B981' },
              { label: 'Active Metro', value: num(overview.activeMetroJourneys), icon: 'train', color: '#EF4444' },
              { label: 'Parking In Use', value: num(overview.occupiedParking), icon: 'car', color: '#6366F1' },
            ].map((m) => (
              <View key={m.label} style={styles.metricCard}>
                <View style={[styles.metricIcon, { backgroundColor: m.color + '22' }]}>
                  <Ionicons name={m.icon as any} size={18} color={m.color} />
                </View>
                <Text style={styles.metricValue}>{m.value}</Text>
                <Text style={styles.metricLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ANALYTICS */}
        {tab === 'analytics' && analytics && (
          <>
            <View style={styles.metricGrid}>
              <View style={styles.metricCard}>
                <View style={[styles.metricIcon, { backgroundColor: '#EF444422' }]}><Ionicons name="trending-down" size={18} color="#EF4444" /></View>
                <Text style={styles.metricValue}>{inr(analytics.totalDebit)}</Text>
                <Text style={styles.metricLabel}>Total Spend (Debit)</Text>
              </View>
              <View style={styles.metricCard}>
                <View style={[styles.metricIcon, { backgroundColor: '#22C55E22' }]}><Ionicons name="trending-up" size={18} color="#22C55E" /></View>
                <Text style={styles.metricValue}>{inr(analytics.totalCredit)}</Text>
                <Text style={styles.metricLabel}>Total Inflow (Credit)</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Last 7 days</Text>
            <View style={styles.trendCard}>
              <View style={styles.trendRow}>
                {analytics.dailyTrend.map((d) => {
                  const max = Math.max(1, ...analytics.dailyTrend.map((x) => x.debit));
                  const h = Math.max(4, (d.debit / max) * 90);
                  return (
                    <View key={d.date} style={styles.trendBarWrap}>
                      <View style={[styles.trendBar, { height: h }]} />
                      <Text style={styles.trendDay}>{new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 1)}</Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.trendMeta}>Daily spend · peak {inr(Math.max(0, ...analytics.dailyTrend.map((x) => x.debit)))}</Text>
            </View>

            <Text style={styles.sectionTitle}>Spend by category</Text>
            {analytics.categoryBreakdown.filter((c) => c.debit > 0).map((c) => {
              const max = Math.max(1, ...analytics.categoryBreakdown.map((x) => x.debit));
              return (
                <View key={c.category} style={styles.catRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.catHead}>
                      <Text style={styles.catName}>{c.category}</Text>
                      <Text style={styles.catAmt}>{inr(c.debit)}</Text>
                    </View>
                    <View style={styles.catTrack}>
                      <View style={[styles.catFill, { width: `${(c.debit / max) * 100}%` }]} />
                    </View>
                    <Text style={styles.catCount}>{c.count} txns</Text>
                  </View>
                </View>
              );
            })}

            <Text style={styles.sectionTitle}>Top wallets</Text>
            {analytics.topUsers.map((u, i) => (
              <View key={u.username || i} style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: '#C4A35A22' }]}><Text style={{ color: '#C4A35A', fontWeight: '800' }}>{i + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{u.name}</Text>
                  <Text style={styles.rowSub}>{u.memberTier} · {num(u.loyaltyPoints)} pts</Text>
                </View>
                <Text style={styles.rowAmount}>{inr(u.balance)}</Text>
              </View>
            ))}
          </>
        )}

        {/* ACTIVITY */}
        {tab === 'activity' && activity.map((a) => (
          <View key={a.id} style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: a.type === 'CREDIT' ? '#22C55E22' : '#EF444422' }]}>
              <Ionicons name={a.type === 'CREDIT' ? 'arrow-down' : 'arrow-up'} size={16} color={a.type === 'CREDIT' ? '#22C55E' : '#EF4444'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{a.userName} · {a.category}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>{a.description || a.status} · {new Date(a.createdAt).toLocaleString('en-IN')}</Text>
            </View>
            <Text style={[styles.rowAmount, { color: a.type === 'CREDIT' ? '#22C55E' : '#EF4444' }]}>
              {a.type === 'CREDIT' ? '+' : '-'}{inr(a.amount)}
            </Text>
          </View>
        ))}

        {/* USERS */}
        {tab === 'users' && (
          <>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color={theme.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search name or username"
                placeholderTextColor={theme.textMuted}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => loadTab('users')}
                returnKeyType="search"
              />
              <TouchableOpacity onPress={() => loadTab('users')}><Text style={styles.searchGo}>Go</Text></TouchableOpacity>
            </View>
            {users.map((u) => (
              <View key={u.userId} style={styles.userCard}>
                <View style={styles.userTop}>
                  <View style={[styles.rowIcon, { backgroundColor: theme.surfaceMuted }]}><Ionicons name="person" size={16} color={theme.textSecondary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{u.name}{u.isAdmin ? '  · ADMIN' : ''}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>{inr(u.balance)} · {u.memberTier} · {u.isCardPaired ? 'Paired' : 'Unpaired'}</Text>
                  </View>
                </View>
                <View style={styles.chipRow}>
                  <TouchableOpacity style={[styles.chip, { backgroundColor: '#22C55E' }]} onPress={() => adjustFunds(u, 'credit')}>
                    <Ionicons name="add" size={13} color="#fff" /><Text style={styles.chipText}>Funds</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.chip, { backgroundColor: '#F97316' }]} onPress={() => adjustFunds(u, 'debit')}>
                    <Ionicons name="remove" size={13} color="#fff" /><Text style={styles.chipText}>Funds</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.chip, { backgroundColor: u.cardBlocked ? '#22C55E' : '#DC2626' }]} onPress={() => toggleBlock(u)}>
                    <Ionicons name={u.cardBlocked ? 'lock-open' : 'lock-closed'} size={13} color="#fff" /><Text style={styles.chipText}>{u.cardBlocked ? 'Unblock' : 'Block'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.chip, { backgroundColor: u.isAdmin ? '#6B7280' : '#8B5CF6' }]} onPress={() => toggleAdmin(u)}>
                    <Ionicons name="shield" size={13} color="#fff" /><Text style={styles.chipText}>{u.isAdmin ? 'Demote' : 'Admin'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {/* TRANSIT */}
        {tab === 'transit' && transit && (
          <>
            <View style={styles.metricGrid}>
              {[
                { label: 'Total Journeys', value: num(transit.totalJourneys), icon: 'train', color: '#3B82F6' },
                { label: 'Active Now', value: num(transit.activeJourneys), icon: 'walk', color: '#EF4444' },
                { label: 'Completed', value: num(transit.completedJourneys), icon: 'checkmark-done', color: '#22C55E' },
                { label: 'Penalties', value: num(transit.penaltyJourneys), icon: 'alert', color: '#F97316' },
                { label: 'Metro Revenue', value: inr(transit.metroRevenue), icon: 'cash', color: '#C4A35A' },
                { label: 'Metro Txns', value: num(transit.metroTxns), icon: 'receipt', color: '#8B5CF6' },
              ].map((m) => (
                <View key={m.label} style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: m.color + '22' }]}><Ionicons name={m.icon as any} size={18} color={m.color} /></View>
                  <Text style={styles.metricValue}>{m.value}</Text>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.sectionTitle}>Recent journeys</Text>
            {transit.recent.map((j) => (
              <View key={j.id} style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: j.status === 'IN_PROGRESS' ? '#EF444422' : '#22C55E22' }]}>
                  <Ionicons name="train" size={15} color={j.status === 'IN_PROGRESS' ? '#EF4444' : '#22C55E'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{j.userName}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>{j.entryStation} → {j.exitStation || '…'} · {j.status}</Text>
                </View>
                <Text style={styles.rowAmount}>{j.fare != null ? inr(j.fare) : '—'}</Text>
              </View>
            ))}
          </>
        )}

        {/* PARKING */}
        {tab === 'parking' && parking && (
          <>
            <View style={styles.metricGrid}>
              {[
                { label: 'Total Spots', value: num(parking.totalSpots), icon: 'grid', color: '#3B82F6' },
                { label: 'Free', value: num(parking.free), icon: 'checkmark-circle', color: '#22C55E' },
                { label: 'Occupied', value: num(parking.occupied), icon: 'car', color: '#EF4444' },
                { label: 'Reserved', value: num(parking.reserved), icon: 'time', color: '#F97316' },
                { label: 'Parking Revenue', value: inr(parking.parkingRevenue), icon: 'cash', color: '#C4A35A' },
                { label: 'Parking Txns', value: num(parking.parkingTxns), icon: 'receipt', color: '#8B5CF6' },
              ].map((m) => (
                <View key={m.label} style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: m.color + '22' }]}><Ionicons name={m.icon as any} size={18} color={m.color} /></View>
                  <Text style={styles.metricValue}>{m.value}</Text>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.sectionTitle}>Occupied spots</Text>
            {parking.occupiedSpots.length === 0 && <Text style={styles.hint}>No spots occupied right now.</Text>}
            {parking.occupiedSpots.map((s) => (
              <View key={s.spotId} style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: '#EF444422' }]}><Ionicons name="car" size={15} color="#EF4444" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{s.spotId} · {s.zone}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>{s.userName}{s.entryTime ? ' · since ' + new Date(s.entryTime).toLocaleTimeString('en-IN') : ''}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* CANTEEN */}
        {tab === 'canteen' && canteen && (
          <>
            <View style={styles.metricGrid}>
              {[
                { label: 'Total Orders', value: num(canteen.totalOrders), icon: 'receipt', color: '#3B82F6' },
                { label: 'Preparing', value: num(canteen.preparing), icon: 'flame', color: '#F97316' },
                { label: 'Ready', value: num(canteen.ready), icon: 'checkmark-circle', color: '#22C55E' },
                { label: 'Collected', value: num(canteen.collected), icon: 'bag-check', color: '#14B8A6' },
                { label: 'Now Serving', value: '#' + num(canteen.nowServing), icon: 'radio', color: '#EF4444' },
                { label: 'Orders Today', value: num(canteen.ordersToday), icon: 'today', color: '#8B5CF6' },
                { label: 'Canteen Revenue', value: inr(canteen.canteenRevenue), icon: 'cash', color: '#C4A35A' },
                { label: 'Revenue Today', value: inr(canteen.revenueToday), icon: 'trending-up', color: '#EA580C' },
              ].map((m) => (
                <View key={m.label} style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: m.color + '22' }]}><Ionicons name={m.icon as any} size={18} color={m.color} /></View>
                  <Text style={styles.metricValue}>{m.value}</Text>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.sectionTitle}>Top items</Text>
            {canteen.topItems.length === 0 && <Text style={styles.hint}>No canteen sales yet.</Text>}
            {canteen.topItems.map((item) => (
              <View key={item.name} style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: '#EA580C22' }]}><Ionicons name="fast-food" size={15} color="#EA580C" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowSub}>{num(item.qty)} sold</Text>
                </View>
                <Text style={styles.rowAmount}>{inr(item.revenue)}</Text>
              </View>
            ))}
            <Text style={styles.sectionTitle}>Recent orders</Text>
            {canteen.recent.map((o) => (
              <View key={o.orderId} style={styles.row}>
                <View style={[styles.rowIcon, {
                  backgroundColor: o.status === 'READY' ? '#22C55E22' : o.status === 'COLLECTED' ? '#14B8A622' : '#F9731622',
                }]}>
                  <Ionicons
                    name={o.status === 'COLLECTED' ? 'bag-check' : o.status === 'READY' ? 'checkmark-circle' : 'flame'}
                    size={15}
                    color={o.status === 'READY' ? '#22C55E' : o.status === 'COLLECTED' ? '#14B8A6' : '#F97316'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>#{o.orderNumber} · {o.userName}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {o.status} · {o.itemCount} items · {o.paidAt ? new Date(o.paidAt).toLocaleString('en-IN') : ''}
                  </Text>
                </View>
                <Text style={styles.rowAmount}>{inr(o.total)}</Text>
              </View>
            ))}
          </>
        )}

        {/* SOUNDS */}
        {tab === 'sounds' && (
          <>
            <Text style={styles.hint}>
              Upload audio (MP3/WAV/OGG, max 3 MB) per sound. Refresh the kiosk browser to apply. Empty = built-in sound.
            </Text>
            {sounds.map((s) => (
              <View key={s.key} style={styles.soundCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.soundLabel}>{SOUND_LABELS[s.key] || s.key}</Text>
                  <Text style={styles.soundMeta} numberOfLines={1}>
                    {s.custom ? `${s.fileName || 'custom'} · ${(s.size / 1024).toFixed(0)} KB` : 'Built-in (default)'}
                  </Text>
                </View>
                {busyKey === s.key ? <ActivityIndicator color={theme.metro} /> : (
                  <View style={styles.soundActions}>
                    {s.custom && Platform.OS === 'web' && (
                      <TouchableOpacity style={styles.iconBtn} onPress={() => previewSound(s.key)}>
                        <Ionicons name="play" size={16} color={theme.metro} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.metro }]} onPress={() => uploadSound(s.key)}>
                      <Ionicons name="cloud-upload" size={14} color="#fff" /><Text style={styles.smallBtnText}>Upload</Text>
                    </TouchableOpacity>
                    {s.custom && (
                      <TouchableOpacity style={styles.iconBtn} onPress={() => resetSound(s.key)}>
                        <Ionicons name="trash" size={16} color="#DC2626" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            ))}
            {Platform.OS !== 'web' && <Text style={styles.hint}>Note: uploading audio is available on the web dashboard.</Text>}
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface },
    refreshBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface },
    title: { color: theme.text, fontSize: fontSize.xl, fontWeight: '800' },
    subtitle: { color: theme.textSecondary, fontSize: fontSize.xs },

    pinWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
    pinLock: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
    pinTitle: { color: theme.text, fontSize: fontSize.lg, fontWeight: '800' },
    pinSub: { color: theme.textSecondary, fontSize: fontSize.sm, marginBottom: spacing.md },
    pinInput: { width: 180, textAlign: 'center', letterSpacing: 8, fontSize: 24, color: theme.text, backgroundColor: theme.surface, borderWidth: 2, borderColor: theme.border, borderRadius: borderRadius.md, paddingVertical: 12 },
    pinErr: { color: '#DC2626', fontSize: fontSize.xs },
    pinBtn: { marginTop: spacing.sm, backgroundColor: '#B91C1C', paddingHorizontal: 40, paddingVertical: 12, borderRadius: borderRadius.md },
    pinBtnText: { color: '#fff', fontWeight: '800', fontSize: fontSize.md },

    tabBarWrap: { paddingBottom: spacing.xs },
    tabBar: { gap: 6, paddingHorizontal: spacing.md },
    tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: borderRadius.full, backgroundColor: theme.surface },
    tabBtnActive: { backgroundColor: theme.metro },
    tabText: { color: theme.textSecondary, fontSize: 12, fontWeight: '700' },
    tabTextActive: { color: '#fff' },

    errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: spacing.md, marginBottom: 6, padding: 8, backgroundColor: '#FEE2E2', borderRadius: borderRadius.sm },
    errorText: { color: '#DC2626', fontSize: fontSize.xs, flex: 1 },

    sectionTitle: { color: theme.text, fontSize: fontSize.md, fontWeight: '800', marginTop: spacing.md, marginBottom: spacing.sm },

    metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    metricCard: { width: '47.5%', backgroundColor: theme.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: theme.border },
    metricIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    metricValue: { color: theme.text, fontSize: fontSize.lg, fontWeight: '800' },
    metricLabel: { color: theme.textSecondary, fontSize: fontSize.xs, marginTop: 2 },

    trendCard: { backgroundColor: theme.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: theme.border },
    trendRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 110, gap: 6 },
    trendBarWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
    trendBar: { width: '70%', backgroundColor: theme.metro, borderRadius: 4 },
    trendDay: { color: theme.textMuted, fontSize: 10 },
    trendMeta: { color: theme.textMuted, fontSize: fontSize.xs, marginTop: 8, textAlign: 'center' },

    catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    catHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    catName: { color: theme.text, fontSize: fontSize.sm, fontWeight: '700' },
    catAmt: { color: theme.text, fontSize: fontSize.sm, fontWeight: '800' },
    catTrack: { height: 8, backgroundColor: theme.surfaceMuted, borderRadius: 4, overflow: 'hidden' },
    catFill: { height: 8, backgroundColor: theme.metro, borderRadius: 4 },
    catCount: { color: theme.textMuted, fontSize: 10, marginTop: 3 },

    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: theme.surface, borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
    rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    rowTitle: { color: theme.text, fontSize: fontSize.sm, fontWeight: '700' },
    rowSub: { color: theme.textMuted, fontSize: fontSize.xs, marginTop: 1 },
    rowAmount: { fontSize: fontSize.sm, fontWeight: '800', color: theme.text },

    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.surface, borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: theme.border },
    searchInput: { flex: 1, color: theme.text, paddingVertical: 10, fontSize: fontSize.sm },
    searchGo: { color: theme.metro, fontWeight: '800', fontSize: fontSize.sm },

    userCard: { backgroundColor: theme.surface, borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
    userTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 6, borderRadius: borderRadius.sm },
    chipText: { color: '#fff', fontSize: 11, fontWeight: '800' },

    hint: { color: theme.textMuted, fontSize: fontSize.xs, marginBottom: spacing.sm, lineHeight: 16 },
    soundCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: theme.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
    soundLabel: { color: theme.text, fontSize: fontSize.sm, fontWeight: '700' },
    soundMeta: { color: theme.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    soundActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted },
    smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: borderRadius.sm },
    smallBtnText: { color: '#fff', fontSize: fontSize.xs, fontWeight: '800' },
  });
}
