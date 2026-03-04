import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BookingOffer, CreateOrderResponse, Passenger } from '@/api/types';

interface BookingState {
  // Flow state
  destinationId: string | null;
  selectedOffer: BookingOffer | null;
  cabinClass: 'economy' | 'business' | 'first';
  passengers: Passenger[];
  selectedSeat: string | null;
  seatPrice: number;
  selectedBaggage: string | null;
  hasInsurance: boolean;
  selectedMeal: string | null;
  passengerCount: number;
  promoCode: string | null;
  promoDiscount: number;
  orderResponse: CreateOrderResponse | null;

  // Actions
  setDestination: (id: string) => void;
  setOffer: (offer: BookingOffer) => void;
  setCabinClass: (cls: 'economy' | 'business' | 'first') => void;
  setPassengerCount: (count: number) => void;
  applyPromo: (code: string) => boolean;
  addPassenger: (p: Passenger) => void;
  updatePassenger: (index: number, p: Partial<Passenger>) => void;
  setSeat: (designator: string | null, price?: number) => void;
  setBaggage: (id: string | null) => void;
  setInsurance: (has: boolean) => void;
  setMeal: (id: string | null) => void;
  setOrderResponse: (order: CreateOrderResponse) => void;
  reset: () => void;

  // Computed
  getTotal: () => number;
}

const INITIAL: Pick<
  BookingState,
  'destinationId' | 'selectedOffer' | 'cabinClass' | 'passengers' | 'selectedSeat' | 'seatPrice' | 'selectedBaggage' | 'hasInsurance' | 'selectedMeal' | 'passengerCount' | 'promoCode' | 'promoDiscount' | 'orderResponse'
> = {
  destinationId: null,
  selectedOffer: null,
  cabinClass: 'economy',
  passengers: [],
  selectedSeat: null,
  seatPrice: 0,
  selectedBaggage: null,
  hasInsurance: false,
  selectedMeal: null,
  passengerCount: 1,
  promoCode: null,
  promoDiscount: 0,
  orderResponse: null,
};

export const useBookingStore = create<BookingState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      setDestination: (id) => set({ destinationId: id }),
      setOffer: (offer) => set({ selectedOffer: offer }),
      setCabinClass: (cls) => set({ cabinClass: cls }),
      addPassenger: (p) => set((s) => ({ passengers: [...s.passengers, p] })),
      updatePassenger: (index, p) =>
        set((s) => ({
          passengers: s.passengers.map((existing, i) => (i === index ? { ...existing, ...p } : existing)),
        })),
      setSeat: (designator, price) => set({ selectedSeat: designator, seatPrice: price ?? 0 }),
      setBaggage: (id) => set({ selectedBaggage: id }),
      setInsurance: (has) => set({ hasInsurance: has }),
      setMeal: (id) => set({ selectedMeal: id }),
      setOrderResponse: (order) => set({ orderResponse: order }),
      setPassengerCount: (count) => set({ passengerCount: count, passengers: [] }),
      applyPromo: () => {
        // Promo code validation will be wired to a backend endpoint.
        // No hardcoded codes — always returns false until backend is ready.
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

        // Seat upgrade
        perPerson += s.seatPrice;

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
        cabinClass: state.cabinClass,
        passengers: state.passengers,
        selectedSeat: state.selectedSeat,
        seatPrice: state.seatPrice,
        selectedBaggage: state.selectedBaggage,
        hasInsurance: state.hasInsurance,
        selectedMeal: state.selectedMeal,
        passengerCount: state.passengerCount,
        promoCode: state.promoCode,
        promoDiscount: state.promoDiscount,
        orderResponse: state.orderResponse,
      }),
    },
  ),
);
