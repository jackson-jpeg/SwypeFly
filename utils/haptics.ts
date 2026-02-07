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
