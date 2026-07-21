import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useFinanceTheme } from '../../hooks/useFinanceTheme';
import { spacing } from '../../theme/colors';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}

export default function FinanceCard({ children, style, padded = true }: Props) {
  const fin = useFinanceTheme();
  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: fin.surface,
      borderRadius: fin.radius,
      marginBottom: spacing.md,
      ...fin.shadow,
    },
    padded: { padding: spacing.md },
  }), [fin]);

  return (
    <View style={[styles.card, padded && styles.padded, style]}>
      {children}
    </View>
  );
}
