import React, { useMemo } from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useFinanceTheme } from '../../hooks/useFinanceTheme';
import { fontSize } from '../../theme/colors';

interface Tab<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (key: T) => void;
}

export default function PillTabs<T extends string>({ tabs, active, onChange }: Props<T>) {
  const fin = useFinanceTheme();
  const styles = useMemo(() => StyleSheet.create({
    row: { marginBottom: 14 },
    pill: {
      paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8,
      backgroundColor: fin.surface, borderWidth: 1, borderColor: fin.border,
    },
    pillOn: { backgroundColor: fin.sidebar, borderColor: fin.sidebar },
    text: { color: fin.textSecondary, fontWeight: '600', fontSize: fontSize.xs },
    textOn: { color: '#fff' },
  }), [fin]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
      {tabs.map((t) => {
        const on = active === t.key;
        return (
          <TouchableOpacity key={t.key} style={[styles.pill, on && styles.pillOn]} onPress={() => onChange(t.key)}>
            <Text style={[styles.text, on && styles.textOn]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
