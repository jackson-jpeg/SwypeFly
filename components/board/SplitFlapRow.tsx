import { useCallback, useRef, memo } from 'react';
import { View, StyleSheet } from 'react-native';
import SplitFlapChar from './SplitFlapChar';

interface SplitFlapRowProps {
  text: string;
  maxLength: number;
  size: 'sm' | 'md' | 'lg';
  color: string;
  align: 'left' | 'right';
  staggerMs?: number;
  startDelay?: number;
  animate: boolean;
  onComplete?: () => void;
}

function SplitFlapRow({
  text,
  maxLength,
  size,
  color,
  align,
  staggerMs = 25,
  startDelay = 0,
  animate,
  onComplete,
}: SplitFlapRowProps) {
  const settledCount = useRef(0);
  const totalNonSpace = useRef(0);

  // Pad text to maxLength
  const truncated = text.slice(0, maxLength).toUpperCase();
  const padded =
    align === 'right'
      ? truncated.padStart(maxLength, ' ')
      : truncated.padEnd(maxLength, ' ');

  const chars = padded.split('');

  // Count non-space chars for completion tracking
  totalNonSpace.current = chars.filter((c) => c !== ' ').length;
  settledCount.current = 0;

  const handleSettled = useCallback(() => {
    settledCount.current += 1;
    if (settledCount.current >= totalNonSpace.current) {
      onComplete?.();
    }
  }, [onComplete]);

  // Find index of first non-space char (for haptic)
  const firstNonSpaceIdx = chars.findIndex((c) => c !== ' ');

  return (
    <View style={styles.row}>
      {chars.map((char, i) => (
        <SplitFlapChar
          key={`${i}-${char}`}
          target={char}
          delay={startDelay + i * staggerMs}
          size={size}
          color={color}
          animate={animate}
          isFirstInColumn={i === firstNonSpaceIdx}
          onSettled={char !== ' ' ? handleSettled : undefined}
        />
      ))}
    </View>
  );
}

export default memo(SplitFlapRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 1.5,
  },
});
