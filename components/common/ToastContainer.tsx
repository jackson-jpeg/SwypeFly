import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useToastStore, type Toast, type ToastType } from '../../stores/toastStore';
import { colors, fonts, spacing } from '../../theme/tokens';

const ICON_MAP: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

const COLOR_MAP: Record<ToastType, string> = {
  success: colors.dealAmazing,
  error: '#E85D4A',
  info: colors.yellow,
};

function ToastItem({ toast }: { toast: Toast }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    // Fade out before removal
    const fadeTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
      ]).start();
    }, toast.duration - 250);

    return () => clearTimeout(fadeTimer);
  }, [toast.duration, opacity, translateY]);

  const iconColor = COLOR_MAP[toast.type];

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
      <Pressable style={styles.toastInner} onPress={() => dismiss(toast.id)}>
        <Ionicons name={ICON_MAP[toast.type]} size={18} color={iconColor} />
        <Text style={styles.toastText} numberOfLines={2}>{toast.message}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 60 : 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    ...Platform.select({
      web: { pointerEvents: 'box-none' as const },
      default: {},
    }),
  },
  toast: {
    marginBottom: spacing.xs,
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: 340,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  toastText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.white,
    flex: 1,
  },
});
