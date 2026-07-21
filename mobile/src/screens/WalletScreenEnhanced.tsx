import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Modal, Switch, TextInput, Alert, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../components/ScreenWrapper';
import WalletServiceModal, { WalletServiceType } from '../components/WalletServiceModal';
import UserAvatarButton from '../components/UserAvatarButton';
import OneLinkPrintCard from '../components/OneLinkPrintCard';
import { useAppTheme } from '../hooks/useAppTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useI18n } from '../hooks/useI18n';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { useWalletStore, Card, BankAccount } from '../store/useWalletStore';
import { useAuthStore } from '../store/useAuthStore';
import { useTicketsStore } from '../store/useTicketsStore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CARD_WIDTH = Dimensions.get('window').width * 0.82;
/** Compact print card — full artwork visible, pocket-sized */
const PRINT_CARD_WIDTH = Math.min(Dimensions.get('window').width * 0.56, 200);
type CardSettingKey = 'isBlocked' | 'internationalPayments' | 'onlineTransactions';

const CARD_SETTING_KEYS: { key: CardSettingKey; titleKey: 'lockCard' | 'internationalUsage' | 'onlineTransactions'; descKey: 'lockCardDesc' | 'internationalUsageDesc' | 'onlineTransactionsDesc' }[] = [
  { key: 'isBlocked', titleKey: 'lockCard', descKey: 'lockCardDesc' },
  { key: 'internationalPayments', titleKey: 'internationalUsage', descKey: 'internationalUsageDesc' },
  { key: 'onlineTransactions', titleKey: 'onlineTransactions', descKey: 'onlineTransactionsDesc' },
];

type ServiceType = WalletServiceType;

const UPI_STORAGE_KEY = 'onelink_upi_id';

