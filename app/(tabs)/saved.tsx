import { View, Text, Platform } from 'react-native';
import { SavedGrid } from '../../components/saved/SavedGrid';

export default function SavedTab() {
  if (Platform.OS === 'web') {
    return (
      <div style={{
        flex: 1, backgroundColor: '#0A0A0A', minHeight: '100vh',
        paddingBottom: 80,
      }}>
        <div style={{ padding: '56px 20px 12px 20px' }}>
          <h1 style={{ margin: 0, color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>
            Saved
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            Your travel wishlist
          </p>
        </div>
        <SavedGrid />
      </div>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 }}>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>Saved</Text>
        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4 }}>Your travel wishlist</Text>
      </View>
      <SavedGrid />
    </View>
  );
}
