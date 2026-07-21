import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import PremiumLayout from '../components/PremiumLayout';
import PremiumCard from '../components/PremiumCard';
import { useAppTheme } from '../hooks/useAppTheme';
import { useI18n } from '../hooks/useI18n';
import { spacing, fontSize } from '../theme/colors';
import { useOrdersStore } from '../store/useOrdersStore';
import { useAuthStore } from '../store/useAuthStore';
import type { RootStackParamList } from '../navigation/types';

type Route = RouteProp<RootStackParamList, 'OrderReceipt'>;

export default function OrderReceiptScreen() {
  const { orderId } = useRoute<Route>().params;
  const theme = useAppTheme();
  const { t } = useI18n();
  const username = useAuthStore((s) => s.user?.username || '');
  const { orders, load } = useOrdersStore();

  useEffect(() => {
    load();
  }, [orderId]);

  const order = orders.find((o) => o.orderId === orderId && o.username === username);

  if (!order) {
    return (
      <PremiumLayout title={t('orderHistory')} accent={theme.shop}>
        <Text style={[styles.missing, { color: theme.textMuted }]}>Order not found for @{username}</Text>
      </PremiumLayout>
    );
  }

  return (
    <PremiumLayout title={t('orderHistory')} subtitle={order.orderId} accent={theme.shop}>
      <ScrollView contentContainerStyle={styles.content}>
        <PremiumCard>
          <Text style={[styles.brand, { color: theme.text }]}>{t('supermarket')}</Text>
          <Text style={[styles.customer, { color: theme.shop }]}>{t('customer')}: {order.customerName} (@{order.username})</Text>
          <Text style={[styles.date, { color: theme.textMuted }]}>{new Date(order.placedAt).toLocaleString('en-IN')}</Text>
          <Text style={[styles.address, { color: theme.textSecondary }]}>{order.deliveryAddress}</Text>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          {order.items.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.itemMeta, { color: theme.textMuted }]}>{item.brand} · {item.unit}</Text>
              </View>
              <Text style={[styles.itemQty, { color: theme.textSecondary }]}>×{item.quantity}</Text>
              <Text style={[styles.itemPrice, { color: theme.text }]}>₹{item.price * item.quantity}</Text>
            </View>
          ))}

          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.billRow}><Text style={{ color: theme.textSecondary }}>Subtotal</Text><Text style={{ color: theme.text }}>₹{order.subtotal}</Text></View>
          <View style={styles.billRow}><Text style={{ color: theme.textSecondary }}>Handling</Text><Text style={{ color: theme.text }}>₹{order.handlingFee}</Text></View>
          <View style={styles.billRow}><Text style={{ color: theme.textSecondary }}>Delivery</Text><Text style={{ color: theme.text }}>{order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee}`}</Text></View>
          <View style={styles.billRow}><Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text><Text style={[styles.totalValue, { color: theme.shop }]}>₹{order.total}</Text></View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.billRow}><Text style={{ color: theme.textSecondary }}>Payment</Text><Text style={{ color: theme.text, fontWeight: '700' }}>{order.paymentMode}</Text></View>
          <View style={styles.billRow}><Text style={{ color: theme.textSecondary }}>Status</Text><Text style={{ color: theme.text, fontWeight: '700' }}>{order.status}</Text></View>
        </PremiumCard>
      </ScrollView>
    </PremiumLayout>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  missing: { textAlign: 'center', marginTop: 40 },
  brand: { fontSize: fontSize.xl, fontWeight: '900' },
  customer: { fontSize: fontSize.sm, fontWeight: '700', marginTop: 6 },
  date: { fontSize: fontSize.sm, marginTop: 4 },
  address: { fontSize: fontSize.sm, marginTop: 2 },
  divider: { height: 1, marginVertical: spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm, gap: spacing.sm },
  itemName: { fontWeight: '600', fontSize: fontSize.sm },
  itemMeta: { fontSize: 11, marginTop: 2 },
  itemQty: { fontWeight: '700' },
  itemPrice: { fontWeight: '700', minWidth: 50, textAlign: 'right' },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalLabel: { fontWeight: '800', fontSize: fontSize.lg },
  totalValue: { fontWeight: '900', fontSize: fontSize.lg },
});
