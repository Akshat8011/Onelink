import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useFinanceTheme } from '../../hooks/useFinanceTheme';
import { fontSize } from '../../theme/colors';

interface Segment {
  value: number;
  color: string;
}

interface Props {
  segments: Segment[];
  centerLabel: string;
  centerSub?: string;
  size?: number;
}

export default function DonutChart({ segments, centerLabel, centerSub, size = 120 }: Props) {
  const fin = useFinanceTheme();
  const styles = useMemo(() => StyleSheet.create({
    center: { position: 'absolute', alignItems: 'center' },
    centerLabel: { fontSize: fontSize.lg, fontWeight: '800', color: fin.text },
    centerSub: { fontSize: 10, color: fin.textSecondary, marginTop: 2 },
  }), [fin]);

  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cx} r={r} stroke={fin.border} strokeWidth={stroke} fill="none" />
        {segments.map((seg, i) => {
          const len = (seg.value / total) * circ;
          const dash = `${len} ${circ - len}`;
          const rot = (offset / total) * 360 - 90;
          offset += seg.value;
          return (
            <Circle
              key={i}
              cx={cx}
              cy={cx}
              r={r}
              stroke={seg.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={dash}
              strokeLinecap="round"
              rotation={rot}
              origin={`${cx}, ${cx}`}
            />
          );
        })}
      </Svg>
      <View style={styles.center}>
        <Text style={styles.centerLabel}>{centerLabel}</Text>
        {centerSub ? <Text style={styles.centerSub}>{centerSub}</Text> : null}
      </View>
    </View>
  );
}
