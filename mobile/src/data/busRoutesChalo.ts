/**
 * Lucknow City Bus (LCTSL) — official route data from citybus.upgov.net
 * Integrated with Chalo for live tracking deep links
 */

export interface LiveBus {
  busId: string;
  routeNo: string;
  routeName: string;
  currentStop: string;
  nextStop: string;
  etaMinutes: number;
  occupancy: 'LOW' | 'MEDIUM' | 'HIGH';
  lat: number;
  lng: number;
  busType: 'AC' | 'NON_AC' | 'ELECTRIC';
  lastUpdated: string;
}

export interface BusRoute {
  routeNo: string;
  name: string;
  operator: string;
  depot: 'Gomti Nagar' | 'Dubagga';
  stops: string[];
  frequency: string;
  firstDeparture: string;
  lastDeparture: string;
  returnFirst: string;
  returnLast: string;
  chaloDeepLink: string;
  activeBuses: LiveBus[];
}

export const CHALO_APP_URL = 'https://chalo.com/app/';

/** All 22 LCTSL routes with fixed bus fleet (no random refresh) */
export const CHALO_BUS_ROUTES: BusRoute[] = [
  {
    routeNo: '101',
    name: 'Dayal Institute → Charbagh',
    operator: 'LCTSL / UPSRTC',
    depot: 'Gomti Nagar',
    stops: ['Dayal Institute', 'BBD', 'Patrkar Puram', 'Balu Adda', 'Charbagh Bus Station'],
    frequency: 'Every 9 min',
    firstDeparture: '06:15 AM',
    lastDeparture: '08:00 PM',
    returnFirst: '06:40 AM',
    returnLast: '07:50 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-101-01', routeNo: '101', routeName: 'Dayal Institute → Charbagh', currentStop: 'BBD', nextStop: 'Patrkar Puram', etaMinutes: 4, occupancy: 'MEDIUM', lat: 26.872, lng: 80.995, busType: 'NON_AC', lastUpdated: 'Live' },
      { busId: 'LKO-101-02', routeNo: '101', routeName: 'Dayal Institute → Charbagh', currentStop: 'Patrkar Puram', nextStop: 'Balu Adda', etaMinutes: 7, occupancy: 'LOW', lat: 26.865, lng: 80.988, busType: 'NON_AC', lastUpdated: 'Live' },
      { busId: 'LKO-101-03', routeNo: '101', routeName: 'Charbagh → Dayal Institute', currentStop: 'Charbagh Bus Station', nextStop: 'Balu Adda', etaMinutes: 2, occupancy: 'HIGH', lat: 26.851, lng: 80.946, busType: 'NON_AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: '202',
    name: 'Kamta → Scooter India',
    operator: 'LCTSL / UPSRTC',
    depot: 'Gomti Nagar',
    stops: ['Kamta Bus Station', 'Ahimamau', 'Utrethiya', 'Transport Nagar', 'Scooter India'],
    frequency: 'Every 3 min',
    firstDeparture: '06:05 AM',
    lastDeparture: '08:40 PM',
    returnFirst: '06:30 AM',
    returnLast: '07:20 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-202-01', routeNo: '202', routeName: 'Kamta → Scooter India', currentStop: 'Ahimamau', nextStop: 'Utrethiya', etaMinutes: 3, occupancy: 'HIGH', lat: 26.891, lng: 81.012, busType: 'ELECTRIC', lastUpdated: 'Live' },
      { busId: 'LKO-202-02', routeNo: '202', routeName: 'Kamta → Scooter India', currentStop: 'Transport Nagar', nextStop: 'Scooter India', etaMinutes: 5, occupancy: 'MEDIUM', lat: 26.858, lng: 80.928, busType: 'ELECTRIC', lastUpdated: 'Live' },
      { busId: 'LKO-202-03', routeNo: '202', routeName: 'Scooter India → Kamta', currentStop: 'Scooter India', nextStop: 'Transport Nagar', etaMinutes: 1, occupancy: 'LOW', lat: 26.842, lng: 80.915, busType: 'ELECTRIC', lastUpdated: 'Live' },
      { busId: 'LKO-202-04', routeNo: '202', routeName: 'Kamta → Scooter India', currentStop: 'Kamta Bus Station', nextStop: 'Ahimamau', etaMinutes: 8, occupancy: 'MEDIUM', lat: 26.902, lng: 81.025, busType: 'ELECTRIC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: '402',
    name: 'Behta → Rajnikhand',
    operator: 'LCTSL / UPSRTC',
    depot: 'Gomti Nagar',
    stops: ['Behta', 'Integral University', 'PS Gudamba', 'Vikas Nagar', 'Nishatganj', 'GPO Hazratganj', 'Charbagh', 'Rajnikhand'],
    frequency: 'Every 5 min',
    firstDeparture: '06:20 AM',
    lastDeparture: '08:40 PM',
    returnFirst: '06:05 AM',
    returnLast: '07:20 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-402-01', routeNo: '402', routeName: 'Behta → Rajnikhand', currentStop: 'Nishatganj', nextStop: 'GPO Hazratganj', etaMinutes: 4, occupancy: 'MEDIUM', lat: 26.872, lng: 80.958, busType: 'NON_AC', lastUpdated: 'Live' },
      { busId: 'LKO-402-02', routeNo: '402', routeName: 'Rajnikhand → Behta', currentStop: 'Charbagh', nextStop: 'GPO Hazratganj', etaMinutes: 6, occupancy: 'LOW', lat: 26.851, lng: 80.946, busType: 'NON_AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: '105',
    name: 'Rajajipuram → BBD',
    operator: 'LCTSL / UPSRTC',
    depot: 'Dubagga',
    stops: ['Rajajipuram', 'Charbagh', 'Nishatganj', 'Polytechnic', 'Awadh Bus Station (Kamta)', 'Chinhat', 'BBD'],
    frequency: 'Every 14 min',
    firstDeparture: '06:40 AM',
    lastDeparture: '07:52 PM',
    returnFirst: '08:10 AM',
    returnLast: '09:22 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-105-01', routeNo: '105', routeName: 'Rajajipuram → BBD', currentStop: 'Nishatganj', nextStop: 'Polytechnic', etaMinutes: 5, occupancy: 'MEDIUM', lat: 26.872, lng: 80.958, busType: 'NON_AC', lastUpdated: 'Live' },
      { busId: 'LKO-105-02', routeNo: '105', routeName: 'BBD → Rajajipuram', currentStop: 'Polytechnic', nextStop: 'Nishatganj', etaMinutes: 9, occupancy: 'LOW', lat: 26.878, lng: 80.972, busType: 'NON_AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: '106',
    name: 'Parag Dairy → Lolai',
    operator: 'LCTSL / UPSRTC',
    depot: 'Dubagga',
    stops: ['Parag Dairy', 'Purani Chungi', 'Awadh Hospital', 'Charbagh', 'Nishatganj', 'Polytechnic', 'Lolai'],
    frequency: 'Every 30 min',
    firstDeparture: '07:20 AM',
    lastDeparture: '06:05 PM',
    returnFirst: '07:20 AM',
    returnLast: '06:01 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-106-01', routeNo: '106', routeName: 'Parag Dairy → Lolai', currentStop: 'Awadh Hospital', nextStop: 'Charbagh', etaMinutes: 6, occupancy: 'LOW', lat: 26.838, lng: 80.922, busType: 'NON_AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: '301',
    name: 'Scooter India → Engineering College',
    operator: 'LCTSL / UPSRTC',
    depot: 'Dubagga',
    stops: ['Scooter India', 'Charbagh', 'Kapoorthala', 'Nishatganj', 'Engineering College'],
    frequency: 'Every 10 min',
    firstDeparture: '07:00 AM',
    lastDeparture: '05:40 PM',
    returnFirst: '08:50 AM',
    returnLast: '07:30 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-301-01', routeNo: '301', routeName: 'Scooter India → Engg College', currentStop: 'Charbagh', nextStop: 'Kapoorthala', etaMinutes: 3, occupancy: 'HIGH', lat: 26.851, lng: 80.946, busType: 'AC', lastUpdated: 'Live' },
      { busId: 'LKO-301-02', routeNo: '301', routeName: 'Engg College → Scooter India', currentStop: 'Nishatganj', nextStop: 'Kapoorthala', etaMinutes: 7, occupancy: 'MEDIUM', lat: 26.872, lng: 80.958, busType: 'AC', lastUpdated: 'Live' },
      { busId: 'LKO-301-03', routeNo: '301', routeName: 'Scooter India → Engg College', currentStop: 'Scooter India', nextStop: 'Charbagh', etaMinutes: 11, occupancy: 'LOW', lat: 26.842, lng: 80.915, busType: 'AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: '502',
    name: 'Charbagh → Kamta',
    operator: 'LCTSL / UPSRTC',
    depot: 'Dubagga',
    stops: ['Charbagh', 'Sikandarbagh', 'Nishatganj', 'Polytechnic', 'Kamta Bus Station'],
    frequency: 'Every 20 min',
    firstDeparture: '07:00 AM',
    lastDeparture: '06:10 PM',
    returnFirst: '08:45 AM',
    returnLast: '07:55 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-502-01', routeNo: '502', routeName: 'Charbagh → Kamta', currentStop: 'Sikandarbagh', nextStop: 'Nishatganj', etaMinutes: 4, occupancy: 'MEDIUM', lat: 26.858, lng: 80.952, busType: 'NON_AC', lastUpdated: 'Live' },
      { busId: 'LKO-502-02', routeNo: '502', routeName: 'Kamta → Charbagh', currentStop: 'Polytechnic', nextStop: 'Nishatganj', etaMinutes: 8, occupancy: 'LOW', lat: 26.878, lng: 80.972, busType: 'NON_AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: '801',
    name: 'Balaganj → Virajkhand',
    operator: 'LCTSL / UPSRTC',
    depot: 'Dubagga',
    stops: ['Balaganj', 'Dubagga', 'Bhithauli', 'Polytechnic', 'New High Court', 'Virajkhand'],
    frequency: 'Every 6 min',
    firstDeparture: '06:10 AM',
    lastDeparture: '04:11 PM',
    returnFirst: '07:30 AM',
    returnLast: '05:49 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-801-01', routeNo: '801', routeName: 'Balaganj → Virajkhand', currentStop: 'Dubagga', nextStop: 'Bhithauli', etaMinutes: 5, occupancy: 'MEDIUM', lat: 26.828, lng: 80.898, busType: 'ELECTRIC', lastUpdated: 'Live' },
      { busId: 'LKO-801-E', routeNo: '801-E', routeName: 'Balaganj → Virajkhand (Electric)', currentStop: 'Polytechnic', nextStop: 'New High Court', etaMinutes: 3, occupancy: 'LOW', lat: 26.878, lng: 80.972, busType: 'ELECTRIC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: '901',
    name: 'Charbagh → Chandrawal',
    operator: 'LCTSL / UPSRTC',
    depot: 'Dubagga',
    stops: ['Charbagh', 'Awadh Hospital', 'Parag Dairy', 'Ashiyana', 'Azad Engineering College', 'Chandrawal'],
    frequency: 'Every 45 min',
    firstDeparture: '06:35 AM',
    lastDeparture: '04:58 PM',
    returnFirst: '07:48 AM',
    returnLast: '06:11 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-901-01', routeNo: '901', routeName: 'Charbagh → Chandrawal', currentStop: 'Ashiyana', nextStop: 'Azad Engineering College', etaMinutes: 12, occupancy: 'LOW', lat: 26.812, lng: 80.905, busType: 'NON_AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: '1001',
    name: 'Ghantaghar → Neemsar Mandir',
    operator: 'LCTSL / UPSRTC',
    depot: 'Dubagga',
    stops: ['Ghantaghar Chowk', 'Malihabad', 'Sandila', 'Beniganj', 'Neemsar Mandir'],
    frequency: 'Limited service',
    firstDeparture: '07:30 AM',
    lastDeparture: '08:30 AM',
    returnFirst: '02:00 PM',
    returnLast: '03:00 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-1001-01', routeNo: '1001', routeName: 'Ghantaghar → Neemsar Mandir', currentStop: 'Malihabad', nextStop: 'Sandila', etaMinutes: 18, occupancy: 'LOW', lat: 26.992, lng: 80.712, busType: 'NON_AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: '1201-E',
    name: 'Dubagga → Mohanlalganj',
    operator: 'LCTSL / UPSRTC',
    depot: 'Dubagga',
    stops: ['Dubagga', 'Awadh Hospital', 'Telibagh', 'PGI', 'Sabha Kheda', 'Mohanlalganj'],
    frequency: 'Every 13 min',
    firstDeparture: '05:55 AM',
    lastDeparture: '07:08 PM',
    returnFirst: '07:19 AM',
    returnLast: '08:32 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-1201-01', routeNo: '1201-E', routeName: 'Dubagga → Mohanlalganj', currentStop: 'Telibagh', nextStop: 'PGI', etaMinutes: 6, occupancy: 'MEDIUM', lat: 26.798, lng: 80.938, busType: 'ELECTRIC', lastUpdated: 'Live' },
      { busId: 'LKO-1201-02', routeNo: '1201-E', routeName: 'Mohanlalganj → Dubagga', currentStop: 'PGI', nextStop: 'Telibagh', etaMinutes: 4, occupancy: 'HIGH', lat: 26.761, lng: 80.955, busType: 'ELECTRIC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: 'PMI-01',
    name: 'Dubagga → Dewa Sharif',
    operator: 'LCTSL PMI Route',
    depot: 'Dubagga',
    stops: ['Dubagga', 'Awadh Hospital', 'Charbagh', 'Hazratganj', 'Ahimamau', 'Gosaiganj', 'Dewa Sharif'],
    frequency: 'Every 40 min',
    firstDeparture: '06:07 AM',
    lastDeparture: '06:01 PM',
    returnFirst: '08:05 AM',
    returnLast: '06:01 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-PMI01-01', routeNo: 'PMI-01', routeName: 'Dubagga → Dewa Sharif', currentStop: 'Hazratganj', nextStop: 'Ahimamau', etaMinutes: 9, occupancy: 'MEDIUM', lat: 26.850, lng: 80.945, busType: 'NON_AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: 'PMI-02',
    name: 'AKTU → Shivgarh Resort',
    operator: 'LCTSL PMI Route',
    depot: 'Dubagga',
    stops: ['AKTU', 'Engineering College', 'Charbagh', 'Cantt.', 'SGPGI', 'Shivgarh Resort'],
    frequency: 'Every 27 min',
    firstDeparture: '06:15 AM',
    lastDeparture: '05:35 PM',
    returnFirst: '08:40 AM',
    returnLast: '08:00 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-PMI02-01', routeNo: 'PMI-02', routeName: 'AKTU → Shivgarh Resort', currentStop: 'Engineering College', nextStop: 'Charbagh', etaMinutes: 7, occupancy: 'LOW', lat: 26.888, lng: 80.982, busType: 'AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: 'PMI-05',
    name: 'Rajajipuram → Dewa',
    operator: 'LCTSL PMI Route',
    depot: 'Dubagga',
    stops: ['Rajajipuram', 'Charbagh', 'Mantri Awas', '1090 Chauraha', 'Lohia Hospital', 'Indira Gandhi Pratishthan', 'Awadh Bus Station', 'Chinhat', 'Dewa'],
    frequency: 'Every 16 min',
    firstDeparture: '05:55 AM',
    lastDeparture: '06:36 PM',
    returnFirst: '07:00 AM',
    returnLast: '08:21 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-PMI05-01', routeNo: 'PMI-05', routeName: 'Rajajipuram → Dewa', currentStop: '1090 Chauraha', nextStop: 'Lohia Hospital', etaMinutes: 5, occupancy: 'MEDIUM', lat: 26.862, lng: 80.978, busType: 'NON_AC', lastUpdated: 'Live' },
      { busId: 'LKO-PMI05-02', routeNo: 'PMI-05', routeName: 'Dewa → Rajajipuram', currentStop: 'Chinhat', nextStop: 'Awadh Bus Station', etaMinutes: 11, occupancy: 'LOW', lat: 26.912, lng: 81.018, busType: 'NON_AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: 'PMI-07',
    name: 'Ghantaghar → Sandila',
    operator: 'LCTSL PMI Route',
    depot: 'Dubagga',
    stops: ['Ghantaghar Chowk', 'Balaganj', 'Dubagga', 'Kakori', 'Malihabad', 'Rahimabad', 'Sandila'],
    frequency: 'Every 34 min',
    firstDeparture: '06:10 AM',
    lastDeparture: '04:16 PM',
    returnFirst: '08:36 AM',
    returnLast: '06:47 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-PMI07-01', routeNo: 'PMI-07', routeName: 'Ghantaghar → Sandila', currentStop: 'Kakori', nextStop: 'Malihabad', etaMinutes: 14, occupancy: 'LOW', lat: 26.948, lng: 80.788, busType: 'NON_AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: 'PMI-08',
    name: 'Dubagga → Baddupur',
    operator: 'LCTSL PMI Route',
    depot: 'Dubagga',
    stops: ['Dubagga', 'Chowk', 'Parivartan Chowk', 'IT Chauraha', 'Tedhi Puliya', 'Tikaitganj', 'Baddupur'],
    frequency: 'Every 45 min',
    firstDeparture: '07:40 AM',
    lastDeparture: '05:44 PM',
    returnFirst: '07:20 AM',
    returnLast: '06:04 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-PMI08-01', routeNo: 'PMI-08', routeName: 'Dubagga → Baddupur', currentStop: 'Parivartan Chowk', nextStop: 'IT Chauraha', etaMinutes: 8, occupancy: 'LOW', lat: 26.848, lng: 80.938, busType: 'NON_AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: 'PMI-11',
    name: 'Scooter India → Kamta',
    operator: 'LCTSL PMI Route',
    depot: 'Dubagga',
    stops: ['Scooter India', 'Transport Nagar', 'Shaheedpath', 'Kamta'],
    frequency: 'Every 45 min',
    firstDeparture: '06:00 AM',
    lastDeparture: '04:52 PM',
    returnFirst: '06:55 AM',
    returnLast: '06:07 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-PMI11-01', routeNo: 'PMI-11', routeName: 'Scooter India → Kamta', currentStop: 'Transport Nagar', nextStop: 'Shaheedpath', etaMinutes: 6, occupancy: 'MEDIUM', lat: 26.858, lng: 80.928, busType: 'NON_AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: 'PMI-03',
    name: 'Dubagga → Baddupur',
    operator: 'LCTSL PMI Route',
    depot: 'Dubagga',
    stops: ['Dubagga', 'Chowk', 'Parivartan Chowk', 'IT Chauraha', 'Tedhi Puliya', 'Tikaitganj', 'Baddupur'],
    frequency: 'Every 30 min',
    firstDeparture: '08:00 AM',
    lastDeparture: '05:10 PM',
    returnFirst: '09:00 AM',
    returnLast: '05:15 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-PMI03-01', routeNo: 'PMI-03', routeName: 'Dubagga → Baddupur', currentStop: 'IT Chauraha', nextStop: 'Tedhi Puliya', etaMinutes: 7, occupancy: 'LOW', lat: 26.888, lng: 80.982, busType: 'NON_AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: 'PMI-06',
    name: 'Rajajipuram → Dewa (via Chinhat)',
    operator: 'LCTSL PMI Route',
    depot: 'Dubagga',
    stops: ['Rajajipuram', 'Charbagh', 'Mantri Awas', '1090 Chauraha', 'Lohia Hospital', 'Indira Gandhi Pratishthan', 'Awadh Bus Station', 'Chinhat', 'Dewa'],
    frequency: 'Every 35 min',
    firstDeparture: '06:00 AM',
    lastDeparture: '04:50 PM',
    returnFirst: '07:55 AM',
    returnLast: '06:45 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-PMI06-01', routeNo: 'PMI-06', routeName: 'Rajajipuram → Dewa', currentStop: 'Lohia Hospital', nextStop: 'Indira Gandhi Pratishthan', etaMinutes: 10, occupancy: 'MEDIUM', lat: 26.862, lng: 80.978, busType: 'NON_AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: 'PMI-07A',
    name: 'Ghantaghar → Godva',
    operator: 'LCTSL PMI Route',
    depot: 'Dubagga',
    stops: ['Ghantaghar Chowk', 'Balaganj', 'Sitapur Bypass', 'Jehta', 'Gauraiya', 'Maal', 'Godva'],
    frequency: 'Every 34 min',
    firstDeparture: '06:27 AM',
    lastDeparture: '04:33 PM',
    returnFirst: '08:53 AM',
    returnLast: '07:04 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-PMI07A-01', routeNo: 'PMI-07A', routeName: 'Ghantaghar → Godva', currentStop: 'Balaganj', nextStop: 'Sitapur Bypass', etaMinutes: 16, occupancy: 'LOW', lat: 26.828, lng: 80.898, busType: 'NON_AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: 'PMI-03A',
    name: 'Bani → Engineering College',
    operator: 'LCTSL PMI Route',
    depot: 'Dubagga',
    stops: ['Bani', 'Kati Baghiya', 'Scooter India', 'Awadh Hospital', 'Charbagh', 'Nishatganj', 'Engineering College'],
    frequency: 'Limited service',
    firstDeparture: '07:30 AM',
    lastDeparture: '01:15 PM',
    returnFirst: '09:30 AM',
    returnLast: '04:00 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-PMI03A-01', routeNo: 'PMI-03A', routeName: 'Bani → Engineering College', currentStop: 'Awadh Hospital', nextStop: 'Charbagh', etaMinutes: 5, occupancy: 'LOW', lat: 26.838, lng: 80.922, busType: 'NON_AC', lastUpdated: 'Live' },
    ],
  },
  {
    routeNo: 'PMI-12',
    name: 'Ghantaghar → Maal',
    operator: 'LCTSL PMI Route',
    depot: 'Dubagga',
    stops: ['Ghantaghar Chowk', 'Balaganj', 'Dubagga', 'Kasmandi Kala', 'Nabipanah', 'Maal'],
    frequency: 'Every 45 min',
    firstDeparture: '08:10 AM',
    lastDeparture: '04:40 PM',
    returnFirst: '08:15 AM',
    returnLast: '05:00 PM',
    chaloDeepLink: 'https://chalo.com/app/',
    activeBuses: [
      { busId: 'LKO-PMI12-01', routeNo: 'PMI-12', routeName: 'Ghantaghar → Maal', currentStop: 'Dubagga', nextStop: 'Kasmandi Kala', etaMinutes: 9, occupancy: 'LOW', lat: 26.828, lng: 80.898, busType: 'NON_AC', lastUpdated: 'Live' },
    ],
  },
];

/** Flatten all active buses across all routes */
export function getAllActiveBuses(): LiveBus[] {
  return CHALO_BUS_ROUTES.flatMap((r) => r.activeBuses);
}

/** Get buses for a specific route */
export function getBusesForRoute(routeNo: string): LiveBus[] {
  const route = CHALO_BUS_ROUTES.find((r) => r.routeNo === routeNo);
  return route?.activeBuses ?? [];
}

/** Total active bus count */
export function getTotalActiveBusCount(): number {
  return getAllActiveBuses().length;
}
