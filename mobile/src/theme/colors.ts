/**
 * OneLink Super App — Design System
 * Per-module color palettes for professional UI
 */

// ═══════════════════════════════════════
// GLOBAL DESIGN TOKENS
// ═══════════════════════════════════════
export const colors = {
  // Core Backgrounds (Dark mode — used for Home & global shell)
  background: '#0A0E1A',
  surface: '#111827',
  card: '#1A2035',
  cardElevated: '#1F2A45',
  cardHover: '#243050',

  // Light Backgrounds (used by Transit, Parking, Retail, Wallet)
  white: '#FFFFFF',
  offWhite: '#F8F9FA',
  lightGray: '#F1F3F5',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // Primary Brand (Blue)
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  primaryLight: '#60A5FA',
  primaryGlow: 'rgba(59, 130, 246, 0.15)',

  // Accent (Gold for premium feel)
  accent: '#F59E0B',
  accentDark: '#D97706',
  accentLight: '#FCD34D',
  accentGlow: 'rgba(245, 158, 11, 0.15)',

  // Status Colors
  success: '#10B981',
  successDark: '#059669',
  successLight: '#D1FAE5',
  successGlow: 'rgba(16, 185, 129, 0.15)',

  error: '#EF4444',
  errorDark: '#DC2626',
  errorLight: '#FEE2E2',
  errorGlow: 'rgba(239, 68, 68, 0.15)',

  warning: '#F59E0B',
  warningDark: '#D97706',
  warningLight: '#FEF3C7',

  info: '#3B82F6',

  // Text
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textInverse: '#111827',
  textDark: '#1F2937',
  textDarkSecondary: '#6B7280',

  // Borders
  border: '#374151',
  borderLight: '#4B5563',
  borderAccent: 'rgba(59, 130, 246, 0.3)',
  borderLightMode: '#E5E7EB',

  // Gradient pairs
  gradientStart: '#3B82F6',
  gradientEnd: '#8B5CF6',
  gradientGold: ['#F59E0B', '#EF4444'] as string[],
  gradientBlue: ['#3B82F6', '#6366F1'] as string[],
  gradientGreen: ['#10B981', '#059669'] as string[],

  // ═══════════════════════════════════════
  // MODULE-SPECIFIC PALETTES
  // ═══════════════════════════════════════

  // Transit / Metro (DMRC-inspired: white bg, blue accents)
  metro: '#003DA5',        // DMRC Blue
  metroLight: '#E8F0FE',
  metroRed: '#DC2626',     // Book ticket button
  metroGreen: '#16A34A',   // Entry station dot
  metroBg: '#F5F7FA',

  // Parking (Park+ inspired: white bg, blue + yellow)
  parking: '#1A73E8',      // Park+ blue
  parkingYellow: '#FBBF24', // Park+ yellow
  parkingBg: '#FFFBEB',
  parkingGreen: '#22C55E',
  parkingRed: '#EF4444',

  // Events (District-inspired: dark bg, purple/pink)
  events: '#A855F7',       // Purple
  eventsPink: '#EC4899',
  eventsDeep: '#7C3AED',
  eventsBg: '#0F0A1A',
  eventsCard: '#1A1025',
  eventsGradientStart: '#7C3AED',
  eventsGradientEnd: '#EC4899',

  // Retail/Shopping (Supermarket-inspired: white bg, green)
  shopping: '#22C55E',     // Fresh green
  shoppingDark: '#16A34A',
  shoppingBg: '#F0FDF4',
  shoppingCard: '#FFFFFF',

  // Wallet (Card manager-inspired: white bg, purple)
  wallet: '#152238',       // Deep navy — professional fintech
  walletLight: '#EEF2F6',
  walletDark: '#0C1520',
  walletBg: '#F7F9FB',
  walletGradient1: '#152238',
  walletGradient2: '#1E3A5F',
  walletGradient3: '#243B53',

  // Parking spot colors (matching old UI)
  spotFree: '#22C55E',
  spotOccupied: '#EF4444',
  spotReserved: '#FBBF24',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.6)',
  shimmer: 'rgba(255, 255, 255, 0.05)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  hero: 32,
  display: 40,
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  }),
};
