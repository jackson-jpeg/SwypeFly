import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeOutLeft,
  FadeInRight,
  FadeOutRight,
  FadeInLeft,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { airports, type Airport } from '../data/airports';
import { useSettingsStore } from '../stores/settingsStore';
import type { BudgetPreference } from '../stores/settingsStore';
import { colors, fonts, spacing } from '../theme/tokens';
import { lightHaptic, successHaptic } from '../utils/haptics';
import SplitFlapRow from '../components/board/SplitFlapRow';

const TOTAL_STEPS = 4;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SAMPLE_DESTINATIONS = [
  { city: 'BARCELONA', price: '$287' },
  { city: 'TOKYO', price: '$412' },
  { city: 'BALI', price: '$389' },
  { city: 'PARIS', price: '$310' },
  { city: 'SANTORINI', price: '$345' },
];

const VALUE_PROPS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'airplane-outline', text: 'Discover deals you won\'t find elsewhere' },
  { icon: 'heart-outline', text: 'Save favorites and track prices' },
  { icon: 'flash-outline', text: 'Book in seconds, save hundreds' },
];

const BUDGET_OPTIONS: {
  key: BudgetPreference;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'budget', label: 'Budget Traveler', description: 'Under $200 round trip', icon: 'bag-outline' },
  { key: 'balanced', label: 'Balanced', description: '$200-500 round trip', icon: 'airplane-outline' },
  { key: 'premium', label: 'Premium', description: '$500+ for the right deal', icon: 'diamond-outline' },
];

