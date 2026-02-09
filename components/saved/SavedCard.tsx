import { Pressable, Text, View, Platform } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { formatFlightPrice } from '../../utils/formatPrice';
import type { Destination } from '../../types/destination';

interface SavedCardProps {
  destination: Destination;
}

export function SavedCard({ destination }: SavedCardProps) {
  const handlePress = () => router.push(`/destination/${destination.id}`);

  if (Platform.OS === 'web') {
    return (
      <>
        <style>{`
          .sg-saved-card {
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          .sg-saved-card:hover {
            transform: scale(1.02);
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
          }
          .sg-saved-card:hover .sg-saved-img {
            filter: brightness(1.08);
          }
          .sg-saved-card:active {
            transform: scale(0.98);
          }
        `}</style>
        <div
          className="sg-saved-card"
          onClick={handlePress}
          style={{
            position: 'relative',
            borderRadius: 16,
            overflow: 'hidden',
            cursor: 'pointer',
            aspectRatio: '3/4',
            backgroundColor: '#1A1A1A',
          }}
        >
          <img
            className="sg-saved-img"
            src={destination.imageUrl}
            alt={destination.city}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              transition: 'filter 0.2s ease',
            }}
            loading="lazy"
          />
          {/* Bottom overlay */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
            padding: '32px 14px 14px 14px',
          }}>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{destination.city}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>{destination.country}</div>
            <div style={{ color: '#FF8F65', fontSize: 12, fontWeight: 600, marginTop: 4 }}>
              {formatFlightPrice(destination.flightPrice, destination.currency)}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <Pressable onPress={handlePress} style={{ borderRadius: 16, overflow: 'hidden', aspectRatio: 0.75, backgroundColor: '#1A1A1A' }}>
      <Image source={{ uri: destination.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{destination.city}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>{destination.country}</Text>
      </View>
    </Pressable>
  );
}
