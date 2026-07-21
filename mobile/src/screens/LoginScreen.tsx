import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { warmUp } from '../services/api';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { useAppTheme } from '../hooks/useAppTheme';
import { useI18n } from '../hooks/useI18n';
import { useThemedStyles } from '../hooks/useThemedStyles';

type Mode = 'login' | 'register';
type StatusType = 'error' | 'success' | 'info';

export default function LoginScreen() {
  const theme = useAppTheme();
  const { t } = useI18n();
  const styles = useThemedStyles((th) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: th.bg },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
    header: { alignItems: 'center', marginBottom: spacing.xl },
    logoRing: {
      width: 80, height: 80, borderRadius: 40, backgroundColor: th.wallet.soft,
      borderWidth: 1, borderColor: th.border, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
    },
    title: { color: th.text, fontSize: fontSize.display, fontWeight: '800' },
    subtitle: { color: th.textSecondary, fontSize: fontSize.md, marginTop: spacing.xs },
    card: {
      backgroundColor: th.surface, borderRadius: borderRadius.xl, padding: spacing.lg,
      borderWidth: 1, borderColor: th.border,
    },
    tabs: { flexDirection: 'row', marginBottom: spacing.lg, backgroundColor: th.surfaceMuted, borderRadius: borderRadius.lg, padding: 4 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: borderRadius.md },
    tabActive: { backgroundColor: th.wallet.primary },
    tabText: { color: th.textMuted, fontWeight: '600', fontSize: fontSize.sm },
    tabTextActive: { color: '#fff' },
    statusBox: { marginBottom: spacing.md, padding: spacing.md, borderRadius: borderRadius.lg, backgroundColor: th.surfaceMuted, borderWidth: 1, borderColor: th.border },
    statusError: { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: '#EF4444' },
    statusSuccess: { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: '#10B981' },
    statusText: { color: th.text, fontSize: fontSize.sm, lineHeight: 20 },
    label: { color: th.textSecondary, fontSize: fontSize.sm, marginBottom: 6, marginTop: spacing.sm },
    input: {
      backgroundColor: th.surfaceMuted, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md,
      paddingVertical: 14, color: th.text, fontSize: fontSize.md, borderWidth: 1, borderColor: th.border,
    },
    rememberRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: 8 },
    rememberText: { color: th.textSecondary, fontSize: fontSize.sm },
    hint: { color: th.textMuted, fontSize: fontSize.sm, marginTop: spacing.md, lineHeight: 20 },
    tokenBox: {
      marginTop: spacing.md, padding: spacing.md, backgroundColor: th.wallet.soft,
      borderRadius: borderRadius.lg, borderWidth: 1, borderColor: th.wallet.primary,
    },
    tokenLabel: { color: th.textSecondary, fontSize: fontSize.sm },
    tokenValue: { color: th.wallet.primary, fontSize: 24, fontWeight: '800', letterSpacing: 2, marginTop: 4 },
    button: { backgroundColor: th.wallet.primary, borderRadius: borderRadius.lg, paddingVertical: 16, alignItems: 'center', marginTop: spacing.lg },
    buttonPressed: { opacity: 0.85 },
    buttonDisabled: { opacity: 0.7 },
    buttonText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },
  }));

  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<StatusType>('info');
  const { loginWithUsername, register } = useAuthStore();

  // Wake the (possibly sleeping) backend as soon as the login screen appears so
  // it is warm by the time the user submits — avoids a cold-start timeout.
  useEffect(() => { warmUp(); }, []);

  const showStatus = (message: string, type: StatusType = 'info') => {
    setStatusMessage(message);
    setStatusType(type);
  };

  const clearStatus = () => setStatusMessage('');

  const handleSubmit = async () => {
    clearStatus();
    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      showStatus(t('enterBoth'), 'error');
      return;
    }
    if (mode === 'register' && password.length < 6) {
      showStatus(t('passwordMin'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const ok = await loginWithUsername(trimmedUser, password, rememberMe);
        if (!ok) showStatus(t('invalidCredentials'), 'error');
      } else {
        const result = await register(trimmedUser, password);
        if (result.success) {
          showStatus(t('accountCreatedProfile'), 'success');
        } else {
          showStatus(result.error || t('registerFailed'), 'error');
        }
      }
    } catch {
      showStatus(t('connectionError'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    clearStatus();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.logoRing}>
              <Ionicons name="link" size={36} color={theme.wallet.primary} />
            </View>
            <Text style={styles.title}>OneLink</Text>
            <Text style={styles.subtitle}>{t('smartCityApp')}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.tabs}>
              <Pressable style={[styles.tab, mode === 'login' && styles.tabActive]} onPress={() => switchMode('login')}>
                <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>{t('signIn')}</Text>
              </Pressable>
              <Pressable style={[styles.tab, mode === 'register' && styles.tabActive]} onPress={() => switchMode('register')}>
                <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>{t('createAccount')}</Text>
              </Pressable>
            </View>

            {!!statusMessage && (
              <View style={[styles.statusBox, statusType === 'error' && styles.statusError, statusType === 'success' && styles.statusSuccess]}>
                <Text style={styles.statusText}>{statusMessage}</Text>
              </View>
            )}

            <Text style={styles.label}>{t('username')}</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={(v) => { setUsername(v); clearStatus(); }}
              placeholder={t('enterUsername')}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!submitting}
            />

            <Text style={styles.label}>{t('password')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={(v) => { setPassword(v); clearStatus(); }}
              placeholder={t('enterPassword')}
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              editable={!submitting}
              onSubmitEditing={handleSubmit}
            />

            {mode === 'login' && (
              <Pressable style={styles.rememberRow} onPress={() => setRememberMe(!rememberMe)}>
                <Ionicons name={rememberMe ? 'checkbox' : 'square-outline'} size={22} color={rememberMe ? theme.wallet.primary : theme.textMuted} />
                <Text style={styles.rememberText}>{t('rememberMe')}</Text>
              </Pressable>
            )}

            {mode === 'register' && <Text style={styles.hint}>{t('registerHint')}</Text>}

            <Pressable
              style={({ pressed }) => [styles.button, submitting && styles.buttonDisabled, pressed && !submitting && styles.buttonPressed]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{mode === 'login' ? t('signIn') : t('createAccount')}</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
