import { View, Text, Platform } from 'react-native';
import { SavedGrid } from '../../components/saved/SavedGrid';
import { colors, spacing, fontSize, fontWeight } from '../../constants/theme';

export default function SavedTab() {
  if (Platform.OS === 'web') {
    return (
      <div style={{
        flex: 1, backgroundColor: colors.background, minHeight: '100vh',
        paddingBottom: 80,
      }}>
        <div style={{ padding: `${spacing['14']}px ${spacing['5']}px ${spacing['3']}px ${spacing['5']}px` }}>
          <h1 style={{ margin: 0, color: colors.text.primary, fontSize: fontSize['6xl'], fontWeight: fontWeight.extrabold, letterSpacing: -0.5 }}>
            Saved
          </h1>
          <p style={{ margin: `${spacing['1']}px 0 0 0`, color: colors.text.muted, fontSize: fontSize.lg }}>
            Your travel wishlist
          </p>
        </div>
        <SavedGrid />
      </div>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing['5'], paddingTop: spacing['14'], paddingBottom: spacing['3'] }}>
        <Text style={{ color: colors.text.primary, fontSize: fontSize['6xl'], fontWeight: fontWeight.extrabold, letterSpacing: -0.5 }}>Saved</Text>
        <Text style={{ color: colors.text.muted, fontSize: fontSize.lg, marginTop: spacing['1'] }}>Your travel wishlist</Text>
      </View>
      <SavedGrid />
    </View>
  );
}
