import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Dimensions,
} from 'react-native';

/** Official OneLink vertical card print artwork (397×630). */
export const ONELINK_CARD_IMAGE = require('../../assets/onelink-card.png');

/** Intrinsic print size — keep in sync with assets/onelink-card.png */
const PRINT_W = 397;
const PRINT_H = 630;
export const ONELINK_CARD_ASPECT = PRINT_W / PRINT_H; // width / height ≈ 0.630

type Props = {
  holderName: string;
  last4?: string;
  seed?: string;
  expiry?: string;
  accountNumber?: string;
  /** Outer width; height is derived so the full print fits with no crop. */
  width?: number;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

export function buildMockCardNumber(seed = 'onelink', last4 = '4242'): string {
  const digits = String(last4).replace(/\D/g, '').slice(-4).padStart(4, '0');
  let h = 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const mid = String(10000000 + (h % 90000000)).slice(0, 8);
  const raw = `4532${mid}${digits}`;
  return raw.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(expiry?: string): string {
  if (!expiry) return '12/28';
  const cleaned = expiry.replace(/\s/g, '');
  if (/^\d{2}\/\d{2}$/.test(cleaned)) return cleaned;
  if (/^\d{2}\/\d{4}$/.test(cleaned)) return `${cleaned.slice(0, 2)}/${cleaned.slice(5)}`;
  if (/^\d{4}-\d{2}/.test(cleaned)) {
    const [y, m] = cleaned.split('-');
    return `${m}/${y.slice(2)}`;
  }
  return cleaned.slice(0, 5);
}

function formatAccount(account?: string, seed?: string): string {
  if (account && account.length >= 4) {
    const clean = account.replace(/\s/g, '').toUpperCase();
    if (clean.length <= 12) return clean;
    return `${clean.slice(0, 4)} ··· ${clean.slice(-4)}`;
  }
  let h = 0;
  const s = String(seed || 'acct');
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return `OL${String(h % 1e8).padStart(8, '0')}`;
}

/**
 * Renders the full OneLink card print (no crop) with name / PAN / account / expiry
 * in a frosted band above the train artwork.
 */
export default function OneLinkPrintCard({
  holderName,
  last4 = '4242',
  seed = 'onelink',
  expiry,
  accountNumber,
  width: widthProp,
  style,
  compact = false,
}: Props) {
  const screenW = Dimensions.get('window').width;
  // Compact pocket size; always show entire print
  const width = widthProp ?? Math.min(screenW * 0.58, 220);
  const height = width * (PRINT_H / PRINT_W);
  const pan = useMemo(() => buildMockCardNumber(seed, last4), [seed, last4]);
  const exp = formatExpiry(expiry);
  const name = (holderName || 'ONELINK USER').trim().toUpperCase();
  const acct = formatAccount(accountNumber, seed);
  const scale = Math.max(0.75, Math.min(1, width / 220));

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius: Math.max(12, 16 * scale),
          overflow: 'hidden',
          backgroundColor: '#1FA89A',
        },
        style,
      ]}
    >
      {/* contain = entire artwork visible; matching aspect means no letterboxing */}
      <Image
        source={ONELINK_CARD_IMAGE}
        style={styles.printImage}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />

      <View style={styles.overlay} pointerEvents="none">
        <View style={[styles.infoBand, compact && styles.infoBandCompact, { transform: [{ scale }] }]}>
          <View style={styles.rowTop}>
            <View style={{ flex: 1, paddingRight: 6, minWidth: 0 }}>
              <Text style={styles.microLabel}>CARDHOLDER</Text>
              <Text style={styles.holder} numberOfLines={2}>
                {name}
              </Text>
            </View>
            <View style={styles.expBlock}>
              <Text style={styles.microLabel}>VALID THRU</Text>
              <Text style={styles.exp}>{exp}</Text>
            </View>
          </View>

          <Text
            style={[styles.pan, { fontSize: Math.max(10, 12 * scale), letterSpacing: Math.max(0.6, 1.4 * scale) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {pan}
          </Text>

          <View style={styles.rowBottom}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.microLabel}>ACCOUNT</Text>
              <Text style={styles.acct} numberOfLines={1}>{acct}</Text>
            </View>
            <Text style={styles.brandHint}>OneLink</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  printImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    // Sit above the train / VISA — ~18–22% from bottom of print
    paddingBottom: '18%',
    paddingHorizontal: '5%',
  },
  infoBand: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(8, 40, 36, 0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  infoBandCompact: {
    paddingVertical: 7,
    paddingHorizontal: 9,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  microLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 1,
    fontSize: 7,
  },
  holder: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.3,
    fontSize: 10,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  expBlock: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  exp: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pan: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  acct: {
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '700',
    letterSpacing: 0.5,
    fontSize: 9,
    fontVariant: ['tabular-nums'],
  },
  brandHint: {
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '800',
    letterSpacing: 0.4,
    fontSize: 8,
  },
});
