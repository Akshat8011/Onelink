import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PremiumLayout from '../components/PremiumLayout';
import { useAppTheme } from '../hooks/useAppTheme';
import { useI18n } from '../hooks/useI18n';
import { spacing, fontSize } from '../theme/colors';
import { useTicketsStore } from '../store/useTicketsStore';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TicketsScreen() {
  const navigation = useNavigation<Nav>();
  const theme = useAppTheme();
  const { t } = useI18n();
  const { tickets } = useTicketsStore();

  return (
    <PremiumLayout title={t('myTickets')} subtitle="Metro & bus" accent={theme.metro} scrollable={false}>
      <FlatList
        data={tickets}
        keyExtractor={(t) => t.ticketId}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="ticket-outline" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.text }]}>{t('noOrders')}</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>Book from Transit tab</Text>
          </View>
        }
        renderItem={({ item }) => {
          const active = item.status === 'ACTIVE' && new Date(item.validUntil) > new Date();
          const color = item.type === 'METRO' ? theme.metro : theme.transit;
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: theme.surface }, theme.shadowSoft]}
              onPress={() => navigation.navigate('TicketDetail', { ticketId: item.ticketId })}
            >
              <View style={[styles.badge, { backgroundColor: color }]}>
                <Ionicons name={item.type === 'METRO' ? 'train' : 'bus'} size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.route, { color: theme.text }]}>{item.from} → {item.to}</Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>
                  ₹{item.fare} · {item.paymentMode} · {new Date(item.bookedAt).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={[styles.status, { backgroundColor: active ? theme.shop + '33' : theme.surfaceMuted }]}>
                <Text style={[styles.statusText, { color: active ? theme.shop : theme.textMuted }]}>{active ? 'ACTIVE' : item.status}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </PremiumLayout>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: 16, padding: spacing.md, marginBottom: spacing.sm },
  badge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  route: { fontWeight: '700', fontSize: fontSize.md },
  meta: { fontSize: fontSize.xs, marginTop: 4 },
  status: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '800' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontWeight: '700', marginTop: spacing.md },
  emptySub: { fontSize: fontSize.sm, marginTop: 4 },
});
