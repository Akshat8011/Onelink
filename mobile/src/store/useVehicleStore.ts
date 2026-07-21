import { create } from 'zustand';
import { lookupVehicle, VehicleInfo, formatPlateDisplay } from '../data/vehicleDatabase';

interface VehicleStore {
  plate: string;
  vehicle: VehicleInfo | null;
  isLoading: boolean;
  error: string | null;
  search: (plate: string) => VehicleInfo | null;
  clear: () => void;
}

export const useVehicleStore = create<VehicleStore>((set) => ({
  plate: '',
  vehicle: null,
  isLoading: false,
  error: null,

  search: (plateInput) => {
    set({ isLoading: true, error: null, plate: plateInput });
    const cleaned = plateInput.replace(/\s+/g, '').toUpperCase();
    if (cleaned.length < 8) {
      set({ isLoading: false, error: 'Enter a valid registration number (e.g. UP 32 AB 1234)', vehicle: null });
      return null;
    }
    const vehicle = lookupVehicle(plateInput);
    if (!vehicle) {
      set({ isLoading: false, error: 'Invalid format. Use UP 32 XX 1234 style plates.', vehicle: null });
      return null;
    }
    set({
      isLoading: false,
      vehicle,
      plate: formatPlateDisplay(plateInput),
      error: null,
    });
    return vehicle;
  },

  clear: () => set({ plate: '', vehicle: null, error: null, isLoading: false }),
}));
