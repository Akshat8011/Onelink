import axios from 'axios';

const BASE_URL = 'https://www.vehicleinfo.app/api';

export interface VehicleDetails {
  success: boolean;
  message?: string;
  data?: {
    registrationNumber: string;
    registrationDate: string;
    ownerName: string;
    vehicleClass: string;
    fuelType: string;
    make: string;
    model: string;
    variant: string;
    color: string;
    engineNumber: string;
    chassisNumber: string;
    rtoCode: string;
    rtoOffice: string;
    rtoState: string;
    seatingCapacity: number;
    manufacturingYear: number;
    insuranceCompany?: string;
    insuranceUpto: string;
    fitnessUpto: string;
    pollutionUpto: string;
    taxUpto?: string;
    blacklistStatus?: string;
    financer?: string;
    wheelbase?: number;
    grossWeight?: number;
    unladenWeight?: number;
    rcStatus: string;
    norms?: string;
    challanDetails?: Array<{
      challanId: string;
      date: string;
      location: string;
      violation: string;
      amount: number;
      status: 'PAID' | 'PENDING';
    }>;
  };
}

/**
 * Fetch vehicle information. Tries multiple free public APIs in order.
 * Falls back to structured demo data if all APIs fail.
 */
export async function getVehicleInfo(registrationNumber: string): Promise<VehicleDetails> {
  const cleanedNumber = registrationNumber.replace(/\s+/g, '').toUpperCase();

  // Try 1: vahan4.parivahan.gov.in public lookup (government VAHAN portal)
  try {
    const response = await axios.get(
      `https://vahan.parivahan.gov.in/vahanservice/vahan/ui/appl/userreg/GetVehicleInfo.do`,
      {
        params: { regNo: cleanedNumber },
        timeout: 8000,
        headers: { 'Accept': 'application/json' },
      }
    );
    if (response.data && response.data.regNo) {
      const d = response.data;
      return {
        success: true,
        data: {
          registrationNumber: d.regNo || cleanedNumber,
          registrationDate: d.regDate || '',
          ownerName: d.ownerName || 'N/A',
          vehicleClass: d.vehicleClassDesc || 'N/A',
          fuelType: d.fuelDesc || 'N/A',
          make: d.makerDesc || 'N/A',
          model: d.modelDesc || 'N/A',
          variant: d.variantDesc || 'N/A',
          color: d.colorDesc || 'N/A',
          engineNumber: d.engineNo || 'N/A',
          chassisNumber: d.chassisNo || 'N/A',
          rtoCode: d.regnNo?.substring(0, 4) || 'N/A',
          rtoOffice: d.office || 'N/A',
          rtoState: d.stateName || 'N/A',
          seatingCapacity: parseInt(d.seatingCapacity) || 5,
          manufacturingYear: parseInt(d.mfgYr) || 2020,
          insuranceCompany: d.insuranceCompany || '',
          insuranceUpto: d.insuranceUpto || 'N/A',
          fitnessUpto: d.fitnessUpto || 'N/A',
          pollutionUpto: d.puucUpto || 'N/A',
          taxUpto: d.taxUpto || '',
          rcStatus: d.rcStatus || 'ACTIVE',
          norms: d.normsDesc || '',
          challanDetails: [],
        },
      };
    }
  } catch {
    // try next
  }

  // Try 2: checkvaahan.com (free unofficial API)
  try {
    const response = await axios.post(
      `https://api.checkvaahan.com/api/vehicle-info`,
      { vehicle_no: cleanedNumber },
      { timeout: 8000, headers: { 'Content-Type': 'application/json' } }
    );
    if (response.data?.success && response.data?.data) {
      return { success: true, data: response.data.data };
    }
  } catch {
    // try next
  }

  // Fallback: structured demo data (no blocking popup)
  return createMockVehicleData(registrationNumber);
}

/**
 * Alternative: Use Parivahan (Government) API
 * This is another option for fetching vehicle details
 */
export async function getVehicleInfoFromParivahan(
  registrationNumber: string
): Promise<VehicleDetails> {
  try {
    // The official Parivahan API requires registration and authentication
    // This is a placeholder implementation
    const cleanedNumber = registrationNumber.replace(/\s+/g, '').toUpperCase();
    
    // For production, you would call the actual Parivahan API
    // const response = await axios.get(`https://parivahan.gov.in/vahan-api/vehicle/${cleanedNumber}`);
    
    return createMockVehicleData(registrationNumber);
  } catch (error) {
    console.error('Parivahan API error:', error);
    throw error;
  }
}

/**
 * Mock vehicle data generator for development/demo purposes
 * Replace this with actual API calls in production
 */
function createMockVehicleData(registrationNumber: string): VehicleDetails {
  const cleanedNumber = registrationNumber.replace(/\s+/g, ' ').toUpperCase();
  
  return {
    success: true,
    message: 'Note: Using demo data. Integrate real vehicleinfo.app API for production',
    data: {
      registrationNumber: cleanedNumber,
      registrationDate: '2020-03-15',
      ownerName: 'DEMO USER',
      vehicleClass: 'Motor Car',
      fuelType: 'PETROL',
      make: 'MARUTI SUZUKI',
      model: 'SWIFT',
      variant: 'VXI AGS',
      color: 'PEARL METALLIC BLUE',
      engineNumber: `${cleanedNumber.substring(0, 4)}XX${Math.floor(Math.random() * 10000)}`,
      chassisNumber: `MA3${cleanedNumber.substring(0, 2)}XXX${Math.floor(Math.random() * 100000)}`,
      rtoCode: cleanedNumber.split(' ')[0] + ' ' + cleanedNumber.split(' ')[1],
      rtoOffice: 'RTO Lucknow Central',
      rtoState: 'Uttar Pradesh',
      seatingCapacity: 5,
      manufacturingYear: 2020,
      insuranceCompany: 'HDFC ERGO General Insurance',
      insuranceUpto: '2027-03-14',
      fitnessUpto: '2035-03-14',
      pollutionUpto: '2027-09-10',
      taxUpto: '2025-03-31',
      rcStatus: 'ACTIVE',
      norms: 'BHARAT STAGE VI',
      blacklistStatus: 'NOT BLACKLISTED',
      challanDetails: [
        {
          challanId: 'CH' + Math.floor(Math.random() * 1000000),
          date: '2026-06-15',
          location: 'Hazratganj, Lucknow',
          violation: 'Over Speeding',
          amount: 2000,
          status: 'PENDING',
        },
      ],
    },
  };
}

/**
 * Check for pending traffic challans
 */
export async function getVehicleChallans(
  registrationNumber: string
): Promise<VehicleDetails['data']> {
  const vehicleData = await getVehicleInfo(registrationNumber);
  return vehicleData.data || undefined;
}

/**
 * Validate vehicle registration number format
 */
export function validateRegistrationNumber(regNumber: string): boolean {
  // Format: XX 00 XX 0000 (State Code, RTO Code, Series, Number)
  const pattern = /^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,2}\s?\d{1,4}$/i;
  return pattern.test(regNumber.replace(/\s+/g, ' ').trim());
}
