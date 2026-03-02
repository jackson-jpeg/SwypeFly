// ─── 04d: Bags & Extras ─────────────────────────────────────────────────────
import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, radii, textPresets } from '../../../constants/theme';
import { useBookingStore } from '../../../stores/bookingStore';
import { StepBar } from './_layout';

const BAG_OPTIONS = [
  { label: 'No Checked Bag', description: 'Carry-on only', price: 0 },
  { label: '1 Checked Bag', description: 'Up to 23kg', price: 35 },
  { label: '2 Checked Bags', description: 'Up to 23kg each', price: 60 },
];

const MEAL_OPTIONS = [
  { label: 'No Meal', id: null },
  { label: 'Standard Meal', id: 'standard' },
  { label: 'Vegetarian', id: 'vegetarian' },
];

export default function Extras() {
  const { destinationId } = useLocalSearchParams<{ destinationId: string }>();
  const router = useRouter();
  const { baggage, setBaggage, insurance, toggleInsurance, meal, setMeal, selectedOffer } =
    useBookingStore();

  const selectedBagIndex = baggage.length > 0 ? parseInt(baggage[0]?.serviceId || '0') : 0;
  const offerAmount = selectedOffer
    ? parseFloat((selectedOffer as Record<string, unknown>).total_amount as string)
    : 0;

  const baggageCost = BAG_OPTIONS[selectedBagIndex]?.price || 0;
  const insuranceCost = insurance ? 29 : 0;
  const subtotal = offerAmount + baggageCost + insuranceCost;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing['6'] }}>
      <StepBar currentStep={3} />

      <Text
        style={{
          ...textPresets.display.title,
          fontFamily: 'Syne_800ExtraBold',
          marginTop: spacing['4'],
          marginBottom: spacing['6'],
        }}
      >
        Bags & Extras
      </Text>

      {/* Checked Bags */}
      <Text style={{ ...textPresets.body.sectionLabel, marginBottom: spacing['3'] }}>
        CHECKED BAGGAGE
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing['3'], marginBottom: spacing['6'] }}>
        {BAG_OPTIONS.map((opt, i) => (
          <Pressable
            key={i}
            onPress={() => setBaggage(i > 0 ? [{ serviceId: String(i), quantity: i }] : [])}
            style={{
              flex: 1,
              backgroundColor: selectedBagIndex === i ? colors.seafoamMist : '#FFFFFF',
              borderRadius: radii.lg,
              padding: spacing['3'],
              borderWidth: selectedBagIndex === i ? 2 : 1,
              borderColor: selectedBagIndex === i ? colors.sageDrift : colors.border,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.deepDusk }}>
              {opt.label}
            </Text>
            <Text style={{ ...textPresets.body.caption, marginTop: 2 }}>{opt.description}</Text>
            <Text
              style={{
                fontFamily: 'Syne_600SemiBold',
                fontSize: 16,
                color: colors.deepDusk,
                marginTop: spacing['2'],
              }}
            >
              {opt.price === 0 ? 'Free' : `$${opt.price}`}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Travel Insurance */}
      <Text style={{ ...textPresets.body.sectionLabel, marginBottom: spacing['3'] }}>
        TRAVEL INSURANCE
      </Text>
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: radii.lg,
          padding: spacing['4'],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing['6'],
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 15, color: colors.text.primary }}>
            Trip Protection
          </Text>
          <Text style={{ ...textPresets.body.caption, marginTop: 2 }}>
            Cancellation, delays, medical — $29
          </Text>
        </View>
        <Switch
          value={insurance}
          onValueChange={toggleInsurance}
          trackColor={{ false: colors.toggleOff, true: colors.toggleOn }}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* Meal Selection */}
      <Text style={{ ...textPresets.body.sectionLabel, marginBottom: spacing['3'] }}>
        MEAL PREFERENCE
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing['3'], marginBottom: spacing['8'] }}>
        {MEAL_OPTIONS.map((opt) => (
          <Pressable
            key={opt.label}
            onPress={() => setMeal(opt.id)}
            style={{
              flex: 1,
              backgroundColor: meal === opt.id ? colors.seafoamMist : '#FFFFFF',
              borderRadius: radii.lg,
              padding: spacing['3'],
              borderWidth: meal === opt.id ? 2 : 1,
              borderColor: meal === opt.id ? colors.sageDrift : colors.border,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.deepDusk }}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Running subtotal */}
      <View
        style={{
          backgroundColor: colors.paleHorizon,
          borderRadius: radii.lg,
          padding: spacing['4'],
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing['4'],
        }}
      >
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 15, color: colors.text.primary }}>
          Estimated Total
        </Text>
        <Text style={{ fontFamily: 'Syne_600SemiBold', fontSize: 22, color: colors.deepDusk }}>
          ${subtotal.toFixed(2)}
        </Text>
      </View>

      <Pressable
        onPress={() => router.push(`/booking/${destinationId}/review`)}
        style={{
          backgroundColor: colors.deepDusk,
          borderRadius: radii.lg,
          paddingVertical: spacing['4'],
          alignItems: 'center',
        }}
      >
        <Text style={{ fontFamily: 'Syne_600SemiBold', fontSize: 16, color: '#FFFFFF' }}>
          Continue to Review
        </Text>
      </Pressable>
    </ScrollView>
  );
}
