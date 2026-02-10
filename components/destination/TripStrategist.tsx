import { View, Text, Pressable, Platform, ActivityIndicator } from 'react-native';
import { useTripPlan } from '../../hooks/useAI';

interface TripStrategistProps {
  destinationId: string;
  city: string;
  country: string;
}

function renderMarkdown(text: string): React.ReactNode {
  // Simple markdown renderer: headings, bold, bullets
  const lines = text.split('\n');

  if (Platform.OS === 'web') {
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <br key={i} />;

      if (trimmed.startsWith('### ')) {
        return <h4 key={i} style={{ margin: '16px 0 6px 0', color: '#1E293B', fontSize: 15, fontWeight: 700 }}>{trimmed.slice(4)}</h4>;
      }
      if (trimmed.startsWith('## ')) {
        return <h3 key={i} style={{ margin: '20px 0 8px 0', color: '#1E293B', fontSize: 16, fontWeight: 700 }}>{trimmed.slice(3)}</h3>;
      }
      if (trimmed.startsWith('# ')) {
        return <h2 key={i} style={{ margin: '20px 0 8px 0', color: '#0F172A', fontSize: 18, fontWeight: 800 }}>{trimmed.slice(2)}</h2>;
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0', paddingLeft: 4 }}>
            <span style={{ color: '#38BDF8', fontSize: 14 }}>{'\u2022'}</span>
            <span style={{ color: '#475569', fontSize: 14, lineHeight: 1.6, flex: 1 }}>
              {trimmed.slice(2).replace(/\*\*(.*?)\*\*/g, '$1')}
            </span>
          </div>
        );
      }

      return <p key={i} style={{ margin: '4px 0', color: '#475569', fontSize: 14, lineHeight: 1.6 }}>{trimmed.replace(/\*\*(.*?)\*\*/g, '$1')}</p>;
    });
  }

  // Native
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <View key={i} style={{ height: 8 }} />;

    if (trimmed.startsWith('### ')) {
      return <Text key={i} style={{ color: '#1E293B', fontSize: 15, fontWeight: '700', marginTop: 16, marginBottom: 6 }}>{trimmed.slice(4)}</Text>;
    }
    if (trimmed.startsWith('## ')) {
      return <Text key={i} style={{ color: '#1E293B', fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 8 }}>{trimmed.slice(3)}</Text>;
    }
    if (trimmed.startsWith('# ')) {
      return <Text key={i} style={{ color: '#0F172A', fontSize: 18, fontWeight: '800', marginTop: 20, marginBottom: 8 }}>{trimmed.slice(2)}</Text>;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return (
        <View key={i} style={{ flexDirection: 'row', gap: 8, marginVertical: 3, paddingLeft: 4 }}>
          <Text style={{ color: '#38BDF8', fontSize: 14 }}>{'\u2022'}</Text>
          <Text style={{ color: '#475569', fontSize: 14, lineHeight: 22, flex: 1 }}>
            {trimmed.slice(2).replace(/\*\*(.*?)\*\*/g, '$1')}
          </Text>
        </View>
      );
    }

    return <Text key={i} style={{ color: '#475569', fontSize: 14, lineHeight: 22, marginVertical: 2 }}>{trimmed.replace(/\*\*(.*?)\*\*/g, '$1')}</Text>;
  });
}

export default function TripStrategist({ destinationId, city, country }: TripStrategistProps) {
  const { data, isLoading, isFetching, refetch } = useTripPlan(destinationId, city, country);

  if (Platform.OS === 'web') {
    return (
      <div style={{ marginTop: 24 }}>
        <div style={{ height: 1, backgroundColor: '#E2E8F0', marginBottom: 24 }} />

        <h3 style={{ margin: '0 0 8px 0', color: '#1E293B', fontSize: 18, fontWeight: 700 }}>
          Trip Strategist
        </h3>
        <p style={{ margin: '0 0 16px 0', color: '#64748B', fontSize: 13 }}>
          AI-powered travel plan by Claude
        </p>

        {!data && !isLoading && (
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #38BDF8 0%, #818CF8 100%)',
              color: '#FFFFFF', border: 'none', borderRadius: 16,
              padding: '16px 24px', fontSize: 16, fontWeight: 700,
              cursor: isFetching ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 12px rgba(56,189,248,0.3)',
              opacity: isFetching ? 0.7 : 1,
              transition: 'opacity 0.2s, transform 0.15s',
            }}
          >
            {'\u2728'} Plan My Trip
          </button>
        )}

        {isLoading && (
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: 16, padding: 32,
            border: '1px solid #E2E8F0', textAlign: 'center',
          }}>
            <div style={{ width: 24, height: 24, border: '3px solid #E2E8F0', borderTopColor: '#818CF8', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px auto' }} />
            <p style={{ margin: 0, color: '#64748B', fontSize: 14 }}>Claude is planning your perfect trip...</p>
          </div>
        )}

        {data && (
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20,
            border: '1px solid #E2E8F0',
          }}>
            {renderMarkdown(data.plan)}

            <div style={{ height: 1, backgroundColor: '#F1F5F9', margin: '16px 0' }} />
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              style={{
                background: 'none', border: '1px solid #E2E8F0',
                borderRadius: 8, padding: '6px 14px',
                color: '#64748B', fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Regenerate Plan
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Native ──
  return (
    <View style={{ marginTop: 24 }}>
      <View style={{ height: 1, backgroundColor: '#E2E8F0', marginBottom: 24 }} />

      <Text style={{ color: '#1E293B', fontSize: 18, fontWeight: '700', marginBottom: 4 }}>
        Trip Strategist
      </Text>
      <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 16 }}>
        AI-powered travel plan by Claude
      </Text>

      {!data && !isLoading && (
        <Pressable
          onPress={() => refetch()}
          disabled={isFetching}
          style={{
            backgroundColor: '#38BDF8', borderRadius: 16, padding: 16,
            alignItems: 'center', justifyContent: 'center',
            opacity: isFetching ? 0.7 : 1,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
            {'\u2728'} Plan My Trip
          </Text>
        </Pressable>
      )}

      {isLoading && (
        <View style={{
          backgroundColor: '#FFFFFF', borderRadius: 16, padding: 32,
          borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center',
        }}>
          <ActivityIndicator color="#818CF8" style={{ marginBottom: 12 }} />
          <Text style={{ color: '#64748B', fontSize: 14 }}>Claude is planning your perfect trip...</Text>
        </View>
      )}

      {data && (
        <View style={{
          backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20,
          borderWidth: 1, borderColor: '#E2E8F0',
        }}>
          {renderMarkdown(data.plan)}

          <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 }} />
          <Pressable
            onPress={() => refetch()}
            disabled={isFetching}
            style={{
              borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8,
              paddingHorizontal: 14, paddingVertical: 6,
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600' }}>Regenerate Plan</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
