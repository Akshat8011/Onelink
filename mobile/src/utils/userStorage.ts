import AsyncStorage from '@react-native-async-storage/async-storage';

export function userStorageKey(base: string, userId?: string | null): string {
  if (!userId) return base;
  return `${base}_${userId}`;
}

export async function getUserStorageItem(base: string, userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  return AsyncStorage.getItem(userStorageKey(base, userId));
}

export async function setUserStorageItem(base: string, userId: string | null | undefined, value: string): Promise<void> {
  if (!userId) return;
  await AsyncStorage.setItem(userStorageKey(base, userId), value);
}
