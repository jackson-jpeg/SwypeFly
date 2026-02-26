import { useQuery } from '@tanstack/react-query';
import { API_BASE } from '../services/apiHelpers';

// ─── Live Updates (weather/advisories) ──────────────────────────────

interface LiveUpdatesData {
  summary: string;
  sources: { title: string; uri: string }[];
}

async function fetchLiveUpdates(city: string, country: string): Promise<LiveUpdatesData> {
  const params = new URLSearchParams({ city, country });
  const res = await fetch(`${API_BASE}/api/ai/live-updates?${params}`);
  if (!res.ok) throw new Error(`Live updates failed: ${res.status}`);
  return res.json();
}

export function useLiveUpdates(city: string | undefined, country: string | undefined) {
  return useQuery({
    queryKey: ['ai', 'live-updates', city, country],
    queryFn: () => fetchLiveUpdates(city!, country!),
    enabled: !!city && !!country,
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });
}

// ─── Nearby Gems ────────────────────────────────────────────────────

interface Place {
  name: string;
  description: string;
  mapsUrl?: string;
}

interface NearbyGemsData {
  places: Place[];
}

async function fetchNearbyGems(city: string, country: string): Promise<NearbyGemsData> {
  const params = new URLSearchParams({ city, country });
  const res = await fetch(`${API_BASE}/api/ai/nearby-gems?${params}`);
  if (!res.ok) throw new Error(`Nearby gems failed: ${res.status}`);
  return res.json();
}

export function useNearbyGems(city: string | undefined, country: string | undefined) {
  return useQuery({
    queryKey: ['ai', 'nearby-gems', city, country],
    queryFn: () => fetchNearbyGems(city!, country!),
    enabled: !!city && !!country,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    retry: 1,
  });
}

// ─── Destination Guide (AI itinerary + restaurants) ─────────────────

interface ItineraryDay {
  day: number;
  activities: string[];
}

interface GuideRestaurant {
  name: string;
  type: string;
  rating: number;
  mapsUrl?: string;
}

interface DestinationGuideData {
  itinerary: ItineraryDay[];
  restaurants: GuideRestaurant[];
}

async function fetchDestinationGuide(city: string, country: string): Promise<DestinationGuideData> {
  const params = new URLSearchParams({ city, country });
  const res = await fetch(`${API_BASE}/api/ai/destination-guide?${params}`);
  if (!res.ok) throw new Error(`Destination guide failed: ${res.status}`);
  return res.json();
}

export function useDestinationGuide(city: string | undefined, country: string | undefined) {
  return useQuery({
    queryKey: ['ai', 'destination-guide', city, country],
    queryFn: () => fetchDestinationGuide(city!, country!),
    enabled: !!city && !!country,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    retry: 1,
  });
}

// NOTE: usePriceCheck and useTripPlan were removed as dead code.
// The AiTripPlanner component uses streaming fetch directly (not React Query).
