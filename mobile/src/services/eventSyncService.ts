import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAllEvents } from '../services/eventsScraper';
import { useCityStore } from '../store/useCityStore';
import { useNotificationsStore } from '../store/useNotificationsStore';

const SYNC_KEY = 'onelink_events_last_sync';
const PREV_COUNT_KEY = 'onelink_events_prev_count';
function todaySixAm(): Date {
  const d = new Date();
  d.setHours(6, 0, 0, 0);
  return d;
}

export async function runDailyEventSync(): Promise<number> {
  const now = new Date();
  const sixAm = todaySixAm();
  if (now < sixAm) return 0;

  const lastSyncRaw = await AsyncStorage.getItem(SYNC_KEY);
  const lastSync = lastSyncRaw ? new Date(lastSyncRaw) : null;
  if (lastSync && lastSync >= sixAm) return 0;

  const events = await fetchAllEvents('lucknow', { forceRefresh: true });
  if (!events.length) return 0;

  const prevCountRaw = await AsyncStorage.getItem(PREV_COUNT_KEY);
  const prevCount = prevCountRaw ? parseInt(prevCountRaw, 10) : 0;
  const newCount = events.length - prevCount;

  useCityStore.setState({
    events,
    lastSyncedAt: now.toISOString(),
  });

  if (newCount > 0) {
    useNotificationsStore.getState().add({
      title: 'Lucknow events updated',
      body: `${events.length} live listings from BookMyShow are available now.`,
      type: 'EVENT',
      actionRoute: 'City',
    });
  }

  await AsyncStorage.setItem(SYNC_KEY, now.toISOString());
  await AsyncStorage.setItem(PREV_COUNT_KEY, String(events.length));
  return Math.max(newCount, 0);
}
