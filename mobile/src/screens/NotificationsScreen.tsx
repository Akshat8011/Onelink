import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PremiumLayout from '../components/PremiumLayout';
import { useAppTheme } from '../hooks/useAppTheme';
import { useI18n } from '../hooks/useI18n';
import { spacing, fontSize } from '../theme/colors';
import { useNotificationsStore, AppNotification } from '../store/useNotificationsStore';
import type { RootStackParamList, RootTabParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ICONS: Record<AppNotification['type'], keyof typeof Ionicons.glyphMap> = {
  TRANSIT: 'train', WALLET: 'wallet', ORDER: 'bag-handle', EVENT: 'sparkles', PARKING: 'car', SYSTEM: 'notifications',
};

const ICON_COLORS: Record<AppNotification['type'], string> = {
  TRANSIT: '#003DA5', WALLET: '#152238', ORDER: '#059669', EVENT: '#7C3AED', PARKING: '#1A73E8', SYSTEM: '#6B7280',
};

function navigateToTab(nav: Nav, screen: keyof RootTabParamList) {
  nav.navigate('MainTabs', { screen } as never);
}

export default function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const theme = useAppTheme();
  const { t } = useI18n();
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationsStore();

  const onPress = (n: AppNotification) => {
    markRead(n.id);
    const params = n.actionParams;
    if (n.actionRoute === 'OrderReceipt' && params?.orderId) {
      navigation.navigate('OrderReceipt', { orderId: params.orderId });
      return;
    }
    if (n.actionRoute === 'TicketDetail' && params?.ticketId) {
      navigation.navigate('TicketDetail', { ticketId: params.ticketId });
      return;
    }
    switch (n.actionRoute) {
      case 'Tickets': navigation.navigate('Tickets'); break;
      case 'OrderHistory': navigation.navigate('OrderHistory'); break;
      case 'Rewards': navigation.navigate('Rewards'); break;
      case 'Wallet': navigateToTab(navigation, 'Wallet'); break;
      case 'City': navigateToTab(navigation, 'City'); break;
      case 'Parking': navigateToTab(navigation, 'Parking'); break;
      case 'Transit': navigateToTab(navigation, 'Transit'); break;
      case 'Shop': navigateToTab(navigation, 'Shop'); break;
      case 'Canteen': navigation.navigate('Canteen'); break;
      case 'Account': navigation.navigate('Account'); break;
      default: break;
    }
  };

  const subtitle = unreadCount > 0 ? `${unreadCount} ${t('unread')}` : t('allCaughtUp');

  return (
    <PremiumLayout
      title={t('notifications')}
      subtitle={subtitle}
      accent={theme.wallet.primary}
      scrollable={false}
      right={unreadCount > 0 ? (
        <TouchableOpacity onPress={markAllRead}>
          <Text style={[styles.markAll, { color: theme.wallet.primary }]}>{t('markAllRead')}</Text>
        </TouchableOpacity>
      ) : undefined}
    >
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t('noNotifications')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const color = ICON_COLORS[item.type];
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: theme.surface, borderColor: item.read ? theme.border : theme.wallet.primary }, theme.shadowSoft]}
              onPress={() => onPress(item)}
              activeOpacity={0.85}
            >
              <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
                <Ionicons name={ICONS[item.type]} size={20} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.cardBody, { color: theme.textSecondary }]} numberOfLines={2}>{item.body}</Text>
                <Text style={[styles.cardTime, { color: theme.textMuted }]}>
                  {new Date(item.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              {!item.read && <View style={[styles.dot, { backgroundColor: theme.wallet.primary }]} />}
            </TouchableOpacity>
          );
        }}
      />
    </PremiumLayout>
  );
}

const styles = StyleSheet.create({
  markAll: { fontSize: fontSize.sm, fontWeight: '700', marginRight: spacing.md },
  card: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 16, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1.5, gap: spacing.md },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontWeight: '700', fontSize: fontSize.md },
  cardBody: { fontSize: fontSize.sm, marginTop: 4 },
  cardTime: { fontSize: fontSize.xs, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { marginTop: spacing.md, fontSize: fontSize.md },
});
