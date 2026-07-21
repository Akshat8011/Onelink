import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import ScreenWrapper from '../components/ScreenWrapper';
import StackHeader from '../components/StackHeader';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { useTicketsStore } from '../store/useTicketsStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { useI18n } from '../hooks/useI18n';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { RootStackParamList } from '../navigation/types';

type Route = RouteProp<RootStackParamList, 'TicketDetail'>;

export default function TicketDetailScreen() {
  const { ticketId } = useRoute<Route>().params;
  const ticket = useTicketsStore((s) => s.tickets.find((t) => t.ticketId === ticketId));
  const theme = useAppTheme();
  const { t } = useI18n();
  const styles = useThemedStyles((th) => StyleSheet.create({
    content: { padding: spacing.lg, alignItems: 'center' },
    missing: { color: th.textMuted, textAlign: 'center', marginTop: 40 },
    receipt: {
      width: '100%', backgroundColor: th.surface, borderRadius: borderRadius.xl,
      padding: spacing.lg, borderWidth: 1, borderColor: th.border, marginBottom: spacing.xl,
    },
    receiptTitle: { color: th.text, fontSize: fontSize.lg, fontWeight: '800', textAlign: 'center' },
    receiptId: { color: th.textMuted, textAlign: 'center', marginBottom: spacing.lg, marginTop: 4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: th.border },
    label: { color: th.textMuted, fontSize: fontSize.sm },
    value: { color: th.text, fontWeight: '600', fontSize: fontSize.sm, maxWidth: '60%', textAlign: 'right' },
    qrWrap: { alignItems: 'center', backgroundColor: th.surface, padding: spacing.lg, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: th.border },
    qrHint: { color: th.textMuted, marginBottom: spacing.md, fontSize: fontSize.sm },
    qrId: { color: th.textSecondary, marginTop: spacing.md, fontSize: fontSize.xs, letterSpacing: 1 },
  }));

  if (!ticket) {
    return (
      <ScreenWrapper edges={['top']} style={{ backgroundColor: theme.bg }}>
        <StackHeader title={t('ticketDetail')} />
        <Text style={styles.missing}>{t('ticketNotFound')}</Text>
      </ScreenWrapper>
    );
  }

  const active = ticket.status === 'ACTIVE' && new Date(ticket.validUntil) > new Date();

  return (
    <ScreenWrapper edges={['top']} style={{ backgroundColor: theme.bg }}>
      <StackHeader title={t('ticketReceipt')} subtitle={ticket.ticketId} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.receipt}>
          <Text style={styles.receiptTitle}>{t('transitReceipt')}</Text>
          <Text style={styles.receiptId}>{t('receiptId', { id: ticket.receiptId })}</Text>
          <View style={styles.row}><Text style={styles.label}>{t('type')}</Text><Text style={styles.value}>{ticket.type}</Text></View>
          <View style={styles.row}><Text style={styles.label}>{t('route')}</Text><Text style={styles.value}>{ticket.from} → {ticket.to}</Text></View>
          <View style={styles.row}><Text style={styles.label}>{t('fare')}</Text><Text style={styles.value}>₹{ticket.fare}</Text></View>
          <View style={styles.row}><Text style={styles.label}>{t('payment')}</Text><Text style={styles.value}>{ticket.paymentMode}</Text></View>
          <View style={styles.row}><Text style={styles.label}>{t('booked')}</Text><Text style={styles.value}>{new Date(ticket.bookedAt).toLocaleString('en-IN')}</Text></View>
          <View style={styles.row}><Text style={styles.label}>{t('validUntil')}</Text><Text style={styles.value}>{new Date(ticket.validUntil).toLocaleString('en-IN')}</Text></View>
          <View style={styles.row}><Text style={styles.label}>{t('status')}</Text><Text style={[styles.value, { color: active ? colors.success : colors.error }]}>{active ? t('live') : ticket.status}</Text></View>
        </View>
        {active && (
          <View style={styles.qrWrap}>
            <Text style={styles.qrHint}>{t('scanGateQr')}</Text>
            <QRCode value={ticket.qrPayload} size={220} backgroundColor="#fff" color="#000" />
            <Text style={styles.qrId}>{ticket.ticketId}</Text>
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
