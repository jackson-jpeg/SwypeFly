// ─── Toast UI Component ──────────────────────────────────────────────────────
// Rendered in app/_layout.tsx above all screens.

import { View, Text, Pressable, Platform } from 'react-native';
import { useToastStore, type Toast, type ToastType } from '../../stores/toastStore';
import { colors, radii, spacing, fontSize, fontWeight, shadows, animation } from '../../constants/theme';

const TYPE_COLORS: Record<ToastType, { bg: string; border: string; text: string }> = {
  success: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: colors.successDark },
  error: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: colors.error },
  info: { bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.3)', text: colors.primaryDarker },
};

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const style = TYPE_COLORS[toast.type];

  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          backgroundColor: style.bg,
          border: `1px solid ${style.border}`,
          borderRadius: radii.lg,
          padding: `${spacing['3']}px ${spacing['4']}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing['3'],
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: shadows.web.lg,
          animation: `sg-toast-in ${animation.slow}ms ease-out`,
          maxWidth: 400,
          width: '100%',
        }}
      >
        <span style={{ color: style.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>
          {toast.message}
        </span>
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.onPress();
              removeToast(toast.id);
            }}
            style={{
              background: 'none',
              border: `1px solid ${style.border}`,
              borderRadius: radii.md,
              padding: `${spacing['1']}px ${spacing['3']}px`,
              color: style.text,
              fontSize: fontSize.base,
              fontWeight: fontWeight.bold,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <View
      style={{
        backgroundColor: style.bg,
        borderWidth: 1,
        borderColor: style.border,
        borderRadius: radii.lg,
        paddingVertical: spacing['3'],
        paddingHorizontal: spacing['4'],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing['3'],
        maxWidth: 400,
        width: '100%',
      }}
    >
      <Text style={{ color: style.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, flex: 1 }}>
        {toast.message}
      </Text>
      {toast.action && (
        <Pressable
          onPress={() => {
            toast.action!.onPress();
            removeToast(toast.id);
          }}
          style={{
            borderWidth: 1,
            borderColor: style.border,
            borderRadius: radii.md,
            paddingHorizontal: spacing['3'],
            paddingVertical: spacing['1'],
          }}
        >
          <Text style={{ color: style.text, fontSize: fontSize.base, fontWeight: fontWeight.bold }}>
            {toast.action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  // sg-toast-in keyframes defined in global.css

  if (toasts.length === 0) return null;

  if (Platform.OS === 'web') {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          top: spacing['14'],
          left: 0,
          right: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: spacing['2'],
          padding: `0 ${spacing['4']}px`,
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: spacing['2'], width: '100%', alignItems: 'center' }}>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <View
      style={{
        position: 'absolute',
        top: spacing['14'],
        left: 0,
        right: 0,
        zIndex: 9999,
        alignItems: 'center',
        gap: spacing['2'],
        paddingHorizontal: spacing['4'],
      }}
      pointerEvents="box-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </View>
  );
}
