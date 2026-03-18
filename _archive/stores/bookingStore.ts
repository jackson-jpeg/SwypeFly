// ─── Booking Flow Store ─────────────────────────────────────────────────────
// Transient state for in-progress booking flow. NOT persisted — Duffel offers expire.

import { create } from 'zustand';

export interface BookingPassenger {
  id: string;
  given_name: string;
  family_name: string;
  born_on: string;
  gender: 'f' | 'm';
  title: 'mr' | 'mrs' | 'ms' | 'miss' | 'dr';
  email: string;
  phone_number: string;
}

export interface BookingState {
  // Destination context
  destinationId: string | null;
  destinationName: string | null;
  destinationImage: string | null;

  // Flight selection
  selectedOffer: Record<string, unknown> | null;
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';

  // Passengers
  passengers: BookingPassenger[];

  // Seat selection
  selectedSeats: { passengerId: string; seatId: string; designation: string }[];

  // Extras
  baggage: { serviceId: string; quantity: number }[];
  insurance: boolean;
  meal: string | null;

  // Payment
  paymentIntentClientSecret: string | null;
  paymentIntentId: string | null;

  // Result
  bookingStatus: 'idle' | 'processing' | 'confirmed' | 'failed';
  bookingReference: string | null;
  duffelOrderId: string | null;

  // Actions
  setDestination: (id: string, name: string, image: string | null) => void;
  setOffer: (offer: Record<string, unknown>) => void;
  setCabinClass: (cabin: BookingState['cabinClass']) => void;
  addPassenger: (passenger: BookingPassenger) => void;
  updatePassenger: (id: string, data: Partial<BookingPassenger>) => void;
  removePassenger: (id: string) => void;
  selectSeat: (passengerId: string, seatId: string, designation: string) => void;
  setBaggage: (baggage: { serviceId: string; quantity: number }[]) => void;
  toggleInsurance: () => void;
  setMeal: (meal: string | null) => void;
  setPaymentIntent: (clientSecret: string, paymentIntentId: string) => void;
  setBookingResult: (
    status: BookingState['bookingStatus'],
    reference?: string,
    orderId?: string,
  ) => void;
  resetBooking: () => void;
}

const initialState = {
  destinationId: null,
  destinationName: null,
  destinationImage: null,
  selectedOffer: null,
  cabinClass: 'economy' as const,
  passengers: [],
  selectedSeats: [],
  baggage: [],
  insurance: false,
  meal: null,
  paymentIntentClientSecret: null,
  paymentIntentId: null,
  bookingStatus: 'idle' as const,
  bookingReference: null,
  duffelOrderId: null,
};

export const useBookingStore = create<BookingState>((set) => ({
  ...initialState,

  setDestination: (id, name, image) => set({ destinationId: id, destinationName: name, destinationImage: image }),
  setOffer: (offer) => set({ selectedOffer: offer }),
  setCabinClass: (cabin) => set({ cabinClass: cabin }),

  addPassenger: (passenger) =>
    set((s) => ({ passengers: [...s.passengers, passenger] })),
  updatePassenger: (id, data) =>
    set((s) => ({
      passengers: s.passengers.map((p) => (p.id === id ? { ...p, ...data } : p)),
    })),
  removePassenger: (id) =>
    set((s) => ({
      passengers: s.passengers.filter((p) => p.id !== id),
      selectedSeats: s.selectedSeats.filter((seat) => seat.passengerId !== id),
    })),

  selectSeat: (passengerId, seatId, designation) =>
    set((s) => ({
      selectedSeats: [
        ...s.selectedSeats.filter((seat) => seat.passengerId !== passengerId),
        { passengerId, seatId, designation },
      ],
    })),

  setBaggage: (baggage) => set({ baggage }),
  toggleInsurance: () => set((s) => ({ insurance: !s.insurance })),
  setMeal: (meal) => set({ meal }),

  setPaymentIntent: (clientSecret, paymentIntentId) =>
    set({ paymentIntentClientSecret: clientSecret, paymentIntentId }),

  setBookingResult: (status, reference, orderId) =>
    set({
      bookingStatus: status,
      bookingReference: reference ?? null,
      duffelOrderId: orderId ?? null,
    }),

  resetBooking: () => set(initialState),
}));
