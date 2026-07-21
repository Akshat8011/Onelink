import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import api from './api';
import type { LiveEvent } from '../data/eventsLucknow';
import bundledPayload from '../data/events_lucknow.scraped.json';

const CACHE_KEY = 'onelink_bms_events_cache_v7';
const CACHE_TS_KEY = 'onelink_bms_events_cache_ts_v7';
const CACHE_TTL_MS = 30 * 60 * 1000;

export interface ScrapedEventRecord {
  title: string;
  language?: string;
  censor_rating?: string;
  booking_url: string;
  heart_count?: string;
  user_rating?: string;
  venues?: string;
  event_date?: string;
  show_times?: string;
  min_price?: string;
  category: 'movie' | 'event' | string;
  image_url?: string;
  event_code: string;
  city?: string;
  scraped_at?: string;
}

export interface ScrapedPayload {
  city: string;
  scraped_at: string;
  source: string;
  total_count: number;
  events: ScrapedEventRecord[];
}

export interface FetchEventsOptions {
  forceRefresh?: boolean;
}

function parseHeartCount(value?: string): number {
  if (!value) return 0;
  const match = value.trim().match(/^([\d.]+)\s*([KkMm])?$/);
  if (!match) {
    const digits = parseInt(value.replace(/\D/g, ''), 10);
    return Number.isFinite(digits) ? digits : 0;
  }
  let amount = parseFloat(match[1]);
  const suffix = (match[2] || '').toUpperCase();
  if (suffix === 'K') amount *= 1000;
  if (suffix === 'M') amount *= 1_000_000;
  return Math.floor(amount);
}

function parseMinPrice(value?: string): number {
  if (!value) return 0;
  const digits = parseInt(String(value).replace(/\D/g, ''), 10);
  return Number.isFinite(digits) ? digits : 0;
}

/** Movies without real showtimes often get fake scraped prices — hide those. */
function resolveDisplayPrice(item: ScrapedEventRecord, parsedPrice: number): number {
  if (parsedPrice <= 0) return 0;
  const category = (item.category || '').toLowerCase();
  if (category !== 'movie') return parsedPrice;

  const showTime = (item.show_times || '').trim();
  const hasRealShowtimes = Boolean(showTime) && !/releasing/i.test(showTime);
  if (!hasRealShowtimes) return 0;
  return parsedPrice;
}

function upgradeImageUrl(url?: string): string {
  if (!url?.trim()) return '';
  let upgraded = url.trim();

  if (upgraded.includes('-portrait.')) {
    upgraded = upgraded.replace('-portrait.', '-landscape.');
  }

  if (upgraded.includes('tr:w-')) {
    upgraded = upgraded.replace(/tr:w-\d+,h-\d+/, 'tr:w-600,h-400');
  } else if (upgraded.includes('bmscdn.com') && upgraded.includes('/events/')) {
    const lastSlash = upgraded.lastIndexOf('/');
    if (lastSlash !== -1) {
      upgraded = upgraded.slice(0, lastSlash) + '/tr:w-600,h-400,fo-auto' + upgraded.slice(lastSlash);
    }
  }

  return upgraded;
}

/** True BMS poster URLs only — reject generic stock/placeholder hosts. */
function isValidEventImage(url?: string): boolean {
  if (!url?.trim()) return false;
  const lower = url.toLowerCase();
  if (lower.includes('unsplash.com')) return false;
  if (lower.includes('placeholder')) return false;
  return (
    lower.includes('bmscdn.com') ||
    lower.includes('bookmyshow') ||
    lower.includes('bmsimages.com')
  );
}

function resolveEventImageUrl(item: ScrapedEventRecord): string {
  const direct = upgradeImageUrl(item.image_url);
  if (isValidEventImage(direct)) return direct;
  return '';
}

/** Rewrite legacy BMS movie paths: /lucknow/movies/... → /movies/lucknow/... */
function normalizeBookingUrl(url?: string): string {
  if (!url) return '';
  return url.replace(
    /^(https?:\/\/in\.bookmyshow\.com)\/lucknow\/movies\//i,
    '$1/movies/lucknow/',
  );
}

