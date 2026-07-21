import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { Platform, StyleSheet } from 'react-native';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import TransitScreen from '../screens/TransitScreen';
import ParkingScreen from '../screens/ParkingScreen';
import CityScreen from '../screens/CityScreen';
import WalletScreen from '../screens/WalletScreenEnhanced';
import ShopScreen from '../screens/ShopScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RewardsScreen from '../screens/RewardsScreen';
import VehicleInfoScreen from '../screens/VehicleInfoScreen';
import TicketsScreen from '../screens/TicketsScreen';
import TicketDetailScreen from '../screens/TicketDetailScreen';
import OrderHistoryScreen from '../screens/OrderHistoryScreen';
import OrderReceiptScreen from '../screens/OrderReceiptScreen';
import AccountScreen from '../screens/account/AccountScreen';
import AccountDetailsScreen from '../screens/account/AccountDetailsScreen';
import BillsScreen from '../screens/account/BillsScreen';
import InvestScreen from '../screens/account/InvestScreen';
import LoanScreen from '../screens/account/LoanScreen';
import InsuranceScreen from '../screens/account/InsuranceScreen';
import AdminScreen from '../screens/AdminScreen';
import CanteenScreen from '../screens/CanteenScreen';
import { useAuthStore } from '../store/useAuthStore';
import TabIcon from '../components/TabIcon';
import { colors } from '../theme/colors';
import { useSettingsStore } from '../store/useSettingsStore';
import { getAppTheme } from '../theme/appTheme';
import { useI18n } from '../hooks/useI18n';
import type { RootTabParamList, RootStackParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  const darkMode = useSettingsStore((s) => s.darkMode);
  const theme = getAppTheme(darkMode);
  const { t } = useI18n();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.home.hero,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 88 : 68,
          elevation: 8,
          shadowColor: '#0F1419',
          shadowOpacity: 0.06,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('tabHome'), tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} color={colors.primary} /> }} />
      <Tab.Screen name="Shop" component={ShopScreen} options={{ tabBarLabel: t('tabShop'), tabBarActiveTintColor: colors.shopping, tabBarIcon: ({ focused }) => <TabIcon name="bag-handle" focused={focused} color={colors.shopping} /> }} />
      <Tab.Screen name="Transit" component={TransitScreen} options={{ tabBarLabel: t('tabTransit'), tabBarActiveTintColor: colors.metro, tabBarIcon: ({ focused }) => <TabIcon name="train" focused={focused} color={colors.metro} /> }} />
      <Tab.Screen name="Parking" component={ParkingScreen} options={{ tabBarLabel: t('tabParking'), tabBarActiveTintColor: colors.parking, tabBarIcon: ({ focused }) => <TabIcon name="car" focused={focused} color={colors.parking} /> }} />
      <Tab.Screen name="City" component={CityScreen} options={{ tabBarLabel: t('tabEvents'), tabBarActiveTintColor: colors.events, tabBarIcon: ({ focused }) => <TabIcon name="sparkles" focused={focused} color={colors.events} /> }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ tabBarLabel: t('tabWallet'), tabBarIcon: ({ focused }) => <TabIcon name="wallet" focused={focused} color={colors.wallet} /> }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated } = useAuthStore();
  const darkMode = useSettingsStore((s) => s.darkMode);
  const theme = getAppTheme(darkMode);

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: theme.bg,
      card: theme.surface,
      border: theme.border,
      text: theme.text,
      primary: theme.wallet.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Rewards" component={RewardsScreen} />
            <Stack.Screen name="VehicleInfo" component={VehicleInfoScreen} />
            <Stack.Screen name="Tickets" component={TicketsScreen} />
            <Stack.Screen name="TicketDetail" component={TicketDetailScreen} />
            <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
            <Stack.Screen name="OrderReceipt" component={OrderReceiptScreen} />
            <Stack.Screen name="Account" component={AccountScreen} />
            <Stack.Screen name="AccountDetails" component={AccountDetailsScreen} />
            <Stack.Screen name="Bills" component={BillsScreen} />
            <Stack.Screen name="Invest" component={InvestScreen} />
            <Stack.Screen name="Loans" component={LoanScreen} />
            <Stack.Screen name="Insurance" component={InsuranceScreen} />
            <Stack.Screen name="Admin" component={AdminScreen} />
            <Stack.Screen name="Canteen" component={CanteenScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabLabel: { fontSize: 9, fontWeight: '600', marginTop: 2 },
  tabItem: { paddingTop: 4 },
});
