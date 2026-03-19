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

  // Trip context (set before entering booking flow)
  departureDate: string | null;
  returnDate: string | null;
  origin: string | null;
  destination: string | null;
  destinationCity: string | null;
  feedPrice: number | null; // Travelpayouts price from feed (for transparency)

  setOfferId: (id: string) => void;
  setPassengers: (passengers: Passenger[]) => void;
  setSeats: (seats: SelectedSeat[]) => void;
  setServices: (services: SelectedService[]) => void;
  setDates: (dep: string, ret: string) => void;
  setTripContext: (
    origin: string,
    destination: string,
    city: string,
    feedPrice: number | null,
  ) => void;
  reset: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────

export const useBookingFlowStore = create<BookingFlowState>()((set) => ({
  selectedOfferId: null,
  passengers: [],
  selectedSeats: [],
  selectedServices: [],
  departureDate: null,
  returnDate: null,
  origin: null,
  destination: null,
  destinationCity: null,
  feedPrice: null,

  setOfferId: (id) => set({ selectedOfferId: id }),
  setPassengers: (passengers) => set({ passengers }),
  setSeats: (seats) => set({ selectedSeats: seats }),
  setServices: (services) => set({ selectedServices: services }),
  setDates: (dep, ret) => set({ departureDate: dep, returnDate: ret }),
  setTripContext: (origin, destination, city, feedPrice) =>
    set({ origin, destination, destinationCity: city, feedPrice }),
  reset: () =>
    set({
      selectedOfferId: null,
      passengers: [],
      selectedSeats: [],
      selectedServices: [],
      departureDate: null,
      returnDate: null,
      origin: null,
      destination: null,
      destinationCity: null,
      feedPrice: null,
    }),
}));
