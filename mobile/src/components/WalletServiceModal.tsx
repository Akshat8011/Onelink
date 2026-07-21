import React, { useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useI18n } from '../hooks/useI18n';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { useWalletStore } from '../store/useWalletStore';
import { useNotificationsStore } from '../store/useNotificationsStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { confirmDialog, alertDialog } from '../utils/dialog';

export type WalletServiceType = 'UPI' | 'BILLS' | 'RECHARGE' | 'INVEST' | 'LOAN' | 'INSURANCE';

interface Props {
  visible: boolean;
  service: WalletServiceType | null;
  onClose: () => void;
  upiId: string;
  onUpiSaved: (id: string) => void;
}

const BILL_TYPES = ['Electricity', 'Water', 'Gas', 'Internet', 'DTH'];
const RECHARGE_TYPES = ['Mobile Prepaid', 'Mobile Postpaid', 'DTH', 'FASTag'];
const INSURANCE_TYPES = ['Health', 'Life', 'Vehicle', 'Travel'];

export default function WalletServiceModal({ visible, service, onClose, upiId, onUpiSaved }: Props) {
  const theme = useAppTheme();
  const { t } = useI18n();
  const { balance, debitWallet, creditWallet } = useWalletStore();
  const pushNotifications = useSettingsStore((s) => s.pushNotifications);
  const [amount, setAmount] = useState('299');
  const [reference, setReference] = useState('');
  const [billType, setBillType] = useState(BILL_TYPES[0]);
  const [rechargeType, setRechargeType] = useState(RECHARGE_TYPES[0]);
  const [insuranceType, setInsuranceType] = useState(INSURANCE_TYPES[0]);
  const [upiInput, setUpiInput] = useState(upiId);

  const notify = (title: string, body: string) => {
    if (pushNotifications) {
      useNotificationsStore.getState().add({ title, body, type: 'WALLET', actionRoute: 'Wallet' });
    }
  };

  const pay = (category: string, description: string) => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      alertDialog('Invalid amount', 'Enter a valid amount');
      return;
    }
    if (balance < amt) {
      alertDialog('Insufficient balance', `Wallet has ₹${balance.toLocaleString()}`);
      return;
    }
    const ok = debitWallet(amt, category, description, 'OneLink Wallet');
    if (!ok) {
      alertDialog('Payment failed', 'Could not complete transaction');
      return;
    }
    notify('Payment successful', description);
    alertDialog('Success', `${description}\n₹${amt} paid from wallet`);
    onClose();
  };

  const titleMap: Record<WalletServiceType, string> = {
    UPI: t('upiPayments'),
    BILLS: t('payBills'),
    RECHARGE: t('recharge'),
    INVEST: 'Invest',
    LOAN: 'Personal Loan',
    INSURANCE: 'Insurance',
  };

  if (!service) return null;

  const sheetStyle = { backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg };
  const inputStyle = { backgroundColor: theme.surfaceMuted, borderRadius: borderRadius.md, padding: spacing.md, color: theme.text, marginBottom: spacing.sm, borderWidth: 1, borderColor: theme.border };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.isDark ? 'rgba(0,0,0,0.75)' : 'rgba(15,20,25,0.45)' }]}>
        <View style={sheetStyle}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>{titleMap[service]}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }}>
            {service === 'UPI' && (
              <>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Your UPI ID</Text>
                <TextInput
                  style={inputStyle}
                  value={upiInput}
                  onChangeText={setUpiInput}
                  placeholder="name@upi"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                />
                <Text style={[styles.label, { color: theme.textSecondary }]}>Amount (₹)</Text>
                <TextInput style={inputStyle} value={amount} onChangeText={setAmount} keyboardType="numeric" />
                <Text style={[styles.label, { color: theme.textSecondary }]}>Note / UPI reference</Text>
                <TextInput style={inputStyle} value={reference} onChangeText={setReference} placeholder="Payment for..." placeholderTextColor={theme.textMuted} />
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: theme.wallet.primary }]}
                  onPress={() => {
                    if (!upiInput.includes('@')) {
                      alertDialog('Invalid UPI', 'Enter a valid UPI ID (e.g. name@paytm)');
                      return;
                    }
                    onUpiSaved(upiInput);
                    pay('UPI', `UPI to ${upiInput}${reference ? ` · ${reference}` : ''}`);
                  }}
                >
                  <Text style={styles.btnText}>Pay via UPI</Text>
                </TouchableOpacity>
              </>
            )}

            {service === 'BILLS' && (
              <>
                <Text style={styles.label}>Bill type</Text>
                <View style={styles.chipRow}>
                  {BILL_TYPES.map((bt) => (
                    <TouchableOpacity key={bt} style={[styles.chip, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }, billType === bt && { borderColor: theme.wallet.primary, backgroundColor: theme.wallet.soft }]} onPress={() => setBillType(bt)}>
                      <Text style={[styles.chipText, { color: theme.textSecondary }, billType === bt && { color: theme.wallet.primary }]}>{bt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.label}>Consumer / account number</Text>
                <TextInput style={inputStyle} value={reference} onChangeText={setReference} placeholder="Account no." placeholderTextColor={theme.textMuted} />
                <Text style={[styles.label, { color: theme.textSecondary }]}>Amount (₹)</Text>
                <TextInput style={inputStyle} value={amount} onChangeText={setAmount} keyboardType="numeric" />
                <TouchableOpacity style={[styles.btn, { backgroundColor: theme.wallet.primary }]} onPress={() => pay('BILLS', `${billType} bill · ${reference || 'account'}`)}>
                  <Text style={styles.btnText}>Pay bill</Text>
                </TouchableOpacity>
              </>
            )}

            {service === 'RECHARGE' && (
              <>
                <Text style={styles.label}>Recharge type</Text>
                <View style={styles.chipRow}>
                  {RECHARGE_TYPES.map((rt) => (
                    <TouchableOpacity key={rt} style={[styles.chip, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }, rechargeType === rt && { borderColor: theme.wallet.primary, backgroundColor: theme.wallet.soft }]} onPress={() => setRechargeType(rt)}>
                      <Text style={[styles.chipText, { color: theme.textSecondary }, rechargeType === rt && { color: theme.wallet.primary }]}>{rt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.label}>Mobile / subscriber number</Text>
                <TextInput style={inputStyle} value={reference} onChangeText={setReference} placeholder="10-digit number" keyboardType="phone-pad" placeholderTextColor={theme.textMuted} />
                <Text style={[styles.label, { color: theme.textSecondary }]}>Amount (₹)</Text>
                <TextInput style={inputStyle} value={amount} onChangeText={setAmount} keyboardType="numeric" />
                <TouchableOpacity style={[styles.btn, { backgroundColor: theme.wallet.primary }]} onPress={() => pay('RECHARGE', `${rechargeType} · ${reference || 'number'}`)}>
                  <Text style={styles.btnText}>Recharge now</Text>
                </TouchableOpacity>
              </>
            )}

            {service === 'INVEST' && (
              <>
                <Text style={styles.hint}>SIP / lump-sum into OneLink Balanced Fund (demo)</Text>
                <Text style={styles.label}>Amount (₹)</Text>
                <TextInput style={inputStyle} value={amount} onChangeText={setAmount} keyboardType="numeric" />
                <TouchableOpacity style={[styles.btn, { backgroundColor: theme.wallet.primary }]} onPress={() => pay('INVEST', 'Mutual fund investment')}>
                  <Text style={styles.btnText}>Invest</Text>
                </TouchableOpacity>
              </>
            )}

            {service === 'LOAN' && (
              <>
                <Text style={styles.hint}>Instant personal loan eligibility check</Text>
                <Text style={styles.label}>Loan amount (₹)</Text>
                <TextInput style={inputStyle} value={amount} onChangeText={setAmount} keyboardType="numeric" />
                <Text style={[styles.label, { color: theme.textSecondary }]}>Purpose</Text>
                <TextInput style={inputStyle} value={reference} onChangeText={setReference} placeholder="Medical, travel, etc." placeholderTextColor={theme.textMuted} />
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: theme.wallet.primary }]}
                  onPress={async () => {
                    const amt = Number(amount);
                    if (!Number.isFinite(amt) || amt <= 0) {
                      alertDialog('Invalid amount', 'Enter a valid loan amount');
                      return;
                    }
                    const confirmed = await confirmDialog(
                      'Loan approved (demo)',
                      `₹${amt.toLocaleString()} pre-approved at 12% p.a.\nEMI starts next month. Funds credited to wallet.`,
                      'Accept',
                      'Cancel',
                    );
                    if (!confirmed) return;
                    creditWallet(amt, 'LOAN', `Personal loan disbursal · ${reference || 'general'}`, 'Loan');
                    notify('Loan disbursed', `₹${amt} credited to wallet`);
                    alertDialog('Loan disbursed', `₹${amt.toLocaleString()} credited to wallet`);
                    onClose();
                  }}
                >
                  <Text style={styles.btnText}>Check eligibility</Text>
                </TouchableOpacity>
              </>
            )}

            {service === 'INSURANCE' && (
              <>
                <Text style={styles.label}>Insurance type</Text>
                <View style={styles.chipRow}>
                  {INSURANCE_TYPES.map((it) => (
                    <TouchableOpacity key={it} style={[styles.chip, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }, insuranceType === it && { borderColor: theme.wallet.primary, backgroundColor: theme.wallet.soft }]} onPress={() => setInsuranceType(it)}>
                      <Text style={[styles.chipText, { color: theme.textSecondary }, insuranceType === it && { color: theme.wallet.primary }]}>{it}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.label}>Premium (₹)</Text>
                <TextInput style={inputStyle} value={amount} onChangeText={setAmount} keyboardType="numeric" />
                <TouchableOpacity style={[styles.btn, { backgroundColor: theme.wallet.primary }]} onPress={() => pay('INSURANCE', `${insuranceType} insurance premium`)}>
                  <Text style={styles.btnText}>Pay premium</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: fontSize.lg, fontWeight: '800' },
  label: { fontSize: fontSize.xs, marginBottom: 6, marginTop: spacing.sm, fontWeight: '600' },
  hint: { fontSize: fontSize.sm, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: borderRadius.full, borderWidth: 1 },
  chipText: { fontSize: fontSize.xs, fontWeight: '600' },
  btn: { padding: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.lg },
  btnText: { color: '#fff', fontWeight: '800' },
});
