import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, TextInput,
  RefreshControl, Modal, Alert, FlatList, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ScreenWrapper from '../components/ScreenWrapper';
import { colors, spacing, borderRadius, fontSize, shadows } from '../theme/colors';
import { useRetailStore, type Product } from '../store/useRetailStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { useI18n } from '../hooks/useI18n';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const FALLBACK_IMG =
  'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/da/cms-assets/cms/product/9a4088cc-db19-4add-b3ce-2edd4d09f4ae.png';

const ProductImage = React.memo(({ uri, style }: { uri: string; style?: object }) => {
  const [src, setSrc] = useState(uri || FALLBACK_IMG);
  useEffect(() => { setSrc(uri || FALLBACK_IMG); }, [uri]);
  return (
    <Image source={{ uri: src }} style={style} resizeMode="contain" onError={() => setSrc(FALLBACK_IMG)} />
  );
});

interface ProductCardProps {
  item: Product;
  cartQty: number;
  onAdd: (p: Product) => void;
  onDec: (id: string, qty: number) => void;
  styles: ReturnType<typeof useShopStyles>;
  t: ReturnType<typeof useI18n>['t'];
}

const ProductCard = React.memo(({ item, cartQty, onAdd, onDec, styles, t }: ProductCardProps) => (
  <View style={styles.productCard}>
    <View style={styles.productImageContainer}>
      <ProductImage uri={item.imageUrl} style={styles.productImage} />
      {item.mrp > item.price && (
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>{Math.round((1 - item.price / item.mrp) * 100)}% {t('off')}</Text>
        </View>
      )}
    </View>
    <View style={styles.productInfo}>
      <Text style={styles.productBrand}>{item.brand}</Text>
      <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.productUnit}>{item.unit}</Text>
      <View style={styles.productPriceRow}>
        <View>
          <Text style={styles.productPrice}>₹{item.price}</Text>
          {item.mrp > item.price && <Text style={styles.productMrp}>₹{item.mrp}</Text>}
        </View>
        {cartQty > 0 ? (
          <View style={styles.qtyControl}>
            <TouchableOpacity onPress={() => onDec(item.productId, cartQty - 1)} style={styles.qtyBtn}>
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.qtyText}>{cartQty}</Text>
            <TouchableOpacity onPress={() => onAdd(item)} style={styles.qtyBtn}>
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addBtn} onPress={() => onAdd(item)} disabled={item.stock === 0}>
            <Text style={[styles.addBtnText, item.stock === 0 && styles.addBtnDisabled]}>
              {item.stock === 0 ? t('outOfStock') : t('add')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  </View>
));

