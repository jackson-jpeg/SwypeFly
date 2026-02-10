import { View, Text, Pressable, Platform, ActivityIndicator, Linking } from 'react-native';
import { useLiveUpdates } from '../../hooks/useAI';

interface LivePulseProps {
  city: string;
  country: string;
}

export default function LivePulse({ city, country }: LivePulseProps) {
  const { data, isLoading, error, refetch, isFetching } = useLiveUpdates(city, country);

  if (Platform.OS === 'web') {
    return (
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: '#4ADE80',
              boxShadow: '0 0 6px rgba(74,222,128,0.5)',
            }} />
            <h3 style={{ margin: 0, color: '#1E293B', fontSize: 18, fontWeight: 700 }}>
              Live Pulse
            </h3>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              background: 'none', border: '1px solid #E2E8F0',
              borderRadius: 8, padding: '4px 12px',
              color: '#64748B', fontSize: 12, fontWeight: 600,
              cursor: isFetching ? 'default' : 'pointer',
              opacity: isFetching ? 0.5 : 1,
            }}
          >
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {isLoading && (
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20,
            border: '1px solid #E2E8F0', textAlign: 'center',
          }}>
            <div style={{ width: 20, height: 20, border: '2px solid #E2E8F0', borderTopColor: '#38BDF8', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        )}

        {error && !data && (
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
            border: '1px solid #E2E8F0',
          }}>
            <p style={{ margin: 0, color: '#94A3B8', fontSize: 14 }}>Live data unavailable right now.</p>
          </div>
        )}

        {data && (
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
            border: '1px solid #E2E8F0',
          }}>
            <p style={{ margin: 0, color: '#475569', fontSize: 14, lineHeight: 1.6 }}>
              {data.summary}
            </p>
            {data.sources.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {data.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 12, color: '#0EA5E9', textDecoration: 'none',
                      backgroundColor: 'rgba(56,189,248,0.08)',
                      borderRadius: 6, padding: '3px 10px',
                      border: '1px solid rgba(56,189,248,0.15)',
                    }}
                  >
                    {src.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Native ──
  return (
    <View style={{ marginTop: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' }} />
          <Text style={{ color: '#1E293B', fontSize: 18, fontWeight: '700' }}>Live Pulse</Text>
        </View>
        <Pressable
          onPress={() => refetch()}
          disabled={isFetching}
          style={{
            borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8,
            paddingHorizontal: 12, paddingVertical: 4,
            opacity: isFetching ? 0.5 : 1,
          }}
        >
          <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600' }}>
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Text>
        </Pressable>
      </View>

      {isLoading && (
        <View style={{
          backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20,
          borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center',
        }}>
          <ActivityIndicator color="#38BDF8" size="small" />
        </View>
      )}

      {error && !data && (
        <View style={{
          backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
          borderWidth: 1, borderColor: '#E2E8F0',
        }}>
          <Text style={{ color: '#94A3B8', fontSize: 14 }}>Live data unavailable right now.</Text>
        </View>
      )}

      {data && (
        <View style={{
          backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
          borderWidth: 1, borderColor: '#E2E8F0',
        }}>
          <Text style={{ color: '#475569', fontSize: 14, lineHeight: 22 }}>
            {data.summary}
          </Text>
          {data.sources.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {data.sources.map((src, i) => (
                <Pressable
                  key={i}
                  onPress={() => Linking.openURL(src.uri)}
                  style={{
                    backgroundColor: 'rgba(56,189,248,0.08)',
                    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3,
                    borderWidth: 1, borderColor: 'rgba(56,189,248,0.15)',
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#0EA5E9' }}>{src.title}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
