import { View, Text, Platform, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, buttons } from '../constants/theme';

export default function NotFound() {
  if (Platform.OS === 'web') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', backgroundColor: colors.duskSand, padding: 32, textAlign: 'center',
      }}>
        {/* "4 ✈ 4" — Bebas Neue large numerals with seafoamMist icon between */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <span style={{
            fontFamily: fonts.impact, fontSize: 120, fontWeight: 400,
            color: colors.deepDusk, lineHeight: 1, letterSpacing: '-0.02em',
          }}>4</span>
          <div style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: colors.seafoamMist,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 32 }}>✈️</span>
          </div>
          <span style={{
            fontFamily: fonts.impact, fontSize: 120, fontWeight: 400,
            color: colors.deepDusk, lineHeight: 1, letterSpacing: '-0.02em',
          }}>4</span>
        </div>

        <h2 style={{
          margin: '0 0 12px 0', color: colors.deepDusk,
          fontSize: 24, fontWeight: 700, fontFamily: fonts.display,
        }}>
          This flight got cancelled
        </h2>
        <p style={{
          margin: '0 0 32px 0', color: colors.bylineText,
          fontSize: 15, lineHeight: 1.6, maxWidth: 320,
        }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        <button
          onClick={() => router.replace('/')}
          style={{
            height: buttons.primary.height,
            paddingLeft: 32, paddingRight: 32,
            borderRadius: buttons.primary.borderRadius,
            backgroundColor: colors.deepDusk,
            border: 'none',
            color: colors.paleHorizon,
            fontSize: 17, fontWeight: 600, fontFamily: fonts.body,
            cursor: 'pointer',
          }}
        >
          Back to Exploring
        </button>
      </div>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.duskSand, padding: 32 }}>
      {/* "4 ✈ 4" */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Text style={{ fontFamily: fonts.impact, fontSize: 120, color: colors.deepDusk, lineHeight: 120 }}>4</Text>
        <View style={{
          width: 72, height: 72, borderRadius: 36,
          backgroundColor: colors.seafoamMist,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 32 }}>✈️</Text>
        </View>
        <Text style={{ fontFamily: fonts.impact, fontSize: 120, color: colors.deepDusk, lineHeight: 120 }}>4</Text>
      </View>

      <Text style={{
        color: colors.deepDusk, fontSize: 24, fontWeight: '700',
        fontFamily: fonts.display, textAlign: 'center', marginBottom: 12,
      }}>
        This flight got cancelled
      </Text>
      <Text style={{
        color: colors.bylineText, fontSize: 15, textAlign: 'center',
        lineHeight: 24, marginBottom: 32, maxWidth: 320,
      }}>
        The page you're looking for doesn't exist or has been moved. Let's get you back on track.
      </Text>

      <Pressable
        onPress={() => router.replace('/')}
        style={{
          height: buttons.primary.height,
          paddingHorizontal: 32,
          borderRadius: buttons.primary.borderRadius,
          backgroundColor: colors.deepDusk,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.paleHorizon, fontSize: 17, fontWeight: '600' }}>Back to Exploring</Text>
      </Pressable>
    </View>
  );
}
