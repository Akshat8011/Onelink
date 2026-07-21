import { useSettingsStore } from '../store/useSettingsStore';
import { getAppTheme } from '../theme/appTheme';

export function useAppTheme() {
  const darkMode = useSettingsStore((s) => s.darkMode);
  return getAppTheme(darkMode);
}
