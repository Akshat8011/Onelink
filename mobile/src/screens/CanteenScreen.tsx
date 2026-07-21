import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, TextInput,
  RefreshControl, Modal, Alert, FlatList, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenWrapper from '../components/ScreenWrapper';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { useCanteenStore, type CanteenCartItem, type CanteenOrder } from '../store/useCanteenStore';
import type { CanteenItem } from '../data/canteenCatalog';
import { useAppTheme } from '../hooks/useAppTheme';
import { useI18n } from '../hooks/useI18n';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ACCENT = '#C2410C';
const ACCENT_SOFT = '#FFF7ED';

/** Category-specific placeholders — never reuse one shared salad for every miss. */
const CATEGORY_FALLBACK: Record<string, string> = {
  Meals: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&h=300&q=80',
  Snacks: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=400&h=300&q=80',
  Beverages: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&h=300&q=80',
  Desserts: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=400&h=300&q=80',
};

const FoodImage = React.memo(({ uri, category, style }: { uri: string; category?: string; style?: object }) => {
  const fallback = CATEGORY_FALLBACK[category || ''] || CATEGORY_FALLBACK.Meals;
  const [src, setSrc] = useState(uri || fallback);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setSrc(uri || fallback);
    setFailed(false);
  }, [uri, fallback]);
  return (
    <Image
      source={{ uri: src }}
      style={style}
      resizeMode="cover"
      onError={() => {
        if (!failed) {
          setFailed(true);
          setSrc(fallback);
        }
      }}
    />
  );
});

type TabKey = 'menu' | 'orders' | 'receipts';

