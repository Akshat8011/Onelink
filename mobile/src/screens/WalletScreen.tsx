import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Modal, Switch, TextInput, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../components/ScreenWrapper';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { useWalletStore, Card, BankAccount } from '../store/useWalletStore';
import { useTicketsStore } from '../store/useTicketsStore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CARD_WIDTH = Dimensions.get('window').width * 0.82;

type CardSettingKey = 'isBlocked' | 'internationalPayments' | 'onlineTransactions';

const CARD_SETTINGS: { key: CardSettingKey; title: string; desc: string }[] = [
  { key: 'isBlocked', title: 'Lock Card', desc: 'Temporarily block all transactions' },
  { key: 'internationalPayments', title: 'International Usage', desc: 'Enable global transactions' },
  { key: 'onlineTransactions', title: 'Online Transactions', desc: 'Enable eCommerce usage' },
];

export default function WalletScreen() {
  const navigation = useNavigation<Nav>();
  const { balance, cards, banks, transactions, analytics, isLoading, fetchDashboard, addFunds, toggleCardSetting } = useWalletStore();
  const activeTickets = useTicketsStore((s) => s.getActiveTickets());
  
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [fundAmount, setFundAmount] = useState('1000');
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);

  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showCardSettings, setShowCardSettings] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (banks.length > 0 && !selectedBank) {
      setSelectedBank(banks[0]);
    }
  }, [banks]);

  useEffect(() => {
    if (selectedCard) {
      const updated = cards.find((c) => c.cardId === selectedCard.cardId);
      if (updated) setSelectedCard(updated);
    }
  }, [cards]);

  const handleTopUp = async () => {
    if (!selectedBank) return;
    const amount = Number(fundAmount);
    if (selectedBank.balance < amount) {
      Alert.alert('Insufficient balance', `${selectedBank.bankName} has only ₹${selectedBank.balance.toLocaleString()}`);
      return;
    }
    const success = await addFunds(amount, selectedBank.accountId);
    if (success) {
      Alert.alert('Success', `₹${fundAmount} added from ${selectedBank.bankName}`);
      setShowAddFunds(false);
    } else {
      Alert.alert('Failed', 'Could not add funds. Please try again.');
    }
  };

  const openCardSettings = (card: Card) => {
    setSelectedCard(card);
    setShowCardSettings(true);
  };

  return (
    <ScreenWrapper edges={['top']} style={{ backgroundColor: '#0A0A0A' }}>
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Wallet Balance</Text>
        <Text style={styles.balanceText}>₹{balance.toLocaleString('en-IN')}</Text>
        <TouchableOpacity style={styles.addFundsBtn} onPress={() => setShowAddFunds(true)}>
          <Ionicons name="add" size={16} color={colors.white} />
          <Text style={styles.addFundsText}>Add Funds</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchDashboard} tintColor={colors.white} />}
      >
        
        {/* ─── Cards Carousel ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Cards</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            {cards.map(card => (
              <TouchableOpacity key={card.cardId} activeOpacity={0.9} onPress={() => openCardSettings(card)}>
                <View style={[styles.cardObject, { backgroundColor: card.colorHex }]}>
                  {/* Card Background Pattern Simulation */}
                  <View style={styles.cardPattern} />
                  
                  <View style={styles.cardTop}>
                    <Text style={styles.cardBank}>{card.bankName}</Text>
                    <Text style={styles.cardType}>{card.network}</Text>
                  </View>
                  
                  <View style={styles.cardMiddle}>
                    <Text style={styles.cardNumber}>••••  ••••  ••••  {card.cardNumberLast4}</Text>
                  </View>
                  
                  <View style={styles.cardBottom}>
                    <View>
                      <Text style={styles.cardLabel}>CARDHOLDER</Text>
                      <Text style={styles.cardValue}>{card.cardholderName.toUpperCase()}</Text>
                    </View>
                    <View>
                      <Text style={styles.cardLabel}>VALID THRU</Text>
                      <Text style={styles.cardValue}>{card.expiryMonth.toString().padStart(2, '0')}/{card.expiryYear}</Text>
                    </View>
                  </View>
                  
                  {card.isBlocked && (
                    <View style={styles.cardBlockedOverlay}>
                      <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 18}}>LOCKED</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ─── Active Tickets ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>My Tickets</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Tickets')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {activeTickets.length === 0 ? (
            <Text style={styles.emptyTickets}>No active metro or bus tickets</Text>
          ) : (
            activeTickets.slice(0, 3).map((t) => (
              <TouchableOpacity
                key={t.ticketId}
                style={styles.ticketRow}
                onPress={() => navigation.navigate('TicketDetail', { ticketId: t.ticketId })}
              >
                <Text style={styles.ticketRoute}>{t.type} · {t.from} → {t.to}</Text>
                <Text style={styles.ticketMeta}>₹{t.fare} · Valid till {new Date(t.validUntil).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ─── Spend Analytics ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spend Analytics</Text>
          <View style={styles.analyticsCard}>
            {analytics.length === 0 ? (
              <Text style={{color: colors.gray500}}>No spend data yet.</Text>
            ) : (
              analytics.map(stat => (
                <View key={stat._id} style={styles.analyticRow}>
                  <Text style={styles.analyticLabel}>{stat._id}</Text>
                  <View style={styles.analyticBarContainer}>
                    <View style={[styles.analyticBar, { width: `${Math.min(100, (stat.total / 10000) * 100)}%` }]} />
                  </View>
                  <Text style={styles.analyticValue}>₹{stat.total}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* ─── Recent Transactions ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <View style={styles.transactionsCard}>
            {transactions.map(txn => (
              <View key={txn.transactionId} style={styles.txnRow}>
                <View style={styles.txnIconWrapper}>
                  <Text style={styles.txnIcon}>{txn.type === 'CREDIT' ? '↙️' : '↗️'}</Text>
                </View>
                <View style={styles.txnDetails}>
                  <Text style={styles.txnDesc}>{txn.description}</Text>
                  <Text style={styles.txnMeta}>{new Date(txn.date).toLocaleDateString()} • {txn.category}</Text>
                </View>
                <View style={styles.txnAmountWrapper}>
                  <Text style={[styles.txnAmount, txn.type === 'CREDIT' ? {color: '#22C55E'} : {color: '#fff'}]}>
                    {txn.type === 'CREDIT' ? '+' : '-'}₹{txn.amount}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ─── Add Funds Modal ─── */}
      <Modal visible={showAddFunds} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.actionModal}>
            <Text style={styles.modalTitle}>Top Up Wallet</Text>
            
            <View style={styles.amountInputRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={fundAmount}
                onChangeText={setFundAmount}
                keyboardType="numeric"
                placeholder="1000"
                placeholderTextColor={colors.gray600}
              />
            </View>
            
            <View style={styles.quickAmountRow}>
              {['500', '1000', '2000', '5000'].map(amt => (
                <TouchableOpacity key={amt} style={styles.quickAmountBtn} onPress={() => setFundAmount(amt)}>
                  <Text style={styles.quickAmountText}>+₹{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalSubTitle}>Pay Using Bank Account</Text>
            <ScrollView style={{maxHeight: 200, marginBottom: 20}}>
              {banks.map(bank => (
                <TouchableOpacity 
                  key={bank.accountId} 
                  style={[styles.bankRow, selectedBank?.accountId === bank.accountId && styles.bankRowActive]}
                  onPress={() => setSelectedBank(bank)}
                >
                  <Text style={styles.bankName}>{bank.bankName}</Text>
                  <Text style={styles.bankDetails}>•• {bank.accountNumberLast4} | Bal: ₹{bank.balance}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleTopUp}>
              <Text style={styles.primaryBtnText}>PAY ₹{fundAmount}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddFunds(false)}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Card Settings Modal ─── */}
      {selectedCard && (
        <Modal visible={showCardSettings} animationType="fade" transparent>
          <View style={styles.modalOverlayDark}>
            <View style={styles.settingsModal}>
              <View style={styles.settingsHeader}>
                <Text style={styles.modalTitle}>Card Management</Text>
                <TouchableOpacity onPress={() => setShowCardSettings(false)}>
                  <Text style={{ fontSize: 24, color: '#666' }}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.settingsCardName}>{selectedCard.bankName} ending in {selectedCard.cardNumberLast4}</Text>

              <ScrollView style={{ maxHeight: 400 }}>
                {CARD_SETTINGS.map(({ key, title, desc }) => (
                  <View key={key} style={styles.settingRow}>
                    <View style={{ flex: 1, paddingRight: spacing.md }}>
                      <Text style={styles.settingTitle}>{title}</Text>
                      <Text style={styles.settingDesc}>{desc}</Text>
                    </View>
                    <Switch
                      value={Boolean(selectedCard[key])}
                      onValueChange={(val) => toggleCardSetting(selectedCard.cardId, key, val)}
                      trackColor={{ false: '#333', true: key === 'isBlocked' ? '#E33629' : '#22C55E' }}
                      thumbColor="#fff"
                      disabled={selectedCard.isBlocked && key !== 'isBlocked'}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

    </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' }, // CRED dark theme
  header: { paddingTop: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, backgroundColor: '#111111' },
  greeting: { color: colors.gray400, fontSize: fontSize.md, fontWeight: '600', letterSpacing: 0.5 },
  balanceText: { color: colors.white, fontSize: 44, fontWeight: '900', marginVertical: spacing.sm },
  addFundsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  addFundsText: { color: colors.white, fontSize: fontSize.sm, fontWeight: '700' },
  
  content: { paddingTop: spacing.xl },
  section: { marginBottom: spacing.xxl },
  sectionTitle: { color: colors.white, fontSize: fontSize.xl, fontWeight: '800', marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: spacing.lg, marginBottom: spacing.md },
  seeAll: { color: colors.primary, fontWeight: '700', fontSize: fontSize.sm },
  emptyTickets: { color: colors.gray500, marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  ticketRow: { marginHorizontal: spacing.lg, backgroundColor: '#111', borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: '#222' },
  ticketRoute: { color: colors.white, fontWeight: '700', fontSize: fontSize.md },
  ticketMeta: { color: colors.gray500, fontSize: fontSize.xs, marginTop: 4 },
  
  cardObject: { width: Dimensions.get('window').width * 0.82, height: 220, borderRadius: 16, padding: spacing.lg, justifyContent: 'space-between', position: 'relative', overflow: 'hidden' },
  cardPattern: { position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBank: { color: colors.white, fontSize: fontSize.md, fontWeight: '800', opacity: 0.9 },
  cardType: { color: colors.white, fontSize: fontSize.md, fontWeight: '900', fontStyle: 'italic' },
  cardMiddle: { marginVertical: spacing.md },
  cardNumber: { color: colors.white, fontSize: 22, fontWeight: '500', letterSpacing: 2 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  cardLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', marginBottom: 2 },
  cardValue: { color: colors.white, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  cardBlockedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },

  analyticsCard: { backgroundColor: '#111', marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: borderRadius.xl },
  analyticRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  analyticLabel: { color: colors.gray400, width: 80, fontSize: 12, fontWeight: '600' },
  analyticBarContainer: { flex: 1, height: 8, backgroundColor: '#222', borderRadius: 4, marginHorizontal: spacing.md },
  analyticBar: { height: '100%', backgroundColor: '#6366F1', borderRadius: 4 },
  analyticValue: { color: colors.white, fontSize: 13, fontWeight: '700', width: 60, textAlign: 'right' },

  transactionsCard: { backgroundColor: '#111', marginHorizontal: spacing.lg, borderRadius: borderRadius.xl, paddingVertical: spacing.md },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: '#222' },
  txnIconWrapper: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  txnIcon: { fontSize: 16 },
  txnDetails: { flex: 1 },
  txnDesc: { color: colors.white, fontSize: fontSize.md, fontWeight: '600', marginBottom: 4 },
  txnMeta: { color: colors.gray500, fontSize: 11 },
  txnAmountWrapper: { alignItems: 'flex-end' },
  txnAmount: { fontSize: fontSize.md, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  actionModal: { backgroundColor: '#1A1A1A', padding: spacing.xl, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalTitle: { color: colors.white, fontSize: 24, fontWeight: '800', marginBottom: spacing.lg },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: spacing.lg },
  currencySymbol: { color: colors.gray400, fontSize: 32, fontWeight: '600', marginRight: 8 },
  amountInput: { color: colors.white, fontSize: 48, fontWeight: '900', minWidth: 120, textAlign: 'center' },
  quickAmountRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginBottom: spacing.xl },
  quickAmountBtn: { backgroundColor: '#333', paddingHorizontal: 16, paddingVertical: 8, borderRadius: borderRadius.full },
  quickAmountText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  modalSubTitle: { color: colors.gray400, fontSize: 14, fontWeight: '600', marginBottom: spacing.sm, textTransform: 'uppercase' },
  bankRow: { padding: spacing.md, backgroundColor: '#222', borderRadius: borderRadius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: '#222' },
  bankRowActive: { borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.1)' },
  bankName: { color: colors.white, fontSize: 16, fontWeight: '700' },
  bankDetails: { color: colors.gray400, fontSize: 12, marginTop: 4 },
  primaryBtn: { backgroundColor: '#6366F1', paddingVertical: 16, borderRadius: borderRadius.lg, alignItems: 'center', marginTop: spacing.lg },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  cancelBtn: { paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm },
  cancelBtnText: { color: colors.gray500, fontSize: 14, fontWeight: '700' },

  modalOverlayDark: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  settingsModal: { width: '90%', backgroundColor: '#1A1A1A', borderRadius: 24, padding: spacing.xl },
  settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  settingsCardName: { color: '#A3A3A3', fontSize: 14, marginBottom: spacing.xl },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  settingTitle: { color: colors.white, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  settingDesc: { color: colors.gray500, fontSize: 12 }
});
