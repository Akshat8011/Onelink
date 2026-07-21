import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, Alert,
  ActivityIndicator, Modal, TextInput, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useAppTheme } from '../hooks/useAppTheme';
import { useI18n } from '../hooks/useI18n';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { useAuthStore } from '../store/useAuthStore';

interface NfcPairingCardProps {
  onToggleBlock?: (blocked: boolean) => void;
  showControls?: boolean;
}

type PasswordAction = 'reveal' | 'regenerate';

export default function NfcPairingCard({ onToggleBlock, showControls = false }: NfcPairingCardProps) {
  const theme = useAppTheme();
  const { t } = useI18n();
  const { user, revealPairingToken, regeneratePairingToken } = useAuthStore();
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [passwordAction, setPasswordAction] = useState<PasswordAction>('reveal');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isPaired = user?.isCardPaired === true;
  const hasPairingCode = user?.hasPairingCode === true;
  const cardUid = user?.cardUid || null;
  const isBlocked = user?.card?.isBlocked === true;
  const maskedCode = '••••••••••';

  const styles = useThemedStyles((th) => StyleSheet.create({
    card: {
      backgroundColor: th.surface,
      borderRadius: th.radius,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: isPaired ? th.border : th.wallet.primary + '44',
      ...th.shadowSoft,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    iconWrap: {
      width: 44, height: 44, borderRadius: 14,
      backgroundColor: isPaired ? '#E6F5EF' : th.wallet.soft,
      alignItems: 'center', justifyContent: 'center',
    },
    title: { color: th.text, fontSize: fontSize.md, fontWeight: '800', flex: 1 },
    subtitle: { color: th.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
    codeBox: {
      backgroundColor: th.wallet.soft,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: th.wallet.primary + '55',
    },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    codeLabel: { color: th.textSecondary, fontSize: fontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    codeValue: { color: th.wallet.primary, fontSize: 32, fontWeight: '900', letterSpacing: isRevealed ? 4 : 2, marginTop: 6 },
    codeHint: { color: th.textMuted, fontSize: fontSize.xs, marginTop: spacing.sm, textAlign: 'center', lineHeight: 18 },
    revealBtn: {
      marginTop: spacing.sm, padding: 8, borderRadius: borderRadius.full,
      backgroundColor: th.surfaceMuted,
    },
    uidLabel: { color: th.textSecondary, fontSize: fontSize.xs, fontWeight: '600' },
    uidValue: { color: th.text, fontSize: fontSize.lg, fontWeight: '800', letterSpacing: 1, marginTop: 4 },
    statusPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full,
      backgroundColor: isPaired ? '#E6F5EF' : '#FEF3C7',
    },
    statusText: { fontSize: fontSize.xs, fontWeight: '700', color: isPaired ? '#059669' : '#B45309' },
    controlRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: th.border,
    },
    controlLabel: { color: th.text, fontWeight: '600', fontSize: fontSize.sm },
    controlDesc: { color: th.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    regenBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      marginTop: spacing.md, paddingVertical: 10, borderRadius: borderRadius.lg,
      borderWidth: 1, borderColor: th.wallet.primary + '66', backgroundColor: th.surfaceMuted,
    },
    regenText: { color: th.wallet.primary, fontWeight: '700', fontSize: fontSize.sm },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,20,25,0.5)', justifyContent: 'center', padding: spacing.lg },
    modalCard: { backgroundColor: th.surface, borderRadius: th.radiusLg, padding: spacing.lg, ...th.shadow },
    modalTitle: { color: th.text, fontSize: fontSize.lg, fontWeight: '800', marginBottom: spacing.xs },
    modalSub: { color: th.textSecondary, fontSize: fontSize.sm, marginBottom: spacing.md, lineHeight: 20 },
    modalInput: {
      backgroundColor: th.surfaceMuted, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md,
      paddingVertical: 14, color: th.text, fontSize: fontSize.md, borderWidth: 1, borderColor: th.border,
      marginBottom: spacing.md,
    },
    modalActions: { flexDirection: 'row', gap: spacing.sm },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: borderRadius.lg, alignItems: 'center' },
    modalBtnCancel: { backgroundColor: th.surfaceMuted },
    modalBtnConfirm: { backgroundColor: th.wallet.primary },
    modalBtnText: { fontWeight: '700', fontSize: fontSize.sm },
    modalBtnTextCancel: { color: th.textSecondary },
    modalBtnTextConfirm: { color: '#fff' },
  }));

  const closePasswordModal = () => {
    setPasswordModal(false);
    setPassword('');
    setSubmitting(false);
  };

  const openPasswordModal = (action: PasswordAction) => {
    setPasswordAction(action);
    setPassword('');
    setPasswordModal(true);
  };

  const handleHideCode = () => {
    setIsRevealed(false);
    setRevealedCode(null);
  };

  const handleRevealPress = () => {
    if (isRevealed) {
      handleHideCode();
      return;
    }
    openPasswordModal('reveal');
  };

  const handleRegenerate = () => {
    if (hasPairingCode) {
      Alert.alert(
        t('regeneratePairingCode'),
        t('regeneratePairingConfirm'),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('regenerate'), style: 'destructive', onPress: () => openPasswordModal('regenerate') },
        ],
      );
    } else {
      openPasswordModal('regenerate');
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      Alert.alert(t('settings'), t('enterPassword'));
      return;
    }
    setSubmitting(true);
    try {
      if (passwordAction === 'reveal') {
        const result = await revealPairingToken(password);
        if (result.success && result.pairingToken) {
          setRevealedCode(result.pairingToken);
          setIsRevealed(true);
          closePasswordModal();
        } else {
          Alert.alert(t('settings'), result.error || t('invalidCredentials'));
          setSubmitting(false);
        }
      } else {
        const result = await regeneratePairingToken(password);
        if (result.success && result.pairingToken) {
          setRevealedCode(result.pairingToken);
          setIsRevealed(true);
          closePasswordModal();
          Alert.alert(t('regeneratePairingCode'), t('regeneratePairingSuccess'));
        } else {
          Alert.alert(t('settings'), result.error || t('invalidCredentials'));
          setSubmitting(false);
        }
      }
    } catch {
      Alert.alert(t('settings'), t('connectionError'));
      setSubmitting(false);
    }
  };

  const displayCode = isRevealed && revealedCode ? revealedCode : maskedCode;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name={isPaired ? 'card' : 'keypad'} size={22} color={isPaired ? '#059669' : undefined} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('nfcSmartCard')}</Text>
          <Text style={styles.subtitle}>
            {isPaired ? t('nfcCardLinkedDesc') : t('nfcPairingDesc')}
          </Text>
        </View>
        <View style={styles.statusPill}>
          <Ionicons name={isPaired ? 'checkmark-circle' : 'time'} size={12} color={isPaired ? '#059669' : '#B45309'} />
          <Text style={styles.statusText}>{isPaired ? t('linked') : t('awaitingPair')}</Text>
        </View>
      </View>

      {!isPaired && (hasPairingCode || isRevealed) ? (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>{t('yourPairingCode')}</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeValue} selectable={isRevealed}>{displayCode}</Text>
            <TouchableOpacity style={styles.revealBtn} onPress={handleRevealPress}>
              <Ionicons name={isRevealed ? 'eye-off' : 'eye'} size={20} color={theme.wallet.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.codeHint}>
            {isRevealed ? t('pairingCodeHint') : t('pairingCodeHiddenHint')}
          </Text>
        </View>
      ) : !isPaired ? (
        <TouchableOpacity style={styles.regenBtn} onPress={handleRegenerate} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" />
          ) : (
            <>
              <Ionicons name="refresh" size={16} color={theme.wallet.primary} />
              <Text style={styles.regenText}>{t('generatePairingCode')}</Text>
            </>
          )}
        </TouchableOpacity>
      ) : isPaired && cardUid ? (
        <View>
          <Text style={styles.uidLabel}>{t('cardUid')}</Text>
          <Text style={styles.uidValue} selectable>{cardUid}</Text>
        </View>
      ) : null}

      {showControls && isPaired && onToggleBlock && (
        <View style={styles.controlRow}>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={styles.controlLabel}>{t('lockCard')}</Text>
            <Text style={styles.controlDesc}>{t('lockCardDesc')}</Text>
          </View>
          <Switch
            value={isBlocked}
            onValueChange={onToggleBlock}
            trackColor={{ false: '#D1D5DB', true: '#FCA5A5' }}
            thumbColor={isBlocked ? '#EF4444' : '#fff'}
          />
        </View>
      )}

      <Modal visible={passwordModal} transparent animationType="fade" onRequestClose={closePasswordModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('enterPasswordToReveal')}</Text>
            <Text style={styles.modalSub}>{t('enterPasswordToRevealDesc')}</Text>
            <TextInput
              style={styles.modalInput}
              value={password}
              onChangeText={setPassword}
              placeholder={t('enterPassword')}
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              autoFocus
              editable={!submitting}
              onSubmitEditing={handlePasswordSubmit}
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, styles.modalBtnCancel]} onPress={closePasswordModal} disabled={submitting}>
                <Text style={[styles.modalBtnText, styles.modalBtnTextCancel]}>{t('cancel')}</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={handlePasswordSubmit} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.modalBtnText, styles.modalBtnTextConfirm]}>{t('verify')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
