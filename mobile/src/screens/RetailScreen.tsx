import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../components/ScreenWrapper';
import { compareProducts, type QuickCommClusterResult, type QuickCommCompareResponse, type QuickCommProductResult } from '../services/quickCommApi';
import { buildRetailDeepLink, buildRetailWebFallback } from '../utils/quickCommLinks';

export default function RetailScreen() {
  const [query, setQuery] = useState('');
  const [pincode, setPincode] = useState('226001');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<QuickCommClusterResult[]>([]);
  const [summary, setSummary] = useState<QuickCommCompareResponse | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) {
      Alert.alert('Enter a product', 'Type a grocery item to compare prices.');
      return;
    }
    if (pincode.trim().length !== 6) {
      Alert.alert('Invalid PIN', 'Enter a valid 6-digit PIN code.');
      return;
    }

    setLoading(true);
    setResults([]);
    setSummary(null);

    try {
      const data = await compareProducts(query.trim(), pincode.trim());
      setResults(data.clusters ?? []);
      setSummary(data);

      if (!data.clusters?.length) {
        Alert.alert('No results', 'No prices found. Try a different product name.');
      }
    } catch (e) {
      Alert.alert(
        'Search failed',
        'Could not compare prices. Make sure the QuickComm API is running:\n\ncd quickcomm\npython -m uvicorn api:app --reload --port 8001',
      );
    } finally {
      setLoading(false);
    }
  };

  const topSavings = useMemo(() => {
    if (!summary?.bestOffer) return null;
    return summary.bestOffer;
  }, [summary]);

  const handleDeepLink = async (product: QuickCommProductResult) => {
    try {
      const webUrl = buildRetailWebFallback(product.platform, product.name);
      const nativeUrl = buildRetailDeepLink(product.platform, product.name);
      const canOpenNative = await Linking.canOpenURL(nativeUrl);
      await Linking.openURL(canOpenNative ? nativeUrl : webUrl);
    } catch {
      const fallback = buildRetailWebFallback(product.platform, product.name);
      await Linking.openURL(fallback);
    }
  };

  return (
    <ScreenWrapper edges={['top']} style={{ backgroundColor: '#F3F4F6' }}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroChip}>
              <Ionicons name="flash" size={14} color="#0F766E" />
              <Text style={styles.heroChipText}>Quick-Comm</Text>
            </View>
            <Text style={styles.heroKicker}>Live grocery comparison</Text>
          </View>
          <Text style={styles.headerTitle}>Find the cheapest basket near you</Text>
          <Text style={styles.headerSubtitle}>Compare prices, delivery windows, and jump straight into the native store app.</Text>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.inputRow}>
            <Ionicons name="location" size={20} color="#64748B" />
            <TextInput
              style={styles.pincodeInput}
              value={pincode}
              onChangeText={setPincode}
              keyboardType="number-pad"
              placeholder="Pincode"
            />
          </View>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={20} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search e.g., '1kg Aashirvaad Atta'"
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.searchBtnText}>Find Best Price</Text>}
          </TouchableOpacity>
        </View>

        {summary && (
          <View style={styles.summaryStrip}>
            {summary.demoMode && (
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>Demo prices — start API for live data</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>Items compared</Text>
              <Text style={styles.summaryValue}>{summary.totalResults}</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>Best platform</Text>
              <Text style={styles.summaryValue}>{summary.bestOffer?.platform ?? 'N/A'}</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>Lowest price</Text>
              <Text style={styles.summaryValue}>₹{summary.bestOffer?.price ?? '—'}</Text>
            </View>
            </View>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.resultsContainer} showsVerticalScrollIndicator={false}>
          {results.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="cart-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyText}>Search for any grocery item to instantly compare prices across all platforms.</Text>
            </View>
          )}

          {results.map((cluster, i) => (
            <View key={i} style={styles.clusterCard}>
              <View style={styles.clusterHeader}>
                <Text style={styles.clusterTitle}>{cluster.normalizedName}</Text>
                <View style={styles.clusterMeta}>
                  <View style={styles.bestPriceBadge}>
                    <Text style={styles.bestPriceText}>Best: ₹{cluster.bestPrice}</Text>
                  </View>
                  <Text style={styles.priceSpreadText}>Spread ₹{cluster.priceSpread}</Text>
                </View>
              </View>

              <View style={styles.comparisonGrid}>
                {cluster.products.map((product, j) => (
                  <View key={j} style={[styles.platformRow, product.price === cluster.bestPrice && styles.bestRow]}>
                    <View style={styles.platformInfo}>
                      <Image source={{ uri: product.imageUrl }} style={styles.productImg} />
                      <View>
                        <Text style={styles.platformName}>{product.platform}</Text>
                        <Text style={styles.productSize}>{product.size}</Text>
                        <View style={styles.deliveryBadge}>
                          <Ionicons name="time-outline" size={12} color="#059669" />
                          <Text style={styles.deliveryText}>{product.deliveryTime}</Text>
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.priceAction}>
                      <Text style={styles.priceText}>₹{product.price}</Text>
                      <TouchableOpacity 
                        style={[styles.buyBtn, product.price === cluster.bestPrice && styles.bestBuyBtn]}
                        onPress={() => handleDeepLink(product)}
                      >
                        <Text style={[styles.buyBtnText, product.price === cluster.bestPrice && styles.bestBuyBtnText]}>Order</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 14, backgroundColor: '#0F172A' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)' },
  heroChipText: { color: '#0F766E', fontWeight: '800', fontSize: 12 },
  heroKicker: { color: '#94A3B8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginBottom: 6, lineHeight: 32 },
  headerSubtitle: { fontSize: 14, color: '#CBD5E1', lineHeight: 20 },
  
  searchSection: { marginHorizontal: 16, marginTop: -18, padding: 18, backgroundColor: '#FFF', borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0', zIndex: 10, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 16, marginBottom: 12, height: 48 },
  pincodeInput: { flex: 1, marginLeft: 8, fontSize: 16, color: '#0F172A' },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, height: 56 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: '#0F172A' },
  searchBtn: { backgroundColor: '#0F766E', height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#0F766E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  searchBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  summaryStrip: { paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  summaryRow: { flexDirection: 'row', gap: 12 },
  demoBadge: { backgroundColor: '#FEF3C7', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  demoBadgeText: { color: '#92400E', fontSize: 12, fontWeight: '600' },
  summaryTile: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  summaryLabel: { color: '#64748B', fontSize: 12, marginBottom: 6 },
  summaryValue: { color: '#0F172A', fontSize: 16, fontWeight: '800' },

  resultsContainer: { padding: 16, paddingTop: 18, paddingBottom: 120 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, opacity: 0.8 },
  emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 15, marginTop: 16, lineHeight: 22, paddingHorizontal: 24 },

  clusterCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 18, marginBottom: 18, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 },
  clusterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottomWidth: 1, borderColor: '#F1F5F9', paddingBottom: 16 },
  clusterTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#0F172A', marginRight: 12 },
  clusterMeta: { alignItems: 'flex-end', gap: 6 },
  bestPriceBadge: { backgroundColor: '#DEF7EC', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  bestPriceText: { color: '#03543F', fontSize: 12, fontWeight: '800' },
  priceSpreadText: { color: '#64748B', fontSize: 12, fontWeight: '700' },

  comparisonGrid: { gap: 16 },
  platformRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  bestRow: { backgroundColor: '#F0FDF4', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 10 },
  platformInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  productImg: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F8FAFC', marginRight: 12 },
  platformName: { fontSize: 15, fontWeight: '700', color: '#334155', marginBottom: 2 },
  productSize: { fontSize: 13, color: '#64748B', marginBottom: 4 },
  deliveryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deliveryText: { fontSize: 12, color: '#059669', fontWeight: '600' },

  priceAction: { alignItems: 'flex-end' },
  priceText: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  buyBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  buyBtnText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
  bestBuyBtn: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  bestBuyBtnText: { color: '#FFF' },
});
