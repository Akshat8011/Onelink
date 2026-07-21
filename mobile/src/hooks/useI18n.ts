import { useSettingsStore } from '../store/useSettingsStore';
import { t as translate, type Lang } from '../i18n/strings';

export function useI18n() {
  const language = useSettingsStore((s) => s.language);
  const t = (key: Parameters<typeof translate>[0], vars?: Record<string, string | number>) => {
    let s = translate(key, language as Lang);
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return s;
  };
  return { language, t, isHi: language === 'HI' };
}