// ---------------------------------------------------------------------------
// Step indicator dots
// ---------------------------------------------------------------------------
function StepDots({ current }: { current: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === current ? styles.dotActive : styles.dotInactive]}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 0 — Welcome
// ---------------------------------------------------------------------------
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.stepContainer}>
      <Animated.Text entering={FadeInUp.delay(100).duration(500)} style={styles.welcomeEmoji}>
        ✈️
      </Animated.Text>
      <Animated.Text entering={FadeInUp.delay(200).duration(500)} style={styles.brand}>
        SOGOJET
      </Animated.Text>
      <Animated.Text entering={FadeInUp.delay(350).duration(500)} style={styles.taglineLarge}>
        Swipe. Save. Fly.
      </Animated.Text>

      <View style={styles.valuePropsContainer}>
        {VALUE_PROPS.map((prop, i) => (
          <Animated.View
            key={prop.icon}
            entering={FadeInUp.delay(500 + i * 120).duration(500)}
            style={styles.valuePropRow}
          >
            <View style={styles.valuePropIconCircle}>
              <Ionicons name={prop.icon} size={22} color={colors.yellow} />
            </View>
            <Text style={styles.valuePropLabel}>{prop.text}</Text>
          </Animated.View>
        ))}
      </View>

      <Animated.View entering={FadeInUp.delay(900).duration(500)} style={styles.bottomAction}>
        <Pressable style={styles.primaryButton} onPress={onNext}>
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Airport Selection (existing logic preserved)
// ---------------------------------------------------------------------------
function AirportStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const { setDeparture } = useSettingsStore();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Airport | null>(null);

  // Cycling destination teaser
  const [destIdx, setDestIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setDestIdx((i) => (i + 1) % SAMPLE_DESTINATIONS.length);
    }, 2500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return airports
      .filter((a) => a.code.toLowerCase().includes(q) || a.city.toLowerCase().includes(q))
      .slice(0, 5);
  }, [query]);

  const handleSelect = (airport: Airport) => {
    setSelected(airport);
    setQuery(`${airport.city} (${airport.code})`);
  };

  const handleContinue = () => {
    if (!selected) return;
    setDeparture(selected.city, selected.code);
    onNext();
  };

  return (
    <KeyboardAvoidingView
      style={styles.stepContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Cycling destination teaser */}
      <View style={styles.teaserRow}>
        <View style={styles.teaserCell}>
          <SplitFlapRow
            text={SAMPLE_DESTINATIONS[destIdx].city}
            maxLength={12}
            size="md"
            color={colors.yellow}
            align="left"
            startDelay={0}
            staggerMs={30}
            animate={true}
          />
        </View>
        <View style={styles.teaserCell}>
          <SplitFlapRow
            text={SAMPLE_DESTINATIONS[destIdx].price}
            maxLength={5}
            size="md"
            color={colors.green}
            align="right"
            startDelay={100}
            animate={true}
          />
        </View>
      </View>

      <Text style={styles.heading}>Where are you flying from?</Text>

      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Search airports..."
          placeholderTextColor={colors.faint}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setSelected(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>

      {results.length > 0 && !selected && (
        <View style={styles.results}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable style={styles.resultRow} onPress={() => handleSelect(item)}>
                <Text style={styles.resultCode}>{item.code}</Text>
                <Text style={styles.resultCity}>{item.city}</Text>
              </Pressable>
            )}
          />
        </View>
      )}

      <View style={styles.bottomAction}>
        <Pressable
          style={[styles.primaryButton, !selected && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!selected}
        >
          <Text style={[styles.primaryButtonText, !selected && styles.buttonTextDisabled]}>
            Continue
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Budget Preference
// ---------------------------------------------------------------------------
function BudgetStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const { setBudgetPreference, budgetPreference } = useSettingsStore();
  const [selected, setSelected] = useState<BudgetPreference | null>(budgetPreference);

  const handleSelect = async (key: BudgetPreference) => {
    setSelected(key);
    setBudgetPreference(key);
    await lightHaptic();
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.heading}>What's your travel style?</Text>
      <Text style={styles.subheading}>This helps us find the best deals for you</Text>

      <View style={styles.budgetCards}>
        {BUDGET_OPTIONS.map((opt, i) => {
          const isSelected = selected === opt.key;
          return (
            <Animated.View key={opt.key} entering={FadeInUp.delay(150 + i * 100).duration(400)}>
              <Pressable
                style={[styles.budgetCard, isSelected && styles.budgetCardSelected]}
                onPress={() => handleSelect(opt.key)}
              >
                <View
                  style={[
                    styles.budgetIconCircle,
                    isSelected && styles.budgetIconCircleSelected,
                  ]}
                >
                  <Ionicons
                    name={opt.icon}
                    size={26}
                    color={isSelected ? colors.bg : colors.muted}
                  />
                </View>
                <View style={styles.budgetTextBlock}>
                  <Text style={[styles.budgetLabel, isSelected && styles.budgetLabelSelected]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.budgetDesc}>{opt.description}</Text>
                </View>
                {isSelected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={colors.yellow}
                    style={styles.budgetCheck}
                  />
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      <View style={styles.bottomAction}>
        <Pressable
          style={[styles.primaryButton, !selected && styles.buttonDisabled]}
          onPress={onNext}
          disabled={!selected}
        >
          <Text style={[styles.primaryButtonText, !selected && styles.buttonTextDisabled]}>
            Continue
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Swipe Tutorial
// ---------------------------------------------------------------------------
function SwipeTutorialStep({ onComplete }: { onComplete: () => void }) {
  // Animated arrows
  const leftArrowX = useSharedValue(0);
  const rightArrowX = useSharedValue(0);
  const tapScale = useSharedValue(1);

  useEffect(() => {
    leftArrowX.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    rightArrowX.value = withRepeat(
      withSequence(
        withTiming(12, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    tapScale.value = withRepeat(
      withSequence(
        withDelay(200, withTiming(0.9, { duration: 300 })),
        withTiming(1, { duration: 300 }),
      ),
      -1,
      false,
    );
  }, [leftArrowX, rightArrowX, tapScale]);

  const leftArrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: leftArrowX.value }],
  }));
  const rightArrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: rightArrowX.value }],
  }));
  const tapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: tapScale.value }],
  }));

  return (
    <View style={styles.stepContainer}>
      <Animated.Text entering={FadeInUp.delay(100).duration(400)} style={styles.heading}>
        How it works
      </Animated.Text>

      {/* Demo card */}
      <Animated.View entering={FadeInUp.delay(250).duration(500)} style={styles.demoCard}>
        <View style={styles.demoCardInner}>
          <Text style={styles.demoCardCity}>BARCELONA</Text>
          <Text style={styles.demoCardPrice}>$287</Text>
        </View>

        {/* Left arrow */}
        <Animated.View style={[styles.arrowLeft, leftArrowStyle]}>
          <Ionicons name="arrow-back-circle" size={40} color="#E05555" />
        </Animated.View>

        {/* Right arrow */}
        <Animated.View style={[styles.arrowRight, rightArrowStyle]}>
          <Ionicons name="arrow-forward-circle" size={40} color={colors.green} />
        </Animated.View>

        {/* Tap indicator */}
        <Animated.View style={[styles.tapIndicator, tapStyle]}>
          <Ionicons name="finger-print-outline" size={28} color={colors.yellow} />
        </Animated.View>
      </Animated.View>

      {/* Legend */}
      <View style={styles.tutorialLegend}>
        <Animated.View entering={FadeInUp.delay(500).duration(400)} style={styles.legendRow}>
          <Ionicons name="heart" size={20} color={colors.green} />
          <Text style={styles.legendText}>Swipe right to save</Text>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(620).duration(400)} style={styles.legendRow}>
          <Ionicons name="close-circle" size={20} color="#E05555" />
          <Text style={styles.legendText}>Swipe left to skip</Text>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(740).duration(400)} style={styles.legendRow}>
          <Ionicons name="expand" size={20} color={colors.yellow} />
          <Text style={styles.legendText}>Tap for details</Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInUp.delay(900).duration(400)} style={styles.bottomAction}>
        <Pressable style={styles.primaryButton} onPress={onComplete}>
          <Text style={styles.primaryButtonText}>I'm ready!</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Onboarding Screen
