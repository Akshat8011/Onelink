import axios from 'axios';

const API_KEY = '8506f474-478c-4d2f-b9cb-c23d3fe12f02';
const BASE_URL = 'https://api.openchargemap.io/v3/poi/';

export interface ChargerLocation {
  ID: number;
  UUID: string;
  AddressInfo: {
    Title: string;
    AddressLine1: string;
    Town: string;
    StateOrProvince: string;
    Postcode: string;
    Country: {
      ISOCode: string;
      Title: string;
    };
    Latitude: number;
    Longitude: number;
    Distance: number;
    DistanceUnit: number;
  };
  Connections: Array<{
    ID: number;
    ConnectionTypeID: number;
    ConnectionType: {
      ID: number;
      Title: string;
    };
    PowerKW: number;
    CurrentTypeID: number;
    CurrentType: {
      ID: number;
      Title: string;
    };
    StatusTypeID: number;
    StatusType: {
      ID: number;
      Title: string;
      IsOperational: boolean;
    };
    Level: {
      ID: number;
      Title: string;
      IsFastChargeCapable: boolean;
    };
  }>;
  NumberOfPoints: number;
  StatusType: {
    ID: number;
    Title: string;
    IsOperational: boolean;
  };
  OperatorInfo: {
    ID: number;
    Title: string;
    WebsiteURL: string;
  };
  UsageType: {
    ID: number;
    Title: string;
  };
}

export interface TransformedCharger {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  distance: number;
  connectors: Array<{
    type: string;
    powerKw: number;
    status: string;
    currentType: string;
    isFastCharge: boolean;
  }>;
  numberOfPoints: number;
  isOperational: boolean;
  operator: string;
  operatorWebsite: string;
  usageType: string;
}

/**
 * Fetch charging stations near Lucknow
 * @param latitude - Center latitude (default: Lucknow city center)
 * @param longitude - Center longitude (default: Lucknow city center)
 * @param radiusKm - Search radius in kilometers (default: 50km)
 * @param maxResults - Maximum number of results (default: 100)
 */
export async function getChargingStations(
  latitude: number = 26.8467,
  longitude: number = 80.9462,
  radiusKm: number = 50,
  maxResults: number = 100
): Promise<TransformedCharger[]> {
  try {
    const response = await axios.get<ChargerLocation[]>(BASE_URL, {
      params: {
        key: API_KEY,
        latitude,
        longitude,
        distance: radiusKm,
        distanceunit: 'KM',
        maxresults: maxResults,
        compact: false,
        verbose: false,
      },
      timeout: 15000,
    });

    return response.data.map(transformCharger);
  } catch (error) {
    console.error('OpenChargeMap API error:', error);
    return [];
  }
}

/**
 * Search charging stations by city name anywhere in the world.
 * Geocodes the city then queries OpenChargeMap API.
 */
export async function searchChargersByCity(
  cityName: string,
  radiusKm: number = 30,
  maxResults: number = 50
): Promise<{ chargers: TransformedCharger[]; location: { name: string; lat: number; lng: number } | null }> {
  const location = await geocodeCity(cityName);
  if (!location) {
    return { chargers: [], location: null };
  }
  const chargers = await getChargingStations(location.lat, location.lng, radiusKm, maxResults);
  return { chargers, location };
}

/** Geocode a city/place name to lat/lng using OpenStreetMap Nominatim */
export async function geocodeCity(
  query: string
): Promise<{ name: string; lat: number; lng: number; country: string } | null> {
  try {
    const response = await axios.get(
      'https://nominatim.openstreetmap.org/search',
      {
        params: { q: query, format: 'json', limit: 1, addressdetails: 1 },
        headers: { 'User-Agent': 'OneLink-App/1.0' },
        timeout: 10000,
      }
    );
    if (!response.data?.length) return null;
    const place = response.data[0];
    return {
      name: place.display_name.split(',')[0],
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
      country: place.address?.country || '',
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/** Popular cities with pre-cached coordinates for fast lookup */
export const POPULAR_CITIES = [
  { name: 'Lucknow', lat: 26.8467, lng: 80.9462, country: 'India' },
  { name: 'Delhi', lat: 28.6139, lng: 77.2090, country: 'India' },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777, country: 'India' },
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946, country: 'India' },
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867, country: 'India' },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707, country: 'India' },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639, country: 'India' },
  { name: 'Pune', lat: 18.5204, lng: 73.8567, country: 'India' },
  { name: 'London', lat: 51.5074, lng: -0.1278, country: 'UK' },
  { name: 'New York', lat: 40.7128, lng: -74.0060, country: 'USA' },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708, country: 'UAE' },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198, country: 'Singapore' },
];

/**
 * Search charging stations by location name
 * @param query - Search query (e.g., "Hazratganj", "Gomti Nagar")
 */
export async function searchChargingStations(
  query: string,
  lat?: number,
  lng?: number
): Promise<TransformedCharger[]> {
  const centerLat = lat ?? 26.8467;
  const centerLng = lng ?? 80.9462;
  try {
    const response = await axios.get<ChargerLocation[]>(BASE_URL, {
      params: {
        key: API_KEY,
        latitude: centerLat,
        longitude: centerLng,
        distance: 50,
        distanceunit: 'KM',
        maxresults: 50,
      },
      timeout: 15000,
    });

    const filtered = response.data.filter((station) => {
      const searchStr = `${station.AddressInfo.Title} ${station.AddressInfo.AddressLine1} ${station.AddressInfo.Town} ${station.AddressInfo.StateOrProvince}`.toLowerCase();
      return searchStr.includes(query.toLowerCase());
    });

    return filtered.map(transformCharger);
  } catch (error) {
    console.error('OpenChargeMap search error:', error);
    return [];
  }
}

/**
 * Transform OpenChargeMap API response to our app format
 */
function transformCharger(station: ChargerLocation): TransformedCharger {
  return {
    id: station.UUID || `OCM_${station.ID}`,
    name: station.AddressInfo.Title || `Charging Station ${station.ID}`,
    address: station.AddressInfo.AddressLine1 || 'Address not available',
    city: station.AddressInfo.Town || 'Lucknow',
    state: station.AddressInfo.StateOrProvince || 'Uttar Pradesh',
    latitude: station.AddressInfo.Latitude,
    longitude: station.AddressInfo.Longitude,
    distance: Math.round(station.AddressInfo.Distance * 10) / 10,
    connectors: (station.Connections || []).map((conn) => ({
      type: conn.ConnectionType?.Title || 'Unknown',
      powerKw: conn.PowerKW || 0,
      status: conn.StatusType?.Title || 'Unknown',
      currentType: conn.CurrentType?.Title || 'Unknown',
      isFastCharge: conn.Level?.IsFastChargeCapable || false,
    })),
    numberOfPoints: station.NumberOfPoints || 0,
    isOperational: station.StatusType?.IsOperational ?? true,
    operator: station.OperatorInfo?.Title || 'Unknown Operator',
    operatorWebsite: station.OperatorInfo?.WebsiteURL || '',
    usageType: station.UsageType?.Title || 'Unknown',
  };
}

/**
 * Get charging stations filtered by connector type
 */
export async function getStationsByConnectorType(
  connectorType: 'CCS' | 'CHAdeMO' | 'Type 2' | 'All' = 'All'
): Promise<TransformedCharger[]> {
  const stations = await getChargingStations();
  
  if (connectorType === 'All') {
    return stations;
  }

  return stations.filter((station) =>
    station.connectors.some((conn) => conn.type.includes(connectorType))
  );
}
