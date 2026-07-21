import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';

const STATION_SPACING = 96;
const LINE_Y = 140;
const MAP_HEIGHT = 300;

interface MetroMapProps {
  stations: string[];
  selectedFrom?: string;
  selectedTo?: string;
  onStationPress?: (station: string) => void;
}

const UNDERGROUND = new Set(['Husain Ganj', 'Sachivalaya', 'Hazratganj']);

export default function MetroMapComponent({
  stations,
  selectedFrom,
  selectedTo,
  onStationPress,
}: MetroMapProps) {
  const mapWidth = stations.length * STATION_SPACING + 80;

  const getStatus = (station: string) => {
    if (station === selectedFrom) return 'from';
    if (station === selectedTo) return 'to';
    if (selectedFrom && selectedTo) {
      const fi = stations.indexOf(selectedFrom);
      const ti = stations.indexOf(selectedTo);
      const si = stations.indexOf(station);
      const lo = Math.min(fi, ti);
      const hi = Math.max(fi, ti);
      if (si > lo && si < hi) return 'between';
    }
    return 'normal';
  };

  const fromIdx = selectedFrom ? stations.indexOf(selectedFrom) : -1;
  const toIdx = selectedTo ? stations.indexOf(selectedTo) : -1;
  const segLo = fromIdx >= 0 && toIdx >= 0 ? Math.min(fromIdx, toIdx) : -1;
  const segHi = fromIdx >= 0 && toIdx >= 0 ? Math.max(fromIdx, toIdx) : -1;

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.lineBadge}>
            <Text style={styles.lineBadgeText}>R</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>UPMRC Red Line</Text>
            <Text style={styles.headerSub}>North-South Corridor · 21 stations · 22.88 km</Text>
          </View>
        </View>
        <View style={styles.scrollHint}>
          <Ionicons name="swap-horizontal" size={14} color={colors.metro} />
          <Text style={styles.scrollHintText}>Scroll</Text>
        </View>
      </View>

      {/* Map canvas */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        style={styles.scroll}
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16 }}
      >
        <View style={[styles.canvas, { width: mapWidth, height: MAP_HEIGHT }]}>
          {/* Background track */}
          <View style={[styles.track, { width: mapWidth - 48, left: 24, top: LINE_Y }]} />

          {/* Active segment highlight */}
          {segLo >= 0 && (
            <View
              style={[
                styles.activeTrack,
                {
                  left: 24 + segLo * STATION_SPACING,
                  width: (segHi - segLo) * STATION_SPACING,
                  top: LINE_Y,
                },
              ]}
            />
          )}

          {stations.map((station, index) => {
            const status = getStatus(station);
            const x = 24 + index * STATION_SPACING;
            const labelAbove = index % 2 === 0;
            const isUnderground = UNDERGROUND.has(station);
            const isTerminal = index === 0 || index === stations.length - 1;

            return (
              <TouchableOpacity
                key={station}
                style={[styles.stationWrap, { left: x - 40, top: 0 }]}
                onPress={() => onStationPress?.(station)}
                activeOpacity={0.75}
              >
                {/* Label above line */}
                {labelAbove && (
                  <View style={[styles.labelBox, styles.labelAbove, { top: 20 }]}>
                    <Text
                      style={[styles.stationLabel, status !== 'normal' && styles.stationLabelActive]}
                      numberOfLines={2}
                    >
                      {station}
                    </Text>
                    {isUnderground && (
                      <View style={styles.ugBadge}>
                        <Ionicons name="arrow-down" size={8} color="#fff" />
                        <Text style={styles.ugText}>UG</Text>
                      </View>
                    )}
                    {index === 0 && (
                      <View style={styles.termBadge}>
                        <Ionicons name="airplane" size={8} color={colors.metro} />
                        <Text style={styles.termText}>Airport</Text>
                      </View>
                    )}
                    {index === stations.length - 1 && (
                      <View style={[styles.termBadge, { backgroundColor: '#FEE2E2' }]}>
                        <Text style={[styles.termText, { color: '#DC2626' }]}>Terminal</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Station node on the line */}
                <View
                  style={[
                    styles.node,
                    { top: LINE_Y - 10 },
                    status === 'from' && styles.nodeFrom,
                    status === 'to' && styles.nodeTo,
                    status === 'between' && styles.nodeBetween,
                    isTerminal && status === 'normal' && styles.nodeTerminal,
                  ]}
                >
                  {isUnderground ? (
                    <Ionicons name="arrow-down" size={status === 'from' || status === 'to' ? 12 : 9} color="#fff" />
                  ) : (
                    <Text style={styles.nodeNum}>{index + 1}</Text>
                  )}
                </View>

                {/* Connector tick */}
                <View style={[styles.tick, { top: LINE_Y + 14, left: 38 }]} />

                {/* Label below line */}
                {!labelAbove && (
                  <View style={[styles.labelBox, styles.labelBelow, { top: LINE_Y + 28 }]}>
                    <Text
                      style={[styles.stationLabel, status !== 'normal' && styles.stationLabelActive]}
                      numberOfLines={2}
                    >
                      {station}
                    </Text>
                    {isUnderground && (
                      <View style={styles.ugBadge}>
                        <Ionicons name="arrow-down" size={8} color="#fff" />
                        <Text style={styles.ugText}>UG</Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
          <Text style={styles.legendText}>Origin</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.legendText}>Destination</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.metro }]} />
          <Text style={styles.legendText}>On route</Text>
        </View>
        <View style={styles.legendItem}>
          <Ionicons name="arrow-down" size={12} color="#374151" />
          <Text style={styles.legendText}>Underground</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#F0F4FF',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#C7D7F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.metro,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  lineBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineBadgeText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  headerTitle: { color: '#fff', fontSize: fontSize.md, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 10, marginTop: 1 },
  scrollHint: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  scrollHintText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  scroll: { backgroundColor: '#EEF2FF' },
  canvas: { position: 'relative' },
  track: {
    position: 'absolute',
    height: 6,
    backgroundColor: '#93B4E8',
    borderRadius: 3,
  },
  activeTrack: {
    position: 'absolute',
    height: 6,
    backgroundColor: colors.metro,
    borderRadius: 3,
    zIndex: 1,
  },
  stationWrap: {
    position: 'absolute',
    width: 80,
    height: MAP_HEIGHT,
    alignItems: 'center',
  },
  labelBox: {
    position: 'absolute',
    width: 76,
    alignItems: 'center',
  },
  labelAbove: {},
  labelBelow: {},
  stationLabel: {
    color: '#4B5563',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 12,
  },
  stationLabelActive: {
    color: colors.metro,
    fontWeight: '800',
    fontSize: 10,
  },
  ugBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#374151',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  ugText: { color: '#fff', fontSize: 7, fontWeight: '700' },
  termBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  termText: { color: colors.metro, fontSize: 7, fontWeight: '700' },
  node: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: colors.metro,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  nodeFrom: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#22C55E',
    borderColor: '#fff',
    borderWidth: 3,
  },
  nodeTo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EF4444',
    borderColor: '#fff',
    borderWidth: 3,
  },
  nodeBetween: {
    backgroundColor: colors.metro,
    borderColor: '#fff',
  },
  nodeTerminal: {
    borderColor: '#EF4444',
    borderWidth: 3,
  },
  nodeNum: { color: colors.metro, fontSize: 8, fontWeight: '800' },
  tick: {
    position: 'absolute',
    width: 2,
    height: 8,
    backgroundColor: '#93B4E8',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    padding: spacing.sm,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#6B7280', fontSize: 10, fontWeight: '600' },
});
