import { useEffect, useRef, useState, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme/tokens';
import { lightHaptic } from '../../utils/haptics';

const CHAR_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CYCLE_INTERVAL = 60; // ms between random chars
const DEFAULT_DURATION = 500; // total cycling time

interface SplitFlapCharProps {
  target: string;
  delay: number;
  duration?: number;
  size: 'sm' | 'md';
  color: string;
  animate: boolean;
  isFirstInColumn?: boolean;
  onSettled?: () => void;
}

const SIZES = {
  sm: { width: 13, height: 22, fontSize: 16 },
  md: { width: 17, height: 28, fontSize: 22 },
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

  if (isSpace) {
    return (
      <View
        style={[
          styles.cell,
          { width: dims.width, height: dims.height, backgroundColor: 'transparent', borderWidth: 0 },
        ]}
      />
    );
  }

  return (
    <View style={[styles.cell, { width: dims.width, height: dims.height }]}>
      <Text style={[styles.text, { fontSize: dims.fontSize, color }]}>{displayChar}</Text>
      {/* Flap split line */}
      <View style={styles.splitLine} />
    </View>
  );
}

export default memo(SplitFlapChar);

const styles = StyleSheet.create({
  cell: {
    backgroundColor: colors.cell,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 2,
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
