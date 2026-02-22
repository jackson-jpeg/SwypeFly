import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useUIStore } from '../stores/uiStore';

function webVibrate(ms: number | number[] = 10) {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(ms);
  }
}

export async function lightHaptic(): Promise<void> {
  try {
    if (useUIStore.getState().hapticsEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // Haptics not available (e.g., simulator)
  }
}

export async function mediumHaptic(): Promise<void> {
  try {
    if (useUIStore.getState().hapticsEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  } catch {
    // Haptics not available
  }
}

export async function selectionHaptic(): Promise<void> {
  try {
    if (useUIStore.getState().hapticsEnabled) {
      await Haptics.selectionAsync();
    }
  } catch {
    // Haptics not available
  }
}

export async function heavyHaptic(): Promise<void> {
  try {
    if (useUIStore.getState().hapticsEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  } catch {
    // Haptics not available
  }
}

export async function successHaptic(): Promise<void> {
  try {
    if (useUIStore.getState().hapticsEnabled) {
      webVibrate([10, 30, 10]);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch {
    webVibrate([10, 30, 10]);
  }
}
