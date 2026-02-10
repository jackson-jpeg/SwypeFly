import { Platform, View, Text, ScrollView, Pressable, Linking } from 'react-native';

interface Restaurant {
  name: string;
  type: string;
  rating: number;
  mapsUrl?: string;
}

interface RestaurantCardsProps {
  restaurants: Restaurant[] | undefined;
  isAI?: boolean;
}

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '\u2605'.repeat(full) + (half ? '\u00BD' : '') + '\u2606'.repeat(empty);
}

export default function RestaurantCards({ restaurants, isAI }: RestaurantCardsProps) {
  if (!restaurants || restaurants.length === 0) return null;

  if (Platform.OS === 'web') {
    return (
      <div style={{ marginTop: 24 }}>
        <style>{`
          .rc-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          {isAI && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#22C55E',
              backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 4,
              padding: '2px 6px', letterSpacing: 0.5,
            }}>
              AI GENERATED
            </span>
          )}
        </div>
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
          {restaurants.map((r, idx) => {
            const card = (
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
                  cursor: r.mapsUrl ? 'pointer' : 'default',
                  textDecoration: 'none',
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
            );
            return r.mapsUrl ? (
              <a key={idx} href={r.mapsUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                {card}
              </a>
            ) : card;
          })}
        </div>
      </div>
    );
  }

  // Native
  return (
    <View style={{ marginTop: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: '#1E293B', fontSize: 18, fontWeight: '700' }}>
          Local Bites
        </Text>
        {isAI && (
          <View style={{ backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#22C55E', letterSpacing: 0.5 }}>AI GENERATED</Text>
          </View>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 14 }}
        contentContainerStyle={{ gap: 10, paddingRight: 8 }}
      >
        {restaurants.map((r, idx) => {
          const cardContent = (
            <>
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
            </>
          );
          return r.mapsUrl ? (
            <Pressable
              key={idx}
              onPress={() => Linking.openURL(r.mapsUrl!)}
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
              {cardContent}
            </Pressable>
          ) : (
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
              {cardContent}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
