import { View, Text, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';

export default function NotFoundScreen() {
  if (Platform.OS === 'web') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', backgroundColor: '#0A0A0A', padding: 32,
      }}>
        <span style={{ fontSize: 64 }}>✈️</span>
        <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: '16px 0 0 0' }}>Page Not Found</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, textAlign: 'center', margin: '8px 0 0 0' }}>
          This destination doesn't exist yet. Let's get you back on track.
        </p>
        <button
          onClick={() => router.replace('/')}
          style={{
            marginTop: 24, background: '#FF6B35', color: '#fff', border: 'none',
            borderRadius: 14, padding: '14px 32px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Back to Explore
        </button>
      </div>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A', paddingHorizontal: 32 }}>
      <Text style={{ fontSize: 64 }}>✈️</Text>
      <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 16 }}>Page Not Found</Text>
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, textAlign: 'center', marginTop: 8 }}>
        This destination doesn't exist yet. Let's get you back on track.
      </Text>
      <Pressable onPress={() => router.replace('/')} style={{ marginTop: 24, backgroundColor: '#FF6B35', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Back to Explore</Text>
      </Pressable>
    </View>
  );
}
