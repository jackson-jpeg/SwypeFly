import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch, USE_STUBS } from '@/api/client';
import {
  STUB_BOOKING_OFFERS,
  STUB_SEAT_MAP,
  STUB_PAYMENT_INTENT,
  STUB_ORDER,
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
      if (USE_STUBS) return STUB_BOOKING_OFFERS;
      return apiFetch<BookingOffer[]>('/api/booking?action=search', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
    enabled: !!params,
  });
}

export function useOfferDetail(offerId: string | null) {
  return useQuery({
    queryKey: ['booking', 'offer', offerId],
    queryFn: async () => {
      if (USE_STUBS) {
        const offer = STUB_BOOKING_OFFERS.find((o) => o.id === offerId);
        return { offer: offer!, seatMap: STUB_SEAT_MAP };
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
      if (USE_STUBS) return STUB_ORDER;
      return apiFetch<CreateOrderResponse>('/api/booking?action=create-order', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
  });
}
