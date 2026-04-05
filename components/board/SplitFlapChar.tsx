import { useEffect, useRef, useState, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme/tokens';
import { lightHaptic } from '../../utils/haptics';

const CHAR_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$.-!?';
const SCRAMBLE_INTERVAL = 55; // ms between random chars during scramble phase
const SCRAMBLE_ITERATIONS_MIN = 8;
const SCRAMBLE_ITERATIONS_MAX = 12;

// Monochrome palette — white/grey flashes on dark cells during the scramble phase.
const SCRAMBLE_COLORS = [
  '#F5F5F5', // white
  '#CCCCCC', // light grey
  '#888888', // mid grey
  '#F5F5F5', // white
  '#555555', // dark grey
  '#CCCCCC', // light grey
];
const SCRAMBLE_TEXT_COLOR = '#0A0A0A'; // dark text on light scramble backgrounds

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
  md: { width: 18, height: 26, fontSize: 18 },
  lg: { width: 28, height: 44, fontSize: 36 },
  xl: { width: 136, height: 196, fontSize: 144 },
} as const;

function SplitFlapChar({
  target,
  delay,
  duration,
  size,
  color,
  animate,
  isFirstInColumn = false,
  onSettled,
}: SplitFlapCharProps) {
  const [displayChar, setDisplayChar] = useState(target || ' ');
  const [bgColor, setBgColor] = useState<string | null>(null);
  const [textColor, setTextColor] = useState(color);
  const cleanupRef = useRef<(() => void) | null>(null);
  const isSpace = target === ' ' || target === '';

  useEffect(() => {
    // Clean up previous animation
    cleanupRef.current?.();
    cleanupRef.current = null;

    if (!animate || isSpace) {
      setDisplayChar(target || ' ');
      setBgColor(null);
      setTextColor(color);
      return;
    }

    let cancelled = false;
    const iterations =
      SCRAMBLE_ITERATIONS_MIN +
      Math.floor(Math.random() * (SCRAMBLE_ITERATIONS_MAX - SCRAMBLE_ITERATIONS_MIN + 1));

    const delayTimeout = setTimeout(() => {
      if (cancelled) return;

      let i = 0;
      const scrambleInterval = setInterval(() => {
        if (cancelled) {
          clearInterval(scrambleInterval);
          return;
        }

        if (i < iterations) {
          // Scramble phase: random char + monochrome color flash
          setDisplayChar(CHAR_POOL[Math.floor(Math.random() * CHAR_POOL.length)]);
          setBgColor(SCRAMBLE_COLORS[i % SCRAMBLE_COLORS.length]);
          setTextColor(SCRAMBLE_TEXT_COLOR);
          i++;
        } else {
          // Settle: show target character, restore normal styling
          clearInterval(scrambleInterval);
          if (!cancelled) {
            setDisplayChar(target);
            setBgColor(null);
            setTextColor(color);
            if (isFirstInColumn) lightHaptic();
            onSettled?.();
          }
        }
      }, SCRAMBLE_INTERVAL);

      cleanupRef.current = () => {
        clearInterval(scrambleInterval);
      };
    }, delay);

    cleanupRef.current = () => {
      clearTimeout(delayTimeout);
    };

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [target, animate, delay, size, color, isFirstInColumn, onSettled, isSpace]);

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
          backgroundColor: bgColor || colors.cell,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize: dims.fontSize, color: textColor }]}>
        {displayChar}
      </Text>
      {/* Flap split line — hide during scramble for cleaner flash effect */}
      {!bgColor && <View style={[styles.splitLine, { height: splitLineHeight }]} />}
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