// ---------------------------------------------------------------------------
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setOnboarded } = useSettingsStore();
  const [step, setStep] = useState(0);
  // Track direction for animation: 1 = forward, -1 = backward
  const [direction, setDirection] = useState(1);

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const handleComplete = useCallback(async () => {
    setOnboarded();
    await successHaptic();
    router.replace('/(tabs)');
  }, [setOnboarded, router]);

  // Choose enter/exit animations based on direction
  const enterAnim = direction === 1 ? FadeInRight.duration(300) : FadeInLeft.duration(300);
  const exitAnim = direction === 1 ? FadeOutLeft.duration(200) : FadeOutRight.duration(200);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      {/* Header: back button + step dots */}
      <View style={styles.header}>
        {step > 0 ? (
          <Pressable onPress={goBack} style={styles.backButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.white} />
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <StepDots current={step} />
        <View style={styles.backPlaceholder} />
      </View>

      {/* Step content */}
      <Animated.View key={step} entering={enterAnim} exiting={exitAnim} style={styles.stepWrapper}>
        {step === 0 && <WelcomeStep onNext={goNext} />}
        {step === 1 && <AirportStep onNext={goNext} onBack={goBack} />}
        {step === 2 && <BudgetStep onNext={goNext} onBack={goBack} />}
        {step === 3 && <SwipeTutorialStep onComplete={handleComplete} />}
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backPlaceholder: {
    width: 36,
  },

  // Step dots
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.yellow,
    width: 24,
    borderRadius: 4,
  },
  dotInactive: {
    backgroundColor: colors.border,
  },

  // Step wrapper
  stepWrapper: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },

  // Welcome step
  welcomeEmoji: {
    fontSize: 56,
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 44,
    color: colors.yellow,
    textAlign: 'center',
    letterSpacing: 6,
    marginBottom: spacing.sm,
  },
  taglineLarge: {
    fontFamily: fonts.accent,
    fontSize: 22,
    color: colors.whiteDim,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  valuePropsContainer: {
    gap: 20,
    marginBottom: spacing.xl,
  },
  valuePropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: spacing.sm,
  },
  valuePropIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cell,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  valuePropLabel: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.white,
    flex: 1,
  },

  // Airport step (preserved from original)
  teaserRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teaserCell: {
    flexDirection: 'row',
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 32,
  },
  subheading: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.lg,
    marginTop: -spacing.sm,
  },
  inputWrapper: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    marginBottom: spacing.sm,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  results: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  resultCode: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.yellow,
    width: 48,
  },
  resultCity: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.white,
  },

  // Budget step
  budgetCards: {
    gap: 14,
    marginBottom: spacing.lg,
  },
  budgetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 14,
  },
  budgetCardSelected: {
    borderColor: colors.yellow,
    backgroundColor: `${colors.yellow}08`,
  },
  budgetIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.cell,
    justifyContent: 'center',
    alignItems: 'center',
  },
  budgetIconCircleSelected: {
    backgroundColor: colors.yellow,
  },
  budgetTextBlock: {
    flex: 1,
  },
  budgetLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.white,
    marginBottom: 2,
  },
  budgetLabelSelected: {
    color: colors.yellow,
  },
  budgetDesc: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
  },
  budgetCheck: {
    marginLeft: 'auto',
  },

  // Swipe tutorial
  demoCard: {
    alignSelf: 'center',
    width: SCREEN_WIDTH * 0.7,
    aspectRatio: 0.75,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'visible',
    marginBottom: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoCardInner: {
    alignItems: 'center',
    gap: 8,
  },
  demoCardCity: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.white,
    letterSpacing: 3,
  },
  demoCardPrice: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.green,
  },
  arrowLeft: {
    position: 'absolute',
    left: -28,
    top: '45%',
  },
  arrowRight: {
    position: 'absolute',
    right: -28,
    top: '45%',
  },
  tapIndicator: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
  },
  tutorialLegend: {
    gap: 16,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.whiteDim,
  },

  // Shared
  bottomAction: {
    marginTop: 'auto',
    paddingBottom: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.yellow,
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: fonts.display,
    fontSize: 19,
    color: colors.bg,
    letterSpacing: 1,
  },
  buttonDisabled: {
    backgroundColor: colors.cell,
  },
  buttonTextDisabled: {
    color: colors.faint,
  },
});
