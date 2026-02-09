import React, { useState } from 'react';
import { View, Text, Pressable, Platform, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthContext } from '../../hooks/AuthContext';
import { supabase } from '../../services/supabase';

type TravelerType = 'beach' | 'city' | 'adventure' | 'culture';
type BudgetLevel = 'budget' | 'comfortable' | 'luxury';

const TYPE_TO_PREFS: Record<TravelerType, Record<string, number>> = {
  beach: { pref_beach: 0.9, pref_nature: 0.6, pref_city: 0.3, pref_adventure: 0.4, pref_culture: 0.3, pref_nightlife: 0.4, pref_food: 0.5 },
  city: { pref_city: 0.9, pref_nightlife: 0.7, pref_food: 0.6, pref_culture: 0.5, pref_beach: 0.3, pref_adventure: 0.3, pref_nature: 0.2 },
  adventure: { pref_adventure: 0.9, pref_nature: 0.7, pref_beach: 0.4, pref_culture: 0.4, pref_city: 0.2, pref_nightlife: 0.2, pref_food: 0.4 },
  culture: { pref_culture: 0.9, pref_food: 0.7, pref_city: 0.5, pref_adventure: 0.4, pref_nature: 0.3, pref_beach: 0.3, pref_nightlife: 0.3 },
};
const BUDGET_TO_NUMERIC: Record<BudgetLevel, number> = { budget: 1, comfortable: 2, luxury: 3 };

const TRAVELER_OPTIONS: { type: TravelerType; label: string; emoji: string; desc: string }[] = [
  { type: 'beach', label: 'Beach', emoji: '\u{1F3D6}', desc: 'Sun, sand & waves' },
  { type: 'city', label: 'City', emoji: '\u{1F3D9}', desc: 'Urban explorer' },
  { type: 'adventure', label: 'Adventure', emoji: '\u{26F0}', desc: 'Thrills & trails' },
  { type: 'culture', label: 'Culture', emoji: '\u{1F3DB}', desc: 'History & art' },
];

const BUDGET_OPTIONS: { level: BudgetLevel; label: string; desc: string; range: string }[] = [
  { level: 'budget', label: 'Budget', desc: 'Keep it lean', range: 'Under $500' },
  { level: 'comfortable', label: 'Comfortable', desc: 'Treat yourself', range: '$500-$1,200' },
  { level: 'luxury', label: 'Luxury', desc: 'Go all out', range: '$1,200+' },
];

