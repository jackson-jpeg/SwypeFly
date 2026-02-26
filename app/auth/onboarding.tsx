import React, { useState } from 'react';
import { View, Text, Pressable, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuthContext } from '../../hooks/AuthContext';
import { databases, DATABASE_ID, COLLECTIONS } from '../../services/appwrite';
import { ID, Permission, Role } from 'appwrite';
import { useUIStore } from '../../stores/uiStore';
import { Query } from 'appwrite';

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

const DEPARTURE_OPTIONS = [
  { city: 'Tampa', code: 'TPA' },
  { city: 'Miami', code: 'MIA' },
  { city: 'Orlando', code: 'MCO' },
  { city: 'New York', code: 'JFK' },
  { city: 'Los Angeles', code: 'LAX' },
  { city: 'Chicago', code: 'ORD' },
  { city: 'Dallas', code: 'DFW' },
  { city: 'Atlanta', code: 'ATL' },
  { city: 'Denver', code: 'DEN' },
  { city: 'San Francisco', code: 'SFO' },
  { city: 'Seattle', code: 'SEA' },
  { city: 'Boston', code: 'BOS' },
  { city: 'Houston', code: 'IAH' },
  { city: 'Phoenix', code: 'PHX' },
  { city: 'Washington DC', code: 'IAD' },
  { city: 'Philadelphia', code: 'PHL' },
  { city: 'Minneapolis', code: 'MSP' },
  { city: 'Detroit', code: 'DTW' },
  { city: 'Charlotte', code: 'CLT' },
  { city: 'Nashville', code: 'BNA' },
];

const TOTAL_STEPS = 4;

