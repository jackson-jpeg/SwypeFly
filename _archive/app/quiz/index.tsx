import { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, buttons } from '../../constants/theme';

type TripType = 'adventure' | 'culture' | 'romance' | 'relaxation';

const TRIP_OPTIONS: { type: TripType; label: string; emoji: string; gradient: [string, string] }[] = [
  { type: 'adventure', label: 'Adventure', emoji: '🏔️', gradient: ['#7BAF8E', '#A8C4B8'] },
  { type: 'culture', label: 'Culture', emoji: '🏛️', gradient: ['#E8C9A0', '#C9A99A'] },
  { type: 'romance', label: 'Romance', emoji: '💕', gradient: ['#C8DDD4', '#A8C4B8'] },
  { type: 'relaxation', label: 'Relaxation', emoji: '🌊', gradient: ['#F7E8A0', '#E8C9A0'] },
];

const TOTAL_QUESTIONS = 4;

function WebQuiz() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<TripType | null>(null);

  const handleNext = () => {
    if (step < TOTAL_QUESTIONS - 1) {
      setSelected(null);
      setStep(step + 1);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.duskSand,
        padding: 24,
      }}
    >
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 420, width: '100%' }}>
        {/* Header: close, progress, step count */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <button
            onClick={() => router.back()}
            aria-label="Close quiz"
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(44,31,26,0.08)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: colors.deepDusk,
            }}
          >
            ✕
          </button>

          {/* Progress bar */}
          <div style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.warmDusk, margin: '0 16px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3, backgroundColor: colors.sageDrift,
              width: `${((step + 1) / TOTAL_QUESTIONS) * 100}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>

          <span style={{ color: colors.bylineText, fontSize: 13, fontWeight: 600, fontFamily: fonts.body }}>
            {step + 1} of {TOTAL_QUESTIONS}
          </span>
        </div>

        {/* Question */}
        <h2 style={{
          margin: '0 0 32px 0', color: colors.deepDusk,
          fontSize: 26, fontWeight: 800, fontFamily: fonts.display,
          textTransform: 'uppercase', letterSpacing: '-0.01em',
          textAlign: 'center', lineHeight: 1.2,
        }}>
          What kind of trip excites you most?
        </h2>

        {/* Option cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {TRIP_OPTIONS.map((opt) => {
            const isSelected = selected === opt.type;
            return (
              <button
                key={opt.type}
                onClick={() => setSelected(opt.type)}
                style={{
                  position: 'relative',
                  padding: '28px 16px',
                  borderRadius: 18,
                  border: isSelected ? `2px solid ${colors.deepDusk}` : `1px solid ${colors.warmDusk}`,
                  background: `linear-gradient(145deg, ${opt.gradient[0]}, ${opt.gradient[1]})`,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  transition: 'all 0.2s ease',
                  transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                  fontFamily: 'inherit',
                }}
              >
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    width: 24, height: 24, borderRadius: 12,
                    backgroundColor: colors.deepDusk,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ color: colors.paleHorizon, fontSize: 14 }}>✓</span>
                  </div>
                )}
                <span style={{ fontSize: 36 }}>{opt.emoji}</span>
                <span style={{
                  color: colors.deepDusk, fontSize: 16, fontWeight: 700,
                  fontFamily: fonts.display,
                }}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          disabled={!selected}
          style={{
            marginTop: 28, width: '100%',
            height: buttons.primary.height,
            borderRadius: buttons.primary.borderRadius,
            border: 'none',
            backgroundColor: selected ? colors.deepDusk : 'rgba(232,201,160,0.4)',
            color: selected ? colors.paleHorizon : 'rgba(44,31,26,0.3)',
            fontSize: 17, fontWeight: 600, fontFamily: fonts.body,
            cursor: selected ? 'pointer' : 'default',
            transition: 'all 0.2s ease',
          }}
        >
          {step < TOTAL_QUESTIONS - 1 ? 'Next Question' : "Let's Go"}
        </button>
      </div>
    </div>
  );
}

function NativeQuiz() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<TripType | null>(null);

  const handleNext = () => {
    if (step < TOTAL_QUESTIONS - 1) {
      setSelected(null);
      setStep(step + 1);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.duskSand, justifyContent: 'center', paddingHorizontal: 24 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: 'rgba(44,31,26,0.08)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 18, color: colors.deepDusk }}>✕</Text>
        </Pressable>

        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.warmDusk, marginHorizontal: 16, overflow: 'hidden' }}>
          <View style={{
            height: '100%', borderRadius: 3, backgroundColor: colors.sageDrift,
            width: `${((step + 1) / TOTAL_QUESTIONS) * 100}%`,
          }} />
        </View>

        <Text style={{ color: colors.bylineText, fontSize: 13, fontWeight: '600' }}>
          {step + 1} of {TOTAL_QUESTIONS}
        </Text>
      </View>

      {/* Question */}
      <Text style={{
        color: colors.deepDusk, fontSize: 26, fontWeight: '800',
        fontFamily: fonts.display, textTransform: 'uppercase',
        textAlign: 'center', lineHeight: 32, marginBottom: 32,
      }}>
        What kind of trip excites you most?
      </Text>

      {/* Option cards */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {TRIP_OPTIONS.map((opt) => {
          const isSelected = selected === opt.type;
          return (
            <Pressable
              key={opt.type}
              onPress={() => setSelected(opt.type)}
              style={{
                width: '48%', padding: 28, borderRadius: 18,
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected ? colors.deepDusk : colors.warmDusk,
                backgroundColor: opt.gradient[0],
                alignItems: 'center', gap: 8,
              }}
            >
              {isSelected && (
                <View style={{
                  position: 'absolute', top: 10, right: 10,
                  width: 24, height: 24, borderRadius: 12,
                  backgroundColor: colors.deepDusk,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: colors.paleHorizon, fontSize: 14 }}>✓</Text>
                </View>
              )}
              <Text style={{ fontSize: 36 }}>{opt.emoji}</Text>
              <Text style={{
                color: colors.deepDusk, fontSize: 16, fontWeight: '700',
                fontFamily: fonts.display,
              }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Next button */}
      <Pressable
        onPress={handleNext}
        disabled={!selected}
        style={{
          marginTop: 28, width: '100%',
          height: buttons.primary.height,
          borderRadius: buttons.primary.borderRadius,
          backgroundColor: selected ? colors.deepDusk : 'rgba(232,201,160,0.4)',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={{
          color: selected ? colors.paleHorizon : 'rgba(44,31,26,0.3)',
          fontSize: 17, fontWeight: '600',
        }}>
          {step < TOTAL_QUESTIONS - 1 ? 'Next Question' : "Let's Go"}
        </Text>
      </Pressable>
    </View>
  );
}

export default function QuizScreen() {
  if (Platform.OS === 'web') return <WebQuiz />;
  return <NativeQuiz />;
}
