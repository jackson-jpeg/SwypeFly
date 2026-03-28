import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Switch,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSavedStore } from '../../stores/savedStore';
import { airports, type Airport } from '../../data/airports';
import { colors, fonts, spacing } from '../../theme/tokens';
import { successHaptic } from '../../utils/haptics';
import { showToast } from '../../stores/toastStore';
import SplitFlapRow from '../../components/board/SplitFlapRow';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';

function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const handleSubscribe = async () => {
    if (!email.trim() || !email.includes('@')) return;
    setStatus('sending');
    try {
      const res = await fetch(`${API_BASE}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setStatus('done');
        setEmail('');
        showToast('Subscribed to deal alerts!');
        successHaptic();
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <View style={{ backgroundColor: colors.cell, borderRadius: 8, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.green, textAlign: 'center' }}>
          You're subscribed! We'll send the best deals to your inbox.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.cell, borderRadius: 8, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
      <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted }}>
        Get the best flight deals delivered to your inbox weekly.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={{
            flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
            borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, fontFamily: fonts.body,
            fontSize: 14, color: colors.white,
          }}
          placeholder="your@email.com"
          placeholderTextColor={colors.muted + '60'}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          onPress={handleSubscribe}
          disabled={status === 'sending'}
          style={{
            backgroundColor: colors.orange, borderRadius: 6, paddingHorizontal: 16,
            justifyContent: 'center', opacity: status === 'sending' ? 0.5 : 1,
          }}
        >
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: '#FFF8F0' }}>
            {status === 'sending' ? '...' : 'Subscribe'}
          </Text>
        </Pressable>
      </View>
      {status === 'error' && (
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: '#E85D4A' }}>
          Something went wrong. Please try again.
        </Text>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const settings = useSettingsStore();
  const clearSaved = useSavedStore((s) => s.clear);

  const [editingAirport, setEditingAirport] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Airport | null>(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return airports
      .filter((a) => a.code.toLowerCase().includes(q) || a.city.toLowerCase().includes(q))
      .slice(0, 5);
  }, [query]);

  const handleSelectAirport = useCallback(
    (airport: Airport) => {
      setSelected(airport);
      setQuery(`${airport.city} (${airport.code})`);
      settings.setDeparture(airport.city, airport.code);
      setEditingAirport(false);
      setQuery('');
      successHaptic();
    },
    [settings],
  );

  const handleViewToggle = useCallback(() => {
    settings.setPreferredView(settings.preferredView === 'swipe' ? 'board' : 'swipe');
    successHaptic();
  }, [settings]);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>SETTINGS</Text>

      {/* ── Departure ── */}
      <Text style={styles.sectionLabel}>DEPARTURE</Text>
      {editingAirport ? (
        <View>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Search airports..."
              placeholderTextColor={colors.faint}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                setSelected(null);
              }}
              autoFocus
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Pressable onPress={() => setEditingAirport(false)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </Pressable>
          </View>
          {results.length > 0 && !selected && (
            <View style={styles.results}>
              <FlatList
                data={results}
                keyExtractor={(item) => item.code}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <Pressable style={styles.resultRow} onPress={() => handleSelectAirport(item)}>
                    <Text style={styles.resultCode}>{item.code}</Text>
                    <Text style={styles.resultCity}>{item.city}</Text>
                  </Pressable>
                )}
              />
            </View>
          )}
        </View>
      ) : (
        <Pressable style={styles.row} onPress={() => setEditingAirport(true)}>
          <View>
            <Text style={styles.rowLabel}>Departure Airport</Text>
            <Text style={styles.rowHint}>Deals are priced from this city</Text>
          </View>
          <View style={styles.rowRight}>
            <SplitFlapRow
              text={settings.departureCode}
              maxLength={3}
              size="md"
              color={colors.yellow}
              align="left"
              startDelay={0}
              animate={true}
            />
            <Text style={styles.rowCityLabel}> · {settings.departureCity}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.faint} />
          </View>
        </Pressable>
      )}

      {/* ── Display ── */}
      <Text style={styles.sectionLabel}>DISPLAY</Text>
      <Pressable style={styles.row} onPress={handleViewToggle}>
        <View>
          <Text style={styles.rowLabel}>Default View</Text>
          <Text style={styles.rowHint}>How deals appear on the home tab</Text>
        </View>
        <View style={styles.pillToggle}>
          <View style={[styles.pill, settings.preferredView === 'swipe' && styles.pillActive]}>
            <Text
              style={[styles.pillText, settings.preferredView === 'swipe' && styles.pillTextActive]}
            >
              Swipe
            </Text>
          </View>
          <View style={[styles.pill, settings.preferredView === 'board' && styles.pillActive]}>
            <Text
              style={[styles.pillText, settings.preferredView === 'board' && styles.pillTextActive]}
            >
              Board
            </Text>
          </View>
        </View>
      </Pressable>

      {/* ── Notifications ── */}
      <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>Push Notifications</Text>
          <Text style={styles.rowHint}>Get notified about new deals</Text>
        </View>
        <Switch
          value={settings.notificationsEnabled}
          onValueChange={settings.setNotifications}
          trackColor={{ false: colors.cell, true: colors.green + '80' }}
          thumbColor={settings.notificationsEnabled ? colors.green : colors.muted}
        />
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>Price Alerts</Text>
          <Text style={styles.rowHint}>Alert when saved destinations drop in price</Text>
        </View>
        <Switch
          value={settings.priceAlertsEnabled}
          onValueChange={settings.setPriceAlerts}
          trackColor={{ false: colors.cell, true: colors.green + '80' }}
          thumbColor={settings.priceAlertsEnabled ? colors.green : colors.muted}
        />
      </View>

      {/* ── Data ── */}
      <Text style={styles.sectionLabel}>DATA</Text>
      <Pressable
        style={styles.row}
        onPress={() => {
          clearSaved();
          successHaptic();
          showToast('Saved flights cleared');
        }}
      >
        <Text style={styles.rowLabel}>Clear Saved Flights</Text>
        <Ionicons name="trash-outline" size={18} color="#E85D4A" />
      </Pressable>

      {/* ── About ── */}
      <Text style={styles.sectionLabel}>ABOUT</Text>
      <Pressable
        style={styles.row}
        onPress={() => {
          const url = 'https://sogojet.com/privacy';
          if (Platform.OS === 'web') { window.open(url, '_blank'); } else { Linking.openURL(url); }
        }}
      >
        <Text style={styles.rowLabel}>Privacy Policy</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.faint} />
      </Pressable>
      <Pressable
        style={styles.row}
        onPress={() => {
          const url = 'https://sogojet.com/terms';
          if (Platform.OS === 'web') { window.open(url, '_blank'); } else { Linking.openURL(url); }
        }}
      >
        <Text style={styles.rowLabel}>Terms of Service</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.faint} />
      </Pressable>
      <Pressable
        style={styles.row}
        onPress={() => {
          const url = 'mailto:hello@sogojet.com';
          if (Platform.OS === 'web') { window.open(url); } else { Linking.openURL(url); }
        }}
      >
        <Text style={styles.rowLabel}>Contact</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.faint} />
      </Pressable>

      {/* ── Newsletter ── */}
      <Text style={styles.sectionLabel}>STAY IN THE LOOP</Text>
      <NewsletterSignup />

      {/* ── Get the App ── */}
      {Platform.OS === 'web' && (
        <>
          <Text style={styles.sectionLabel}>GET THE APP</Text>
          <Pressable
            style={[styles.row, { backgroundColor: colors.yellow + '10', borderColor: colors.yellow + '30' }]}
            onPress={() => {
              if (typeof window !== 'undefined') window.open('https://apps.apple.com/app/sogojet/id6746076960', '_blank');
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Ionicons name="logo-apple" size={20} color={colors.yellow} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: colors.yellow }]}>Download SoGoJet for iOS</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 }}>
                  Booking, price alerts, Face ID, and more
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.yellow} />
          </Pressable>
        </>
      )}

      <Text style={styles.footer}>SoGoJet v2.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingBottom: 60 },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.white,
    paddingTop: 16,
    paddingBottom: 8,
    letterSpacing: 2,
  },
  sectionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.green,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 28,
    marginBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.green + '30',
    paddingBottom: 6,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cell,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  rowLabel: { fontFamily: fonts.body, fontSize: 15, color: colors.white },
  rowHint: { fontFamily: fonts.body, fontSize: 11, color: colors.faint, marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontFamily: fonts.body, fontSize: 14, color: colors.green },
  rowCityLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.green },

  // Airport picker inline
  inputWrapper: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    marginBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  results: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  resultCode: { fontFamily: fonts.display, fontSize: 16, color: colors.yellow, width: 48 },
  resultCity: { fontFamily: fonts.body, fontSize: 14, color: colors.white },

  // View toggle
  pillToggle: {
    flexDirection: 'row',
    backgroundColor: colors.cell,
    borderRadius: 8,
    padding: 2,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pillActive: {
    backgroundColor: colors.green,
  },
  pillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.faint,
  },
  pillTextActive: {
    color: colors.bg,
  },

  footer: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.border,
    textAlign: 'center',
    marginTop: 40,
  },
});
