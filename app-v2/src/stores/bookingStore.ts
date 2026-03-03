import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BookingOffer, Passenger } from '@/api/types';

interface BookingState {
  // Flow state
  destinationId: string | null;
  selectedOffer: BookingOffer | null;
  passengers: Passenger[];
  selectedSeat: string | null;
  selectedBaggage: string | null;
  hasInsurance: boolean;
  selectedMeal: string | null;

  // Actions
  setDestination: (id: string) => void;
  setOffer: (offer: BookingOffer) => void;
  addPassenger: (p: Passenger) => void;
  updatePassenger: (index: number, p: Partial<Passenger>) => void;
  setSeat: (designator: string | null) => void;
  setBaggage: (id: string | null) => void;
  setInsurance: (has: boolean) => void;
  setMeal: (id: string | null) => void;
  reset: () => void;

  // Computed
  getTotal: () => number;
}

const INITIAL: Pick<
  BookingState,
  'destinationId' | 'selectedOffer' | 'passengers' | 'selectedSeat' | 'selectedBaggage' | 'hasInsurance' | 'selectedMeal'
> = {
  destinationId: null,
  selectedOffer: null,
  passengers: [],
  selectedSeat: null,
  selectedBaggage: null,
  hasInsurance: false,
  selectedMeal: null,
};

export const useBookingStore = create<BookingState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      setDestination: (id) => set({ destinationId: id }),
      setOffer: (offer) => set({ selectedOffer: offer }),
      addPassenger: (p) => set((s) => ({ passengers: [...s.passengers, p] })),
      updatePassenger: (index, p) =>
        set((s) => ({
          passengers: s.passengers.map((existing, i) => (i === index ? { ...existing, ...p } : existing)),
        })),
      setSeat: (designator) => set({ selectedSeat: designator }),
      setBaggage: (id) => set({ selectedBaggage: id }),
      setInsurance: (has) => set({ hasInsurance: has }),
      setMeal: (id) => set({ selectedMeal: id }),
      reset: () => set(INITIAL),

      getTotal: () => {
        const s = get();
        let total = s.selectedOffer?.totalAmount ?? 0;

        // Baggage
        if (s.selectedBaggage && s.selectedOffer) {
          const svc = s.selectedOffer.availableServices.find((sv) => sv.id === s.selectedBaggage);
          if (svc) total += svc.amount;
        }

        // Insurance
        if (s.hasInsurance) total += 29;

        // Meal
        if (s.selectedMeal && s.selectedOffer) {
          const svc = s.selectedOffer.availableServices.find((sv) => sv.id === s.selectedMeal);
          if (svc) total += svc.amount;
        }

        return total;
      },
    }),
    {
      name: 'sogojet-booking',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        destinationId: state.destinationId,
        selectedOffer: state.selectedOffer,
        passengers: state.passengers,
        selectedSeat: state.selectedSeat,
        selectedBaggage: state.selectedBaggage,
        hasInsurance: state.hasInsurance,
        selectedMeal: state.selectedMeal,
      }),
    },
  ),
);
