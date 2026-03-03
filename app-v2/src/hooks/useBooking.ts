import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch, USE_STUBS } from '@/api/client';
import {
  getStubBookingOffers,
  getStubDestination,
  STUB_SEAT_MAP,
  STUB_PAYMENT_INTENT,
} from '@/api/stubs';
import type {
  BookingOffer,
  BookingSearchRequest,
  SeatMap,
  PaymentIntentResponse,
  CreateOrderResponse,
} from '@/api/types';

export function useBookingSearch(params: BookingSearchRequest | null) {
  return useQuery({
    queryKey: ['booking', 'search', params],
    queryFn: async () => {
      if (USE_STUBS) {
        const dest = getStubDestination(params?.destination ?? '');
        return getStubBookingOffers(dest, params?.origin);
      }
      return apiFetch<BookingOffer[]>('/api/booking?action=search', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
    enabled: !!params,
  });
}

export function useOfferDetail(offerId: string | null, destId?: string, origin?: string) {
  return useQuery({
    queryKey: ['booking', 'offer', offerId],
    queryFn: async () => {
      if (USE_STUBS) {
        const dest = getStubDestination(destId ?? '');
        const offers = getStubBookingOffers(dest, origin);
        const offer = offers.find((o) => o.id === offerId) ?? offers[0]!;
        return { offer, seatMap: STUB_SEAT_MAP };
      }
      return apiFetch<{ offer: BookingOffer; seatMap: SeatMap }>(
        `/api/booking?action=offer&offerId=${offerId}`,
      );
    },
    enabled: !!offerId,
  });
}

export function useCreatePaymentIntent() {
  return useMutation({
    mutationFn: async (params: { offerId: string; amount: number; currency: string }) => {
      if (USE_STUBS) return STUB_PAYMENT_INTENT;
      return apiFetch<PaymentIntentResponse>('/api/booking?action=payment-intent', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: async (params: {
      offerId: string;
      passengers: { id: string; given_name: string; family_name: string; born_on: string; gender: string; title: string; email: string; phone_number: string }[];
      selectedServices?: { id: string; quantity: number }[];
      paymentIntentId: string;
    }) => {
      if (USE_STUBS) {
        return {
          orderId: `ord_SGJT_${Date.now()}`,
          bookingReference: `SGJT${Math.random().toString(36).slice(2, 4).toUpperCase()}`,
          status: 'confirmed' as const,
          passengers: params.passengers.map((p) => ({
            id: p.id,
            name: `${p.given_name} ${p.family_name}`,
          })),
          slices: [],
          totalPaid: params.selectedServices?.length ? 0 : 0,
          currency: 'USD',
        } satisfies CreateOrderResponse;
      }
      return apiFetch<CreateOrderResponse>('/api/booking?action=create-order', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
  });
}
