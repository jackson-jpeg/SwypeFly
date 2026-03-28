import { useEffect, useRef, useState, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme/tokens';
import { lightHaptic } from '../../utils/haptics';

const CHAR_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CYCLE_INTERVAL = 100; // ms between random chars (was 60 — reduced CPU from ~4000 to ~2400 updates/sec)
const DEFAULT_DURATION = 400; // total cycling time (was 500 — settle faster)

interface SplitFlapCharProps {
  target: string;
  delay: number;
  duration?: number;
  size: 'sm' | 'md' | 'lg' | 'xl';
  color: string;
  animate: boolean;
  isFirstInColumn?: boolean;
  onSettled?: () => void;
}

const SIZES = {
  sm: { width: 13, height: 22, fontSize: 16 },
  md: { width: 17, height: 28, fontSize: 22 },
  lg: { width: 28, height: 44, fontSize: 36 },
  xl: { width: 136, height: 196, fontSize: 144 },
} as const;

function SplitFlapChar({
  target,
  delay,
  duration = DEFAULT_DURATION,
  size,
  color,
  animate,
  isFirstInColumn = false,
  onSettled,
}: SplitFlapCharProps) {
  const [displayChar, setDisplayChar] = useState(target || ' ');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSpace = target === ' ' || target === '';

  useEffect(() => {
    // Clean up previous animation
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);

    if (!animate || isSpace) {
      setDisplayChar(target || ' ');
      return;
    }

    // Start cycling after delay
    timeoutRef.current = setTimeout(() => {
      // Cycle through random characters
      intervalRef.current = setInterval(() => {
        setDisplayChar(CHAR_POOL[Math.floor(Math.random() * CHAR_POOL.length)]);
      }, CYCLE_INTERVAL);

      // Settle on target after duration (or cycle indefinitely if no target)
      if (target) {
        settleTimeoutRef.current = setTimeout(() => {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setDisplayChar(target);
          if (isFirstInColumn) lightHaptic();
          onSettled?.();
        }, duration);
      }
    }, delay);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    };
  }, [target, animate, delay, duration, isFirstInColumn, onSettled, isSpace]);

  const dims = SIZES[size];
  const borderRadius = Math.max(2, dims.width * 0.08);
  const borderWidth = Math.max(0.5, dims.width * 0.012);
  const splitLineHeight = Math.max(0.5, dims.height * 0.012);

  if (isSpace) {
    return (
      <View
        style={[
          styles.cell,
          {
            width: dims.width,
            height: dims.height,
            backgroundColor: 'transparent',
            borderWidth: 0,
            borderRadius: 0,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.cell,
        {
          width: dims.width,
          height: dims.height,
          borderRadius,
          borderWidth,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize: dims.fontSize, color }]}>{displayChar}</Text>
      {/* Flap split line */}
      <View style={[styles.splitLine, { height: splitLineHeight }]} />
    </View>
  );
}

export default memo(SplitFlapChar);

const styles = StyleSheet.create({
  cell: {
    backgroundColor: colors.cell,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  text: {
    fontFamily: fonts.display,
    textAlign: 'center',
  },
  splitLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: '#0A0A0880',
  },
});
