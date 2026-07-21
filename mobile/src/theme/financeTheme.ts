/** Premium finance UI — mature, section-identifiable palette */
export const fin = {
  bg: '#F5F4F1',
  surface: '#FFFFFF',
  sidebar: '#0F1419',
  sidebarMuted: '#1C2128',
  text: '#0F1419',
  textSecondary: '#5C6370',
  textMuted: '#8B919A',
  border: '#E8E5DF',
  gold: '#C9A227',
  goldSoft: '#F7F1E3',

  /** Section identities */
  sections: {
    wealth: { primary: '#1E3A5F', secondary: '#2E5077', soft: '#E8EEF4', accent: '#C9A227' },
    invest: { primary: '#1B4332', secondary: '#2D6A4F', soft: '#E6F0EB', accent: '#D4AF37' },
    loans: { primary: '#2D1B4E', secondary: '#4A3070', soft: '#EDE8F4', accent: '#9B8EC4' },
    insurance: { primary: '#1A3C40', secondary: '#2A5F66', soft: '#E5F0F1', accent: '#5BA8A8' },
    bills: { primary: '#3D3028', secondary: '#5C4A3A', soft: '#F0EBE6', accent: '#B8956A' },
    profile: { primary: '#2C2C2C', secondary: '#454545', soft: '#F0EFED', accent: '#A8A29E' },
  },

  /** Legacy aliases mapped to premium tones */
  gradientStart: '#1E3A5F',
  gradientEnd: '#2E5077',
  accent: '#C9A227',
  accentSoft: '#F7F1E3',
  orange: '#B8956A',
  blue: '#2E5077',
  purple: '#4A3070',
  cyan: '#5BA8A8',
  green: '#2D6A4F',
  red: '#8B3A3A',

  chart: ['#1E3A5F', '#2D6A4F', '#4A3070', '#5BA8A8', '#B8956A', '#6B7280', '#C9A227'],

  radius: 20,
  radiusSm: 12,
  radiusLg: 26,
  shadow: {
    shadowColor: '#0F1419',
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  shadowSoft: {
    shadowColor: '#0F1419',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};

export type FinSection = keyof typeof fin.sections;

export function sectionStyle(key: FinSection, isDark = false) {
  return getFinanceTheme(isDark).sections[key];
}

export function getFinanceTheme(isDark: boolean) {
  if (!isDark) return fin;
  return {
    ...fin,
    bg: '#0A0E1A',
    surface: '#1A2035',
    sidebar: '#0F1419',
    sidebarMuted: '#141B2E',
    text: '#F3F4F6',
    textSecondary: '#9CA3AF',
    textMuted: '#6B7280',
    border: '#2A3448',
    goldSoft: '#2A2418',
    shadow: {
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    shadowSoft: {
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
  };
}
