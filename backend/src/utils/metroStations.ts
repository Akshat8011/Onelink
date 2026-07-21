/**
 * Canonical Lucknow Metro Red Line (North–South Corridor) station list.
 *
 * Single source of truth shared by the transit service (app-side ticketing /
 * fares) and the kiosk service (physical gate ticketing) so the stops and
 * distances can never drift between the two. Ordered from the southern
 * terminal (CCS Airport) to the northern terminal (Munshipulia) — the real
 * UPMRC Red Line: 21 stations, ~22.88 km.
 */
export const METRO_STATIONS = [
  'CCS Airport',
  'Amausi',
  'Transport Nagar',
  'Krishna Nagar',
  'Singar Nagar',
  'Alambagh',
  'Alambagh Bus Station',
  'Mawaiya',
  'Durgapuri',
  'Charbagh',
  'Husain Ganj',
  'Sachivalaya',
  'Hazratganj',
  'KD Singh Stadium',
  'Vishwavidyalaya',
  'IT Chauraha',
  'Badshah Nagar',
  'Lekhraj Market',
  'Bhootnath Market',
  'Indira Nagar',
  'Munshipulia',
] as const;

/** Cumulative track distance (km) from CCS Airport for each station above. */
const CUMULATIVE_KM = [
  0, 1.4, 2.8, 4.0, 5.1, 6.2, 7.0, 8.0, 9.0, 10.4, 11.4,
  12.3, 13.2, 14.0, 14.9, 15.9, 17.0, 18.2, 19.3, 20.9, 22.88,
];

export function metroStationIndex(name: string): number {
  const target = String(name ?? '').trim().toLowerCase();
  return METRO_STATIONS.findIndex((s) => s.toLowerCase() === target);
}

/** Track distance (km) between two stations; 0 if either is unknown. */
export function metroDistanceKm(from: string, to: string): number {
  const a = metroStationIndex(from);
  const b = metroStationIndex(to);
  if (a === -1 || b === -1) return 0;
  return Math.round(Math.abs(CUMULATIVE_KM[a] - CUMULATIVE_KM[b]) * 10) / 10;
}
