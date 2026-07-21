import { useMemo } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { getFinanceTheme } from '../theme/financeTheme';

export function useFinanceTheme() {
  const isDark = useSettingsStore((s) => s.darkMode);
  return useMemo(() => getFinanceTheme(isDark), [isDark]);
}