function inferCategory(title: string, scraperCategory: string): string {
  const cat = (scraperCategory || '').toLowerCase();
  if (cat === 'movie') return 'MOVIE';
  if (cat === 'comedy') return 'COMEDY';
  if (cat === 'music') return 'MUSIC';
  if (cat === 'sports') return 'SPORTS';
  if (cat === 'plays' || cat === 'play') return 'THEATRE';
  if (cat === 'activities' || cat === 'activity') return 'WORKSHOP';
  if (cat === 'event') {
    const lower = title.toLowerCase();
    if (/comedy|standup|stand-up|namak|meaningless|cult leader|humourist/i.test(lower)) return 'COMEDY';
    if (/tour|concert|music|fred again|audition|hybe|dj /i.test(lower)) return 'MUSIC';
    if (/painting|workshop|sketch|origami|collage|pottery|craft/i.test(lower)) return 'WORKSHOP';
    if (/sports|ipl|marathon|cricket|football/i.test(lower)) return 'SPORTS';
    return 'THEATRE';
  }
  const lower = title.toLowerCase();
  if (/comedy|standup|stand-up/i.test(lower)) return 'COMEDY';
  if (/concert|music|tour/i.test(lower)) return 'MUSIC';
  if (/sports|marathon|cricket/i.test(lower)) return 'SPORTS';
  return 'THEATRE';
}

function resolveVenue(item: ScrapedEventRecord): string {
  if (item.venues?.trim()) {
    const venues = item.venues.split(';').map(v => v.trim()).filter(Boolean);
    const first = venues[0] || item.venues.trim();
    if (venues.length > 1) {
      return `${first} +${venues.length - 1} more`;
    }
    return first;
  }
  return '';
}

function buildDescription(item: ScrapedEventRecord): string {
  const parts: string[] = [];
  if (item.language) parts.push(item.language);
  if (item.censor_rating) parts.push(item.censor_rating);
  if (item.user_rating) parts.push(`${item.user_rating} user rating`);
  if (item.heart_count) parts.push(`${item.heart_count} likes`);
  if (item.venues) parts.push(item.venues);
  return parts.length ? parts.join(' · ') : 'Live listing from BookMyShow Lucknow';
}

function resolveEventDate(item: ScrapedEventRecord): string {
  const raw = item.event_date?.trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return '';
}

function resolveShowTime(item: ScrapedEventRecord, eventDate: string): string {
  if (item.show_times?.trim()) return item.show_times.trim();

  if (item.category === 'movie' && eventDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const release = new Date(`${eventDate}T12:00:00`);
    release.setHours(0, 0, 0, 0);
    if (release.getTime() > today.getTime()) return 'Releasing soon';
    if (release.getTime() === today.getTime()) return 'Showtimes today';
  }

  return '';
}

export function formatEventDateLabel(dateStr: string, showTime?: string): string {
  if (!dateStr?.trim()) {
    return showTime?.trim() || 'Schedule on BookMyShow';
  }

  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return showTime?.trim() || dateStr;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDay = new Date(d);
  eventDay.setHours(0, 0, 0, 0);

  let datePart: string;
  if (eventDay.getTime() === today.getTime()) {
    datePart = 'Today';
  } else {
    datePart = d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' as const } : {}),
    });
  }

  const time = showTime?.trim();
  if (time && !/^releasing/i.test(time)) {
    return `${datePart} · ${time}`;
  }
  if (time?.toLowerCase().includes('releasing')) {
    return `${datePart} · ${time}`;
  }
  return datePart;
}

function transformScrapedRecord(item: ScrapedEventRecord, payloadScrapedAt?: string): LiveEvent {
  const likes = parseHeartCount(item.heart_count);
  const scrapedAt = item.scraped_at || payloadScrapedAt || new Date().toISOString();
  const eventDate = resolveEventDate(item);
  const showTime = resolveShowTime(item, eventDate);
  const price = resolveDisplayPrice(item, parseMinPrice(item.min_price));
  const bookingUrl = normalizeBookingUrl(item.booking_url);

  return {
    eventId: item.event_code,
    title: item.title.trim(),
    description: buildDescription(item),
    venue: resolveVenue(item),
    city: item.city || 'Lucknow',
    date: eventDate,
    showTime,
    displayTime: formatEventDateLabel(eventDate, showTime),
    price,
    capacity: likes > 0 ? likes + 500 : 1000,
    ticketsSold: likes,
    category: inferCategory(item.title, item.category),
    imageUrl: resolveEventImageUrl(item),
    source: 'bookmyshow',
    bookingUrl,
    bookMyShowUrl: bookingUrl,
    language: item.language || undefined,
    censorRating: item.censor_rating || undefined,
    userRating: item.user_rating || undefined,
    heartCount: item.heart_count || undefined,
    scrapedAt,
    isLiveData: true,
  };
}

