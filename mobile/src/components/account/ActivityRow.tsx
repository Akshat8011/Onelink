import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinanceTheme } from '../../hooks/useFinanceTheme';
import { fontSize } from '../../theme/colors';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  title: string;
  category: string;
  amount?: string;
  change?: string;
  changeUp?: boolean;
  status?: string;
  onPress?: () => void;
}

export default function ActivityRow({
  icon, iconColor, iconBg,
  title, category, amount, change, changeUp, status, onPress,
}: Props) {
  const fin = useFinanceTheme();
  const styles = useMemo(() => StyleSheet.create({
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: fin.border,
    },
    icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    title: { color: fin.text, fontWeight: '700', fontSize: fontSize.sm },
    cat: { color: fin.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
    amount: { color: fin.text, fontWeight: '800', fontSize: fontSize.sm },
    change: { fontSize: 10, fontWeight: '700', marginTop: 2 },
    up: { color: fin.green },
    down: { color: fin.red },
    status: { color: fin.sections.loans.secondary, fontSize: 10, fontWeight: '700', marginTop: 2 },
  }), [fin]);

  const resolvedIconColor = iconColor ?? fin.orange;
  const resolvedIconBg = iconBg ?? fin.accentSoft;

  const inner = (
    <>
      <View style={[styles.icon, { backgroundColor: resolvedIconBg }]}>
        <Ionicons name={icon} size={18} color={resolvedIconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.cat}>{category}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {amount ? <Text style={styles.amount}>{amount}</Text> : null}
        {change ? (
          <Text style={[styles.change, changeUp ? styles.up : styles.down]}>{changeUp ? '↑' : '↓'} {change}</Text>
        ) : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={fin.textMuted} style={{ marginLeft: 4 }} /> : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.row}>{inner}</View>;
}
