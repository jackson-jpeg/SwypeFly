import { View, ActivityIndicator, Platform } from 'react-native';
import { useEffect } from 'react';

const SPIN_CSS_ID = 'sg-spin-css';

export function LoadingSpinner() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (document.getElementById(SPIN_CSS_ID)) return;
    const style = document.createElement('style');
    style.id = SPIN_CSS_ID;
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }, []);

  if (Platform.OS === 'web') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flex: 1, backgroundColor: '#F8FAFC', minHeight: '100vh',
      }}>
        <div style={{
          width: 40, height: 40, border: '3px solid #E2E8F0',
          borderTopColor: '#38BDF8', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
      <ActivityIndicator size="large" color="#38BDF8" />
    </View>
  );
}
