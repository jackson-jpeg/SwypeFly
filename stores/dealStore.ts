import { create } from 'zustand';
import type { BoardDeal } from '../types/deal';
import { getAirlineName } from '../utils/airlines';
import { generateAviasalesLink } from '../utils/affiliateLinks';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || '';
const PAGE_SIZE = 10;

// ─── API response → BoardDeal transform ─────────────────────────────

interface ApiDestination {
  id: string;
  iataCode: string;
  city: string;
  country: string;
  tagline: string;
  description: string;
  imageUrl: string;
  flightPrice: number;
  flightDuration: string;
  vibeTags: string[];
  departureDate?: string;
  returnDate?: string;
  cheapestDate?: string;
  cheapestReturnDate?: string;
  tripDurationDays?: number;
  airline?: string;
  priceSource?: string;
  priceDirection?: string;
  affiliateUrl?: string;
  itinerary?: { day: number; activities: string[] }[];
  restaurants?: { name: string; type: string; rating: number }[];
  // Deal quality fields
  dealScore?: number;
  dealTier?: 'amazing' | 'great' | 'good' | 'fair';
  qualityScore?: number;
  pricePercentile?: number;
  isNonstop?: boolean;
  totalStops?: number;
  maxLayoverMinutes?: number;
  usualPrice?: number;
  savingsAmount?: number;
  savingsPercent?: number;
  priceHistory?: number[];
  nearbyOrigin?: string;
  nearbyOriginLabel?: string;
}

function randomTime(): string {
  const h = String(Math.floor(Math.random() * 18) + 5).padStart(2, '0');
  const m = String(Math.floor(Math.random() * 60)).padStart(2, '0');
  return `${h}:${m}`;
}

function randomFlightCode(airlineCode?: string): string {
  const code = airlineCode || ['AA', 'DL', 'UA', 'B6'][Math.floor(Math.random() * 4)];
  const num = String(Math.floor(Math.random() * 900) + 100);
  return `${code}${num}`;
}

function getStatus(d: ApiDestination): 'DEAL' | 'HOT' | 'NEW' {
  // Use deal tier when available (from deal quality engine)
  if (d.dealTier === 'amazing' || d.dealTier === 'great') return 'DEAL';
  if (d.dealTier === 'good') return 'HOT';

  // Fallback to legacy logic
  if (d.priceSource === 'estimate' || d.priceSource === 'amadeus') return 'NEW';
  if (d.priceDirection === 'down') return 'DEAL';
  if (d.priceSource === 'duffel') return 'HOT';
  if (d.priceSource === 'travelpayouts') return 'DEAL';
  return 'NEW';
}

function apiToBoardDeal(d: ApiDestination, origin: string): BoardDeal {
  const hasPrice = d.flightPrice != null && d.flightPrice > 0;
  const price = hasPrice ? Math.round(d.flightPrice) : null;
  const tripDays = d.tripDurationDays ?? 5;
  const depDate = d.departureDate || '';
  const retDate = d.returnDate || '';

  return {
    id: d.id,
    departureTime: randomTime(),
    destination: d.city.toUpperCase().slice(0, 12),
    destinationFull: d.city,
    country: d.country,
    iataCode: d.iataCode,
    flightCode: randomFlightCode(d.airline),
    price,
    priceFormatted: price != null ? `$${price}` : 'Check',
    status: hasPrice ? getStatus(d) : 'NEW',
    priceSource: d.priceSource || 'unknown',
    airline: d.airline ? getAirlineName(d.airline) : 'Multiple Airlines',
    departureDate: depDate,
    returnDate: retDate,
    cheapestDate: d.cheapestDate || d.departureDate || '',
    cheapestReturnDate: d.cheapestReturnDate || d.returnDate || '',
    tripDays,
    flightDuration: d.flightDuration || '—',
    vibeTags: d.vibeTags || [],
    imageUrl: d.imageUrl || '',
    tagline: d.tagline || '',
    description: d.description || '',
    affiliateUrl: d.affiliateUrl || generateAviasalesLink(origin, d.iataCode, depDate, retDate),
    itinerary: d.itinerary,
    restaurants: d.restaurants,
    // Deal quality fields
    dealScore: d.dealScore,
    dealTier: d.dealTier,
    qualityScore: d.qualityScore,
    pricePercentile: d.pricePercentile,
    isNonstop: d.isNonstop,
    totalStops: d.totalStops,
    maxLayoverMinutes: d.maxLayoverMinutes,
    usualPrice: d.usualPrice,
    savingsAmount: d.savingsAmount,
    savingsPercent: d.savingsPercent,
    priceHistory: d.priceHistory,
    nearbyOrigin: d.nearbyOrigin,
    nearbyOriginLabel: d.nearbyOriginLabel,
  };
}

// ─── Store ───────────────────────────────────────────────────────────

interface DealState {
  deals: BoardDeal[];
  isLoading: boolean;
  error: string | null;

  // Board-specific
  boardIndex: number;
  advanceBoard: () => void;
  jumpToBoard: (index: number) => void;

  // Shared
  updateDealPrice: (dealId: string, price: number) => void;
  fetchDeals: (origin: string, filters?: Record<string, string>) => Promise<void>;
  fetchMore: (origin: string, filters?: Record<string, string>) => Promise<void>;
}

let cursor = 0;

export const useDealStore = create<DealState>()((set, get) => ({
  deals: [],
  isLoading: false,
  error: null,

  boardIndex: 0,
  advanceBoard: () => {
    const { boardIndex, deals } = get();
    if (boardIndex < deals.length - 1) {
      set({ boardIndex: boardIndex + 1 });
    }
  },
  jumpToBoard: (index) => set({ boardIndex: index }),

  updateDealPrice: (dealId, price) => {
    const deals = get().deals.map((d) =>
      d.id === dealId ? { ...d, price, priceFormatted: `$${price}` } : d,
    );
    set({ deals });
  },

  fetchDeals: async (origin, filters?: Record<string, string>) => {
    set({ isLoading: true, error: null, boardIndex: 0 });
    cursor = 0;

    try {
      const params = new URLSearchParams({ origin, cursor: '0', ...filters });
      const res = await fetch(`${API_BASE}/api/feed?${params}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const raw: ApiDestination[] = data.destinations || data.deals || data;
      const deals = raw.map((d) => apiToBoardDeal(d, origin));
      set({ deals, isLoading: false });
    } catch (e) {
      set({ deals: [], isLoading: false, error: (e as Error).message });
    }
  },

  fetchMore: async (origin, filters?: Record<string, string>) => {
    if (get().isLoading) return;
    if (!API_BASE) return;

    cursor += PAGE_SIZE;
    try {
      const params = new URLSearchParams({
        origin,
        cursor: String(cursor),
        ...filters,
      });
      const res = await fetch(`${API_BASE}/api/feed?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const raw: ApiDestination[] = data.destinations || data.deals || data;
      if (raw.length > 0) {
        const newDeals = raw.map((d) => apiToBoardDeal(d, origin));
        set({ deals: [...get().deals, ...newDeals] });
      }
    } catch {
      // Silently fail on pagination errors
    }
  },
}));
