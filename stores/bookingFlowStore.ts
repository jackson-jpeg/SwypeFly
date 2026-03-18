import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────

export interface Passenger {
  givenName: string;
  familyName: string;
  bornOn: string;
  gender: 'm' | 'f';
  title: 'mr' | 'ms' | 'mrs' | 'miss' | 'dr';
  email: string;
  phoneNumber: string;
}

export interface SelectedSeat {
  designator: string; // e.g. "14A"
  price: number;
  currency: string;
  serviceId?: string; // Duffel service ID for seat
}

export interface SelectedService {
  id: string;
  type: string;
  name: string;
  amount: number;
  currency: string;
}

interface BookingFlowState {
  selectedOfferId: string | null;
  passengers: Passenger[];
  selectedSeats: SelectedSeat[];
  selectedServices: SelectedService[];

  setOfferId: (id: string) => void;
  setPassengers: (passengers: Passenger[]) => void;
  setSeats: (seats: SelectedSeat[]) => void;
  setServices: (services: SelectedService[]) => void;
  reset: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────

export const useBookingFlowStore = create<BookingFlowState>()((set) => ({
  selectedOfferId: null,
  passengers: [],
  selectedSeats: [],
  selectedServices: [],

  setOfferId: (id) => set({ selectedOfferId: id }),
  setPassengers: (passengers) => set({ passengers }),
  setSeats: (seats) => set({ selectedSeats: seats }),
  setServices: (services) => set({ selectedServices: services }),
  reset: () =>
    set({
      selectedOfferId: null,
      passengers: [],
      selectedSeats: [],
      selectedServices: [],
    }),
}));
