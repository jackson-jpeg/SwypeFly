import { View, Text, Pressable, Platform } from 'react-native';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Something went wrong', onRetry }: ErrorStateProps) {
  if (Platform.OS === 'web') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flex: 1, padding: '60px 32px', backgroundColor: '#0A0A0A', minHeight: '100vh',
      }}>
        <span style={{ fontSize: 48 }}>😵</span>
        <span style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginTop: 16, textAlign: 'center' }}>{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginTop: 20, background: '#FF6B35', color: '#fff', border: 'none',
              borderRadius: 12, padding: '12px 32px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A', paddingHorizontal: 32 }}>
      <Text style={{ fontSize: 48 }}>⚠️</Text>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center', marginTop: 16 }}>{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} style={{ marginTop: 20, backgroundColor: '#FF6B35', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Try Again</Text>
        </Pressable>
      )}
    </View>
  );
}
