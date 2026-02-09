import { View, Text, Platform } from 'react-native';
import { SavedGrid } from '../../components/saved/SavedGrid';

export default function SavedTab() {
  if (Platform.OS === 'web') {
    return (
      <div style={{
        flex: 1, backgroundColor: '#F8FAFC', minHeight: '100vh',
        paddingBottom: 80,
      }}>
        <div style={{ padding: '56px 20px 12px 20px' }}>
          <h1 style={{ margin: 0, color: '#1E293B', fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>
            Saved
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#94A3B8', fontSize: 14 }}>
            Your travel wishlist
          </p>
        </div>
        <SavedGrid />
      </div>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 }}>
        <Text style={{ color: '#1E293B', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>Saved</Text>
        <Text style={{ color: '#94A3B8', fontSize: 14, marginTop: 4 }}>Your travel wishlist</Text>
      </View>
      <SavedGrid />
    </View>
  );
}
