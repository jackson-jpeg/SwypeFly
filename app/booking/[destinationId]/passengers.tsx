// ─── 04b: Passenger Details ─────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, radii, textPresets } from '../../../constants/theme';
import { useBookingStore, type BookingPassenger } from '../../../stores/bookingStore';
import { StepBar } from './_layout';

const TITLES = ['mr', 'mrs', 'ms', 'miss', 'dr'] as const;
const GENDERS = [
  { label: 'Male', value: 'm' as const },
  { label: 'Female', value: 'f' as const },
];

function PassengerForm({
  index,
  passenger,
  onUpdate,
}: {
  index: number;
  passenger: BookingPassenger;
  onUpdate: (data: Partial<BookingPassenger>) => void;
}) {
  const inputStyle = {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.warmDusk,
    borderRadius: radii.sm,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['3'],
    backgroundColor: '#FFFFFF',
    marginBottom: spacing['3'],
  };

  const focusStyle = { borderColor: colors.sageDrift };

  return (
    <View
      style={{
        backgroundColor: colors.paleHorizon,
        borderRadius: radii.lg,
        padding: spacing['4'],
        marginBottom: spacing['4'],
      }}
    >
      <Text style={{ ...textPresets.body.sectionLabel, marginBottom: spacing['3'] }}>
        PASSENGER {index + 1}
      </Text>

      {/* Title */}
      <View style={{ flexDirection: 'row', gap: spacing['2'], marginBottom: spacing['3'] }}>
        {TITLES.map((t) => (
          <Pressable
            key={t}
            onPress={() => onUpdate({ title: t })}
            style={{
              paddingHorizontal: spacing['3'],
              paddingVertical: spacing['1.5'],
              borderRadius: radii.full,
              backgroundColor: passenger.title === t ? colors.deepDusk : 'transparent',
              borderWidth: 1,
              borderColor: passenger.title === t ? colors.deepDusk : colors.border,
            }}
          >
            <Text
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 13,
                color: passenger.title === t ? colors.paleHorizon : colors.text.secondary,
                textTransform: 'capitalize',
              }}
            >
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        placeholder="First name"
        placeholderTextColor={colors.text.muted}
        value={passenger.given_name}
        onChangeText={(v) => onUpdate({ given_name: v })}
        style={inputStyle}
      />

      <TextInput
        placeholder="Last name"
        placeholderTextColor={colors.text.muted}
        value={passenger.family_name}
        onChangeText={(v) => onUpdate({ family_name: v })}
        style={inputStyle}
      />

      <TextInput
        placeholder="Date of birth (YYYY-MM-DD)"
        placeholderTextColor={colors.text.muted}
        value={passenger.born_on}
        onChangeText={(v) => onUpdate({ born_on: v })}
        style={inputStyle}
      />

      {/* Gender */}
      <View style={{ flexDirection: 'row', gap: spacing['2'], marginBottom: spacing['3'] }}>
        {GENDERS.map((g) => (
          <Pressable
            key={g.value}
            onPress={() => onUpdate({ gender: g.value })}
            style={{
              flex: 1,
              paddingVertical: spacing['3'],
              borderRadius: radii.sm,
              backgroundColor: passenger.gender === g.value ? colors.deepDusk : '#FFFFFF',
              borderWidth: 1,
              borderColor: passenger.gender === g.value ? colors.deepDusk : colors.border,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 14,
                color: passenger.gender === g.value ? colors.paleHorizon : colors.text.primary,
              }}
            >
              {g.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        placeholder="Email"
        placeholderTextColor={colors.text.muted}
        value={passenger.email}
        onChangeText={(v) => onUpdate({ email: v })}
        keyboardType="email-address"
        autoCapitalize="none"
        style={inputStyle}
      />

      <TextInput
        placeholder="Phone number"
        placeholderTextColor={colors.text.muted}
        value={passenger.phone_number}
        onChangeText={(v) => onUpdate({ phone_number: v })}
        keyboardType="phone-pad"
        style={inputStyle}
      />
    </View>
  );
}

export default function Passengers() {
  const { destinationId } = useLocalSearchParams<{ destinationId: string }>();
  const router = useRouter();
  const { passengers, addPassenger, updatePassenger, removePassenger } = useBookingStore();

  // Initialize with one passenger if empty
  if (passengers.length === 0) {
    addPassenger({
      id: `pax_${Date.now()}`,
      given_name: '',
      family_name: '',
      born_on: '',
      gender: 'm',
      title: 'mr',
      email: '',
      phone_number: '',
    });
  }

  const handleAddPassenger = () => {
    addPassenger({
      id: `pax_${Date.now()}`,
      given_name: '',
      family_name: '',
      born_on: '',
      gender: 'm',
      title: 'mr',
      email: '',
      phone_number: '',
    });
  };

  const isValid = passengers.every(
    (p) => p.given_name && p.family_name && p.born_on && p.email && p.phone_number,
  );

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing['6'] }}>
      <StepBar currentStep={1} />

      <Text
        style={{
          ...textPresets.display.title,
          fontFamily: 'Syne_800ExtraBold',
          marginTop: spacing['4'],
          marginBottom: spacing['6'],
        }}
      >
        Passenger Details
      </Text>

      {passengers.map((p, i) => (
        <PassengerForm
          key={p.id}
          index={i}
          passenger={p}
          onUpdate={(data) => updatePassenger(p.id, data)}
        />
      ))}

      <Pressable onPress={handleAddPassenger} style={{ marginBottom: spacing['6'] }}>
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 15, color: colors.sageDrift }}>
          + Add Another Passenger
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.push(`/booking/${destinationId}/seats`)}
        disabled={!isValid}
        style={{
          backgroundColor: isValid ? colors.deepDusk : colors.border,
          height: 52,
          borderRadius: 14,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 17, color: isValid ? colors.paleHorizon : '#FFFFFF' }}>
          Continue to Seat Selection
        </Text>
      </Pressable>
    </ScrollView>
  );
}