function WebOnboarding() {
  const { user } = useAuthContext();
  const [step, setStep] = useState<1 | 2>(1);
  const [travelerType, setTravelerType] = useState<TravelerType | null>(null);
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel | null>(null);
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    if (!travelerType || !budgetLevel || !user) return;
    setSaving(true);
    await supabase.from('user_preferences').upsert({
      user_id: user.id,
      traveler_type: travelerType,
      budget_level: budgetLevel,
      budget_numeric: BUDGET_TO_NUMERIC[budgetLevel] || 2,
      travel_style: travelerType,
      has_completed_onboarding: true,
      ...(TYPE_TO_PREFS[travelerType] || {}),
    });
    setSaving(false);
    router.replace('/(tabs)');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0A0A0A',
        padding: 24,
      }}
    >
      {/* Background blur */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage:
            'url(https://images.pexels.com/photos/1010657/pexels-photo-1010657.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(24px) brightness(0.25)',
          transform: 'scale(1.1)',
        }}
      />

      <div
        style={{
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          maxWidth: 400, width: '100%',
        }}
      >
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          <div style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: '#FF6B35',
          }} />
          <div style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: step === 2 ? '#FF6B35' : 'rgba(255,255,255,0.2)',
            transition: 'background-color 0.3s',
          }} />
        </div>

        {step === 1 ? (
          <>
            <h2 style={{ margin: 0, color: '#fff', fontSize: 24, fontWeight: 700, textAlign: 'center' as const }}>
              What kind of traveler are you?
            </h2>
            <p style={{ margin: '8px 0 28px 0', color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center' as const }}>
              We&apos;ll personalize your feed
            </p>

            {/* 2x2 grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%' }}>
              {TRAVELER_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => setTravelerType(opt.type)}
                  style={{
                    padding: 20,
                    borderRadius: 16,
                    border: travelerType === opt.type
                      ? '2px solid #FF6B35'
                      : '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: travelerType === opt.type
                      ? 'rgba(255,107,53,0.12)'
                      : 'rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                  }}
                >
                  <span style={{ fontSize: 32 }}>{opt.emoji}</span>
                  <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{opt.label}</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{opt.desc}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => travelerType && setStep(2)}
              disabled={!travelerType}
              style={{
                marginTop: 24,
                width: '100%',
                padding: '14px 20px',
                borderRadius: 12,
                border: 'none',
                backgroundColor: travelerType ? '#FF6B35' : 'rgba(255,255,255,0.1)',
                color: travelerType ? '#fff' : 'rgba(255,255,255,0.3)',
                fontSize: 15,
                fontWeight: 600,
                cursor: travelerType ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }}
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <h2 style={{ margin: 0, color: '#fff', fontSize: 24, fontWeight: 700, textAlign: 'center' as const }}>
              What&apos;s your typical budget?
            </h2>
            <p style={{ margin: '8px 0 28px 0', color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center' as const }}>
              For a round-trip flight
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
              {BUDGET_OPTIONS.map((opt) => (
                <button
                  key={opt.level}
                  onClick={() => setBudgetLevel(opt.level)}
                  style={{
                    padding: '16px 20px',
                    borderRadius: 14,
                    border: budgetLevel === opt.level
                      ? '2px solid #FF6B35'
                      : '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: budgetLevel === opt.level
                      ? 'rgba(255,107,53,0.12)'
                      : 'rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ textAlign: 'left' as const }}>
                    <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{opt.label}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>{opt.desc}</div>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 500 }}>
                    {opt.range}
                  </span>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 24 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.15)',
                  backgroundColor: 'transparent',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                disabled={!budgetLevel || saving}
                style={{
                  flex: 2,
                  padding: '14px 20px',
                  borderRadius: 12,
                  border: 'none',
                  backgroundColor: budgetLevel ? '#FF6B35' : 'rgba(255,255,255,0.1)',
                  color: budgetLevel ? '#fff' : 'rgba(255,255,255,0.3)',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: budgetLevel && !saving ? 'pointer' : 'default',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving...' : "Let's Go"}
              </button>
            </div>
          </>
        )}

        {/* Skip */}
        <button
          onClick={() => router.replace('/(tabs)')}
          style={{
            marginTop: 16,
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.3)',
            fontSize: 13,
            cursor: 'pointer',
            padding: 8,
          }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

function NativeOnboarding() {
  const { user } = useAuthContext();
  const [step, setStep] = useState<1 | 2>(1);
  const [travelerType, setTravelerType] = useState<TravelerType | null>(null);
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel | null>(null);
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    if (!travelerType || !budgetLevel || !user) return;
    setSaving(true);
    await supabase.from('user_preferences').upsert({
      user_id: user.id,
      traveler_type: travelerType,
      budget_level: budgetLevel,
      budget_numeric: BUDGET_TO_NUMERIC[budgetLevel] || 2,
      travel_style: travelerType,
      has_completed_onboarding: true,
      ...(TYPE_TO_PREFS[travelerType] || {}),
    });
    setSaving(false);
    router.replace('/(tabs)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', paddingHorizontal: 28 }}>
      {/* Progress dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B35' }} />
        <View style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: step === 2 ? '#FF6B35' : 'rgba(255,255,255,0.2)',
        }} />
      </View>

      {step === 1 ? (
        <>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center' }}>
            What kind of traveler are you?
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 28 }}>
            We'll personalize your feed
          </Text>

          {/* 2x2 grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {TRAVELER_OPTIONS.map((opt) => (
              <Pressable
                key={opt.type}
                onPress={() => setTravelerType(opt.type)}
                style={{
                  width: '48%',
                  padding: 20,
                  borderRadius: 16,
                  borderWidth: travelerType === opt.type ? 2 : 1,
                  borderColor: travelerType === opt.type ? '#FF6B35' : 'rgba(255,255,255,0.1)',
                  backgroundColor: travelerType === opt.type ? 'rgba(255,107,53,0.12)' : 'rgba(255,255,255,0.04)',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 32 }}>{opt.emoji}</Text>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{opt.label}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{opt.desc}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => travelerType && setStep(2)}
            disabled={!travelerType}
            style={{
              marginTop: 24,
              paddingVertical: 14,
              borderRadius: 12,
              backgroundColor: travelerType ? '#FF6B35' : 'rgba(255,255,255,0.1)',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: travelerType ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 15, fontWeight: '600' }}>
              Continue
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center' }}>
            What's your typical budget?
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 28 }}>
            For a round-trip flight
          </Text>

          <View style={{ gap: 12 }}>
            {BUDGET_OPTIONS.map((opt) => (
              <Pressable
                key={opt.level}
                onPress={() => setBudgetLevel(opt.level)}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  borderWidth: budgetLevel === opt.level ? 2 : 1,
                  borderColor: budgetLevel === opt.level ? '#FF6B35' : 'rgba(255,255,255,0.1)',
                  backgroundColor: budgetLevel === opt.level ? 'rgba(255,107,53,0.12)' : 'rgba(255,255,255,0.04)',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{opt.label}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>{opt.desc}</Text>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '500' }}>
                  {opt.range}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            <Pressable
              onPress={() => setStep(1)}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600' }}>Back</Text>
            </Pressable>
            <Pressable
              onPress={handleFinish}
              disabled={!budgetLevel || saving}
              style={{
                flex: 2,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: budgetLevel ? '#FF6B35' : 'rgba(255,255,255,0.1)',
                alignItems: 'center',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: budgetLevel ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 15, fontWeight: '600' }}>
                  Let's Go
                </Text>
              )}
            </Pressable>
          </View>
        </>
      )}

      {/* Skip */}
      <Pressable onPress={() => router.replace('/(tabs)')} style={{ alignItems: 'center', marginTop: 16, padding: 8 }}>
        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Skip for now</Text>
      </Pressable>
    </View>
  );
}

export default function OnboardingScreen() {
  if (Platform.OS === 'web') return <WebOnboarding />;
  return <NativeOnboarding />;
}
