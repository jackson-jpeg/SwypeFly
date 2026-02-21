import { View, Text, ScrollView, Platform, Pressable, Modal, FlatList } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useUIStore } from '../../stores/uiStore';
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
  { city: 'Seattle', code: 'SEA' },
  { city: 'Boston', code: 'BOS' },
  { city: 'Phoenix', code: 'PHX' },
  { city: 'Houston', code: 'IAH' },
  { city: 'Minneapolis', code: 'MSP' },
];

const BG = '#0F172A';
const CARD = '#1E293B';
const BORDER = '#334155';
const TEXT = '#F8FAFC';
const MUTED = '#94A3B8';
const ACCENT = '#38BDF8';
const DANGER = '#EF4444';

export default function SettingsTab() {
  const { user, signOut, isGuest } = useAuthContext();
  const departureCity = useUIStore((s) => s.departureCity);
  const departureCode = useUIStore((s) => s.departureCode);
  const setDeparture = useUIStore((s) => s.setDeparture);
  const [showDepartureModal, setShowDepartureModal] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth/login');
  };

  if (Platform.OS === 'web') {
    return (
      <div style={{ backgroundColor: BG, minHeight: '100vh', overflowY: 'auto', paddingBottom: 100 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
          <div style={{ padding: '56px 20px 24px 20px' }}>
            <h1 style={{ margin: 0, color: TEXT, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>
              Settings
            </h1>
          </div>

          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Flying From */}
            <span style={{ color: MUTED, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginBottom: -4 }}>
              Flying From
            </span>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: CARD, borderRadius: 14, padding: '16px 18px',
              border: `1px solid ${BORDER}`,
            }}>
              <div>
                <span style={{ color: TEXT, fontSize: 17, fontWeight: 600, display: 'block' }}>
                  ✈️ {departureCity}
                </span>
                <span style={{ color: MUTED, fontSize: 13, marginTop: 2, display: 'block' }}>
                  {departureCode}
                </span>
              </div>
              <select
                value={departureCode}
                onChange={(e) => {
                  const opt = DEPARTURE_OPTIONS.find((o) => o.code === e.target.value);
                  if (opt) setDeparture(opt.city, opt.code, true);
                }}
                style={{
                  background: '#334155', color: TEXT, border: `1px solid ${BORDER}`,
                  borderRadius: 8, padding: '8px 32px 8px 12px', fontSize: 14, cursor: 'pointer',
                  appearance: 'none', WebkitAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394A3B8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                }}
              >
                {DEPARTURE_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>{o.city} ({o.code})</option>
                ))}
              </select>
            </div>

            {/* Account */}
            <span style={{ color: MUTED, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginTop: 12, marginBottom: -4 }}>
              Account
            </span>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: CARD, borderRadius: 14, padding: '16px 18px',
              border: `1px solid ${BORDER}`,
            }}>
              <div>
                <span style={{ color: TEXT, fontSize: 15, fontWeight: 500, display: 'block' }}>
                  {user ? user.email : 'Guest'}
                </span>
                {isGuest && (
                  <span style={{ color: MUTED, fontSize: 12, marginTop: 2, display: 'block' }}>
                    Browsing without account
                  </span>
                )}
              </div>
              {user ? (
                <button
                  onClick={handleSignOut}
                  style={{
                    background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.3)`,
                    borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600,
                    color: DANGER, cursor: 'pointer',
                  }}
                >
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={() => router.replace('/auth/login')}
                  style={{
                    background: 'rgba(56,189,248,0.1)', border: `1px solid rgba(56,189,248,0.3)`,
                    borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600,
                    color: ACCENT, cursor: 'pointer',
                  }}
                >
                  Sign In
                </button>
              )}
            </div>

            {/* Legal */}
            <span style={{ color: MUTED, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginTop: 12, marginBottom: -4 }}>
              Legal
            </span>
            {[
              { label: 'Privacy Policy', route: '/legal/privacy' },
              { label: 'Terms of Service', route: '/legal/terms' },
            ].map((item) => (
              <div
                key={item.label}
                onClick={() => router.push(item.route as any)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: CARD, borderRadius: 14, padding: '16px 18px',
                  border: `1px solid ${BORDER}`, cursor: 'pointer',
                }}
              >
                <span style={{ color: TEXT, fontSize: 15, fontWeight: 500 }}>{item.label}</span>
                <span style={{ color: MUTED, fontSize: 14 }}>›</span>
              </div>
            ))}

            {/* About */}
            <span style={{ color: MUTED, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginTop: 12, marginBottom: -4 }}>
              About
            </span>
            <div style={{
              backgroundColor: CARD, borderRadius: 14, padding: '16px 18px',
              border: `1px solid ${BORDER}`,
            }}>
              <span style={{ color: TEXT, fontSize: 15, fontWeight: 500, display: 'block' }}>SoGoJet</span>
              <span style={{ color: MUTED, fontSize: 13, marginTop: 4, display: 'block' }}>Version 1.0.0</span>
              <span style={{ color: MUTED, fontSize: 12, marginTop: 2, display: 'block' }}>Find cheap flights to amazing places ✈️</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Native ─────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 }}>
          <Text style={{ color: TEXT, fontSize: 28, fontWeight: '800' }}>Settings</Text>
        </View>
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {/* Flying From */}
          <Text style={{ color: MUTED, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 }}>Flying From</Text>
          <Pressable
            onPress={() => setShowDepartureModal(true)}
            style={{ backgroundColor: CARD, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: BORDER }}
          >
            <View>
              <Text style={{ color: TEXT, fontSize: 17, fontWeight: '600' }}>✈️ {departureCity}</Text>
              <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{departureCode}</Text>
            </View>
            <Text style={{ color: MUTED, fontSize: 14 }}>Change ›</Text>
          </Pressable>

          {/* Account */}
          <Text style={{ color: MUTED, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 12 }}>Account</Text>
          <View style={{ backgroundColor: CARD, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: BORDER }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: TEXT, fontSize: 15, fontWeight: '500' }} numberOfLines={1}>
                {user ? user.email : 'Guest'}
              </Text>
              {isGuest && (
                <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>Browsing without account</Text>
              )}
            </View>
            {user ? (
              <Pressable onPress={handleSignOut} style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 }}>
                <Text style={{ color: DANGER, fontSize: 13, fontWeight: '600' }}>Sign Out</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => router.replace('/auth/login')} style={{ backgroundColor: 'rgba(56,189,248,0.1)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 }}>
                <Text style={{ color: ACCENT, fontSize: 13, fontWeight: '600' }}>Sign In</Text>
              </Pressable>
            )}
          </View>

          {/* Legal */}
          <Text style={{ color: MUTED, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 12 }}>Legal</Text>
          <Pressable onPress={() => router.push('/legal/privacy')} style={{ backgroundColor: CARD, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: BORDER }}>
            <Text style={{ color: TEXT, fontSize: 15, fontWeight: '500' }}>Privacy Policy</Text>
            <Text style={{ color: MUTED, fontSize: 14 }}>›</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/legal/terms')} style={{ backgroundColor: CARD, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: BORDER }}>
            <Text style={{ color: TEXT, fontSize: 15, fontWeight: '500' }}>Terms of Service</Text>
            <Text style={{ color: MUTED, fontSize: 14 }}>›</Text>
          </Pressable>

          {/* About */}
          <Text style={{ color: MUTED, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 12 }}>About</Text>
          <View style={{ backgroundColor: CARD, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BORDER }}>
            <Text style={{ color: TEXT, fontSize: 15, fontWeight: '500' }}>SoGoJet</Text>
            <Text style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>Version 1.0.0</Text>
            <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>Find cheap flights to amazing places ✈️</Text>
          </View>

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Departure City Modal */}
      <Modal visible={showDepartureModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: BORDER }}>
              <Text style={{ color: TEXT, fontSize: 18, fontWeight: '700' }}>Departure City</Text>
              <Pressable onPress={() => setShowDepartureModal(false)}>
                <Text style={{ color: ACCENT, fontSize: 15, fontWeight: '600' }}>Done</Text>
              </Pressable>
            </View>
            <FlatList
              data={DEPARTURE_OPTIONS}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setDeparture(item.city, item.code, true); setShowDepartureModal(false); }}
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 14, paddingHorizontal: 20,
                    backgroundColor: item.code === departureCode ? 'rgba(56,189,248,0.08)' : 'transparent',
                  }}
                >
                  <Text style={{ color: item.code === departureCode ? ACCENT : TEXT, fontSize: 15, fontWeight: item.code === departureCode ? '600' : '400' }}>
                    {item.city} ({item.code})
                  </Text>
                  {item.code === departureCode && <Text style={{ color: ACCENT, fontSize: 16 }}>✓</Text>}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
