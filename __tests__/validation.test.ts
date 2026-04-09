import {
  feedQuerySchema,
  swipeBodySchema,
  destinationQuerySchema,
  bookingSearchSchema,
  passengerSchema,
  priceAlertBodySchema,
  subscribeBodySchema,
  hotelSearchSchema,
  savedActionSchema,
  validateRequest,
} from '../utils/validation';

// ─── feedQuerySchema ────────────────────────────────────────────────

describe('feedQuerySchema', () => {
  it('applies defaults when given empty object', () => {
    const result = feedQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.origin).toBe('TPA');
      expect(result.data.cursor).toBeUndefined();
    }
  });

  it('accepts a full valid query', () => {
    const result = feedQuerySchema.safeParse({
      origin: 'JFK',
      cursor: '10',
      vibeFilter: 'beach',
      sortPreset: 'cheapest',
      durationFilter: 'weekend',
      travelStyle: 'luxury',
      maxPrice: '500',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.origin).toBe('JFK');
      expect(result.data.cursor).toBe(10);
      expect(result.data.maxPrice).toBe(500);
    }
  });

  it('rejects invalid IATA code (lowercase)', () => {
    const result = feedQuerySchema.safeParse({ origin: 'jfk' });
    expect(result.success).toBe(false);
  });

  it('rejects IATA code with wrong length', () => {
    const result = feedQuerySchema.safeParse({ origin: 'JFKX' });
    expect(result.success).toBe(false);
  });

  it('rejects negative cursor', () => {
    const result = feedQuerySchema.safeParse({ cursor: '-1' });
    expect(result.success).toBe(false);
  });
});

// ─── swipeBodySchema ────────────────────────────────────────────────

