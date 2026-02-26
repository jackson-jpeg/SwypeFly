import { useState } from 'react';
import { Platform, View, Text, ScrollView, Pressable } from 'react-native';
import { colors, spacing, fontSize, fontWeight, radii } from '../../constants/theme';

interface ItineraryItem {
  day: number;
  activities: string[];
}

interface ItineraryTimelineProps {
  itinerary: ItineraryItem[] | undefined;
  isAI?: boolean;
}

const TIME_SLOTS = ['MORNING', 'AFTERNOON', 'EVENING'] as const;
const TIME_COLORS = { MORNING: colors.primary, AFTERNOON: colors.primary, EVENING: colors.primary };

const DAY_THEMES = [
  'Arrival & First Impressions',
  'Deep Exploration',
  'Hidden Gems & Local Life',
  'Adventure & Discovery',
  'Culture & Heritage',
  'Nature & Relaxation',
  'Final Day & Farewell',
];

function getDayTheme(dayIndex: number): string {
  return DAY_THEMES[dayIndex % DAY_THEMES.length];
}

export default function ItineraryTimeline({ itinerary, isAI }: ItineraryTimelineProps) {
  const [showAll, setShowAll] = useState(false);

  if (!itinerary || itinerary.length === 0) return null;

  const visibleDays = showAll ? itinerary : itinerary.slice(0, 2);
  const hasMore = itinerary.length > 2;

  if (Platform.OS === 'web') {
    return (
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <h3 style={{
            margin: 0, color: colors.dark.text.primary,
            fontSize: 18, fontWeight: 700,
          }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {visibleDays.map((item, dayIdx) => (
            <div key={item.day} style={{
              backgroundColor: colors.dark.surface,
              border: `1px solid ${colors.dark.border}`,
              borderRadius: 16,
              padding: 20,
              overflow: 'hidden',
            }}>
              {/* Day header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{
                  backgroundColor: '#22C55E',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 12,
                  letterSpacing: 0.5,
                }}>
                  Day {item.day}
                </span>
                <span style={{
                  color: colors.dark.text.primary,
                  fontSize: 15,
                  fontWeight: 600,
                }}>
                  {getDayTheme(dayIdx)}
                </span>
              </div>

              {/* Activities with timeline */}
              <div style={{ paddingLeft: 20, position: 'relative' }}>
                {/* Vertical line */}
                <div style={{
                  position: 'absolute',
                  top: 6,
                  bottom: 6,
                  left: 5,
                  width: 2,
                  backgroundColor: 'rgba(56,189,248,0.2)',
                  borderRadius: 1,
                }} />

                {item.activities.map((activity, idx) => {
                  const timeSlot = TIME_SLOTS[idx] || TIME_SLOTS[TIME_SLOTS.length - 1];
                  return (
                    <div key={idx} style={{
                      position: 'relative',
                      marginBottom: idx < item.activities.length - 1 ? 18 : 0,
                      paddingLeft: 8,
                    }}>
                      {/* Blue dot */}
                      <div style={{
                        position: 'absolute',
                        left: -19,
                        top: 2,
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: colors.primary,
                        border: `2px solid ${colors.dark.surface}`,
                        boxShadow: '0 0 0 2px rgba(56,189,248,0.3)',
                      }} />

                      {/* Time label */}
                      <div style={{
                        color: TIME_COLORS[timeSlot],
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        marginBottom: 4,
                      }}>
                        {timeSlot}
                      </div>

                      {/* Activity text */}
                      <div style={{
                        color: colors.dark.text.body,
                        fontSize: 14,
                        lineHeight: 1.5,
                      }}>
                        {activity}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Show all / collapse */}
        {hasMore && (
          <button
            onClick={() => setShowAll(!showAll)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              width: '100%',
              marginTop: 12,
              padding: '10px 0',
              borderRadius: 12,
              border: `1px solid ${colors.dark.border}`,
              backgroundColor: 'transparent',
              color: colors.primary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showAll ? 'Show less' : `Show all ${itinerary.length} days`}
          </button>
        )}
      </div>
    );
  }

  // ─── Native (keep simple) ──────────────────────────────────────────
  const [activeDay, setActiveDay] = useState(0);
  const currentDay = itinerary[activeDay] ?? itinerary[0];

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
                borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
                backgroundColor: isActive ? colors.primary : colors.dark.surfaceElevated,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? '#FFFFFF' : colors.dark.text.muted }}>
                Day {item.day}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ marginTop: 16, paddingLeft: 20, position: 'relative' }}>
        <View style={{
          position: 'absolute', top: 0, bottom: 0, left: 8,
          width: 2, backgroundColor: colors.dark.border, borderRadius: 1,
        }} />
        {currentDay.activities.map((activity, idx) => (
          <View key={idx} style={{ position: 'relative', marginBottom: idx < currentDay.activities.length - 1 ? 12 : 0 }}>
            <View style={{
              position: 'absolute', left: -16, top: 14,
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.dark.surface,
            }} />
            <View style={{
              backgroundColor: colors.dark.surface, borderWidth: 1, borderColor: colors.dark.border,
              borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
            }}>
              <Text style={{ color: colors.dark.text.body, fontSize: 14, lineHeight: 21 }}>{activity}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
