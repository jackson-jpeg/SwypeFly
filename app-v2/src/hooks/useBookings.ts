import { useQuery } from '@tanstack/react-query';
import { apiFetch, USE_STUBS } from '@/api/client';

export interface BookingRecord {
  id: string;
  duffelOrderId: string;
  status: string;
  totalAmount: number;
  currency: string;
  passengerCount: number;
  stripePaymentIntentId: string;
  createdAt: string;
  destinationCity: string;
  destinationIata: string;
  originIata: string;
  departureDate: string;
  returnDate: string;
  airline: string;
  bookingReference: string;
  passengers: {
    givenName: string;
    familyName: string;
    email: string;
  }[];
}

export function useBookings() {
  return useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      if (USE_STUBS) {
        return [] as BookingRecord[];
      }
      const res = await apiFetch<{ bookings: BookingRecord[] }>('/api/bookings');
      return res.bookings;
    },
    staleTime: 30_000,
  });
}
