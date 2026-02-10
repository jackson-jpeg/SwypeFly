import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

function getApiBase(): string {
  if (typeof window !== 'undefined' && window.location?.hostname !== 'localhost') {
    return '';
  }
  return '';
}

const API_BASE = getApiBase();

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {}
  return {};
}

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

// ─── Price Check ────────────────────────────────────────────────────

interface PriceCheckData {
  price: number;
  source: string;
  url: string;
}

async function fetchPriceCheck(origin: string, destination: string): Promise<PriceCheckData> {
  const params = new URLSearchParams({ origin, destination });
  const res = await fetch(`${API_BASE}/api/ai/price-check?${params}`);
  if (!res.ok) throw new Error(`Price check failed: ${res.status}`);
  return res.json();
}

export function usePriceCheck(origin: string, destination: string) {
  return useQuery({
    queryKey: ['ai', 'price-check', origin, destination],
    queryFn: () => fetchPriceCheck(origin, destination),
    enabled: false, // On-demand only — call refetch()
    staleTime: 30 * 60 * 1000, // 30 min
    retry: 1,
  });
}

// ─── Trip Plan ──────────────────────────────────────────────────────

interface TripPlanData {
  plan: string;
}

async function fetchTripPlan(destinationId: string, city: string, country: string): Promise<TripPlanData> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/ai/trip-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ destination_id: destinationId, city, country }),
  });
  if (!res.ok) throw new Error(`Trip plan failed: ${res.status}`);
  return res.json();
}

export function useTripPlan(destinationId: string | undefined, city: string | undefined, country: string | undefined) {
  return useQuery({
    queryKey: ['ai', 'trip-plan', destinationId],
    queryFn: () => fetchTripPlan(destinationId!, city!, country!),
    enabled: false, // On-demand — call refetch()
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    retry: 1,
  });
}
