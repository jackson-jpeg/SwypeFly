import { View, Text, Pressable, Platform } from 'react-native';
import { colors, radii, spacing, fontSize, fontWeight } from '../../constants/theme';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Something went wrong', onRetry }: ErrorStateProps) {
  if (Platform.OS === 'web') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flex: 1, padding: `${spacing['15']}px ${spacing['8']}px`, backgroundColor: colors.background, minHeight: '100vh',
      }}>
        <span style={{ fontSize: 48 }}>😵</span>
        <span style={{ color: colors.text.primary, fontSize: fontSize['3xl'], fontWeight: fontWeight.semibold, marginTop: spacing['4'], textAlign: 'center' }}>
          {message}
        </span>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginTop: spacing['5'], background: colors.primary, color: '#fff', border: 'none',
              borderRadius: radii.lg, padding: `${spacing['3']}px ${spacing['8']}px`,
              fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, paddingHorizontal: spacing['8'] }}>
      <Text style={{ fontSize: 48 }}>😵</Text>
      <Text style={{ color: colors.text.primary, fontSize: fontSize['3xl'], fontWeight: fontWeight.semibold, textAlign: 'center', marginTop: spacing['4'] }}>
        {message}
      </Text>
      {onRetry && (
        <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Try again" style={{ marginTop: spacing['5'], backgroundColor: colors.primary, borderRadius: radii.lg, paddingHorizontal: spacing['6'], paddingVertical: spacing['3'] }}>
          <Text style={{ color: '#fff', fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }}>Try Again</Text>
        </Pressable>
      )}
    </View>
  );
}