function WebOnboarding() {
  const { user } = useAuthContext();
  const setDeparture = useUIStore((s) => s.setDeparture);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [travelerType, setTravelerType] = useState<TravelerType | null>(null);
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel | null>(null);
  const [departureCity, setDepartureCity] = useState<{ city: string; code: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left');

  const goForward = (nextStep: 0 | 1 | 2 | 3) => {
    setSlideDir('left');
    setStep(nextStep);
  };
  const goBack = (nextStep: 0 | 1 | 2 | 3) => {
    setSlideDir('right');
    setStep(nextStep);
  };

  const handleFinish = async () => {
    if (!travelerType || !budgetLevel || !user) return;
    setSaving(true);
    if (departureCity) {
      setDeparture(departureCity.city, departureCity.code, true);
    }

    const prefData = {
      user_id: user.id,
      traveler_type: travelerType,
      budget_level: budgetLevel,
      budget_numeric: BUDGET_TO_NUMERIC[budgetLevel] || 2,
      has_completed_onboarding: true,
      departure_city: departureCity?.city || 'Tampa',
      departure_code: departureCity?.code || 'TPA',
      ...(TYPE_TO_PREFS[travelerType] || {}),
    };

    try {
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.userPreferences,
        ID.unique(),
        prefData,
        [Permission.read(Role.user(user.id)), Permission.update(Role.user(user.id))],
      );
    } catch {
      // Document may already exist — try updating instead
      try {
        const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.userPreferences, [
          Query.equal('user_id', user.id),
          Query.limit(1),
        ]);
        if (existing.documents.length > 0) {
          const { user_id: _, ...updates } = prefData;
          await databases.updateDocument(
            DATABASE_ID,
            COLLECTIONS.userPreferences,
            existing.documents[0].$id,
            updates,
          );
        }
      } catch {
        // Best effort — continue to main app
      }
    }

    useUIStore.getState().setOnboarded();
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
      <style>{`
        @keyframes sg-onboard-slide-left {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes sg-onboard-slide-right {
          from { transform: translateX(-40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes sg-plane-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

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
        {/* Progress dots — animated width */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} style={{
              height: 8, borderRadius: 4,
              width: step === i ? 24 : 8,
              backgroundColor: step >= i ? '#38BDF8' : 'rgba(255,255,255,0.2)',
              transition: 'width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.3s',
            }} />
          ))}
        </div>

        {/* Step content with slide animation */}
        <div
          key={step}
          style={{
            width: '100%',
            animation: `${slideDir === 'left' ? 'sg-onboard-slide-left' : 'sg-onboard-slide-right'} 0.35s ease-out`,
          }}
        >
          {/* ─── Step 0: Welcome ─── */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                fontSize: 56, marginBottom: 16,
                animation: 'sg-plane-float 3s ease-in-out infinite',
              }}>
                {'\u2708\uFE0F'}
              </div>
              <h1 style={{
                margin: 0, color: '#fff', fontSize: 28, fontWeight: 800,
                textAlign: 'center', letterSpacing: -0.5,
              }}>
                Welcome to SoGoJet
              </h1>
              <p style={{
                margin: '12px 0 0 0', color: 'rgba(255,255,255,0.5)',
                fontSize: 15, textAlign: 'center', lineHeight: 1.6, maxWidth: 320,
              }}>
                Discover your next adventure. We&apos;ll show you incredible destinations
                matched to your travel style.
              </p>

              <button
                onClick={() => goForward(1)}
                style={{
                  marginTop: 32, width: '100%',
                  padding: '14px 20px', borderRadius: 12,
                  border: 'none', backgroundColor: '#38BDF8',
                  color: '#fff', fontSize: 15, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                Get Started
              </button>
            </div>
          )}

          {/* ─── Step 1: Traveler Type ─── */}
          {step === 1 && (
            <>
              <h2 style={{ margin: 0, color: '#fff', fontSize: 24, fontWeight: 700, textAlign: 'center' as const }}>
                What kind of traveler are you?
              </h2>
              <p style={{ margin: '8px 0 28px 0', color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center' as const }}>
                We&apos;ll personalize your feed
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%' }}>
                {TRAVELER_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => setTravelerType(opt.type)}
                    style={{
                      padding: 20, borderRadius: 16,
                      border: travelerType === opt.type
                        ? '2px solid #38BDF8'
                        : '1px solid rgba(255,255,255,0.1)',
                      backgroundColor: travelerType === opt.type
                        ? 'rgba(56,189,248,0.12)'
                        : 'rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: 32 }}>{opt.emoji}</span>
                    <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{opt.label}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{opt.desc}</span>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 24 }}>
                <button
                  onClick={() => goBack(0)}
                  style={{
                    flex: 1, padding: '14px 20px', borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.15)',
                    backgroundColor: 'transparent',
                    color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  onClick={() => travelerType && goForward(2)}
                  disabled={!travelerType}
                  style={{
                    flex: 2, padding: '14px 20px', borderRadius: 12,
                    border: 'none',
                    backgroundColor: travelerType ? '#38BDF8' : 'rgba(255,255,255,0.1)',
                    color: travelerType ? '#fff' : 'rgba(255,255,255,0.3)',
                    fontSize: 15, fontWeight: 600,
                    cursor: travelerType ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                  }}
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {/* ─── Step 2: Budget ─── */}
          {step === 2 && (
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
                      padding: '16px 20px', borderRadius: 14,
                      border: budgetLevel === opt.level
                        ? '2px solid #38BDF8'
                        : '1px solid rgba(255,255,255,0.1)',
                      backgroundColor: budgetLevel === opt.level
                        ? 'rgba(56,189,248,0.12)'
                        : 'rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
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
                  onClick={() => goBack(1)}
                  style={{
                    flex: 1, padding: '14px 20px', borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.15)',
                    backgroundColor: 'transparent',
                    color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  onClick={() => budgetLevel && goForward(3)}
                  disabled={!budgetLevel}
                  style={{
                    flex: 2, padding: '14px 20px', borderRadius: 12,
                    border: 'none',
                    backgroundColor: budgetLevel ? '#38BDF8' : 'rgba(255,255,255,0.1)',
                    color: budgetLevel ? '#fff' : 'rgba(255,255,255,0.3)',
                    fontSize: 15, fontWeight: 600,
                    cursor: budgetLevel ? 'pointer' : 'default',
                  }}
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {/* ─── Step 3: Departure City ─── */}
          {step === 3 && (
            <>
              <h2 style={{ margin: 0, color: '#fff', fontSize: 24, fontWeight: 700, textAlign: 'center' as const }}>
                Where are you flying from?
              </h2>
              <p style={{ margin: '8px 0 28px 0', color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center' as const }}>
                We&apos;ll find the best deals from your airport
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxHeight: 280, overflowY: 'auto' }}>
                {DEPARTURE_OPTIONS.map((opt) => (
                  <button
                    key={opt.code}
                    onClick={() => setDepartureCity(opt)}
                    style={{
                      padding: '14px 16px', borderRadius: 12,
                      border: departureCity?.code === opt.code
                        ? '2px solid #38BDF8'
                        : '1px solid rgba(255,255,255,0.1)',
                      backgroundColor: departureCity?.code === opt.code
                        ? 'rgba(56,189,248,0.12)'
                        : 'rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{opt.city}</span>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: 500 }}>{opt.code}</span>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 24 }}>
                <button
                  onClick={() => goBack(2)}
                  style={{
                    flex: 1, padding: '14px 20px', borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.15)',
                    backgroundColor: 'transparent',
                    color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleFinish}
                  disabled={!departureCity || saving}
                  style={{
                    flex: 2, padding: '14px 20px', borderRadius: 12,
                    border: 'none',
                    backgroundColor: departureCity ? '#38BDF8' : 'rgba(255,255,255,0.1)',
                    color: departureCity ? '#fff' : 'rgba(255,255,255,0.3)',
                    fontSize: 15, fontWeight: 600,
                    cursor: departureCity && !saving ? 'pointer' : 'default',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving...' : "Let's Go"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Skip */}
        <button
          onClick={() => router.replace('/(tabs)')}
          style={{
            marginTop: 16, background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.3)', fontSize: 13,
            cursor: 'pointer', padding: 8,
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
  const setDeparture = useUIStore((s) => s.setDeparture);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [travelerType, setTravelerType] = useState<TravelerType | null>(null);
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel | null>(null);
  const [departureCity, setDepartureCity] = useState<{ city: string; code: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    if (!travelerType || !budgetLevel || !user) return;
    setSaving(true);
    if (departureCity) {
      setDeparture(departureCity.city, departureCity.code, true);
    }

    const prefData = {
      user_id: user.id,
      traveler_type: travelerType,
      budget_level: budgetLevel,
      budget_numeric: BUDGET_TO_NUMERIC[budgetLevel] || 2,
      has_completed_onboarding: true,
      departure_city: departureCity?.city || 'Tampa',
      departure_code: departureCity?.code || 'TPA',
      ...(TYPE_TO_PREFS[travelerType] || {}),
    };

    try {
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.userPreferences,
        ID.unique(),
        prefData,
        [Permission.read(Role.user(user.id)), Permission.update(Role.user(user.id))],
      );
    } catch {
      try {
        const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.userPreferences, [
          Query.equal('user_id', user.id),
          Query.limit(1),
        ]);
        if (existing.documents.length > 0) {
          const { user_id: _, ...updates } = prefData;
          await databases.updateDocument(
            DATABASE_ID,
            COLLECTIONS.userPreferences,
            existing.documents[0].$id,
            updates,
          );
        }
      } catch {
        // Best effort
      }
    }

    useUIStore.getState().setOnboarded();
    setSaving(false);
    router.replace('/(tabs)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', paddingHorizontal: 28 }}>
      {/* Progress dots — animated width */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={{
            height: 8, borderRadius: 4,
            width: step === i ? 24 : 8,
            backgroundColor: step >= i ? '#38BDF8' : 'rgba(255,255,255,0.2)',
          }} />
        ))}
      </View>

      {/* ─── Step 0: Welcome ─── */}
      {step === 0 && (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 56, marginBottom: 16 }}>{'\u2708\uFE0F'}</Text>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 }}>
            Welcome to SoGoJet
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, textAlign: 'center', marginTop: 12, lineHeight: 24, maxWidth: 320 }}>
            Discover your next adventure. We'll show you incredible destinations matched to your travel style.
          </Text>

          <Pressable
            onPress={() => setStep(1)}
            style={{
              marginTop: 32, width: '100%',
              paddingVertical: 14, borderRadius: 12,
              backgroundColor: '#38BDF8', alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Get Started</Text>
          </Pressable>
        </View>
      )}

      {/* ─── Step 1: Traveler Type ─── */}
      {step === 1 && (
        <>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center' }}>
            What kind of traveler are you?
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 28 }}>
            We'll personalize your feed
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {TRAVELER_OPTIONS.map((opt) => (
              <Pressable
                key={opt.type}
                onPress={() => setTravelerType(opt.type)}
                style={{
                  width: '48%', padding: 20, borderRadius: 16,
                  borderWidth: travelerType === opt.type ? 2 : 1,
                  borderColor: travelerType === opt.type ? '#38BDF8' : 'rgba(255,255,255,0.1)',
                  backgroundColor: travelerType === opt.type ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
                  alignItems: 'center', gap: 6,
                }}
              >
                <Text style={{ fontSize: 32 }}>{opt.emoji}</Text>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{opt.label}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{opt.desc}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            <Pressable
              onPress={() => setStep(0)}
              style={{
                flex: 1, paddingVertical: 14, borderRadius: 12,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600' }}>Back</Text>
            </Pressable>
            <Pressable
              onPress={() => travelerType && setStep(2)}
              disabled={!travelerType}
              style={{
                flex: 2, paddingVertical: 14, borderRadius: 12,
                backgroundColor: travelerType ? '#38BDF8' : 'rgba(255,255,255,0.1)',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: travelerType ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 15, fontWeight: '600' }}>
                Continue
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* ─── Step 2: Budget ─── */}
      {step === 2 && (
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
                  padding: 16, borderRadius: 14,
                  borderWidth: budgetLevel === opt.level ? 2 : 1,
                  borderColor: budgetLevel === opt.level ? '#38BDF8' : 'rgba(255,255,255,0.1)',
                  backgroundColor: budgetLevel === opt.level ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
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
                flex: 1, paddingVertical: 14, borderRadius: 12,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600' }}>Back</Text>
            </Pressable>
            <Pressable
              onPress={() => budgetLevel && setStep(3)}
              disabled={!budgetLevel}
              style={{
                flex: 2, paddingVertical: 14, borderRadius: 12,
                backgroundColor: budgetLevel ? '#38BDF8' : 'rgba(255,255,255,0.1)',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: budgetLevel ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 15, fontWeight: '600' }}>
                Continue
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* ─── Step 3: Departure City ─── */}
      {step === 3 && (
        <>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center' }}>
            Where are you flying from?
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 28 }}>
            We'll find the best deals from your airport
          </Text>

          <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {DEPARTURE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.code}
                  onPress={() => setDepartureCity(opt)}
                  style={{
                    width: '48%', padding: 14, borderRadius: 12,
                    borderWidth: departureCity?.code === opt.code ? 2 : 1,
                    borderColor: departureCity?.code === opt.code ? '#38BDF8' : 'rgba(255,255,255,0.1)',
                    backgroundColor: departureCity?.code === opt.code ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{opt.city}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '500' }}>{opt.code}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            <Pressable
              onPress={() => setStep(2)}
              style={{
                flex: 1, paddingVertical: 14, borderRadius: 12,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600' }}>Back</Text>
            </Pressable>
            <Pressable
              onPress={handleFinish}
              disabled={!departureCity || saving}
              style={{
                flex: 2, paddingVertical: 14, borderRadius: 12,
                backgroundColor: departureCity ? '#38BDF8' : 'rgba(255,255,255,0.1)',
                alignItems: 'center',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: departureCity ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 15, fontWeight: '600' }}>
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
