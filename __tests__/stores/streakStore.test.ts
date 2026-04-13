jest.mock('../../utils/storage', () => ({
  createPersistStorage: () => undefined,
}));

import { useStreakStore } from '../../stores/streakStore';

function setToday(dateStr: string) {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(dateStr + 'T12:00:00'));
}

describe('streakStore', () => {
  afterEach(() => {
    jest.useRealTimers();
    useStreakStore.setState({
      currentStreak: 0,
      longestStreak: 0,
      lastLoginDate: null,
    });
  });

  it('starts with zero streak', () => {
    const { currentStreak, longestStreak, lastLoginDate } = useStreakStore.getState();
    expect(currentStreak).toBe(0);
    expect(longestStreak).toBe(0);
    expect(lastLoginDate).toBeNull();
  });

  it('sets streak to 1 on first login', () => {
    setToday('2026-04-10');
    useStreakStore.getState().recordLogin();
    expect(useStreakStore.getState().currentStreak).toBe(1);
    expect(useStreakStore.getState().longestStreak).toBe(1);
    expect(useStreakStore.getState().lastLoginDate).toBe('2026-04-10');
  });

  it('does not increment on duplicate same-day login', () => {
    setToday('2026-04-10');
    useStreakStore.getState().recordLogin();
    useStreakStore.getState().recordLogin();
    useStreakStore.getState().recordLogin();
    expect(useStreakStore.getState().currentStreak).toBe(1);
  });

  it('increments streak on consecutive days', () => {
    setToday('2026-04-10');
    useStreakStore.getState().recordLogin();
    expect(useStreakStore.getState().currentStreak).toBe(1);

    setToday('2026-04-11');
    useStreakStore.getState().recordLogin();
    expect(useStreakStore.getState().currentStreak).toBe(2);

    setToday('2026-04-12');
    useStreakStore.getState().recordLogin();
    expect(useStreakStore.getState().currentStreak).toBe(3);
    expect(useStreakStore.getState().longestStreak).toBe(3);
  });

  it('resets streak after a gap day', () => {
    setToday('2026-04-10');
    useStreakStore.getState().recordLogin();
    setToday('2026-04-11');
    useStreakStore.getState().recordLogin();
    expect(useStreakStore.getState().currentStreak).toBe(2);

    // Skip April 12
    setToday('2026-04-13');
    useStreakStore.getState().recordLogin();
    expect(useStreakStore.getState().currentStreak).toBe(1);
    expect(useStreakStore.getState().longestStreak).toBe(2);
  });

  it('preserves longestStreak across resets', () => {
    setToday('2026-04-01');
    useStreakStore.getState().recordLogin();
    setToday('2026-04-02');
    useStreakStore.getState().recordLogin();
    setToday('2026-04-03');
    useStreakStore.getState().recordLogin();
    setToday('2026-04-04');
    useStreakStore.getState().recordLogin();
    expect(useStreakStore.getState().longestStreak).toBe(4);

    // Gap then new shorter streak
    setToday('2026-04-10');
    useStreakStore.getState().recordLogin();
    setToday('2026-04-11');
    useStreakStore.getState().recordLogin();
    expect(useStreakStore.getState().currentStreak).toBe(2);
    expect(useStreakStore.getState().longestStreak).toBe(4);
  });

  it('handles month boundary (Mar 31 → Apr 1)', () => {
    setToday('2026-03-31');
    useStreakStore.getState().recordLogin();
    setToday('2026-04-01');
    useStreakStore.getState().recordLogin();
    expect(useStreakStore.getState().currentStreak).toBe(2);
  });

  it('handles year boundary (Dec 31 → Jan 1)', () => {
    setToday('2025-12-31');
    useStreakStore.getState().recordLogin();
    setToday('2026-01-01');
    useStreakStore.getState().recordLogin();
    expect(useStreakStore.getState().currentStreak).toBe(2);
  });

  it('resets to 1 after a long absence', () => {
    setToday('2026-01-01');
    useStreakStore.getState().recordLogin();
    setToday('2026-04-10');
    useStreakStore.getState().recordLogin();
    expect(useStreakStore.getState().currentStreak).toBe(1);
    expect(useStreakStore.getState().longestStreak).toBe(1);
  });
});
