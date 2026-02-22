import { useState } from 'react';
import { Platform, View, Text, ScrollView, Pressable } from 'react-native';
import { colors } from '../../constants/theme';

interface ItineraryItem {
  day: number;
  activities: string[];
}

interface ItineraryTimelineProps {
  itinerary: ItineraryItem[] | undefined;
  isAI?: boolean;
}

export default function ItineraryTimeline({ itinerary, isAI }: ItineraryTimelineProps) {
  const [activeDay, setActiveDay] = useState(0);

  if (!itinerary || itinerary.length === 0) return null;

  const currentDay = itinerary[activeDay] ?? itinerary[0];

  if (Platform.OS === 'web') {
    return (
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3
            style={{
              margin: 0,
              color: colors.dark.text.primary,
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            Suggested Itinerary
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

        {/* Day tabs */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 14,
            overflowX: 'auto',
            paddingBottom: 4,
          }}
        >
          {itinerary.map((item, idx) => {
            const isActive = idx === activeDay;
            return (
              <button
                key={item.day}
                onClick={() => setActiveDay(idx)}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 20,
                  padding: '6px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  flexShrink: 0,
                  backgroundColor: isActive ? '#38BDF8' : colors.dark.surfaceElevated,
                  color: isActive ? '#FFFFFF' : colors.dark.text.muted,
                  transition: 'all 0.15s ease',
                }}
              >
                Day {item.day}
              </button>
            );
          })}
        </div>

        {/* Timeline */}
        <div style={{ marginTop: 16, paddingLeft: 20, position: 'relative' }}>
          {/* Vertical line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 8,
              width: 2,
              backgroundColor: colors.dark.border,
              borderRadius: 1,
            }}
          />
          {currentDay.activities.map((activity, idx) => (
            <div
              key={idx}
              style={{
                position: 'relative',
                marginBottom: idx < currentDay.activities.length - 1 ? 12 : 0,
              }}
            >
              {/* Dot */}
              <div
                style={{
                  position: 'absolute',
                  left: -16,
                  top: 14,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: '#38BDF8',
                  border: `2px solid ${colors.dark.surface}`,
                  boxShadow: `0 0 0 2px ${colors.dark.border}`,
                }}
              />
              {/* Card */}
              <div
                style={{
                  backgroundColor: colors.dark.surface,
                  border: `1px solid ${colors.dark.border}`,
                  borderRadius: 12,
                  padding: '12px 16px',
                }}
              >
                <span
                  style={{
                    color: colors.dark.text.body,
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  {activity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Native
  return (
    <View style={{ marginTop: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: colors.dark.text.primary, fontSize: 18, fontWeight: '700' }}>
          Suggested Itinerary
        </Text>
        {isAI && (
          <View style={{ backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#22C55E', letterSpacing: 0.5 }}>AI GENERATED</Text>
          </View>
        )}
      </View>

      {/* Day tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 14 }}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
      >
        {itinerary.map((item, idx) => {
          const isActive = idx === activeDay;
          return (
            <Pressable
              key={item.day}
              onPress={() => setActiveDay(idx)}
              style={{
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 6,
                backgroundColor: isActive ? '#38BDF8' : colors.dark.surfaceElevated,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: isActive ? '#FFFFFF' : colors.dark.text.muted,
                }}
              >
                Day {item.day}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Timeline */}
      <View style={{ marginTop: 16, paddingLeft: 20, position: 'relative' }}>
        {/* Vertical line */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 8,
            width: 2,
            backgroundColor: colors.dark.border,
            borderRadius: 1,
          }}
        />
        {currentDay.activities.map((activity, idx) => (
          <View
            key={idx}
            style={{
              position: 'relative',
              marginBottom:
                idx < currentDay.activities.length - 1 ? 12 : 0,
            }}
          >
            {/* Dot */}
            <View
              style={{
                position: 'absolute',
                left: -16,
                top: 14,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: '#38BDF8',
                borderWidth: 2,
                borderColor: colors.dark.surface,
              }}
            />
            {/* Card */}
            <View
              style={{
                backgroundColor: colors.dark.surface,
                borderWidth: 1,
                borderColor: colors.dark.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text
                style={{
                  color: colors.dark.text.body,
                  fontSize: 14,
                  lineHeight: 21,
                }}
              >
                {activity}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
