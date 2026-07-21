import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/useAuthStore';
import { colors, fontSize } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  size?: number;
  style?: ViewStyle;
}

export default function UserAvatarButton({ size = 40, style }: Props) {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const initial = (user?.name || user?.username || 'U').charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, style]}
      onPress={() => navigation.navigate('Account')}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Open account"
    >
      <Text style={[styles.text, { fontSize: size * 0.42 }]}>{initial}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.primaryGlow,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: colors.primary, fontWeight: '800' },
});
