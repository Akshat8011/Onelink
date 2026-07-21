import React from 'react';
import { View, StyleSheet } from 'react-native';
import { fin } from '../../theme/financeTheme';

interface Props {
  data: number[];
  colors?: string[];
  height?: number;
}

const DEFAULT_COLORS = fin.chart;

export default function MiniBarChart({ data, colors: barColors, height = 56 }: Props) {
  const max = Math.max(...data, 1);
  return (
    <View style={[styles.wrap, { height }]}>
      {data.map((v, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            {
              height: Math.max(6, (v / max) * height),
              backgroundColor: (barColors ?? DEFAULT_COLORS)[i % (barColors ?? DEFAULT_COLORS).length],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, flex: 1 },
  bar: { flex: 1, borderRadius: 6, minWidth: 8 },
});
