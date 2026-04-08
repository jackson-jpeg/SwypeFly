import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createPersistStorage } from '../utils/storage';

// ─── Types ────────────────────────────────────────────────────────────

export type BookingStatus = 'confirmed' | 'completed' | 'cancelled';

export interface BookingEntry {
  id: string;
  destinationName: string;
  destinationImage: string;
  origin: string;
  departureDate: string;
  returnDate: string;
  passengers: number;
  totalPrice: number;
  currency: string;
  bookingReference: string;
  airline: string;
  bookedAt: string; // ISO string
  status: BookingStatus;
}

interface BookingHistoryState {
  bookings: BookingEntry[];
  addBooking: (booking: BookingEntry) => void;
  removeBooking: (id: string) => void;
  clearHistory: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────

export const useBookingHistoryStore = create<BookingHistoryState>()(
  persist(
    (set, get) => ({
      bookings: [],

      addBooking: (booking) => {
        const { bookings } = get();
        // Prevent duplicates by booking reference
        if (bookings.some((b) => b.id === booking.id)) return;
        set({ bookings: [booking, ...bookings] });
      },

      removeBooking: (id) => {
        set({ bookings: get().bookings.filter((b) => b.id !== id) });
      },

      clearHistory: () => set({ bookings: [] }),
    }),
    {
      name: 'sogojet-booking-history',
      storage: createPersistStorage(),
    },
  ),
);
