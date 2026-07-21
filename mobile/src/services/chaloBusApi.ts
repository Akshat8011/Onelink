import {
  CHALO_BUS_ROUTES,
  CHALO_APP_URL,
  getAllActiveBuses,
  getBusesForRoute,
  getTotalActiveBusCount,
  type LiveBus,
  type BusRoute,
} from '../data/busRoutesChalo';

export type { LiveBus, BusRoute };

export interface ChaloBus {
  busId: string;
  routeNumber: string;
  routeName: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  lastUpdated: string;
  nextStop: string;
  estimatedArrival: number;
  occupancyLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  busType: 'AC' | 'NON_AC' | 'ELECTRIC';
  currentStop: string;
}

export interface ChaloRoute {
  routeId: string;
  routeNumber: string;
  routeName: string;
  fromStop: string;
  toStop: string;
  stops: { id: string; name: string; latitude: number; longitude: number; address: string }[];
  activeBuses: number;
  frequency: string;
  fare: number;
  distance: number;
  operationalHours: { start: string; end: string };
  depot: string;
  returnHours: { start: string; end: string };
}

function toChaloBus(bus: LiveBus): ChaloBus {
  return {
    busId: bus.busId,
    routeNumber: bus.routeNo,
    routeName: bus.routeName,
    latitude: bus.lat,
    longitude: bus.lng,
    heading: 0,
    speed: 25,
    lastUpdated: bus.lastUpdated,
    nextStop: bus.nextStop,
    estimatedArrival: bus.etaMinutes,
    occupancyLevel: bus.occupancy,
    busType: bus.busType,
    currentStop: bus.currentStop,
  };
}

function toChaloRoute(route: BusRoute): ChaloRoute {
  return {
    routeId: `ROUTE_${route.routeNo}`,
    routeNumber: route.routeNo,
    routeName: route.name,
    fromStop: route.stops[0],
    toStop: route.stops[route.stops.length - 1],
    stops: route.stops.map((s, i) => ({
      id: `STOP_${route.routeNo}_${i}`,
      name: s,
      latitude: 26.8467,
      longitude: 80.9462,
      address: s,
    })),
    activeBuses: route.activeBuses.length,
    frequency: route.frequency,
    fare: 15,
    distance: route.stops.length * 2.5,
    operationalHours: { start: route.firstDeparture, end: route.lastDeparture },
    depot: route.depot,
    returnHours: { start: route.returnFirst, end: route.returnLast },
  };
}

/** Returns all active buses — stable LCTSL fleet data, no random generation */
export async function getLiveBuses(_city = 'lucknow'): Promise<ChaloBus[]> {
  return getAllActiveBuses().map(toChaloBus);
}

/** Returns all 22 LCTSL routes from official timetable */
export async function getBusRoutes(_city = 'lucknow'): Promise<ChaloRoute[]> {
  return CHALO_BUS_ROUTES.map(toChaloRoute);
}

export async function getBusesByRoute(routeNo: string): Promise<ChaloBus[]> {
  return getBusesForRoute(routeNo).map(toChaloBus);
}

export function getChaloAppUrl(): string {
  return CHALO_APP_URL;
}

export function getActiveBusCount(): number {
  return getTotalActiveBusCount();
}

export async function refreshLiveBusData(): Promise<ChaloBus[]> {
  return getLiveBuses();
}
