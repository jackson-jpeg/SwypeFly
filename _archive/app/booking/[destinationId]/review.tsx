// ─── 04e: Review & Payment ──────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, radii, textPresets } from '../../../constants/theme';
import { useBookingStore } from '../../../stores/bookingStore';
import { StepBar } from './_layout';

export default function Review() {
  const { destinationId } = useLocalSearchParams<{ destinationId: string }>();
  const router = useRouter();
  const {
    selectedOffer,
    passengers,
    selectedSeats,
    baggage,
    insurance,
    meal,
    destinationName,
    setPaymentIntent,
    setBookingResult,
  } = useBookingStore();

  const [processing, setProcessing] = useState(false);
  const [promoCode, setPromoCode] = useState('');

  const offerAmount = selectedOffer
    ? parseFloat((selectedOffer as Record<string, unknown>).total_amount as string)
    : 0;
  const offerCurrency = selectedOffer
    ? ((selectedOffer as Record<string, unknown>).total_currency as string) || 'USD'
    : 'USD';
  const baggageCost = baggage.length > 0 ? (parseInt(baggage[0]?.serviceId || '0') === 1 ? 35 : 60) : 0;
  const insuranceCost = insurance ? 29 : 0;
  const total = offerAmount + baggageCost + insuranceCost;

  const handlePay = async () => {
    setProcessing(true);
    try {
      // 1. Create payment intent
      const piRes = await fetch('/api/booking?action=payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer TODO_JWT`, // TODO: Get from auth context
        },
        body: JSON.stringify({
          offerId: (selectedOffer as Record<string, unknown>)?.id,
          amount: Math.round(total * 100), // cents
          currency: offerCurrency,
        }),
      });
      const piData = await piRes.json();

      if (!piRes.ok) {
        setBookingResult('failed');
        return;
      }

      setPaymentIntent(piData.clientSecret, piData.paymentIntentId);

      // 2. In production, confirm payment via Stripe Elements here.
      // For now, proceed directly to order creation (assumes test mode).

      // 3. Create Duffel order
      const orderRes = await fetch('/api/booking?action=create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer TODO_JWT`, // TODO: Get from auth context
        },
        body: JSON.stringify({
          offerId: (selectedOffer as Record<string, unknown>)?.id,
          passengers: passengers.map((p) => ({
            ...p,
          })),
          selectedServices: baggage.length > 0 ? baggage : undefined,
          paymentIntentId: piData.paymentIntentId,
        }),
      });
      const orderData = await orderRes.json();

      if (orderRes.ok) {
        setBookingResult('confirmed', orderData.bookingReference, orderData.duffelOrderId);
        router.replace(`/booking/${destinationId}/confirmation`);
      } else {
        setBookingResult('failed');
      }
    } catch (err) {
      console.error('[review] Payment/booking failed:', err);
      setBookingResult('failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing['6'] }}>
      <StepBar currentStep={4} />

      <Text
        style={{
          ...textPresets.display.title,
          fontFamily: 'Syne_800ExtraBold',
          marginTop: spacing['4'],
          marginBottom: spacing['6'],
        }}
      >
        Review & Pay
      </Text>

      {/* Order summary card */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: radii.lg,
          padding: spacing['4'],
          marginBottom: spacing['4'],
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ fontFamily: 'Syne_600SemiBold', fontSize: 18, color: colors.deepDusk }}>
          {destinationName || 'Flight'}
        </Text>

        {/* Line items */}
        <View style={{ marginTop: spacing['4'], gap: spacing['3'] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ ...textPresets.body.default, fontSize: 15 }}>
              Flight × {passengers.length} passenger{passengers.length > 1 ? 's' : ''}
            </Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 15, color: colors.text.primary }}>
              ${offerAmount.toFixed(2)}
            </Text>
          </View>

          {baggageCost > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ ...textPresets.body.default, fontSize: 15 }}>Checked baggage</Text>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 15, color: colors.text.primary }}>
                ${baggageCost.toFixed(2)}
              </Text>
            </View>
          )}

          {insurance && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ ...textPresets.body.default, fontSize: 15 }}>Travel insurance</Text>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 15, color: colors.text.primary }}>
                $29.00
              </Text>
            </View>
          )}

          {selectedSeats.length > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ ...textPresets.body.default, fontSize: 15 }}>
                Seat{selectedSeats.length > 1 ? 's' : ''}: {selectedSeats.map((s) => s.designation).join(', ')}
              </Text>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 15, color: colors.text.primary }}>
                Included
              </Text>
            </View>
          )}

          <View
            style={{
              height: 1,
              backgroundColor: colors.divider,
              marginVertical: spacing['2'],
            }}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: 'Syne_600SemiBold', fontSize: 18, color: colors.deepDusk }}>
              Total
            </Text>
            <Text style={{ fontFamily: 'Syne_700Bold', fontSize: 22, color: colors.deepDusk }}>
              ${total.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      {/* Promo code */}
      <View
        style={{
          flexDirection: 'row',
          gap: spacing['2'],
          marginBottom: spacing['6'],
        }}
      >
        <TextInput
          placeholder="Promo code"
          placeholderTextColor={colors.text.muted}
          value={promoCode}
          onChangeText={setPromoCode}
          style={{
            flex: 1,
            fontFamily: 'Inter_400Regular',
            fontSize: 15,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.sm,
            paddingHorizontal: spacing['3'],
            paddingVertical: spacing['3'],
            color: colors.text.primary,
          }}
        />
        <Pressable
          style={{
            backgroundColor: colors.paleHorizon,
            borderRadius: radii.sm,
            paddingHorizontal: spacing['4'],
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: colors.deepDusk }}>
            Apply
          </Text>
        </Pressable>
      </View>

      {/* Security note */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginBottom: spacing['4'],
        }}
      >
        <Text style={{ fontSize: 14 }}>🔒</Text>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.text.muted }}>
          Secured with 256-bit SSL encryption
        </Text>
      </View>

      {/* Pay button */}
      <Pressable
        onPress={handlePay}
        disabled={processing}
        style={{
          backgroundColor: colors.deepDusk,
          height: 52,
          borderRadius: 14,
          justifyContent: 'center',
          alignItems: 'center',
          opacity: processing ? 0.7 : 1,
        }}
      >
        {processing ? (
          <ActivityIndicator color={colors.paleHorizon} />
        ) : (
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 17, color: colors.paleHorizon }}>
            Pay ${total.toFixed(2)}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
