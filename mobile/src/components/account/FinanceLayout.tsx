import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ScreenWrapper from '../ScreenWrapper';
import { getFinanceTheme } from '../../theme/financeTheme';
import { useSettingsStore } from '../../store/useSettingsStore';
import { spacing, fontSize } from '../../theme/colors';

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  searchPlaceholder?: string;
  rightAction?: { label: string; onPress: () => void };
}

export default function FinanceLayout({ title, subtitle, children, searchPlaceholder, rightAction }: Props) {
  const navigation = useNavigation();
  const isDark = useSettingsStore((s) => s.darkMode);
  const fin = getFinanceTheme(isDark);

  return (
    <ScreenWrapper edges={['top']} style={{ backgroundColor: fin.bg }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: fin.surface }, fin.shadowSoft]} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={fin.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: fin.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: fin.textSecondary }]}>{subtitle}</Text> : null}
        </View>
        {rightAction ? (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: fin.sidebar }]} onPress={rightAction.onPress}>
            <Text style={styles.actionText}>{rightAction.label}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: fin.surface }, fin.shadowSoft]}>
            <Ionicons name="notifications-outline" size={20} color={fin.text} />
          </TouchableOpacity>
        )}
      </View>
      {searchPlaceholder && (
        <View style={[styles.searchWrap, { backgroundColor: fin.surface }, fin.shadowSoft]}>
          <Ionicons name="search" size={18} color={fin.textMuted} />
          <TextInput placeholder={searchPlaceholder} placeholderTextColor={fin.textMuted} style={[styles.search, { color: fin.text }]} />
        </View>
      )}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {children}
      </ScrollView>
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
  iconBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  actionText: { color: '#fff', fontWeight: '700', fontSize: fontSize.xs },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    borderRadius: 16, paddingHorizontal: spacing.md, height: 46,
  },
  search: { flex: 1, fontSize: fontSize.sm },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 48 },
});
