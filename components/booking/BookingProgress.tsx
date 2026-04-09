import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { usePathname } from 'expo-router';
import { colors, fonts, spacing } from '../../theme/tokens';

const STEPS = [
  { key: 'trip', label: 'Trip' },
  { key: 'index', label: 'Flights' },
  { key: 'passengers', label: 'Passengers' },
  { key: 'seats', label: 'Seats' },
  { key: 'services', label: 'Extras' },
  { key: 'review', label: 'Review' },
] as const;

function getStepIndex(pathname: string): number {
  const segment = pathname.split('/').pop() || '';
  // 'dates' is a sub-step of trip
  if (segment === 'dates') return 0;
  const idx = STEPS.findIndex((s) => s.key === segment);
  // booking/[id] root is flight selection (index)
  if (idx === -1 && pathname.includes('/booking/')) return 1;
  return Math.max(idx, 0);
}

export default function BookingProgress() {
  const pathname = usePathname();
  const currentStep = getStepIndex(pathname);

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      <View style={styles.track}>
        {STEPS.map((step, i) => {
          const isComplete = i < currentStep;
          const isCurrent = i === currentStep;
          return (
            <View key={step.key} style={styles.stepWrapper}>
              {/* Connector line (skip before first) */}
              {i > 0 && (
                <View
                  style={[
                    styles.connector,
                    isComplete && styles.connectorComplete,
                  ]}
                />
              )}
              {/* Dot */}
              <View
                style={[
                  styles.dot,
                  isComplete && styles.dotComplete,
                  isCurrent && styles.dotCurrent,
                ]}
                accessibilityRole="text"
                accessibilityLabel={`Step ${i + 1} of ${STEPS.length}: ${step.label}${isCurrent ? ', current' : isComplete ? ', complete' : ''}`}
              />
            </View>
          );
        })}
      </View>
      <Text style={styles.label}>
        {STEPS[currentStep]?.label}
        <Text style={styles.labelCount}>{`  ${currentStep + 1}/${STEPS.length}`}</Text>
      </Text>
    </Animated.View>
  );
}

const DOT_SIZE = 8;
const DOT_CURRENT_SIZE = 10;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 280,
    justifyContent: 'center',
  },
  stepWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 2,
  },
  connectorComplete: {
    backgroundColor: colors.yellow,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.border,
  },
  dotComplete: {
    backgroundColor: colors.yellow,
  },
  dotCurrent: {
    width: DOT_CURRENT_SIZE,
    height: DOT_CURRENT_SIZE,
    borderRadius: DOT_CURRENT_SIZE / 2,
    backgroundColor: colors.yellow,
    borderWidth: 2,
    borderColor: colors.bg,
    shadowColor: colors.yellow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  label: {
    fontFamily: fonts.display,
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  labelCount: {
    color: colors.faint,
    fontSize: 10,
  },
});
