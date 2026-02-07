import { View, Platform } from 'react-native';
import { SwipeFeed } from '../../components/swipe/SwipeFeed';

export default function ExploreTab() {
  if (Platform.OS === 'web') {
    return (
      <div style={{ width: '100%', height: '100vh', backgroundColor: '#0A0A0A', position: 'relative' }}>
        <SwipeFeed />
      </div>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <SwipeFeed />
    </View>
  );
}
