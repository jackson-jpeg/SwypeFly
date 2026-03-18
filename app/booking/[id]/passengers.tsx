import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing } from '../../../theme/tokens';
import SplitFlapRow from '../../../components/board/SplitFlapRow';
import { useBookingFlowStore } from '../../../stores/bookingFlowStore';
import type { Passenger } from '../../../stores/bookingFlowStore';

// ─── Constants ───────────────────────────────────────────────────────

const TITLES: { value: Passenger['title']; label: string }[] = [
  { value: 'mr', label: 'Mr' },
  { value: 'mrs', label: 'Mrs' },
  { value: 'ms', label: 'Ms' },
  { value: 'miss', label: 'Miss' },
  { value: 'dr', label: 'Dr' },
];

const GENDERS: { value: Passenger['gender']; label: string }[] = [
  { value: 'm', label: 'Male' },
  { value: 'f', label: 'Female' },
];

const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s\-()]{7,}$/;

// ─── Screen ──────────────────────────────────────────────────────────

export default function PassengersScreen() {
  const router = useRouter();
  const { id, offerId } = useLocalSearchParams<{ id: string; offerId: string }>();
  const insets = useSafeAreaInsets();
  const setPassengers = useBookingFlowStore((s) => s.setPassengers);

  // Form state
  const [title, setTitle] = useState<Passenger['title']>('mr');
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [bornOn, setBornOn] = useState('');
  const [gender, setGender] = useState<Passenger['gender']>('m');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Validation
  const isValid = useMemo(() => {
    return (
      givenName.trim().length > 0 &&
      familyName.trim().length > 0 &&
      DOB_REGEX.test(bornOn) &&
      EMAIL_REGEX.test(email) &&
      PHONE_REGEX.test(phoneNumber)
    );
  }, [givenName, familyName, bornOn, email, phoneNumber]);

  const handleContinue = useCallback(() => {
    if (!isValid) return;
    setPassengers([
      {
        title,
        givenName: givenName.trim(),
        familyName: familyName.trim(),
        bornOn,
        gender,
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
      },
    ]);
    router.push(`/booking/${id}/seats?offerId=${offerId}`);
  }, [isValid, title, givenName, familyName, bornOn, gender, email, phoneNumber, id, offerId, router, setPassengers]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.yellow} />
        </Pressable>
        <View style={styles.headerTitle}>
          <SplitFlapRow
            text="PASSENGER"
            maxLength={12}
            size="md"
            color={colors.yellow}
            align="left"
            animate={true}
          />
        </View>
        <Text style={styles.subtitle}>Traveler 1 of 1</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>TITLE</Text>
          <View style={styles.chipRow}>
            {TITLES.map((t) => (
              <Pressable
                key={t.value}
                style={[styles.chip, title === t.value && styles.chipActive]}
                onPress={() => setTitle(t.value)}
              >
                <Text style={[styles.chipText, title === t.value && styles.chipTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* First Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>FIRST NAME</Text>
          <TextInput
            style={styles.input}
            value={givenName}
            onChangeText={setGivenName}
            placeholder="As on passport"
            placeholderTextColor={colors.faint}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {/* Last Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>LAST NAME</Text>
          <TextInput
            style={styles.input}
            value={familyName}
            onChangeText={setFamilyName}
            placeholder="As on passport"
            placeholderTextColor={colors.faint}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {/* Date of Birth */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>DATE OF BIRTH</Text>
          <TextInput
            style={styles.input}
            value={bornOn}
            onChangeText={setBornOn}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.faint}
            keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
            autoCorrect={false}
            maxLength={10}
          />
        </View>

        {/* Gender */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>GENDER</Text>
          <View style={styles.toggleRow}>
            {GENDERS.map((g) => (
              <Pressable
                key={g.value}
                style={[styles.toggleBtn, gender === g.value && styles.toggleBtnActive]}
                onPress={() => setGender(g.value)}
              >
                <Text
                  style={[styles.toggleText, gender === g.value && styles.toggleTextActive]}
                >
                  {g.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="traveler@example.com"
            placeholderTextColor={colors.faint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Phone */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>PHONE</Text>
          <TextInput
            style={styles.input}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="+1 555 123 4567"
            placeholderTextColor={colors.faint}
            keyboardType="phone-pad"
            autoCorrect={false}
          />
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          style={[styles.continueBtn, !isValid && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!isValid}
        >
          <Text style={[styles.continueBtnText, !isValid && styles.continueBtnTextDisabled]}>
            Continue
          </Text>
          <Ionicons
            name="arrow-forward"
            size={18}
            color={isValid ? colors.bg : colors.faint}
          />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  backBtn: {
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },
  headerTitle: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.green,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.green + '30',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.white,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: colors.green + '20',
    borderColor: colors.green,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
  },
  chipTextActive: {
    color: colors.green,
    fontFamily: fonts.bodyBold,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.green + '20',
    borderColor: colors.green,
  },
  toggleText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
  },
  toggleTextActive: {
    color: colors.green,
    fontFamily: fonts.bodyBold,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  continueBtn: {
    backgroundColor: colors.yellow,
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  continueBtnDisabled: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  continueBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.bg,
  },
  continueBtnTextDisabled: {
    color: colors.faint,
  },
});
