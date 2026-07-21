import React, { useEffect } from 'react';
import { StatusBar, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/store/useAuthStore';
import { useWalletStore } from './src/store/useWalletStore';
import { useNotificationsStore } from './src/store/useNotificationsStore';
import { useSettingsStore } from './src/store/useSettingsStore';
import { useTicketsStore } from './src/store/useTicketsStore';
import { useOrdersStore } from './src/store/useOrdersStore';
import { useRewardsStore } from './src/store/useRewardsStore';
import { useFinancialStore } from './src/store/useFinancialStore';
import { runDailyEventSync } from './src/services/eventSyncService';
import { resetAllUserStores } from './src/utils/resetUserStores';
import { useAppTheme } from './src/hooks/useAppTheme';
import { spacing, fontSize } from './src/theme/colors';

function AppContent() {
  const { isLoading, isAuthenticated, loadToken, user } = useAuthStore();
  const theme = useAppTheme();

  useEffect(() => {
    loadToken();
    useSettingsStore.getState().load();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      resetAllUserStores();
      return;
    }
    resetAllUserStores();
    (async () => {
      useAuthStore.getState().setupRealtimeListeners();
      await Promise.all([
        useNotificationsStore.getState().load(),
        useSettingsStore.getState().load(),
        useTicketsStore.getState().load(),
        useOrdersStore.getState().load(),
        useRewardsStore.getState().load(),
        useFinancialStore.getState().load(),
        useWalletStore.getState().fetchDashboard(),
      ]);
      await runDailyEventSync();
    })();
  }, [isAuthenticated, user?.userId]);

  if (isLoading) {
    return (
      <View style={[styles.splash, { backgroundColor: theme.bg }]}>
        <View style={[styles.logoRing, { backgroundColor: theme.wallet.soft, borderColor: theme.border }]}>
          <Ionicons name="link" size={36} color={theme.wallet.primary} />
        </View>
        <Text style={[styles.splashTitle, { color: theme.text }]}>OneLink</Text>
        <Text style={[styles.splashSub, { color: theme.textSecondary }]}>Smart City Super App</Text>
        <ActivityIndicator color={theme.wallet.primary} size="small" style={styles.loader} />
      </View>
    );
  }

  return <AppNavigator />;
}

export default function App() {
  const theme = useAppTheme();
  return (
    <SafeAreaProvider>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  splashTitle: { fontSize: fontSize.display, fontWeight: '800', letterSpacing: 1 },
  splashSub: { fontSize: fontSize.md, marginTop: spacing.sm },
  loader: { marginTop: spacing.xl },
});