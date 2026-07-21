let _demoMode = false;

export function isDemoMode(): boolean {
  return _demoMode;
}

export function enableDemoMode(): void {
  if (!_demoMode) {
    _demoMode = true;
    console.info('[OneLink] Running in demo mode — using local data');
  }
}

export function disableDemoMode(): void {
  _demoMode = false;
}

export async function tryApi<T>(apiCall: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await apiCall();
  } catch {
    enableDemoMode();
    return fallback();
  }
}
