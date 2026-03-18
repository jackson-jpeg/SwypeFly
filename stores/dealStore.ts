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
  tripDurationDays?: number;
  airline?: string;
  priceSource?: string;
  priceDirection?: string;
  affiliateUrl?: string;
  itinerary?: { day: number; activities: string[] }[];
  restaurants?: { name: string; type: string; rating: number }[];
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

function getStatus(priceDirection?: string, priceSource?: string): 'DEAL' | 'HOT' | 'NEW' {
  if (priceDirection === 'down') return 'DEAL';
  if (priceSource === 'duffel') return 'HOT';
  if (priceSource === 'travelpayouts') return 'DEAL';
  return 'NEW';
}

function apiToBoardDeal(d: ApiDestination, origin: string): BoardDeal {
  const hasPrice = d.flightPrice != null && d.flightPrice > 0 && d.priceSource === 'duffel';
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
    status: hasPrice ? getStatus(d.priceDirection, d.priceSource) : 'NEW',
    airline: d.airline ? getAirlineName(d.airline) : 'Multiple Airlines',
    departureDate: depDate,
    returnDate: retDate,
    tripDays,
    flightDuration: d.flightDuration || '—',
    vibeTags: d.vibeTags || [],
    imageUrl: d.imageUrl || '',
    tagline: d.tagline || '',
    description: d.description || '',
    affiliateUrl: d.affiliateUrl || generateAviasalesLink(origin, d.iataCode, depDate, retDate),
    itinerary: d.itinerary,
    restaurants: d.restaurants,
  };
}

// ─── Store ───────────────────────────────────────────────────────────

interface DealState {
  deals: BoardDeal[];
  isLoading: boolean;
  error: string | null;
  activeFilters: string[];

  // Board-specific
  boardIndex: number;
  advanceBoard: () => void;
  jumpToBoard: (index: number) => void;

  // Shared
  setFilters: (vibes: string[]) => void;
  clearFilters: () => void;
  updateDealPrice: (dealId: string, price: number) => void;
  fetchDeals: (origin: string) => Promise<void>;
  fetchMore: (origin: string) => Promise<void>;
}

let cursor = 0;

export const useDealStore = create<DealState>()((set, get) => ({
  deals: [],
  isLoading: false,
  error: null,
  activeFilters: [],

  boardIndex: 0,
  advanceBoard: () => {
    const { boardIndex, deals } = get();
    if (boardIndex < deals.length - 1) {
      set({ boardIndex: boardIndex + 1 });
    }
  },
  jumpToBoard: (index) => set({ boardIndex: index }),

  setFilters: (vibes) => set({ activeFilters: vibes }),
  clearFilters: () => set({ activeFilters: [] }),

  updateDealPrice: (dealId, price) => {
    const deals = get().deals.map((d) =>
      d.id === dealId ? { ...d, price, priceFormatted: `$${price}` } : d,
    );
    set({ deals });
  },

  fetchDeals: async (origin) => {
    set({ isLoading: true, error: null, boardIndex: 0 });
    cursor = 0;

    try {
      const vibes = get().activeFilters.join(',');
      const params = new URLSearchParams({ origin, cursor: '0', ...(vibes && { vibes }) });
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

  fetchMore: async (origin) => {
    if (get().isLoading) return;
    if (!API_BASE) return;

    cursor += PAGE_SIZE;
    try {
      const vibes = get().activeFilters.join(',');
      const params = new URLSearchParams({
        origin,
        cursor: String(cursor),
        ...(vibes && { vibes }),
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
