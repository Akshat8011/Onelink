import React from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PremiumLayout from '../components/PremiumLayout';
import PremiumCard from '../components/PremiumCard';
import { useAppTheme } from '../hooks/useAppTheme';
import { useI18n } from '../hooks/useI18n';
import { spacing, borderRadius, fontSize } from '../theme/colors';
import { useSettingsStore } from '../store/useSettingsStore';
import { useNotificationsStore } from '../store/useNotificationsStore';
import { useAuthStore } from '../store/useAuthStore';

function SettingRow({
  title, desc, value, onChange, icon, theme,
}: {
  title: string; desc?: string; value: boolean; onChange: (v: boolean) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  theme: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: theme.settings.soft }]}>
          <Ionicons name={icon} size={18} color={theme.settings.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        {desc ? <Text style={[styles.rowDesc, { color: theme.textMuted }]}>{desc}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.border, true: theme.wallet.primary }}
        thumbColor={theme.surface}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const s = useSettingsStore();
  const notify = useNotificationsStore((st) => st.add);
  const { user, logout } = useAuthStore();
  const theme = useAppTheme();
  const lang = s.language;
  const t = (en: string, hi: string) => (lang === 'HI' ? hi : en);

  const toggle = (key: keyof typeof s, label: string, next: boolean) => {
    s.update({ [key]: next } as Partial<typeof s>);
    notify({ title: t('Settings updated', 'सेटिंग अपडेट'), body: `${label}: ${next ? t('On', 'चालू') : t('Off', 'बंद')}`, type: 'SYSTEM' });
  };

  return (
    <PremiumLayout title={t('Settings', 'सेटिंग्स')} subtitle={t('Preferences & privacy', 'प्राथमिकताएँ')} accent={theme.settings.primary}>
      <Text style={[styles.section, { color: theme.text }]}>{t('Notifications', 'सूचनाएँ')}</Text>
      <PremiumCard style={{ padding: 0 }}>
        <SettingRow theme={theme} icon="notifications-outline" title={t('Push notifications', 'पुश सूचनाएँ')} desc={t('Tickets, orders & wallet alerts', 'टिकट, ऑर्डर और वॉलेट')} value={s.pushNotifications} onChange={(v) => toggle('pushNotifications', t('Push', 'पुश'), v)} />
        <SettingRow theme={theme} icon="mail-outline" title={t('Email alerts', 'ईमेल अलर्ट')} value={s.emailAlerts} onChange={(v) => toggle('emailAlerts', t('Email', 'ईमेल'), v)} />
        <SettingRow theme={theme} icon="chatbubble-outline" title={t('SMS alerts', 'SMS अलर्ट')} value={s.smsAlerts} onChange={(v) => toggle('smsAlerts', t('SMS', 'SMS'), v)} />
      </PremiumCard>

      <Text style={[styles.section, { color: theme.text }]}>{t('Appearance', 'दिखावट')}</Text>
      <PremiumCard style={{ padding: 0 }}>
        <SettingRow theme={theme} icon="moon-outline" title={t('Dark mode', 'डार्क मोड')} desc={t('Toggle app theme', 'थीम बदलें')} value={s.darkMode} onChange={(v) => toggle('darkMode', t('Dark mode', 'डार्क मोड'), v)} />
        <View style={[styles.row, { borderBottomColor: theme.border }]}>
          <View style={[styles.rowIcon, { backgroundColor: theme.settings.soft }]}><Ionicons name="language" size={18} color={theme.settings.primary} /></View>
          <Text style={[styles.rowTitle, { flex: 1, color: theme.text }]}>{t('Language', 'भाषा')}</Text>
          <TouchableOpacity style={[styles.langPill, { backgroundColor: theme.wallet.soft }]} onPress={() => {
            const next = s.language === 'EN' ? 'HI' : 'EN';
            s.update({ language: next });
            notify({
              title: t('Language updated', 'भाषा अपडेट'),
              body: next === 'HI' ? 'ऐप अब हिंदी में है' : 'App is now in English',
              type: 'SYSTEM',
            });
          }}>
            <Text style={[styles.langBtn, { color: theme.wallet.primary }]}>{s.language === 'EN' ? 'English' : 'हिंदी'}</Text>
          </TouchableOpacity>
        </View>
      </PremiumCard>

      <Text style={[styles.section, { color: theme.text }]}>{t('Wallet', 'वॉलेट')}</Text>
      <PremiumCard style={{ padding: 0 }}>
        <SettingRow theme={theme} icon="eye-outline" title={t('Show balance on Home', 'होम पर बैलेंस')} value={s.showBalanceOnHome} onChange={(v) => toggle('showBalanceOnHome', t('Balance', 'बैलेंस'), v)} />
        <SettingRow theme={theme} icon="refresh-outline" title={t('Auto top-up', 'ऑटो टॉप-अप')} desc={t(`When below ₹${s.autoTopUpThreshold}`, `₹${s.autoTopUpThreshold} से कम`)} value={s.autoTopUp} onChange={(v) => toggle('autoTopUp', t('Auto top-up', 'ऑटो'), v)} />
        <View style={[styles.row, { borderBottomColor: theme.border }]}>
          <View style={[styles.rowIcon, { backgroundColor: theme.settings.soft }]}><Ionicons name="cash-outline" size={18} color={theme.settings.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>{t('Top-up threshold (₹)', 'थ्रेशोल्ड (₹)')}</Text>
            <Text style={[styles.rowDesc, { color: theme.textMuted }]}>{t('Auto-add ₹500 when below', 'कम होने पर ₹500 जोड़ें')}</Text>
          </View>
          <TextInput
            style={[styles.thresholdInput, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
            keyboardType="numeric"
            value={String(s.autoTopUpThreshold)}
            onChangeText={(v) => { const n = parseInt(v, 10); if (Number.isFinite(n) && n > 0) s.update({ autoTopUpThreshold: n }); }}
          />
        </View>
      </PremiumCard>

      <Text style={[styles.section, { color: theme.text }]}>{t('Account', 'खाता')}</Text>
      <PremiumCard style={{ padding: 0 }}>
        <View style={[styles.row, { borderBottomColor: theme.border }]}>
          <View style={[styles.avatar, { backgroundColor: theme.home.hero }]}>
            <Text style={styles.avatarText}>{(user?.name || 'U').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>{user?.name || t('Signed in', 'साइन इन')}</Text>
            <Text style={[styles.rowDesc, { color: theme.textMuted }]}>{user?.username || user?.email}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.row, { borderBottomColor: theme.border }]}
          onPress={() => Alert.alert(t('Sign out?', 'साइन आउट?'), t('You can sign back in anytime.', 'कभी भी वापस साइन इन करें।'), [
            { text: t('Cancel', 'रद्द'), style: 'cancel' },
            { text: t('Sign out', 'साइन आउट'), style: 'destructive', onPress: () => logout() },
          ])}
        >
          <View style={[styles.rowIcon, { backgroundColor: theme.isDark ? '#3B1F1F' : '#FEF2F2' }]}>
            <Ionicons name="log-out-outline" size={18} color="#B45309" />
          </View>
          <Text style={styles.logoutText}>{t('Sign out', 'साइन आउट')}</Text>
        </TouchableOpacity>
      </PremiumCard>

      <TouchableOpacity style={styles.resetBtn} onPress={() => Alert.alert(t('Reset?', 'रीसेट?'), t('Restore defaults?', 'डिफ़ॉल्ट?'), [
        { text: t('Cancel', 'रद्द'), style: 'cancel' },
        { text: t('Reset', 'रीसेट'), style: 'destructive', onPress: () => s.reset() },
      ])}>
        <Text style={styles.resetText}>{t('Reset to defaults', 'डिफ़ॉल्ट पर रीसेट')}</Text>
      </TouchableOpacity>
    </PremiumLayout>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: fontSize.md, fontWeight: '800', marginBottom: spacing.sm, marginTop: spacing.sm, letterSpacing: -0.3 },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, gap: spacing.sm },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: fontSize.md, fontWeight: '600' },
  rowDesc: { fontSize: fontSize.xs, marginTop: 2 },
  langPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full },
  langBtn: { fontWeight: '700', fontSize: fontSize.sm },
  thresholdInput: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, minWidth: 72, textAlign: 'center', fontWeight: '700' },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  resetBtn: { marginTop: spacing.xl, alignItems: 'center', padding: spacing.md },
  resetText: { color: '#B45309', fontWeight: '700' },
  logoutText: { color: '#B45309', fontWeight: '700', fontSize: fontSize.md },
});
