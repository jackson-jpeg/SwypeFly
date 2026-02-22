import { View, Text, Platform, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSize, fontWeight } from '../constants/theme';

export default function NotFound() {
  if (Platform.OS === 'web') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', backgroundColor: '#0F172A', padding: 32, textAlign: 'center',
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🌎</div>
        <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 800, margin: '0 0 8px 0' }}>
          Lost in transit
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, margin: '0 0 32px 0', lineHeight: 1.5 }}>
          This destination doesn't exist... yet.<br />
          Let's get you back on track.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => router.replace('/')}
            style={{
              padding: '14px 28px', borderRadius: 9999,
              backgroundColor: '#38BDF8', border: 'none',
              color: '#0F172A', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}
          >Explore Destinations</button>
          <button
            onClick={() => router.back()}
            style={{
              padding: '14px 28px', borderRadius: 9999,
              backgroundColor: 'transparent', border: '1.5px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}
          >Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', padding: 32 }}>
      <Text style={{ fontSize: 64, marginBottom: 16 }}>🌎</Text>
      <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800', textAlign: 'center' }}>Lost in transit</Text>
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, textAlign: 'center', marginTop: 8, marginBottom: 32 }}>
        This destination doesn't exist... yet.
      </Text>
      <Pressable onPress={() => router.replace('/')} style={{ backgroundColor: '#38BDF8', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 9999 }}>
        <Text style={{ color: '#0F172A', fontSize: 16, fontWeight: '700' }}>Explore Destinations</Text>
      </Pressable>
    </View>
  );
}