describe('swipeBodySchema', () => {
  it('accepts valid swipe with all fields', () => {
    const result = swipeBodySchema.safeParse({
      destination_id: 'dest-123',
      action: 'saved',
      time_spent_ms: 3500,
      price_shown: 499,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid swipe with required fields only', () => {
    const result = swipeBodySchema.safeParse({
      destination_id: 'dest-123',
      action: 'viewed',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing destination_id', () => {
    const result = swipeBodySchema.safeParse({ action: 'viewed' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid action', () => {
    const result = swipeBodySchema.safeParse({
      destination_id: 'dest-1',
      action: 'liked',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative time_spent_ms', () => {
    const result = swipeBodySchema.safeParse({
      destination_id: 'dest-1',
      action: 'viewed',
      time_spent_ms: -100,
    });
    expect(result.success).toBe(false);
  });
});

// ─── destinationQuerySchema ─────────────────────────────────────────

describe('destinationQuerySchema', () => {
  it('accepts valid query and defaults origin', () => {
    const result = destinationQuerySchema.safeParse({ id: 'abc-123' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.origin).toBe('TPA');
    }
  });

  it('accepts explicit origin', () => {
    const result = destinationQuerySchema.safeParse({ id: '123', origin: 'LAX' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.origin).toBe('LAX');
    }
  });

  it('rejects empty id', () => {
    const result = destinationQuerySchema.safeParse({ id: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing id', () => {
    const result = destinationQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── bookingSearchSchema ────────────────────────────────────────────

describe('bookingSearchSchema', () => {
  const validSearch = {
    origin: 'JFK',
    destination: 'LAX',
    departureDate: '2026-06-15',
    passengers: [{ type: 'adult' }],
  };

  it('accepts a valid booking search', () => {
    const result = bookingSearchSchema.safeParse(validSearch);
    expect(result.success).toBe(true);
  });

  it('accepts with optional returnDate and cabinClass', () => {
    const result = bookingSearchSchema.safeParse({
      ...validSearch,
      returnDate: '2026-06-22',
      cabinClass: 'business',
    });
    expect(result.success).toBe(true);
  });

  it('rejects bad date format', () => {
    const result = bookingSearchSchema.safeParse({
      ...validSearch,
      departureDate: '06-15-2026',
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 9 passengers', () => {
    const result = bookingSearchSchema.safeParse({
      ...validSearch,
      passengers: Array(10).fill({ type: 'adult' }),
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero passengers', () => {
    const result = bookingSearchSchema.safeParse({
      ...validSearch,
      passengers: [],
    });
    expect(result.success).toBe(false);
  });
});

// ─── passengerSchema ────────────────────────────────────────────────

describe('passengerSchema', () => {
  const validPassenger = {
    given_name: 'Jane',
    family_name: 'Doe',
    born_on: '1990-05-20',
    gender: 'f',
    title: 'ms',
    email: 'jane@example.com',
    phone_number: '+15551234567',
  };

  it('accepts a valid full passenger', () => {
    const result = passengerSchema.safeParse({
      ...validPassenger,
      passport_number: 'AB1234567',
      passport_expiry: '2030-01-01',
      nationality: 'us',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // nationality should be uppercased
      expect(result.data.nationality).toBe('US');
    }
  });

  it('accepts required fields only', () => {
    const result = passengerSchema.safeParse(validPassenger);
    expect(result.success).toBe(true);
  });

  it('rejects bad email', () => {
    const result = passengerSchema.safeParse({
      ...validPassenger,
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects bad DOB format', () => {
    const result = passengerSchema.safeParse({
      ...validPassenger,
      born_on: '05/20/1990',
    });
    expect(result.success).toBe(false);
  });
});

// ─── priceAlertBodySchema ───────────────────────────────────────────

describe('priceAlertBodySchema', () => {
  it('accepts a valid price alert', () => {
    const result = priceAlertBodySchema.safeParse({
      destination_id: 'dest-1',
      target_price: 250,
    });
    expect(result.success).toBe(true);
  });

  it('accepts alert with optional email', () => {
    const result = priceAlertBodySchema.safeParse({
      destination_id: 'dest-1',
      target_price: 300,
      email: 'user@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative price', () => {
    const result = priceAlertBodySchema.safeParse({
      destination_id: 'dest-1',
      target_price: -10,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero price', () => {
    const result = priceAlertBodySchema.safeParse({
      destination_id: 'dest-1',
      target_price: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ─── subscribeBodySchema ────────────────────────────────────────────

describe('subscribeBodySchema', () => {
  it('accepts valid email and applies default airport', () => {
    const result = subscribeBodySchema.safeParse({ email: 'user@test.com' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.airport).toBe('TPA');
    }
  });

  it('accepts explicit airport', () => {
    const result = subscribeBodySchema.safeParse({ email: 'user@test.com', airport: 'LAX' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.airport).toBe('LAX');
    }
  });

  it('rejects invalid email', () => {
    const result = subscribeBodySchema.safeParse({ email: 'bad-email' });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const result = subscribeBodySchema.safeParse({ airport: 'JFK' });
    expect(result.success).toBe(false);
  });
});

// ─── hotelSearchSchema ──────────────────────────────────────────────

describe('hotelSearchSchema', () => {
  const validHotelSearch = {
    latitude: 40.7128,
    longitude: -74.006,
    checkIn: '2026-07-01',
    checkOut: '2026-07-05',
  };

  it('accepts a valid hotel search', () => {
    const result = hotelSearchSchema.safeParse(validHotelSearch);
    expect(result.success).toBe(true);
  });

  it('accepts optional guests', () => {
    const result = hotelSearchSchema.safeParse({ ...validHotelSearch, guests: 3 });
    expect(result.success).toBe(true);
  });

  it('rejects latitude out of range', () => {
    const result = hotelSearchSchema.safeParse({ ...validHotelSearch, latitude: 95 });
    expect(result.success).toBe(false);
  });

  it('rejects longitude out of range', () => {
    const result = hotelSearchSchema.safeParse({ ...validHotelSearch, longitude: 200 });
    expect(result.success).toBe(false);
  });

  it('rejects bad date format', () => {
    const result = hotelSearchSchema.safeParse({ ...validHotelSearch, checkIn: '07/01/2026' });
    expect(result.success).toBe(false);
  });
});

// ─── savedActionSchema ──────────────────────────────────────────────

describe('savedActionSchema', () => {
  it.each(['list', 'save', 'unsave', 'get-prefs', 'save-prefs'] as const)(
    'accepts action "%s"',
    (action) => {
      const result = savedActionSchema.safeParse({ action });
      expect(result.success).toBe(true);
    },
  );

  it('rejects unknown action', () => {
    const result = savedActionSchema.safeParse({ action: 'delete' });
    expect(result.success).toBe(false);
  });

  it('rejects missing action', () => {
    const result = savedActionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── validateRequest helper ─────────────────────────────────────────

describe('validateRequest', () => {
  it('returns success with valid data', () => {
    const result = validateRequest(swipeBodySchema, {
      destination_id: 'x',
      action: 'viewed',
    });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('returns error string with invalid data', () => {
    const result = validateRequest(swipeBodySchema, { action: 'bad' });
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(result.error!.length).toBeGreaterThan(0);
    expect(result.data).toBeUndefined();
  });

  it('includes field path in error message', () => {
    const result = validateRequest(passengerSchema, {
      given_name: 'A',
      family_name: 'B',
      born_on: 'bad-date',
      gender: 'f',
      title: 'mr',
      email: 'a@b.com',
      phone_number: '12345',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('born_on');
  });
});
