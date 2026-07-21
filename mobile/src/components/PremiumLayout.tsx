import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ScreenWrapper from './ScreenWrapper';
import { useAppTheme } from '../hooks/useAppTheme';
import { spacing, fontSize } from '../theme/colors';

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accent?: string;
  right?: React.ReactNode;
  scrollable?: boolean;
}

export default function PremiumLayout({ title, subtitle, children, accent, right, scrollable = true }: Props) {
  const navigation = useNavigation();
  const theme = useAppTheme();
  const accentColor = accent || theme.home.hero;

  return (
    <ScreenWrapper edges={['top']} style={{ backgroundColor: theme.bg }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: theme.surface }, theme.shadowSoft]} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
        </View>
        {right || <View style={[styles.accentDot, { backgroundColor: accentColor }]} />}
      </View>
      {scrollable ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.scroll, { flex: 1 }]}>{children}</View>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
  },
  backBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: fontSize.sm, marginTop: 2 },
  accentDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.md },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 48 },
});
