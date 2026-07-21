import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';

interface ScreenWrapperProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
  dark?: boolean;
}

export default function ScreenWrapper({
  children,
  style,
  edges = ['top'],
  dark,
}: ScreenWrapperProps) {
  const theme = useAppTheme();
  const isDark = dark ?? theme.isDark;

  return (
    <SafeAreaView
      style={[styles.base, { backgroundColor: isDark ? theme.bg : theme.bg }, style]}
      edges={edges}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1 },
});
