// Mock for services/supabaseServer.ts — used in CI where env vars aren't set

const mockFrom = jest.fn().mockReturnValue({
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  contains: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  then: jest.fn().mockImplementation((resolve) => {
    if (resolve) resolve({ data: [], error: null, count: 0 });
    return Promise.resolve({ data: [], error: null, count: 0 });
  }),
});

export const supabase = {
  from: mockFrom,
};

export const TABLES = {
  destinations: 'destinations',
  savedTrips: 'saved_trips',
  userPreferences: 'user_preferences',
  swipeHistory: 'swipe_history',
  cachedPrices: 'cached_prices',
  cachedHotelPrices: 'cached_hotel_prices',
  destinationImages: 'destination_images',
  aiCache: 'ai_cache',
  priceAlerts: 'price_alerts',
  subscribers: 'subscribers',
  bookings: 'bookings',
  bookingPassengers: 'booking_passengers',
  priceCalendar: 'price_calendar',
  priceHistoryStats: 'price_history_stats',
} as const;