export function transformScrapedPayload(payload: ScrapedPayload): LiveEvent[] {
  if (!payload?.events?.length) return [];
  return payload.events.map(item => transformScrapedRecord(item, payload.scraped_at));
}

async function clearCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([CACHE_KEY, CACHE_TS_KEY]);
  } catch {
    // non-fatal
  }
}

async function readCache(): Promise<LiveEvent[] | null> {
  try {
    const [raw, tsRaw] = await Promise.all([
      AsyncStorage.getItem(CACHE_KEY),
      AsyncStorage.getItem(CACHE_TS_KEY),
    ]);
    if (!raw || !tsRaw) return null;

    const age = Date.now() - parseInt(tsRaw, 10);
    if (age > CACHE_TTL_MS) return null;

    const parsed = JSON.parse(raw) as LiveEvent[];
    return parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

async function writeCache(events: LiveEvent[]): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [CACHE_KEY, JSON.stringify(events)],
      [CACHE_TS_KEY, String(Date.now())],
    ]);
  } catch {
    // non-fatal
  }
}

async function fetchRemotePayload(forceRefresh: boolean): Promise<ScrapedPayload | null> {
  const cacheBuster = forceRefresh ? `?t=${Date.now()}` : '';

  const fetchBackend = async () => {
    const { data } = await api.get<{ success: boolean; data: ScrapedPayload }>(
      `/v1/city/live/bms${cacheBuster}`,
      { timeout: 15000 }
    );
    if (data?.success && data.data?.events?.length) return data.data;
    return null;
  };

  try {
    const payload = await fetchBackend();
    if (payload) return payload;
  } catch (error) {
    console.warn('Events backend fetch failed, using bundled data', error);
  }

  return null;
}

function getBundledEvents(): LiveEvent[] {
  const payload = bundledPayload as ScrapedPayload;
  return transformScrapedPayload(payload);
}

export async function fetchAllEvents(
  _city: string = 'lucknow',
  options: FetchEventsOptions = {}
): Promise<LiveEvent[]> {
  const { forceRefresh = false } = options;

  if (forceRefresh) {
    await clearCache();
  } else {
    const cached = await readCache();
    if (cached?.length) {
      const withImages = cached.filter(e => e.imageUrl);
      if (withImages.length >= cached.length * 0.5) {
        return cached;
      }
      await clearCache();
    }
  }

  const payload = await fetchRemotePayload(forceRefresh);
  if (payload) {
    const events = transformScrapedPayload(payload);
    if (events.length) {
      await writeCache(events);
      return events;
    }
  }

  const bundled = getBundledEvents();
  if (bundled.length) {
    console.log(`[Events] Using ${bundled.length} bundled events, ${bundled.filter(e => e.imageUrl).length} with images`);
    if (!forceRefresh) await writeCache(bundled);
    return bundled;
  }

  return [];
}

export async function getEventsByCategory(
  category: 'MUSIC' | 'COMEDY' | 'SPORTS' | 'MOVIE' | 'ALL',
  city: string = 'lucknow',
  options?: FetchEventsOptions
): Promise<LiveEvent[]> {
  const events = await fetchAllEvents(city, options);
  if (category === 'ALL') return events;
  return events.filter(e => e.category === category);
}

export async function searchEvents(
  query: string,
  city: string = 'lucknow',
  options?: FetchEventsOptions
): Promise<LiveEvent[]> {
  const events = await fetchAllEvents(city, options);
  const searchTerm = query.toLowerCase();
  return events.filter(event =>
    event.title.toLowerCase().includes(searchTerm) ||
    event.description.toLowerCase().includes(searchTerm) ||
    event.venue.toLowerCase().includes(searchTerm) ||
    (event.artist || '').toLowerCase().includes(searchTerm) ||
    (event.language || '').toLowerCase().includes(searchTerm)
  );
}

export async function refreshEventsData(city: string = 'lucknow'): Promise<LiveEvent[]> {
  return fetchAllEvents(city, { forceRefresh: true });
}
