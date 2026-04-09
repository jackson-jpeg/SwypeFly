import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing } from '../../../theme/tokens';
import { successHaptic, errorHaptic, warningHaptic } from '../../../utils/haptics';
import SplitFlapRow from '../../../components/board/SplitFlapRow';
import TripBanner from '../../../components/booking/TripBanner';
import BookingProgress from '../../../components/booking/BookingProgress';
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
const PHONE_REGEX = /^\+\d[\d\s\-()]{7,}$/;

// ─── Screen ──────────────────────────────────────────────────────────

export default function PassengersScreen() {
  const router = useRouter();
  const { id, offerId } = useLocalSearchParams<{ id: string; offerId: string }>();
  const navigation = useNavigation();
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

  // Per-field error state (shown on blur or submit attempt)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});
  const [didAttemptSubmit, setDidAttemptSubmit] = useState(false);

  const hasFormData = givenName.length > 0 || familyName.length > 0 || email.length > 0;

  // Prevent swipe-back/hardware back from discarding form data
  useEffect(() => {
    if (!hasFormData) return;
    const unsubscribe = navigation.addListener('beforeRemove', (e: { preventDefault: () => void; data: { action: unknown } }) => {
      e.preventDefault();
      if (Platform.OS === 'web') {
        if (window.confirm('Discard passenger details?')) navigation.dispatch(e.data.action as never);
        return;
      }
      Alert.alert('Discard details?', 'Your passenger information will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action as never) },
      ]);
    });
    return unsubscribe;
  }, [navigation, hasFormData]);

  // Validation — returns per-field errors and warnings
  function validateFields(): { errors: Record<string, string>; warnings: Record<string, string> } {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};
    if (!givenName.trim()) errors.givenName = 'First name is required';
    if (!familyName.trim()) errors.familyName = 'Last name is required';
    if (!DOB_REGEX.test(bornOn)) {
      errors.bornOn = 'Date format: YYYY-MM-DD';
    } else {
      const dob = new Date(bornOn + 'T00:00:00');
      const now = new Date();
      if (isNaN(dob.getTime()) || dob >= now) {
        errors.bornOn = 'Must be a date in the past';
      } else {
        // Age calculation
        let ageYears = now.getFullYear() - dob.getFullYear();
        const monthDiff = now.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
          ageYears--;
        }
        if (ageYears < 2) {
          errors.bornOn = 'Passenger must be at least 2 years old';
        } else if (ageYears < 18) {
          warnings.bornOn = 'Passenger is under 18 — an adult must also travel';
        }
      }
    }
    if (!EMAIL_REGEX.test(email)) errors.email = 'Enter a valid email';
    if (!PHONE_REGEX.test(phoneNumber)) errors.phoneNumber = 'Enter a valid phone (e.g. +1234567890)';
    return { errors, warnings };
  }

  const isValid = useMemo(() => {
    return Object.keys(validateFields().errors).length === 0;
  }, [givenName, familyName, bornOn, email, phoneNumber]);

  const handleFieldBlur = useCallback((field: string) => {
    const { errors, warnings } = validateFields();
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (errors[field]) next[field] = errors[field];
      else delete next[field];
      return next;
    });
    setFieldWarnings((prev) => {
      const next = { ...prev };
      if (warnings[field]) next[field] = warnings[field];
      else delete next[field];
      return next;
    });
  }, [givenName, familyName, bornOn, email, phoneNumber]);

  const handleBack = useCallback(() => {
    if (!hasFormData) return router.back();
    if (Platform.OS === 'web') {
      if (window.confirm('Discard passenger details?')) router.back();
      return;
    }
    Alert.alert('Discard details?', 'Your passenger information will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  }, [hasFormData, router]);

  const handleContinue = useCallback(() => {
    setDidAttemptSubmit(true);
    const { errors, warnings } = validateFields();
    setFieldWarnings(warnings);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      errorHaptic();
      return;
    }
    if (Object.keys(warnings).length > 0) {
      warningHaptic();
    }
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
    successHaptic();
    router.push(`/booking/${id}/seats?offerId=${offerId}`);
  }, [isValid, title, givenName, familyName, bornOn, gender, email, phoneNumber, id, offerId, router, setPassengers]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
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
      <BookingProgress />
      <TripBanner />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 60}
      >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
            style={[styles.input, fieldErrors.givenName && styles.inputError]}
            value={givenName}
            onChangeText={setGivenName}
            onBlur={() => handleFieldBlur('givenName')}
            placeholder="As on passport"
            placeholderTextColor={colors.faint}
            autoCapitalize="words"
            autoCorrect={false}
            accessibilityLabel="First name"
          />
          {(didAttemptSubmit || fieldErrors.givenName) && fieldErrors.givenName && (
            <Text style={styles.errorText}>{fieldErrors.givenName}</Text>
          )}
        </View>

        {/* Last Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>LAST NAME</Text>
          <TextInput
            style={[styles.input, fieldErrors.familyName && styles.inputError]}
            value={familyName}
            onChangeText={setFamilyName}
            onBlur={() => handleFieldBlur('familyName')}
            placeholder="As on passport"
            placeholderTextColor={colors.faint}
            autoCapitalize="words"
            autoCorrect={false}
            accessibilityLabel="Last name"
          />
          {(didAttemptSubmit || fieldErrors.familyName) && fieldErrors.familyName && (
            <Text style={styles.errorText}>{fieldErrors.familyName}</Text>
          )}
        </View>

        {/* Date of Birth */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>DATE OF BIRTH</Text>
          <TextInput
            style={[styles.input, fieldErrors.bornOn && styles.inputError]}
            value={bornOn}
            onChangeText={setBornOn}
            onBlur={() => handleFieldBlur('bornOn')}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.faint}
            keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
            autoCorrect={false}
            maxLength={10}
            accessibilityLabel="Date of birth"
          />
          {(didAttemptSubmit || fieldErrors.bornOn) && fieldErrors.bornOn && (
            <Text style={styles.errorText}>{fieldErrors.bornOn}</Text>
          )}
          {!fieldErrors.bornOn && fieldWarnings.bornOn && (
            <Text style={styles.warningText}>{fieldWarnings.bornOn}</Text>
          )}
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
            style={[styles.input, fieldErrors.email && styles.inputError]}
            value={email}
            onChangeText={setEmail}
            onBlur={() => handleFieldBlur('email')}
            placeholder="traveler@example.com"
            placeholderTextColor={colors.faint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Email address"
          />
          {(didAttemptSubmit || fieldErrors.email) && fieldErrors.email && (
            <Text style={styles.errorText}>{fieldErrors.email}</Text>
          )}
        </View>

        {/* Phone */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>PHONE</Text>
          <TextInput
            style={[styles.input, fieldErrors.phoneNumber && styles.inputError]}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            onBlur={() => handleFieldBlur('phoneNumber')}
            placeholder="+1 555 123 4567 (country code required)"
            placeholderTextColor={colors.faint}
            keyboardType="phone-pad"
            autoCorrect={false}
            accessibilityLabel="Phone number"
          />
          {(didAttemptSubmit || fieldErrors.phoneNumber) && fieldErrors.phoneNumber && (
            <Text style={styles.errorText}>{fieldErrors.phoneNumber}</Text>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Continue Button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          style={[styles.continueBtn, !isValid && didAttemptSubmit && styles.continueBtnDisabled]}
          onPress={handleContinue}
          accessibilityRole="button"
          accessibilityLabel="Continue to review"
          accessibilityState={{ disabled: !isValid && didAttemptSubmit }}
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
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 1,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  warningText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 4,
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
