import { View, ActivityIndicator, Platform } from 'react-native';
import { colors } from '../../constants/theme';

export function LoadingSpinner() {
  // spin keyframes defined in global.css

  if (Platform.OS === 'web') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flex: 1, backgroundColor: colors.background, minHeight: '100vh',
      }}>
        <div style={{
          width: 40, height: 40, border: `3px solid ${colors.border}`,
          borderTopColor: colors.primary, borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