function useShopStyles() {
  const theme = useAppTheme();
  return useThemedStyles((th) => StyleSheet.create({
    container: { flex: 1, backgroundColor: th.bg },
    header: {
      paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
      backgroundColor: th.shopHeader, borderBottomWidth: 1, borderBottomColor: th.shopHeaderBorder,
    },
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    title: { fontSize: 20, fontWeight: '900', color: th.isDark ? th.shopAccent : '#14532D' },
    historyBtn: {
      width: 40, height: 40, backgroundColor: th.surface, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
    },
    searchContainer: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: th.surface,
      borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 10,
      borderWidth: 1, borderColor: th.shopHeaderBorder,
    },
    searchInput: { flex: 1, color: th.text, fontSize: fontSize.md, padding: 0, fontWeight: '500' },
    sidebar: { width: 80, backgroundColor: th.surfaceMuted, borderRightWidth: 1, borderRightColor: th.border },
    sidebarItem: { paddingVertical: spacing.lg, paddingHorizontal: spacing.sm, alignItems: 'center', position: 'relative' },
    sidebarItemActive: { backgroundColor: th.surface },
    sidebarIndicator: { position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 4, borderRadius: 2 },
    sidebarText: { fontSize: 11, color: th.textMuted, textAlign: 'center', fontWeight: '600' },
    sidebarTextActive: { color: th.text, fontWeight: '800' },
    mainContent: { flex: 1, backgroundColor: th.bg },
    gridContent: { padding: spacing.md },
    row: { justifyContent: 'space-between', gap: spacing.md },
    resultCount: { fontSize: 12, color: th.textMuted, marginBottom: spacing.sm },
    productCard: {
      flex: 1, maxWidth: '48%', backgroundColor: th.surface, borderRadius: borderRadius.lg,
      overflow: 'hidden', borderWidth: 1, borderColor: th.border, marginBottom: spacing.md,
    },
    productImageContainer: { height: 120, backgroundColor: th.surfaceMuted, position: 'relative', padding: 6 },
    productImage: { width: '100%', height: '100%' },
    discountBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: '#DC2626', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    discountText: { color: '#fff', fontSize: 9, fontWeight: '700' },
    productInfo: { padding: spacing.sm },
    productBrand: { fontSize: 10, color: colors.shoppingDark, fontWeight: '800', textTransform: 'uppercase' },
    productName: { fontSize: 13, fontWeight: '600', color: th.text, minHeight: 34, lineHeight: 17 },
    productUnit: { fontSize: 11, color: th.textMuted, marginVertical: 4 },
    productPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 },
    productPrice: { fontSize: 15, fontWeight: '800', color: th.text },
    productMrp: { fontSize: 11, color: th.textMuted, textDecorationLine: 'line-through' },
    addBtn: { borderColor: colors.shopping, borderWidth: 1, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: colors.shoppingBg },
    addBtnText: { color: colors.shoppingDark, fontSize: 12, fontWeight: '800' },
    addBtnDisabled: { color: th.textMuted },
    qtyControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.shopping, borderRadius: 6 },
    qtyBtn: { paddingHorizontal: 10, paddingVertical: 6 },
    qtyBtnText: { color: colors.white, fontSize: 14, fontWeight: 'bold' },
    qtyText: { color: colors.white, fontSize: 13, fontWeight: '800', marginHorizontal: 4 },
    stickyCartBtn: {
      position: 'absolute', bottom: 20, left: spacing.md, right: spacing.md,
      backgroundColor: th.shopAccent, borderRadius: borderRadius.lg, padding: spacing.md,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...shadows.elevated,
    },
    cartInfoLeft: { flexDirection: 'row', alignItems: 'center' },
    cartIconWrapper: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8, marginRight: 12 },
    cartItemsCount: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
    cartTotalSticky: { color: colors.white, fontSize: 16, fontWeight: '800' },
    viewCartText: { color: colors.white, fontSize: 14, fontWeight: '800' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    cartModal: {
      backgroundColor: th.surfaceMuted, height: '85%',
      borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    },
    cartModalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: spacing.lg, backgroundColor: th.surface,
      borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    },
    cartModalTitle: { fontSize: 18, fontWeight: '900', color: th.text },
    cartItemRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: th.border,
      gap: 10, backgroundColor: th.surface,
    },
    cartThumb: { width: 48, height: 48, backgroundColor: th.surfaceMuted, borderRadius: 8 },
    cartItemInfo: { flex: 1 },
    cartItemName: { fontSize: 14, fontWeight: '600', color: th.text },
    cartItemUnit: { fontSize: 12, color: th.textMuted, marginTop: 2 },
    qtyControlCart: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.shopping, borderRadius: 6 },
    qtyBtnCart: { paddingHorizontal: 10, paddingVertical: 8 },
    qtyBtnTextCart: { color: colors.white, fontSize: 16, fontWeight: 'bold' },
    qtyTextCart: { color: colors.white, fontSize: 14, fontWeight: '800', marginHorizontal: 6 },
    billDetails: {
      backgroundColor: th.surface, marginHorizontal: spacing.lg,
      borderRadius: borderRadius.lg, padding: spacing.md,
    },
    billTitle: { fontSize: 16, fontWeight: '800', color: th.text, marginBottom: spacing.md },
    billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
    billLabel: { fontSize: 13, color: th.textSecondary },
    billValue: { fontSize: 13, color: th.text, fontWeight: '500' },
    billTotalRow: { borderTopWidth: 1, borderTopColor: th.border, marginTop: 8, paddingTop: 8 },
    billTotalLabel: { fontSize: 15, fontWeight: '800', color: th.text },
    billTotalValue: { fontSize: 15, fontWeight: '800', color: th.text },
    checkoutFooter: {
      backgroundColor: th.surface, padding: spacing.lg, flexDirection: 'row',
      justifyContent: 'space-between', alignItems: 'center',
      borderTopWidth: 1, borderTopColor: th.border, paddingBottom: 40,
    },
    payUsingText: { fontSize: 12, color: th.textMuted, fontWeight: '600' },
    footerTotal: { fontSize: 18, fontWeight: '900', color: th.text },
    placeOrderBtn: { backgroundColor: th.shopAccent, paddingHorizontal: 24, paddingVertical: 14, borderRadius: borderRadius.lg },
    placeOrderBtnText: { color: colors.white, fontSize: 15, fontWeight: '800' },
    emptyText: { color: th.textMuted },
  }));
}

