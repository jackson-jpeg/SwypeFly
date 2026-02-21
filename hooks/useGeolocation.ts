import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { findNearestAirport } from '../data/airports';
import { useUIStore } from '../stores/uiStore';

/**
 * On first load (web only), request browser geolocation and set the
 * departure airport to the nearest major airport. Only runs once per
 * session — won't override a user's manual selection if they've already
 * changed it from the default.
 */
export function useGeolocation() {
  const hasRun = useRef(false);
  const setDeparture = useUIStore((s) => s.setDeparture);
  const departureCode = useUIStore((s) => s.departureCode);

  useEffect(() => {
    if (hasRun.current) return;
    if (Platform.OS !== 'web') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    hasRun.current = true;

    // Only auto-detect if user hasn't manually changed from default
    // We check localStorage for a flag indicating manual override
    try {
      const manualOverride = localStorage.getItem('sogojet-manual-departure');
      if (manualOverride === 'true') return;
    } catch {
      // localStorage not available
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const nearest = findNearestAirport(latitude, longitude);
        // Only update if it's different from current
        if (nearest.code !== departureCode) {
          setDeparture(nearest.city, nearest.code);
        }
      },
      () => {
        // User denied or error — keep default, no problem
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 30 * 60 * 1000, // 30 min cache
      },
    );
  }, [setDeparture, departureCode]);
}
