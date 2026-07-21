import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFinanceTheme } from '../../hooks/useFinanceTheme';

interface Props {
  progress: number;
  color?: string;
  height?: number;
}

export default function ProgressBar({ progress, color, height = 8 }: Props) {
  const fin = useFinanceTheme();
  const styles = useMemo(() => StyleSheet.create({
    track: { backgroundColor: fin.border, overflow: 'hidden', width: '100%' },
    fill: { height: '100%' },
  }), [fin]);

  const fillColor = color ?? fin.accent;
  const pct = Math.min(100, Math.max(0, progress));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fillColor, borderRadius: height / 2 }]} />
    </View>
  );
}
