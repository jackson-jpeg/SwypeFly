import type { VibeTag } from './destination';

export interface UserPreferences {
  hapticsEnabled: boolean;
  theme: 'dark' | 'light' | 'system';
  preferredVibes: VibeTag[];
  maxBudget: number | null;
  departureCity: string | null;
}
