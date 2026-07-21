import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fin, FinSection, sectionStyle } from '../../theme/financeTheme';
import { spacing, fontSize } from '../../theme/colors';
import MiniBarChart from './MiniBarChart';

interface Props {
  label: string;
  value: string;
  footer?: { label: string; pct: string }[];
  chartData?: number[];
  variant?: FinSection;
}

export default function GradientMetricCard({ label, value, footer, chartData, variant = 'wealth' }: Props) {
  const s = sectionStyle(variant);
  return (
    <View style={[styles.wrap, { backgroundColor: s.primary }]}>
      <View style={[styles.glow, { backgroundColor: s.secondary }]} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {chartData && chartData.length > 0 && (
        <View style={styles.chart}>
          <MiniBarChart
            data={chartData}
            height={48}
            colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.65)', 'rgba(255,255,255,0.35)']}
          />
        </View>
      )}
      {footer && footer.length > 0 && (
        <View style={styles.footer}>
          {footer.map((f) => (
            <View key={f.label} style={styles.footItem}>
              <Text style={styles.footPct}>{f.pct}</Text>
              <Text style={styles.footLbl}>{f.label}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={[styles.accentLine, { backgroundColor: s.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: fin.radiusLg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...fin.shadow,
  },
  glow: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    right: -60, top: -60, opacity: 0.35,
  },
  accentLine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderRadius: 2 },
  label: { color: 'rgba(255,255,255,0.8)', fontSize: fontSize.sm, fontWeight: '600', letterSpacing: 0.3 },
  value: { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: 4, letterSpacing: -1 },
  chart: { marginTop: spacing.md, opacity: 0.9 },
  footer: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.lg },
  footItem: {},
  footPct: { color: '#fff', fontWeight: '800', fontSize: fontSize.md },
  footLbl: { color: 'rgba(255,255,255,0.65)', fontSize: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
});
