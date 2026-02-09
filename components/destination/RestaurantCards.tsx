import { Platform, View, Text, ScrollView } from 'react-native';

interface Restaurant {
  name: string;
  type: string;
  rating: number;
}

interface RestaurantCardsProps {
  restaurants: Restaurant[] | undefined;
}

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '\u2605'.repeat(full) + (half ? '\u00BD' : '') + '\u2606'.repeat(empty);
}

export default function RestaurantCards({ restaurants }: RestaurantCardsProps) {
  if (!restaurants || restaurants.length === 0) return null;

  if (Platform.OS === 'web') {
    return (
      <div style={{ marginTop: 24 }}>
        <style>{`
          .rc-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        <h3
          style={{
            margin: 0,
            color: '#1E293B',
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          Local Bites
        </h3>
        <div
          className="rc-scroll"
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            scrollbarWidth: 'none' as any,
            marginTop: 14,
            paddingBottom: 4,
          }}
        >
          {restaurants.map((r, idx) => (
            <div
              key={idx}
              style={{
                minWidth: 140,
                maxWidth: 140,
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: 12,
                padding: 14,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <span
                style={{
                  color: '#1E293B',
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.name}
              </span>
              <span
                style={{
                  color: '#64748B',
                  fontSize: 12,
                  textTransform: 'capitalize',
                }}
              >
                {r.type}
              </span>
              <span
                style={{
                  color: '#F59E0B',
                  fontSize: 13,
                  letterSpacing: 1,
                }}
              >
                {renderStars(r.rating)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Native
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={{ color: '#1E293B', fontSize: 18, fontWeight: '700' }}>
        Local Bites
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 14 }}
        contentContainerStyle={{ gap: 10, paddingRight: 8 }}
      >
        {restaurants.map((r, idx) => (
          <View
            key={idx}
            style={{
              width: 140,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#E2E8F0',
              borderRadius: 12,
              padding: 14,
              gap: 4,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: '#1E293B',
                fontSize: 14,
                fontWeight: '600',
              }}
            >
              {r.name}
            </Text>
            <Text
              style={{
                color: '#64748B',
                fontSize: 12,
                textTransform: 'capitalize',
              }}
            >
              {r.type}
            </Text>
            <Text
              style={{
                color: '#F59E0B',
                fontSize: 13,
                letterSpacing: 1,
              }}
            >
              {renderStars(r.rating)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
