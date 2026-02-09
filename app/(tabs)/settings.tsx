import { View, Text, Switch, ScrollView, Platform, Pressable, Modal, FlatList } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useUIStore } from '../../stores/uiStore';
import { useSavedStore } from '../../stores/savedStore';
import { useAuthContext } from '../../hooks/AuthContext';

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
];

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

function WebSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: '#1A1A1A', borderRadius: 14, padding: '16px 18px',
    }}>
      <span style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: '#2A2A2A', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: '6px 12px', fontSize: 14, cursor: 'pointer',
          appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none' as unknown as undefined,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          paddingRight: 28,
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function WebSettingsRow({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <div
      onClick={onPress}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#1A1A1A', borderRadius: 14, padding: '16px 18px',
        cursor: onPress ? 'pointer' : 'default',
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => { if (onPress) (e.currentTarget as HTMLElement).style.backgroundColor = '#222'; }}
      onMouseLeave={(e) => { if (onPress) (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'; }}
    >
      <span style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
        {value}{onPress ? ' \u203A' : ''}
      </span>
    </div>
  );
}

export default function SettingsTab() {
  const { user, signOut, isGuest } = useAuthContext();
  const hapticsEnabled = useUIStore((s) => s.hapticsEnabled);
  const toggleHaptics = useUIStore((s) => s.toggleHaptics);
  const departureCity = useUIStore((s) => s.departureCity);
  const departureCode = useUIStore((s) => s.departureCode);
  const setDeparture = useUIStore((s) => s.setDeparture);
  const currency = useUIStore((s) => s.currency);
  const setCurrency = useUIStore((s) => s.setCurrency);
  const savedIds = useSavedStore((s) => s.savedIds);
  const [showCleared, setShowCleared] = useState(false);
  const [showDepartureModal, setShowDepartureModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  const handleClearSaved = () => {
    savedIds.forEach((id) => useSavedStore.getState().toggleSaved(id));
    setShowCleared(true);
    setTimeout(() => setShowCleared(false), 2000);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth/login');
  };

  if (Platform.OS === 'web') {
    return (
      <div style={{
        backgroundColor: '#0A0A0A', minHeight: '100vh',
        overflowY: 'auto', paddingBottom: 100,
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
          <div style={{ padding: '56px 20px 12px 20px' }}>
            <h1 style={{ margin: 0, color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>
              Settings
            </h1>
          </div>

          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Account */}
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginTop: 8, marginBottom: 4 }}>
              Account
            </span>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: '#1A1A1A', borderRadius: 14, padding: '16px 18px',
            }}>
              <div>
                <span style={{ color: '#fff', fontSize: 15, fontWeight: 500, display: 'block' }}>
                  {user ? user.email : 'Guest'}
                </span>
                {isGuest && (
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 2, display: 'block' }}>
                    Browsing without account
                  </span>
                )}
              </div>
              {user ? (
                <button
                  onClick={handleSignOut}
                  style={{
                    background: 'none', border: '1px solid rgba(255,80,80,0.3)',
                    borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600,
                    color: '#ff5050', cursor: 'pointer',
                  }}
                >
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={() => router.replace('/auth/login')}
                  style={{
                    background: 'none', border: '1px solid rgba(255,107,53,0.3)',
                    borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600,
                    color: '#FF6B35', cursor: 'pointer',
                  }}
                >
                  Sign In
                </button>
              )}
            </div>

            {/* Preferences */}
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginTop: 16, marginBottom: 4 }}>
              Preferences
            </span>
            <WebSelect
              label="Departure City"
              value={departureCode}
              options={DEPARTURE_OPTIONS.map((o) => ({ label: `${o.city} (${o.code})`, value: o.code }))}
              onChange={(code) => {
                const opt = DEPARTURE_OPTIONS.find((o) => o.code === code);
                if (opt) setDeparture(opt.city, opt.code);
              }}
            />
            <WebSelect
              label="Currency"
              value={currency}
              options={CURRENCY_OPTIONS.map((c) => ({ label: c, value: c }))}
              onChange={setCurrency}
            />

            {/* Haptics */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: '#1A1A1A', borderRadius: 14, padding: '16px 18px',
            }}>
              <div>
                <span style={{ color: '#fff', fontSize: 15, fontWeight: 500, display: 'block' }}>Haptic Feedback</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 2, display: 'block' }}>Vibrate on swipe & save</span>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: 48, height: 28, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hapticsEnabled}
                  onChange={toggleHaptics}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: hapticsEnabled ? '#FF6B35' : '#333',
                  borderRadius: 14, transition: 'background-color 0.2s',
                }}>
                  <span style={{
                    position: 'absolute', top: 2, left: hapticsEnabled ? 22 : 2,
                    width: 24, height: 24, backgroundColor: '#fff', borderRadius: 12,
                    transition: 'left 0.2s',
                  }} />
                </span>
              </label>
            </div>

            {/* Data */}
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginTop: 16, marginBottom: 4 }}>
              Data
            </span>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: '#1A1A1A', borderRadius: 14, padding: '16px 18px',
            }}>
              <div>
                <span style={{ color: '#fff', fontSize: 15, fontWeight: 500, display: 'block' }}>
                  Saved Destinations
                </span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 2, display: 'block' }}>
                  {savedIds.size} destination{savedIds.size !== 1 ? 's' : ''} saved
                </span>
              </div>
              <button
                onClick={handleClearSaved}
                disabled={savedIds.size === 0}
                style={{
                  background: 'none', border: '1px solid rgba(255,80,80,0.3)',
                  borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600,
                  color: savedIds.size === 0 ? 'rgba(255,255,255,0.2)' : '#ff5050',
                  cursor: savedIds.size === 0 ? 'default' : 'pointer',
                  transition: 'opacity 0.15s',
                }}
              >
                {showCleared ? 'Cleared' : 'Clear All'}
              </button>
            </div>

            {/* About */}
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginTop: 16, marginBottom: 4 }}>
              About
            </span>
            <WebSettingsRow label="Version" value="1.0.0" />
            <WebSettingsRow label="Prices by" value="Amadeus" />
          </div>
        </div>
      </div>
    );
  }

  // Native
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>Settings</Text>
        </View>
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {/* Account */}
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 8 }}>Account</Text>
          <View style={{ backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '500' }} numberOfLines={1}>
                {user ? user.email : 'Guest'}
              </Text>
              {isGuest && (
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 2 }}>
                  Browsing without account
                </Text>
              )}
            </View>
            {user ? (
              <Pressable onPress={handleSignOut} style={{ borderWidth: 1, borderColor: 'rgba(255,80,80,0.3)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 }}>
                <Text style={{ color: '#ff5050', fontSize: 13, fontWeight: '600' }}>Sign Out</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => router.replace('/auth/login')} style={{ borderWidth: 1, borderColor: 'rgba(255,107,53,0.3)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 }}>
                <Text style={{ color: '#FF6B35', fontSize: 13, fontWeight: '600' }}>Sign In</Text>
              </Pressable>
            )}
          </View>

          {/* Preferences */}
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 16 }}>Preferences</Text>

          {/* Departure City Picker */}
          <Pressable
            onPress={() => setShowDepartureModal(true)}
            style={{ backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '500' }}>Departure City</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>{departureCity} ({departureCode}) ›</Text>
          </Pressable>

          {/* Currency Picker */}
          <Pressable
            onPress={() => setShowCurrencyModal(true)}
            style={{ backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '500' }}>Currency</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>{currency} ›</Text>
          </Pressable>

          {/* Haptics */}
          <View style={{ backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '500' }}>Haptic Feedback</Text>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 2 }}>Vibrate on swipe & save</Text>
            </View>
            <Switch value={hapticsEnabled} onValueChange={toggleHaptics} trackColor={{ false: '#333', true: '#FF6B35' }} thumbColor="#fff" />
          </View>
          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Departure City Modal */}
      <Modal visible={showDepartureModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#1A1A1A', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Departure City</Text>
              <Pressable onPress={() => setShowDepartureModal(false)}>
                <Text style={{ color: '#FF6B35', fontSize: 15, fontWeight: '600' }}>Done</Text>
              </Pressable>
            </View>
            <FlatList
              data={DEPARTURE_OPTIONS}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setDeparture(item.city, item.code);
                    setShowDepartureModal(false);
                  }}
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 14, paddingHorizontal: 20,
                    backgroundColor: item.code === departureCode ? 'rgba(255,107,53,0.1)' : 'transparent',
                  }}
                >
                  <Text style={{ color: item.code === departureCode ? '#FF6B35' : '#fff', fontSize: 15, fontWeight: item.code === departureCode ? '600' : '400' }}>
                    {item.city} ({item.code})
                  </Text>
                  {item.code === departureCode && (
                    <Text style={{ color: '#FF6B35', fontSize: 16 }}>✓</Text>
                  )}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Currency Modal */}
      <Modal visible={showCurrencyModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#1A1A1A', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '50%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Currency</Text>
              <Pressable onPress={() => setShowCurrencyModal(false)}>
                <Text style={{ color: '#FF6B35', fontSize: 15, fontWeight: '600' }}>Done</Text>
              </Pressable>
            </View>
            <FlatList
              data={CURRENCY_OPTIONS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setCurrency(item);
                    setShowCurrencyModal(false);
                  }}
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 14, paddingHorizontal: 20,
                    backgroundColor: item === currency ? 'rgba(255,107,53,0.1)' : 'transparent',
                  }}
                >
                  <Text style={{ color: item === currency ? '#FF6B35' : '#fff', fontSize: 15, fontWeight: item === currency ? '600' : '400' }}>
                    {item}
                  </Text>
                  {item === currency && (
                    <Text style={{ color: '#FF6B35', fontSize: 16 }}>✓</Text>
                  )}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
