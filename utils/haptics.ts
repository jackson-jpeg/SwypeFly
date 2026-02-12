import * as Haptics from 'expo-haptics';
import { useUIStore } from '../stores/uiStore';

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
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch {
    // Haptics not available
  }
}
