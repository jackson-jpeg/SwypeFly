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
  passengerCount: number;
  promoCode: string | null;
  promoDiscount: number;

  // Actions
  setDestination: (id: string) => void;
  setOffer: (offer: BookingOffer) => void;
  setPassengerCount: (count: number) => void;
  applyPromo: (code: string) => boolean;
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
  'destinationId' | 'selectedOffer' | 'passengers' | 'selectedSeat' | 'selectedBaggage' | 'hasInsurance' | 'selectedMeal' | 'passengerCount' | 'promoCode' | 'promoDiscount'
> = {
  destinationId: null,
  selectedOffer: null,
  passengers: [],
  selectedSeat: null,
  selectedBaggage: null,
  hasInsurance: false,
  selectedMeal: null,
  passengerCount: 1,
  promoCode: null,
  promoDiscount: 0,
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
      setPassengerCount: (count) => set({ passengerCount: count }),
      applyPromo: (code) => {
        const upper = code.trim().toUpperCase();
        const VALID_CODES: Record<string, number> = { SOGOJET: 0.1, FLY20: 0.2, WELCOME: 0.15 };
        const discount = VALID_CODES[upper];
        if (discount) {
          set({ promoCode: upper, promoDiscount: discount });
          return true;
        }
        return false;
      },
      reset: () => set(INITIAL),

      getTotal: () => {
        const s = get();
        let perPerson = s.selectedOffer?.totalAmount ?? 0;

        // Baggage
        if (s.selectedBaggage && s.selectedOffer) {
          const svc = s.selectedOffer.availableServices.find((sv) => sv.id === s.selectedBaggage);
          if (svc) perPerson += svc.amount;
        }

        // Insurance
        if (s.hasInsurance) perPerson += 29;

        // Meal
        if (s.selectedMeal && s.selectedOffer) {
          const svc = s.selectedOffer.availableServices.find((sv) => sv.id === s.selectedMeal);
          if (svc) perPerson += svc.amount;
        }

        let total = perPerson * s.passengerCount;

        // Promo discount
        if (s.promoDiscount > 0) {
          total = Math.round(total * (1 - s.promoDiscount));
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
        passengerCount: state.passengerCount,
        promoCode: state.promoCode,
        promoDiscount: state.promoDiscount,
      }),
    },
  ),
);
