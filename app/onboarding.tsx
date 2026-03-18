import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { airports, type Airport } from '../data/airports';
import { useSettingsStore } from '../stores/settingsStore';
import { colors, fonts, spacing } from '../theme/tokens';
import { successHaptic } from '../utils/haptics';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setDeparture, setOnboarded } = useSettingsStore();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Airport | null>(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return airports
      .filter((a) => a.code.toLowerCase().includes(q) || a.city.toLowerCase().includes(q))
      .slice(0, 5);
  }, [query]);

  const handleSelect = (airport: Airport) => {
    setSelected(airport);
    setQuery(`${airport.city} (${airport.code})`);
  };

  const handleGo = async () => {
    if (!selected) return;
    setDeparture(selected.city, selected.code);
    setOnboarded();
    await successHaptic();
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 80 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.emoji}>✈️</Text>
      <Text style={styles.heading}>Where are you{'\n'}flying from?</Text>

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
      </View>

      {results.length > 0 && !selected && (
        <View style={styles.results}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable style={styles.resultRow} onPress={() => handleSelect(item)}>
                <Text style={styles.resultCode}>{item.code}</Text>
                <Text style={styles.resultCity}>{item.city}</Text>
              </Pressable>
            )}
          />
        </View>
      )}

      <Pressable
        style={[styles.button, !selected && styles.buttonDisabled]}
        onPress={handleGo}
        disabled={!selected}
      >
        <Text style={[styles.buttonText, !selected && styles.buttonTextDisabled]}>
          Let's Go
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  emoji: { fontSize: 48, textAlign: 'center', marginBottom: spacing.lg },
  heading: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.white,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 36,
  },
  inputWrapper: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    marginBottom: spacing.sm,
  },
  input: {
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
    marginBottom: spacing.md,
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
  resultCode: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.yellow,
    width: 48,
  },
  resultCity: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.white,
  },
  button: {
    backgroundColor: colors.green,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    backgroundColor: colors.cell,
  },
  buttonText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.bg,
  },
  buttonTextDisabled: {
    color: colors.faint,
  },
});
