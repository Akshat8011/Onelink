import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { spacing } from '../theme/colors';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function PremiumCard({ children, style }: Props) {
  const theme = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }, theme.shadow, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: spacing.md, marginBottom: spacing.md },
});
