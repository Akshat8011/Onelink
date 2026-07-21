import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

type IconName = keyof typeof Ionicons.glyphMap;

interface TabIconProps {
  name: IconName;
  focused: boolean;
  color: string;
}

const OUTLINE_MAP: Partial<Record<IconName, IconName>> = {
  home: 'home-outline',
  train: 'train-outline',
  car: 'car-outline',
  sparkles: 'sparkles-outline',
  'bag-handle': 'bag-handle-outline',
  wallet: 'wallet-outline',
};

export default function TabIcon({ name, focused, color }: TabIconProps) {
  const iconName = focused ? name : (OUTLINE_MAP[name] || name);
  return (
    <Ionicons
      name={iconName}
      size={22}
      color={focused ? color : colors.gray400}
    />
  );
}
