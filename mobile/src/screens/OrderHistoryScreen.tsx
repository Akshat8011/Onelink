import React, { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PremiumLayout from '../components/PremiumLayout';
import { useAppTheme } from '../hooks/useAppTheme';
import { useI18n } from '../hooks/useI18n';
import { spacing, fontSize } from '../theme/colors';
import { useOrdersStore } from '../store/useOrdersStore';
import { useAuthStore } from '../store/useAuthStore';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function OrderHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const theme = useAppTheme();
  const { t } = useI18n();
  const { orders, load } = useOrdersStore();
  const username = useAuthStore((s) => s.user?.username || '');

  useEffect(() => { load(); }, [username]);

  const userOrders = orders.filter((o) => o.username === username);

  return (
    <PremiumLayout title={t('orderHistory')} subtitle={t('supermarket')} accent={theme.shop} scrollable={false}>
      <FlatList
        data={userOrders}
        keyExtractor={(o) => o.orderId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t('noOrders')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, theme.shadowSoft]}
            onPress={() => navigation.navigate('OrderReceipt', { orderId: item.orderId })}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.orderId, { color: theme.text }]}>{item.orderId}</Text>
              <Text style={[styles.user, { color: theme.shop }]}>@{item.username}</Text>
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {item.items.length} items · {new Date(item.placedAt).toLocaleString('en-IN')}
              </Text>
              <Text style={[styles.address, { color: theme.textSecondary }]} numberOfLines={1}>{item.deliveryAddress}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.total, { color: theme.shop }]}>₹{item.total}</Text>
              <Text style={[styles.status, { color: theme.textMuted }]}>{item.status}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </PremiumLayout>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 40 },
  card: { flexDirection: 'row', borderRadius: 16, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1 },
  orderId: { fontWeight: '800', fontSize: fontSize.md },
  user: { fontSize: fontSize.xs, fontWeight: '700', marginTop: 2 },
  meta: { fontSize: fontSize.xs, marginTop: 4 },
  address: { fontSize: fontSize.sm, marginTop: 2 },
  total: { fontWeight: '800', fontSize: fontSize.lg },
  status: { fontSize: fontSize.xs, marginTop: 4, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { marginTop: spacing.md },
});