export default function ShopScreen() {
  const navigation = useNavigation<Nav>();
  const theme = useAppTheme();
  const { t } = useI18n();
  const styles = useShopStyles();
  const {
    products, categories, cart, selectedCategory, isLoading, isLoadingMore,
    totalProductCount, fetchProducts, fetchCategories, setCategory, setSearchQuery,
    loadMoreProducts, addToCart, updateQuantity, getCartTotal, getCartCount, checkout, pushCartToKiosk,
  } = useRetailStore();

  const [searchInput, setSearchInput] = useState('');
  const [showCart, setShowCart] = useState(false);

  useEffect(() => { fetchCategories(); fetchProducts(); }, []);
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput, setSearchQuery]);

  const cartMap = useMemo(() => {
    const m = new Map<string, number>();
    cart.forEach((c) => m.set(c.product.productId, c.quantity));
    return m;
  }, [cart]);

  const handleCheckout = async () => {
    const success = await checkout();
    if (success) {
      Alert.alert(t('orderPlaced'), t('paymentSuccess'), [
        { text: t('viewReceipt'), onPress: () => navigation.navigate('OrderHistory') },
        { text: t('ok') },
      ]);
      setShowCart(false);
    } else {
      Alert.alert(t('checkoutFailed'), t('insufficientBalance'));
    }
  };

  const handlePayViaCard = async () => {
    const success = await pushCartToKiosk();
    if (success) {
      Alert.alert('Cart sent to kiosk', 'Go to the Pi terminal, tap your card, choose Shop, and confirm payment.');
      setShowCart(false);
    } else {
      Alert.alert('Could not send cart', 'Please try again or pay with wallet.');
    }
  };

  const renderItem = useCallback(({ item }: { item: Product }) => (
    <ProductCard item={item} cartQty={cartMap.get(item.productId) ?? 0} onAdd={addToCart} onDec={updateQuantity} styles={styles} t={t} />
  ), [cartMap, addToCart, updateQuantity, styles, t]);

  const subtotal = getCartTotal();

  return (
    <ScreenWrapper edges={['top']} style={{ backgroundColor: theme.bg }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Text style={styles.title}>{t('oneLinkSupermarket')}</Text>
            <TouchableOpacity style={styles.historyBtn} onPress={() => navigation.navigate('OrderHistory')}>
              <Ionicons name="receipt-outline" size={22} color={theme.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('searchProducts')}
              placeholderTextColor={theme.textMuted}
              value={searchInput}
              onChangeText={setSearchInput}
            />
          </View>
        </View>

        <View style={{ flex: 1, flexDirection: 'row' }}>
          {!searchInput && (
            <View style={styles.sidebar}>
              <FlatList
                data={categories}
                keyExtractor={(c) => c}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: cat }) => (
                  <TouchableOpacity
                    style={[styles.sidebarItem, selectedCategory === cat && styles.sidebarItemActive]}
                    onPress={() => { setSearchInput(''); setCategory(cat); }}
                  >
                    <View style={[styles.sidebarIndicator, selectedCategory === cat && { backgroundColor: colors.shopping }]} />
                    <Text style={[styles.sidebarText, selectedCategory === cat && styles.sidebarTextActive]}>
                      {cat === 'All' ? t('all') : cat.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          <FlatList
            style={styles.mainContent}
            contentContainerStyle={styles.gridContent}
            data={products}
            keyExtractor={(item) => item.productId}
            numColumns={2}
            columnWrapperStyle={styles.row}
            renderItem={renderItem}
            ListHeaderComponent={
              <Text style={styles.resultCount}>
                {t('ofItems', { n: products.length, total: totalProductCount.toLocaleString() })}
              </Text>
            }
            ListEmptyComponent={
              !isLoading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={styles.emptyText}>{t('noProducts')}</Text>
                </View>
              ) : null
            }
            ListFooterComponent={
              isLoadingMore ? (
                <ActivityIndicator style={{ padding: 16 }} color={colors.shopping} />
              ) : (
                <View style={{ height: 100 }} />
              )
            }
            onEndReached={() => loadMoreProducts()}
            onEndReachedThreshold={0.4}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => fetchProducts(selectedCategory, true)} />}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={5}
            removeClippedSubviews
          />
        </View>

        {getCartCount() > 0 && (
          <TouchableOpacity style={styles.stickyCartBtn} onPress={() => setShowCart(true)} activeOpacity={0.9}>
            <View style={styles.cartInfoLeft}>
              <View style={styles.cartIconWrapper}>
                <Ionicons name="cart" size={16} color="#fff" />
              </View>
              <View>
                <Text style={styles.cartItemsCount}>{getCartCount()} {t('items')}</Text>
                <Text style={styles.cartTotalSticky}>₹{subtotal}</Text>
              </View>
            </View>
            <Text style={styles.viewCartText}>{t('viewCart')} ▸</Text>
          </TouchableOpacity>
        )}

        <Modal visible={showCart} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.cartModal}>
              <View style={styles.cartModalHeader}>
                <Text style={styles.cartModalTitle}>{t('yourCart')}</Text>
                <TouchableOpacity onPress={() => setShowCart(false)}>
                  <Text style={{ fontSize: 24, color: theme.textMuted }}>✕</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                style={{ flex: 1 }}
                data={cart}
                keyExtractor={(c) => c.product.productId}
                renderItem={({ item: c }) => (
                  <View style={styles.cartItemRow}>
                    <ProductImage uri={c.product.imageUrl} style={styles.cartThumb} />
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName}>{c.product.name}</Text>
                      <Text style={styles.cartItemUnit}>{c.product.unit} · ₹{c.product.price}</Text>
                    </View>
                    <View style={styles.qtyControlCart}>
                      <TouchableOpacity onPress={() => updateQuantity(c.product.productId, c.quantity - 1)} style={styles.qtyBtnCart}>
                        <Text style={styles.qtyBtnTextCart}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyTextCart}>{c.quantity}</Text>
                      <TouchableOpacity onPress={() => addToCart(c.product)} style={styles.qtyBtnCart}>
                        <Text style={styles.qtyBtnTextCart}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                ListFooterComponent={
                  <View>
                    <View style={styles.billDetails}>
                      <Text style={styles.billTitle}>{t('billSummary')}</Text>
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>{t('itemsTotal')}</Text>
                        <Text style={styles.billValue}>₹{subtotal}</Text>
                      </View>
                      <View style={[styles.billRow, styles.billTotalRow]}>
                        <Text style={styles.billTotalLabel}>{t('amountPayable')}</Text>
                        <Text style={styles.billTotalValue}>₹{subtotal}</Text>
                      </View>
                    </View>
                    <View style={{ height: 40 }} />
                  </View>
                }
              />
              <View style={styles.checkoutFooter}>
                <View>
                  <Text style={styles.payUsingText}>{t('oneLinkWallet')}</Text>
                  <Text style={styles.footerTotal}>₹{subtotal}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[styles.placeOrderBtn, { backgroundColor: '#4338ca', flex: 1 }]} onPress={handlePayViaCard}>
                    <Text style={styles.placeOrderBtnText}>Pay via Card</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.placeOrderBtn, { flex: 1 }]} onPress={handleCheckout}>
                    <Text style={styles.placeOrderBtnText}>{t('payPlaceOrder')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ScreenWrapper>
  );
}
