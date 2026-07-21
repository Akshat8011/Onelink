import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirmation dialog.
 *
 * On native we use `Alert.alert` with buttons. On web (the Expo web export /
 * "webapp"), `Alert.alert` button callbacks are NOT invoked by react-native-web,
 * which is why confirm-then-act flows (paying bills, buying insurance, applying
 * for a loan) silently did nothing when tapped. We fall back to `window.confirm`
 * there so the action actually runs.
 *
 * Returns a promise that resolves to `true` when the user confirms.
 */
export function confirmDialog(
  title: string,
  message = '',
  confirmText = 'OK',
  cancelText = 'Cancel',
): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const text = message ? `${title}\n\n${message}` : title;
      return Promise.resolve(window.confirm(text));
    }
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, onPress: () => resolve(true) },
    ]);
  });
}

/** Cross-platform informational alert that also works on the web build. */
export function alertDialog(title: string, message = ''): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
    return;
  }
  Alert.alert(title, message);
}
