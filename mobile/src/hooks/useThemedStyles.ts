import { useMemo } from 'react';
import type { AppTheme } from '../theme/appTheme';
import { useAppTheme } from './useAppTheme';

export function useThemedStyles<T>(factory: (theme: AppTheme) => T): T {
  const theme = useAppTheme();
  return useMemo(() => factory(theme), [theme.isDark, theme.bg, theme.surface, theme.text]);
}
