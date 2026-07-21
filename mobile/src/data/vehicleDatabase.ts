export interface VehicleChallan {
  challanId: string;
  date: string;
  violation: string;
  amount: number;
  status: 'PAID' | 'PENDING';
  location: string;
}

export interface VehicleInfo {
  registrationNumber: string;
  ownerName: string;
  model: string;
  make: string;
  variant: string;
  fuelType: string;
  color: string;
  registrationDate: string;
  fitnessUpto: string;
  insuranceUpto: string;
  pollutionUpto: string;
  rtoOffice: string;
  chassisNumber: string;
  engineNumber: string;
  seatingCapacity: number;
  challans: VehicleChallan[];
}

const KNOWN_VEHICLES: Record<string, VehicleInfo> = {
  'UP32XX1234': {
    registrationNumber: 'UP 32 XX 1234',
    ownerName: 'AKSHAT SHARMA',
    model: 'Creta',
    make: 'Hyundai',
    variant: 'SX(O) 1.5 Diesel AT',
    fuelType: 'Diesel',
    color: 'Polar White',
    registrationDate: '2019-08-14',
    fitnessUpto: '2029-08-13',
    insuranceUpto: '2026-08-13',
    pollutionUpto: '2026-02-14',
    rtoOffice: 'RTO Lucknow (UP-32)',
    chassisNumber: 'MALBM51RLKM****89',
    engineNumber: 'D4FBJM****12',
    seatingCapacity: 5,
    challans: [
      {
        challanId: 'UP3200123456',
        date: '2025-11-03',
        violation: 'Over-speeding (72 km/h in 50 zone)',
        amount: 2000,
        status: 'PAID',
        location: 'Hazratganj, Lucknow',
      },
      {
        challanId: 'UP3200987654',
        date: '2026-01-18',
        violation: 'No parking zone',
        amount: 500,
        status: 'PENDING',
        location: 'Gomti Nagar, Lucknow',
      },
    ],
  },
  'UP32AB5678': {
    registrationNumber: 'UP 32 AB 5678',
    ownerName: 'PRIYA VERMA',
    model: 'Swift',
    make: 'Maruti Suzuki',
    variant: 'VXI 1.2 Petrol',
    fuelType: 'Petrol',
    color: 'Pearl Arctic White',
    registrationDate: '2021-03-22',
    fitnessUpto: '2031-03-21',
    insuranceUpto: '2026-03-21',
    pollutionUpto: '2026-09-22',
    rtoOffice: 'RTO Lucknow (UP-32)',
    chassisNumber: 'MBHCZCB3LMN****45',
    engineNumber: 'K12MN****78',
    seatingCapacity: 5,
    challans: [],
  },
};

const MAKES = ['Maruti Suzuki', 'Hyundai', 'Tata', 'Mahindra', 'Honda', 'Toyota', 'Kia'];
const MODELS: Record<string, string[]> = {
  'Maruti Suzuki': ['Swift', 'Baleno', 'Brezza', 'Ertiga', 'Dzire'],
  Hyundai: ['Creta', 'Venue', 'i20', 'Verna', 'Exter'],
  Tata: ['Nexon', 'Punch', 'Harrier', 'Safari', 'Tiago'],
  Mahindra: ['XUV700', 'Scorpio-N', 'Thar', 'Bolero', 'XUV300'],
  Honda: ['City', 'Amaze', 'Elevate', 'WR-V'],
  Toyota: ['Innova Crysta', 'Fortuner', 'Glanza', 'Urban Cruiser'],
  Kia: ['Seltos', 'Sonet', 'Carens', 'EV6'],
};
const FUELS = ['Petrol', 'Diesel', 'CNG', 'Electric'];
const COLORS = ['White', 'Silver', 'Black', 'Red', 'Blue', 'Grey'];

function normalizePlate(plate: string): string {
  return plate.replace(/\s+/g, '').toUpperCase();
}

function hashPlate(plate: string): number {
  let h = 0;
  for (let i = 0; i < plate.length; i++) h = (h * 31 + plate.charCodeAt(i)) % 100000;
  return h;
}

export function lookupVehicle(plateInput: string): VehicleInfo | null {
  const normalized = normalizePlate(plateInput);
  if (!/^[A-Z]{2}\d{2}[A-Z]{1,2}\d{1,4}$/.test(normalized)) return null;

  if (KNOWN_VEHICLES[normalized]) return { ...KNOWN_VEHICLES[normalized] };

  const h = hashPlate(normalized);
  const make = MAKES[h % MAKES.length];
  const model = MODELS[make][h % MODELS[make].length];
  const year = 2016 + (h % 9);
  const month = (h % 12) + 1;
  const day = (h % 28) + 1;
  const regDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const formatted = `${normalized.slice(0, 2)} ${normalized.slice(2, 4)} ${normalized.slice(4, 6)} ${normalized.slice(6)}`;

  return {
    registrationNumber: formatted,
    ownerName: 'REGISTERED OWNER',
    model,
    make,
    variant: `${model} Base`,
    fuelType: FUELS[h % FUELS.length],
    color: COLORS[h % COLORS.length],
    registrationDate: regDate,
    fitnessUpto: `${year + 15}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    insuranceUpto: `${year + 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    pollutionUpto: `${year}-${String((month + 6) % 12 || 12).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    rtoOffice: 'RTO Lucknow (UP-32)',
    chassisNumber: `CH${h}****${normalized.slice(-2)}`,
    engineNumber: `EN${h}****${normalized.slice(-2)}`,
    seatingCapacity: 5,
    challans: h % 3 === 0
      ? [{
          challanId: `UP32${h}`,
          date: '2026-02-10',
          violation: 'Signal jump',
          amount: 1000,
          status: 'PENDING',
          location: 'Charbagh Crossing, Lucknow',
        }]
      : [],
  };
}

export function formatPlateDisplay(plate: string): string {
  const n = normalizePlate(plate);
  if (n.length < 8) return plate.toUpperCase();
  return `${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 6)} ${n.slice(6)}`;
}
