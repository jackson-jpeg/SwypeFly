// Mock the persist storage to avoid AsyncStorage/window issues in Node test env
jest.mock('../../utils/storage', () => ({
  createPersistStorage: () => undefined,
}));

import { useSettingsStore } from '../../stores/settingsStore';
import type { BudgetPreference } from '../../stores/settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({ budgetPreference: null });
  });

  // ─── Initial state ──────────────────────────────────────────

  it('starts with budgetPreference as null', () => {
    expect(useSettingsStore.getState().budgetPreference).toBeNull();
  });

  // ─── setBudgetPreference ────────────────────────────────────

  it('sets budgetPreference to a value', () => {
    useSettingsStore.getState().setBudgetPreference('balanced');
    expect(useSettingsStore.getState().budgetPreference).toBe('balanced');
  });

  it.each<BudgetPreference>(['budget', 'balanced', 'premium'])(
    'sets budgetPreference to "%s"',
    (pref) => {
      useSettingsStore.getState().setBudgetPreference(pref);
      expect(useSettingsStore.getState().budgetPreference).toBe(pref);
    },
  );

  it('overwrites previous budgetPreference', () => {
    useSettingsStore.getState().setBudgetPreference('budget');
    useSettingsStore.getState().setBudgetPreference('premium');
    expect(useSettingsStore.getState().budgetPreference).toBe('premium');
  });
});
