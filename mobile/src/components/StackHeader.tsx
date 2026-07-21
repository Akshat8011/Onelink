import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { spacing, fontSize } from '../theme/colors';

interface StackHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export default function StackHeader({ title, subtitle, right }: StackHeaderProps) {
  const navigation = useNavigation();
  const theme = useAppTheme();

  return (
    <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
        <Ionicons name="arrow-back" size={22} color={theme.text} />
      </TouchableOpacity>
      <View style={styles.titleWrap}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {right || <View style={{ width: 40 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { fontSize: fontSize.lg, fontWeight: '800' },
  subtitle: { fontSize: fontSize.xs, marginTop: 2 },
});