export default function WalletScreen() {
  const navigation = useNavigation<Nav>();
  const theme = useAppTheme();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const styles = useThemedStyles((th) => StyleSheet.create({
    container: { flex: 1, backgroundColor: th.bg },
    content: { paddingBottom: 32 },
    header: {
      backgroundColor: th.wallet.primary, marginHorizontal: spacing.lg, marginTop: spacing.md,
      borderRadius: th.radiusLg, padding: spacing.lg, marginBottom: spacing.md, overflow: 'hidden', ...th.shadow,
      borderWidth: 1, borderColor: 'rgba(184,149,107,0.18)',
    },
    headerGlow: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: th.wallet.accent, opacity: 0.12, right: -40, top: -40 },
    headerGlowSecondary: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: th.wallet.secondary, opacity: 0.25, left: -20, bottom: -30 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    upiLinked: { color: 'rgba(184,149,107,0.85)', fontSize: fontSize.xs, marginTop: 6 },
    greeting: { color: 'rgba(255,255,255,0.72)', fontSize: fontSize.sm, fontWeight: '600', letterSpacing: 0.3 },
    balanceText: { color: '#F8FAFC', fontSize: 40, fontWeight: '900', marginTop: 4, letterSpacing: -1 },
    addFundsBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
      backgroundColor: 'rgba(184,149,107,0.22)', paddingHorizontal: spacing.md, paddingVertical: 10,
      borderRadius: borderRadius.full, marginTop: spacing.md, borderWidth: 1, borderColor: 'rgba(184,149,107,0.35)',
    },
    addFundsText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '700' },
    servicesSection: { backgroundColor: th.surface, padding: spacing.lg, marginHorizontal: spacing.lg, borderRadius: th.radius, marginBottom: spacing.md, ...th.shadowSoft },
    sectionTitleInline: { color: th.text, fontSize: fontSize.lg, fontWeight: '800', marginBottom: spacing.md, letterSpacing: -0.3 },
    servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    serviceCard: { width: '30%', alignItems: 'center', backgroundColor: th.surfaceMuted, padding: spacing.md, borderRadius: th.radiusSm },
    serviceIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
    serviceLabel: { color: th.textSecondary, fontSize: fontSize.xs, fontWeight: '600', textAlign: 'center' },
    section: { marginBottom: spacing.lg },
    sectionTitle: { color: th.text, fontSize: fontSize.lg, fontWeight: '800', marginHorizontal: spacing.lg, marginBottom: spacing.md, letterSpacing: -0.3 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: spacing.lg, marginBottom: spacing.md },
    seeAll: { color: th.wallet.secondary, fontWeight: '700', fontSize: fontSize.sm },
    cardObject: { width: CARD_WIDTH, height: 220, borderRadius: 20, padding: spacing.lg, justifyContent: 'space-between', position: 'relative', overflow: 'hidden', ...th.shadow },
    cardPattern: { position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.08)' },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardBank: { color: '#fff', fontSize: fontSize.md, fontWeight: '800', opacity: 0.95 },
    cardType: { color: '#fff', fontSize: fontSize.md, fontWeight: '900', fontStyle: 'italic' },
    cardMiddle: { marginVertical: spacing.md },
    cardNumber: { color: '#fff', fontSize: 22, fontWeight: '500', letterSpacing: 2 },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
    cardLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '700', marginBottom: 2 },
    cardValue: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
    cardBlockedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', gap: 8 },
    cardBlockedText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    bankCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: th.surface, marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: th.radiusSm, marginBottom: spacing.sm, ...th.shadowSoft },
    bankIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: th.wallet.soft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, borderWidth: 1, borderColor: th.border },
    bankDetails: { flex: 1 },
    bankName: { color: th.text, fontSize: fontSize.md, fontWeight: '700' },
    bankAccount: { color: th.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    bankBalance: { color: th.text, fontSize: fontSize.lg, fontWeight: '800' },
    emptyTickets: { color: th.textMuted, marginHorizontal: spacing.lg, marginBottom: spacing.lg },
    ticketRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, backgroundColor: th.surface, borderRadius: th.radiusSm, padding: spacing.md, marginBottom: spacing.sm, ...th.shadowSoft },
    ticketRoute: { color: th.text, fontWeight: '700', fontSize: fontSize.md },
    ticketMeta: { color: th.textMuted, fontSize: fontSize.xs, marginTop: 4 },
    analyticsCard: { backgroundColor: th.surface, marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: th.radius, ...th.shadowSoft },
    analyticRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    analyticLabel: { color: th.textSecondary, width: 80, fontSize: 12, fontWeight: '600' },
    analyticBarContainer: { flex: 1, height: 8, backgroundColor: th.surfaceMuted, borderRadius: 4, marginHorizontal: spacing.md },
    analyticBar: { height: '100%', backgroundColor: th.wallet.secondary, borderRadius: 4 },
    analyticValue: { color: th.text, fontSize: 13, fontWeight: '700', width: 60, textAlign: 'right' },
    transactionsCard: { backgroundColor: th.surface, marginHorizontal: spacing.lg, borderRadius: th.radius, paddingVertical: spacing.sm, ...th.shadowSoft },
    txnRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: th.border },
    txnIconWrapper: { width: 40, height: 40, borderRadius: 14, backgroundColor: th.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
    txnDetails: { flex: 1 },
    txnDesc: { color: th.text, fontSize: fontSize.md, fontWeight: '600', marginBottom: 4 },
    txnMeta: { color: th.textMuted, fontSize: 11 },
    txnAmount: { fontSize: fontSize.md, fontWeight: '800' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,20,25,0.45)', justifyContent: 'flex-end' },
    actionModal: { backgroundColor: th.surface, padding: spacing.xl, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
    modalTitle: { color: th.text, fontSize: 24, fontWeight: '800', marginBottom: spacing.lg },
    amountInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: spacing.lg },
    currencySymbol: { color: th.textSecondary, fontSize: 32, fontWeight: '600', marginRight: 8 },
    amountInput: { color: th.text, fontSize: 48, fontWeight: '900', minWidth: 120, textAlign: 'center' },
    quickAmountRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginBottom: spacing.xl },
    quickAmountBtn: { backgroundColor: th.surfaceMuted, paddingHorizontal: 16, paddingVertical: 8, borderRadius: borderRadius.full },
    quickAmountText: { color: th.text, fontSize: 14, fontWeight: '600' },
    modalSubTitle: { color: th.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
    bankRow: { padding: spacing.md, backgroundColor: th.surfaceMuted, borderRadius: th.radiusSm, marginBottom: spacing.sm, borderWidth: 1.5, borderColor: 'transparent' },
    bankRowActive: { borderColor: th.wallet.primary, backgroundColor: th.wallet.soft },
    bankRowDetails: { color: th.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    primaryBtn: { backgroundColor: th.wallet.primary, paddingVertical: 16, borderRadius: th.radiusSm, alignItems: 'center', marginTop: spacing.lg },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
    cancelBtn: { paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm },
    cancelBtnText: { color: th.textMuted, fontSize: 14, fontWeight: '700' },
    modalOverlayDark: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
    settingsModal: { width: '90%', backgroundColor: th.surface, borderRadius: 24, padding: spacing.xl, ...th.shadow },
    settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    settingsCardName: { color: th.textSecondary, fontSize: 14, marginBottom: spacing.xl },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: th.border },
    settingTitle: { color: th.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
    settingDesc: { color: th.textMuted, fontSize: 12 },
    emptyAnalytics: { color: th.textMuted },
  }));

  const scrollRef = useRef<ScrollView>(null);
  const { balance, cards, banks, transactions, analytics, isLoading, fetchDashboard, addFunds, toggleCardSetting } = useWalletStore();
  const activeTickets = useTicketsStore((s) => s.getActiveTickets());
  
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [fundAmount, setFundAmount] = useState('1000');
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showCardSettings, setShowCardSettings] = useState(false);
  const [activeService, setActiveService] = useState<ServiceType | null>(null);
  const [upiId, setUpiId] = useState('');

  useEffect(() => {
    fetchDashboard();
    AsyncStorage.getItem(UPI_STORAGE_KEY).then((v) => { if (v) setUpiId(v); });
  }, []);

  useEffect(() => {
    if (banks.length > 0 && !selectedBank) setSelectedBank(banks[0]);
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
      Alert.alert(t('insufficientBankBalance'), t('bankHasOnly', { bank: selectedBank.bankName, amount: selectedBank.balance.toLocaleString() }));
      return;
    }
    const success = await addFunds(amount, selectedBank.accountId);
    if (success) {
      Alert.alert(t('success'), t('fundsAdded', { amount: fundAmount, bank: selectedBank.bankName }));
      setShowAddFunds(false);
    } else {
      Alert.alert(t('failed'), t('couldNotAddFunds'));
    }
  };

  const openCardSettings = (card: Card) => {
    setSelectedCard(card);
    setShowCardSettings(true);
  };

  const handleServiceAction = (service: ServiceType) => {
    if (service === 'INVEST') {
      navigation.navigate('Invest');
      return;
    }
    if (service === 'LOAN') {
      navigation.navigate('Loans');
      return;
    }
    if (service === 'INSURANCE') {
      navigation.navigate('Insurance');
      return;
    }
    if (service === 'BILLS') {
      navigation.navigate('Bills');
      return;
    }
    setActiveService(service);
  };

  const saveUpiId = async (id: string) => {
    setUpiId(id);
    await AsyncStorage.setItem(UPI_STORAGE_KEY, id);
  };

  const services = [
    { type: 'UPI' as ServiceType, icon: 'flash' as const, labelKey: 'upiPayments' as const, color: theme.wallet.service.upi },
    { type: 'BILLS' as ServiceType, icon: 'receipt' as const, labelKey: 'payBills' as const, color: theme.wallet.service.bills },
    { type: 'RECHARGE' as ServiceType, icon: 'phone-portrait' as const, labelKey: 'recharge' as const, color: theme.wallet.service.recharge },
    { type: 'INVEST' as ServiceType, icon: 'trending-up' as const, labelKey: 'investNav' as const, color: theme.wallet.service.invest },
    { type: 'LOAN' as ServiceType, icon: 'cash' as const, labelKey: 'loansNav' as const, color: theme.wallet.service.loan },
    { type: 'INSURANCE' as ServiceType, icon: 'shield-checkmark' as const, labelKey: 'insuranceLabel' as const, color: theme.wallet.service.insurance },
  ];

  return (
    <ScreenWrapper edges={['top']} style={{ backgroundColor: theme.bg }}>
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchDashboard} tintColor={theme.wallet.primary} />}
      >
      <View style={styles.header}>
        <View style={styles.headerGlow} />
        <View style={styles.headerGlowSecondary} />
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{t('oneLinkWallet')}</Text>
            <Text style={styles.balanceText}>₹{balance.toLocaleString('en-IN')}</Text>
            {upiId ? <Text style={styles.upiLinked}>UPI · {upiId}</Text> : null}
          </View>
          <UserAvatarButton size={42} />
        </View>
        <TouchableOpacity style={styles.addFundsBtn} onPress={() => setShowAddFunds(true)}>
          <Ionicons name="add-circle" size={18} color="#fff" />
          <Text style={styles.addFundsText}>{t('addFunds')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.servicesSection}>
        <Text style={styles.sectionTitleInline}>{t('bankingServices')}</Text>
        <View style={styles.servicesGrid}>
          {services.map((service) => (
            <TouchableOpacity
              key={service.type}
              style={styles.serviceCard}
              onPress={() => handleServiceAction(service.type)}
              activeOpacity={0.8}
            >
              <View style={[styles.serviceIcon, { backgroundColor: service.color + '14' }]}>
                <Ionicons name={service.icon} size={24} color={service.color} />
              </View>
              <Text style={styles.serviceLabel}>{t(service.labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
        
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('yourCards')}</Text>
            <TouchableOpacity onPress={() => cards[0] && openCardSettings(cards[0])}>
              <Text style={styles.seeAll}>{t('manageArrow')}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm, alignItems: 'center' }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                if (cards[0]) openCardSettings(cards[0]);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('cardManagement')}
            >
              <OneLinkPrintCard
                width={PRINT_CARD_WIDTH}
                holderName={
                  user?.name
                  || user?.username
                  || cards[0]?.cardholderName
                  || 'OneLink User'
                }
                last4={
                  (user?.card?.cardNumber || cards[0]?.cardNumberLast4 || '4242')
                    .toString()
                    .replace(/\D/g, '')
                    .slice(-4) || '4242'
                }
                seed={user?.userId || user?.cardUid || user?.username || cards[0]?.cardId || 'onelink'}
                expiry={
                  user?.card?.expiry
                  || (cards[0]
                    ? `${String(cards[0].expiryMonth).padStart(2, '0')}/${cards[0].expiryYear}`
                    : '12/28')
                }
                accountNumber={user?.cardUid || user?.card?.cardNumber || user?.userId}
                compact
              />
            </TouchableOpacity>
            <Text style={{
              marginTop: spacing.sm,
              color: theme.textMuted,
              fontSize: fontSize.xs,
              fontWeight: '600',
              textAlign: 'center',
            }}>
              Tap card for management
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('linkedBanks')}</Text>
          {banks.map((bank) => (
            <View key={bank.accountId} style={styles.bankCard}>
              <View style={styles.bankIcon}>
                <Ionicons name="business" size={20} color={theme.wallet.primary} />
              </View>
              <View style={styles.bankDetails}>
                <Text style={styles.bankName}>{bank.bankName}</Text>
                <Text style={styles.bankAccount}>•• •• {bank.accountNumberLast4} · {bank.accountType}</Text>
              </View>
              <Text style={styles.bankBalance}>₹{bank.balance.toLocaleString()}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('myTicketsWallet')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Tickets')}>
              <Text style={styles.seeAll}>{t('seeAllArrow')}</Text>
            </TouchableOpacity>
          </View>
          {activeTickets.length === 0 ? (
            <Text style={styles.emptyTickets}>{t('noActiveTickets')}</Text>
          ) : (
            activeTickets.slice(0, 3).map((ticket) => (
              <TouchableOpacity
                key={ticket.ticketId}
                style={styles.ticketRow}
                onPress={() => navigation.navigate('TicketDetail', { ticketId: ticket.ticketId })}
              >
                <Ionicons name="ticket" size={20} color={theme.wallet.primary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.ticketRoute}>{ticket.type} · {ticket.from} → {ticket.to}</Text>
                  <Text style={styles.ticketMeta}>₹{ticket.fare} · {t('validTill', { time: new Date(ticket.validUntil).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) })}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('spendAnalytics')}</Text>
          <View style={styles.analyticsCard}>
            {analytics.length === 0 ? (
              <Text style={styles.emptyAnalytics}>{t('noSpendData')}</Text>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('recentTransactions')}</Text>
          <View style={styles.transactionsCard}>
            {transactions.slice(0, 8).map(txn => (
              <View key={txn.transactionId} style={styles.txnRow}>
                <View style={styles.txnIconWrapper}>
                  <Ionicons name={txn.type === 'CREDIT' ? 'arrow-down' : 'arrow-up'} size={16} color={txn.type === 'CREDIT' ? theme.wallet.credit : theme.wallet.debit} />
                </View>
                <View style={styles.txnDetails}>
                  <Text style={styles.txnDesc}>{txn.description}</Text>
                  <Text style={styles.txnMeta}>{new Date(txn.date).toLocaleDateString()} • {txn.category}</Text>
                </View>
                <Text style={[styles.txnAmount, { color: txn.type === 'CREDIT' ? theme.wallet.credit : theme.wallet.debit }]}>
                  {txn.type === 'CREDIT' ? '+' : '-'}₹{txn.amount}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      <WalletServiceModal
        visible={activeService !== null}
        service={activeService}
        onClose={() => setActiveService(null)}
        upiId={upiId}
        onUpiSaved={saveUpiId}
      />

      {/* Add Funds Modal */}
      <Modal visible={showAddFunds} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.actionModal}>
            <Text style={styles.modalTitle}>{t('topUpWallet')}</Text>
            
            <View style={styles.amountInputRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={fundAmount}
                onChangeText={setFundAmount}
                keyboardType="numeric"
                placeholder="1000"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            
            <View style={styles.quickAmountRow}>
              {['500', '1000', '2000', '5000'].map(amt => (
                <TouchableOpacity key={amt} style={styles.quickAmountBtn} onPress={() => setFundAmount(amt)}>
                  <Text style={styles.quickAmountText}>+₹{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalSubTitle}>{t('payUsingBankAccount')}</Text>
            <ScrollView style={{maxHeight: 200, marginBottom: 20}}>
              {banks.map(bank => (
                <TouchableOpacity 
                  key={bank.accountId} 
                  style={[styles.bankRow, selectedBank?.accountId === bank.accountId && styles.bankRowActive]}
                  onPress={() => setSelectedBank(bank)}
                >
                  <Text style={styles.bankName}>{bank.bankName}</Text>
                  <Text style={styles.bankRowDetails}>•• {bank.accountNumberLast4} | Bal: ₹{bank.balance}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleTopUp}>
              <Text style={styles.primaryBtnText}>{t('payBtnAmount', { amount: fundAmount })}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddFunds(false)}>
              <Text style={styles.cancelBtnText}>{t('cancel').toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Card Settings Modal */}
      {selectedCard && (
        <Modal visible={showCardSettings} animationType="fade" transparent>
          <View style={styles.modalOverlayDark}>
            <View style={styles.settingsModal}>
              <View style={styles.settingsHeader}>
                <Text style={styles.modalTitle}>{t('cardManagement')}</Text>
                <TouchableOpacity onPress={() => setShowCardSettings(false)}>
                  <Ionicons name="close" size={24} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.settingsCardName}>
                OneLink Card · •••• {selectedCard.cardNumberLast4}
              </Text>

              <ScrollView style={{ maxHeight: 400 }}>
                {CARD_SETTING_KEYS.map(({ key, titleKey, descKey }) => (
                  <View key={key} style={styles.settingRow}>
                    <View style={{ flex: 1, paddingRight: spacing.md }}>
                      <Text style={styles.settingTitle}>{t(titleKey)}</Text>
                      <Text style={styles.settingDesc}>{t(descKey)}</Text>
                    </View>
                    <Switch
                      value={Boolean(selectedCard[key])}
                      onValueChange={(val) => toggleCardSetting(selectedCard.cardId, key, val)}
                      trackColor={{ false: '#333', true: key === 'isBlocked' ? theme.wallet.debit : theme.wallet.credit }}
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
