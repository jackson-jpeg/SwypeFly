import { View, Text, Pressable, Platform, ActivityIndicator, Linking } from 'react-native';
import { useNearbyGems } from '../../hooks/useAI';

interface NearbyGemsProps {
  city: string;
  country: string;
}

export default function NearbyGems({ city, country }: NearbyGemsProps) {
  const { data, isLoading } = useNearbyGems(city, country);

  if (!data && !isLoading) return null;

  if (Platform.OS === 'web') {
    return (
      <div style={{ marginTop: 24 }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#1E293B', fontSize: 18, fontWeight: 700 }}>
          Hidden Gems
        </h3>

        {isLoading && (
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20,
            border: '1px solid #E2E8F0', textAlign: 'center',
          }}>
            <div style={{ width: 20, height: 20, border: '2px solid #E2E8F0', borderTopColor: '#38BDF8', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        )}

        {data && data.places.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.places.map((place, i) => (
              <a
                key={i}
                href={place.mapsUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  backgroundColor: '#FFFFFF', borderRadius: 12, padding: '12px 16px',
                  border: '1px solid #E2E8F0',
                  textDecoration: 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(56,189,248,0.3)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(56,189,248,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E2E8F0';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: 'rgba(56,189,248,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 16 }}>{'\uD83D\uDCCD'}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#1E293B', fontSize: 14, fontWeight: 600 }}>{place.name}</div>
                  {place.description && (
                    <div style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>{place.description}</div>
                  )}
                </div>
                <span style={{ color: '#94A3B8', fontSize: 12, flexShrink: 0 }}>
                  Open in Maps &#8599;
                </span>
              </a>
            ))}
          </div>
        )}

        {data && data.places.length === 0 && (
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
            border: '1px solid #E2E8F0',
          }}>
            <p style={{ margin: 0, color: '#94A3B8', fontSize: 14 }}>No hidden gems found yet.</p>
          </div>
        )}
      </div>
    );
  }

  // ── Native ──
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={{ color: '#1E293B', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
        Hidden Gems
      </Text>

      {isLoading && (
        <View style={{
          backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20,
          borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center',
        }}>
          <ActivityIndicator color="#38BDF8" size="small" />
        </View>
      )}

      {data && data.places.length > 0 && (
        <View style={{ gap: 10 }}>
          {data.places.map((place, i) => (
            <Pressable
              key={i}
              onPress={() => place.mapsUrl && Linking.openURL(place.mapsUrl)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12,
                borderWidth: 1, borderColor: '#E2E8F0',
              }}
            >
              <View style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: 'rgba(56,189,248,0.1)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 16 }}>{'\uD83D\uDCCD'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#1E293B', fontSize: 14, fontWeight: '600' }}>{place.name}</Text>
                {place.description ? (
                  <Text style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>{place.description}</Text>
                ) : null}
              </View>
              <Text style={{ color: '#94A3B8', fontSize: 12 }}>{'\u2197'}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {data && data.places.length === 0 && (
        <View style={{
          backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
          borderWidth: 1, borderColor: '#E2E8F0',
        }}>
          <Text style={{ color: '#94A3B8', fontSize: 14 }}>No hidden gems found yet.</Text>
        </View>
      )}
    </View>
  );
}
