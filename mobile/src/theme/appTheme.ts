import { premium } from './premiumTheme';

export type AppTheme = typeof premium & {
  isDark: boolean;
  metroBg: string;
  shopHeader: string;
  shopHeaderBorder: string;
  shopAccent: string;
  parkingHeader: string;
};

const lightExtras = {
  metroBg: '#E8EEF8',
  shopHeader: '#F0FDF4',
  shopHeaderBorder: '#DCFCE7',
  shopAccent: '#15803D',
  parkingHeader: '#1A73E8',
};

const darkExtras = {
  metroBg: '#0F1729',
  shopHeader: '#0F1F17',
  shopHeaderBorder: '#1A3D2E',
  shopAccent: '#34D399',
  parkingHeader: '#1E3A5F',
};

const dark = {
  bg: '#0A0E1A',
  surface: '#1A2035',
  surfaceMuted: '#141B2E',
  text: '#F3F4F6',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  border: '#2A3448',
  gold: '#C9A227',
  goldSoft: '#2A2418',
  home: { hero: '#2E5077', heroAccent: '#3D6A99', heroSoft: '#1A2A3D' },
  wallet: { primary: '#4A7CAB', secondary: '#3D6A99', accent: '#C4A35A', soft: '#152535', credit: '#4ADE80', debit: '#D4A574', service: { upi: '#4A7CAB', bills: '#B8956B', recharge: '#2DD4BF', invest: '#C4A35A', loan: '#94A3B8', insurance: '#60A5FA' } },
  rewards: { primary: '#C9A227', secondary: '#B8860B', soft: '#2A2418' },
  settings: { primary: '#9CA3AF', soft: '#1F2937' },
  metro: '#60A5FA',
  parking: '#93C5FD',
  events: '#A78BFA',
  shop: '#34D399',
  canteen: '#FB923C',
  transit: '#FB923C',
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  shadowSoft: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  radius: premium.radius,
  radiusSm: premium.radiusSm,
  radiusLg: premium.radiusLg,
};

export function getAppTheme(isDark: boolean): AppTheme {
  const base = isDark ? dark : premium;
  const extras = isDark ? darkExtras : lightExtras;
  return { ...base, ...extras, isDark };
}