export default function CanteenScreen() {
  const navigation = useNavigation<Nav>();
  const theme = useAppTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const [tab, setTab] = useState<TabKey>('menu');
  const [cartOpen, setCartOpen] = useState(false);
  const [receipt, setReceipt] = useState<CanteenOrder | null>(null);
  const [detailItem, setDetailItem] = useState<CanteenItem | null>(null);
  const lastDetailTap = useRef<{ id: string; t: number } | null>(null);

  const openDetailOnDoubleTap = useCallback((item: CanteenItem) => {
    const now = Date.now();
    const prev = lastDetailTap.current;
    if (prev && prev.id === item.productId && now - prev.t < 450) {
      lastDetailTap.current = null;
      setDetailItem(item);
      return;
    }
    lastDetailTap.current = { id: item.productId, t: now };
  }, []);

  const {
    items, categories, cart, selectedCategory, searchQuery, orders, nowServing,
    isLoading, readyBanner,
    fetchMenu, fetchOrders, setCategory, setSearchQuery,
    addToCart, updateQuantity, getCartTotal, getCartCount,
    pushCartToKiosk, clearReadyBanner,
  } = useCanteenStore();

  useEffect(() => {
    fetchMenu();
    fetchOrders();
  }, []);

  const cartQtyMap = useMemo(() => {
    const m: Record<string, number> = {};
    cart.forEach((c) => { m[c.product.productId] = c.quantity; });
    return m;
  }, [cart]);

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status === 'PREPARING' || o.status === 'READY'),
    [orders],
  );
  const receipts = useMemo(
    () => orders.filter((o) => o.status === 'COLLECTED'),
    [orders],
  );

  const onPayAtCanteen = useCallback(async () => {
    if (!cart.length) {
      Alert.alert(t('canteenEmptyCart'), t('canteenEmptyCartHint'));
      return;
    }
    const ok = await pushCartToKiosk();
    if (ok) {
      setCartOpen(false);
      Alert.alert(t('canteenCartSent'), t('canteenCartSentHint'));
    } else {
      Alert.alert(t('failed'), t('canteenPushFailed'));
    }
  }, [cart.length, pushCartToKiosk, t]);

  const detailQty = detailItem ? (cartQtyMap[detailItem.productId] || 0) : 0;

  const renderItem = useCallback(({ item }: { item: CanteenItem }) => {
    const qty = cartQtyMap[item.productId] || 0;
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.88} onPress={() => openDetailOnDoubleTap(item)}>
        <FoodImage uri={item.imageUrl} category={item.category} style={styles.cardImage} />
        <View style={styles.cardBody}>
          <Text style={styles.cardCat}>{item.category}</Text>
          <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
          <View style={styles.cardRow}>
            <Text style={styles.cardPrice}>₹{item.price}</Text>
            {qty > 0 ? (
              <View style={styles.qtyControl}>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation?.(); updateQuantity(item.productId, qty - 1); }}
                  style={styles.qtyBtn}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyText}>{qty}</Text>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation?.(); addToCart(item); }}
                  style={styles.qtyBtn}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={(e) => { e.stopPropagation?.(); addToCart(item); }}
              >
                <Text style={styles.addBtnText}>{t('add')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [addToCart, cartQtyMap, openDetailOnDoubleTap, styles, t, updateQuantity]);

  const listHeader = (
    <View>
      {readyBanner ? (
        <TouchableOpacity style={styles.readyBanner} onPress={clearReadyBanner}>
          <Ionicons name="notifications" size={20} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.readyTitle}>{t('canteenOrderReady')}</Text>
            <Text style={styles.readySub}>
              #{readyBanner.orderNumber} · {t('canteenCollectHint')}
            </Text>
          </View>
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>
      ) : null}

      <View style={styles.queueChip}>
        <Text style={styles.queueLabel}>{t('canteenNowServing')}</Text>
        <Text style={styles.queueNum}>#{nowServing || '—'}</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('canteenSearch')}
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cats} contentContainerStyle={{ gap: 8 }}>
        {categories.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.catChip, selectedCategory === c && styles.catChipActive]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.catText, selectedCategory === c && styles.catTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <ScreenWrapper edges={['top']} style={{ backgroundColor: theme.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('canteen')}</Text>
          <Text style={styles.subtitle}>{t('canteenSubtitle')}</Text>
        </View>
        <TouchableOpacity style={styles.cartBtn} onPress={() => setCartOpen(true)}>
          <Ionicons name="cart" size={22} color={ACCENT} />
          {getCartCount() > 0 ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{getCartCount()}</Text></View>
          ) : null}
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {([
          ['menu', t('canteenMenu')],
          ['orders', t('canteenOrders')],
          ['receipts', t('canteenReceipts')],
        ] as [TabKey, string][]).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'menu' ? (
        <FlatList
          data={items}
          keyExtractor={(i) => i.productId}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          ListHeaderComponent={listHeader}
          renderItem={renderItem}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => { fetchMenu(); fetchOrders(); }}
              tintColor={ACCENT}
            />
          }
        />
      ) : tab === 'orders' ? (
        <ScrollView contentContainerStyle={styles.listPad} refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchOrders} tintColor={ACCENT} />
        }>
          {!activeOrders.length ? (
            <View style={styles.empty}>
              <Ionicons name="restaurant-outline" size={40} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>{t('canteenNoActive')}</Text>
              <Text style={styles.emptySub}>{t('canteenNoActiveHint')}</Text>
            </View>
          ) : activeOrders.map((o) => (
            <OrderCard key={o.orderId} order={o} nowServing={nowServing} styles={styles} t={t} onPress={() => setReceipt(o)} />
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.listPad} refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchOrders} tintColor={ACCENT} />
        }>
          {!receipts.length ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={40} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>{t('canteenNoReceipts')}</Text>
            </View>
          ) : receipts.map((o) => (
            <OrderCard key={o.orderId} order={o} nowServing={nowServing} styles={styles} t={t} onPress={() => setReceipt(o)} />
          ))}
        </ScrollView>
      )}

      {/* Dish detail — large image, name, price */}
      <Modal visible={!!detailItem} animationType="fade" transparent onRequestClose={() => setDetailItem(null)}>
        <View style={styles.detailOverlay}>
          <TouchableOpacity style={styles.detailBackdrop} activeOpacity={1} onPress={() => setDetailItem(null)} />
          {detailItem ? (
            <View style={styles.detailSheet}>
              <TouchableOpacity style={styles.detailClose} onPress={() => setDetailItem(null)} hitSlop={12}>
                <Ionicons name="close" size={22} color={theme.text} />
              </TouchableOpacity>
              <FoodImage uri={detailItem.imageUrl} category={detailItem.category} style={styles.detailImage} />
              <View style={styles.detailBody}>
                <Text style={styles.detailCat}>{detailItem.category}</Text>
                <Text style={styles.detailName}>{detailItem.name}</Text>
                {detailItem.description ? (
                  <Text style={styles.detailDesc}>{detailItem.description}</Text>
                ) : null}
                <View style={styles.detailFooter}>
                  <Text style={styles.detailPrice}>₹{detailItem.price}</Text>
                  {detailQty > 0 ? (
                    <View style={styles.qtyControl}>
                      <TouchableOpacity
                        onPress={() => updateQuantity(detailItem.productId, detailQty - 1)}
                        style={styles.qtyBtnLg}
                      >
                        <Text style={styles.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyTextLg}>{detailQty}</Text>
                      <TouchableOpacity onPress={() => addToCart(detailItem)} style={styles.qtyBtnLg}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.detailAddBtn} onPress={() => addToCart(detailItem)}>
                      <Text style={styles.detailAddText}>{t('add')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* Cart modal */}
      <Modal visible={cartOpen} animationType="slide" transparent onRequestClose={() => setCartOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('canteenCart')}</Text>
              <TouchableOpacity onPress={() => setCartOpen(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {!cart.length ? (
                <Text style={styles.emptySub}>{t('canteenEmptyCartHint')}</Text>
              ) : cart.map((c: CanteenCartItem) => (
                <View key={c.product.productId} style={styles.cartRow}>
                  <FoodImage uri={c.product.imageUrl} category={c.product.category} style={styles.cartThumb} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartName}>{c.product.name}</Text>
                    <Text style={styles.cartMeta}>₹{c.product.price} × {c.quantity}</Text>
                  </View>
                  <View style={styles.qtyControl}>
                    <TouchableOpacity onPress={() => updateQuantity(c.product.productId, c.quantity - 1)} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{c.quantity}</Text>
                    <TouchableOpacity onPress={() => addToCart(c.product)} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalFooter}>
              <Text style={styles.totalText}>{t('canteenTotal')}: ₹{getCartTotal()}</Text>
              <TouchableOpacity style={styles.payBtn} onPress={onPayAtCanteen} disabled={!cart.length}>
                <Text style={styles.payBtnText}>{t('canteenPayAtCanteen')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Receipt detail */}
      <Modal visible={!!receipt} animationType="fade" transparent onRequestClose={() => setReceipt(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {receipt ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('canteenReceipt')} #{receipt.orderNumber}</Text>
                  <TouchableOpacity onPress={() => setReceipt(null)}>
                    <Ionicons name="close" size={24} color={theme.text} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.receiptMeta}>{receipt.status} · ₹{receipt.total}</Text>
                <Text style={styles.receiptMeta}>
                  {new Date(receipt.paidAt).toLocaleString('en-IN')}
                </Text>
                {receipt.items.map((i, idx) => (
                  <View key={`${i.productId}-${idx}`} style={styles.receiptRow}>
                    <Text style={styles.cartName}>{i.quantity}× {i.name}</Text>
                    <Text style={styles.cartMeta}>₹{i.price * i.quantity}</Text>
                  </View>
                ))}
                <Text style={[styles.receiptMeta, { marginTop: 12 }]}>
                  {t('canteenReceiptId')}: {receipt.receiptId}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

function OrderCard({
  order, nowServing, styles, t, onPress,
}: {
  order: CanteenOrder;
  nowServing: number;
  styles: ReturnType<typeof useStyles>;
  t: ReturnType<typeof useI18n>['t'];
  onPress: () => void;
}) {
  const eta = order.status === 'PREPARING'
    ? Math.max(0, order.orderNumber - nowServing) * 2
    : 0;
  const statusColor =
    order.status === 'READY' ? '#059669' : order.status === 'COLLECTED' ? '#6B7280' : ACCENT;

  return (
    <TouchableOpacity style={styles.orderCard} onPress={onPress}>
      <View style={styles.orderTop}>
        <Text style={styles.orderNum}>#{order.orderNumber}</Text>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{order.status}</Text>
        </View>
      </View>
      <Text style={styles.orderItems}>
        {order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
      </Text>
      <View style={styles.orderBottom}>
        <Text style={styles.orderTotal}>₹{order.total}</Text>
        {order.status === 'PREPARING' ? (
          <Text style={styles.etaText}>
            {t('canteenEta', { minutes: eta })} · {t('canteenNowServing')} #{nowServing}
          </Text>
        ) : order.status === 'READY' ? (
          <Text style={[styles.etaText, { color: '#059669' }]}>{t('canteenCollectHint')}</Text>
        ) : (
          <Text style={styles.etaText}>{t('canteenCollected')}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function useStyles() {
  return useThemedStyles((th) => StyleSheet.create({
    header: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md, gap: spacing.sm,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: th.surface,
      alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: 22, fontWeight: '900', color: ACCENT, letterSpacing: -0.3 },
    subtitle: { fontSize: fontSize.xs, color: th.textMuted, marginTop: 2 },
    cartBtn: {
      width: 44, height: 44, borderRadius: 14, backgroundColor: ACCENT_SOFT,
      alignItems: 'center', justifyContent: 'center',
    },
    badge: {
      position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8,
      backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
    },
    badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
    tabs: {
      flexDirection: 'row', marginHorizontal: spacing.lg, marginBottom: spacing.sm,
      backgroundColor: th.surfaceMuted, borderRadius: 14, padding: 4,
    },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
    tabActive: { backgroundColor: th.surface },
    tabText: { fontSize: fontSize.xs, fontWeight: '600', color: th.textMuted },
    tabTextActive: { color: ACCENT, fontWeight: '800' },
    readyBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#059669',
      marginBottom: spacing.md, padding: spacing.md, borderRadius: borderRadius.lg,
    },
    readyTitle: { color: '#fff', fontWeight: '800', fontSize: fontSize.sm },
    readySub: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.xs, marginTop: 2 },
    queueChip: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: ACCENT_SOFT, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.sm,
    },
    queueLabel: { color: ACCENT, fontWeight: '700', fontSize: fontSize.sm },
    queueNum: { color: ACCENT, fontWeight: '900', fontSize: 20 },
    searchBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: th.surface,
      borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 10,
      borderWidth: 1, borderColor: th.border, marginBottom: spacing.sm,
    },
    searchInput: { flex: 1, color: th.text, fontSize: fontSize.md, padding: 0 },
    cats: { marginBottom: spacing.md },
    catChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full,
      backgroundColor: th.surface, borderWidth: 1, borderColor: th.border,
    },
    catChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
    catText: { fontSize: fontSize.xs, fontWeight: '600', color: th.textSecondary },
    catTextActive: { color: '#fff' },
    grid: { paddingHorizontal: spacing.md, paddingBottom: 40 },
    row: { justifyContent: 'space-between', gap: spacing.sm },
    card: {
      flex: 1, maxWidth: '48%', backgroundColor: th.surface, borderRadius: borderRadius.lg,
      overflow: 'hidden', borderWidth: 1, borderColor: th.border, marginBottom: spacing.sm,
      minHeight: 210,
    },
    cardImage: { width: '100%', height: 110, backgroundColor: th.surfaceMuted },
    cardBody: { padding: spacing.sm, flexGrow: 1, justifyContent: 'space-between' },
    cardCat: { fontSize: 9, fontWeight: '800', color: ACCENT, textTransform: 'uppercase' },
    cardName: { fontSize: 13, fontWeight: '700', color: th.text, minHeight: 34, marginTop: 2 },
    cardRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8,
    },
    cardPrice: { fontSize: fontSize.md, fontWeight: '900', color: th.text },
    addBtn: {
      backgroundColor: ACCENT, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    },
    addBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    qtyBtn: {
      width: 28, height: 28, borderRadius: 8, backgroundColor: ACCENT_SOFT,
      alignItems: 'center', justifyContent: 'center',
    },
    qtyBtnText: { color: ACCENT, fontWeight: '800', fontSize: 16 },
    qtyText: { fontWeight: '800', color: th.text, minWidth: 16, textAlign: 'center' },
    listPad: { padding: spacing.lg, paddingBottom: 40 },
    empty: { alignItems: 'center', paddingVertical: 48 },
    emptyTitle: { color: th.text, fontWeight: '800', marginTop: spacing.sm },
    emptySub: { color: th.textMuted, fontSize: fontSize.sm, marginTop: 4, textAlign: 'center' },
    orderCard: {
      backgroundColor: th.surface, borderRadius: borderRadius.lg, padding: spacing.md,
      marginBottom: spacing.sm, borderWidth: 1, borderColor: th.border,
    },
    orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    orderNum: { fontSize: 20, fontWeight: '900', color: th.text },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
    statusText: { fontSize: 10, fontWeight: '800' },
    orderItems: { color: th.textSecondary, fontSize: fontSize.sm, marginTop: 8 },
    orderBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    orderTotal: { fontWeight: '900', color: th.text },
    etaText: { fontSize: fontSize.xs, color: th.textMuted, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: th.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: spacing.lg, maxHeight: '85%',
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    modalTitle: { fontSize: fontSize.lg, fontWeight: '900', color: th.text },
    detailOverlay: { flex: 1, justifyContent: 'center', padding: spacing.lg },
    detailBackdrop: {
      ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)',
    },
    detailSheet: {
      backgroundColor: th.surface, borderRadius: 22, overflow: 'hidden',
      borderWidth: 1, borderColor: th.border, maxHeight: '92%',
    },
    detailClose: {
      position: 'absolute', top: 12, right: 12, zIndex: 2, width: 36, height: 36,
      borderRadius: 18, backgroundColor: th.surface, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: th.border,
    },
    detailImage: { width: '100%', height: 280, backgroundColor: th.surfaceMuted },
    detailBody: { padding: spacing.lg },
    detailCat: {
      fontSize: 11, fontWeight: '800', color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.6,
    },
    detailName: { fontSize: 24, fontWeight: '900', color: th.text, marginTop: 6, letterSpacing: -0.4 },
    detailDesc: { color: th.textSecondary, fontSize: fontSize.sm, marginTop: 8, lineHeight: 20 },
    detailFooter: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginTop: spacing.lg, gap: spacing.md,
    },
    detailPrice: { fontSize: 28, fontWeight: '900', color: th.text },
    detailAddBtn: {
      backgroundColor: ACCENT, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12,
    },
    detailAddText: { color: '#fff', fontWeight: '800', fontSize: fontSize.md },
    qtyBtnLg: {
      width: 36, height: 36, borderRadius: 10, backgroundColor: ACCENT_SOFT,
      alignItems: 'center', justifyContent: 'center',
    },
    qtyTextLg: { fontWeight: '900', color: th.text, minWidth: 24, textAlign: 'center', fontSize: 18 },
    cartRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    cartThumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: th.surfaceMuted },
    cartName: { fontWeight: '700', color: th.text, fontSize: fontSize.sm },
    cartMeta: { color: th.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    modalFooter: { borderTopWidth: 1, borderTopColor: th.border, paddingTop: spacing.md, marginTop: spacing.sm },
    totalText: { fontSize: fontSize.lg, fontWeight: '900', color: th.text, marginBottom: spacing.sm },
    payBtn: {
      backgroundColor: ACCENT, borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center',
    },
    payBtnText: { color: '#fff', fontWeight: '800', fontSize: fontSize.md },
    receiptMeta: { color: th.textSecondary, fontSize: fontSize.sm, marginBottom: 4 },
    receiptRow: {
      flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
      borderBottomWidth: 1, borderBottomColor: th.border,
    },
  }));
}
