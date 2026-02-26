import {
  feedQuerySchema,
  swipeBodySchema,
  destinationQuerySchema,
  pricesQuerySchema,
  hotelPricesQuerySchema,
  priceAlertBodySchema,
  tripPlanBodySchema,
  subscribeBodySchema,
  validateRequest,
} from '../utils/validation';

// ─── feedQuerySchema ─────────────────────────────────────────────────

describe('feedQuerySchema', () => {
  it('accepts valid query with origin and cursor', () => {
    const result = validateRequest(feedQuerySchema, { origin: 'JFK', cursor: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.origin).toBe('JFK');
      expect(result.data.cursor).toBe(10);
    }
  });

  it('defaults origin to TPA when missing', () => {
    const result = validateRequest(feedQuerySchema, {});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.origin).toBe('TPA');
    }
  });

  it('rejects invalid IATA code (lowercase)', () => {
    const result = validateRequest(feedQuerySchema, { origin: 'jfk' });
    expect(result.success).toBe(false);
  });

  it('rejects IATA code with wrong length', () => {
    const result = validateRequest(feedQuerySchema, { origin: 'JFKX' });
    expect(result.success).toBe(false);
  });

  it('rejects negative cursor', () => {
    const result = validateRequest(feedQuerySchema, { origin: 'JFK', cursor: '-1' });
    expect(result.success).toBe(false);
  });

  it('accepts maxPrice filter', () => {
    const result = validateRequest(feedQuerySchema, { origin: 'JFK', maxPrice: '500' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxPrice).toBe(500);
    }
  });

  it('rejects maxPrice over 10000', () => {
    const result = validateRequest(feedQuerySchema, { origin: 'JFK', maxPrice: '99999' });
    expect(result.success).toBe(false);
  });

  it('rejects maxPrice of 0', () => {
    const result = validateRequest(feedQuerySchema, { origin: 'JFK', maxPrice: '0' });
    expect(result.success).toBe(false);
  });

  it('accepts vibeFilter and regionFilter together', () => {
    const result = validateRequest(feedQuerySchema, {
      origin: 'LAX',
      vibeFilter: 'beach',
      regionFilter: 'caribbean',
      sortPreset: 'cheapest',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vibeFilter).toBe('beach');
      expect(result.data.regionFilter).toBe('caribbean');
      expect(result.data.sortPreset).toBe('cheapest');
    }
  });

  it('rejects invalid regionFilter', () => {
    const result = validateRequest(feedQuerySchema, { origin: 'JFK', regionFilter: 'mars' });
    expect(result.success).toBe(false);
  });
});

// ─── swipeBodySchema ─────────────────────────────────────────────────

describe('swipeBodySchema', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  it('accepts valid swipe with all fields', () => {
    const result = validateRequest(swipeBodySchema, {
      destination_id: validUUID,
      action: 'saved',
      time_spent_ms: 3500,
      price_shown: 499,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid swipe with required fields only', () => {
    const result = validateRequest(swipeBodySchema, {
      destination_id: validUUID,
      action: 'viewed',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid action', () => {
    const result = validateRequest(swipeBodySchema, {
      destination_id: validUUID,
      action: 'liked',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing destination_id', () => {
    const result = validateRequest(swipeBodySchema, { action: 'saved' });
    expect(result.success).toBe(false);
  });

  it('rejects non-uuid destination_id', () => {
    const result = validateRequest(swipeBodySchema, {
      destination_id: 'not-a-uuid',
      action: 'saved',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative time_spent_ms', () => {
    const result = validateRequest(swipeBodySchema, {
      destination_id: validUUID,
      action: 'viewed',
      time_spent_ms: -100,
    });
    expect(result.success).toBe(false);
  });
});

// ─── destinationQuerySchema ──────────────────────────────────────────

describe('destinationQuerySchema', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  it('accepts valid id and origin', () => {
    const result = validateRequest(destinationQuerySchema, { id: validUUID, origin: 'LAX' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.origin).toBe('LAX');
    }
  });

  it('defaults origin to TPA', () => {
    const result = validateRequest(destinationQuerySchema, { id: validUUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.origin).toBe('TPA');
    }
  });

  it('rejects missing id', () => {
    const result = validateRequest(destinationQuerySchema, {});
    expect(result.success).toBe(false);
  });

  it('accepts numeric string id', () => {
    const result = validateRequest(destinationQuerySchema, { id: '123' });
    expect(result.success).toBe(true);
  });
});

// ─── pricesQuerySchema ───────────────────────────────────────────────

describe('pricesQuerySchema', () => {
  it('accepts valid origin', () => {
    const result = validateRequest(pricesQuerySchema, { origin: 'SFO' });
    expect(result.success).toBe(true);
  });

  it('accepts empty query (all optional)', () => {
    const result = validateRequest(pricesQuerySchema, {});
    expect(result.success).toBe(true);
  });

  it('rejects invalid origin format', () => {
    const result = validateRequest(pricesQuerySchema, { origin: 'sf' });
    expect(result.success).toBe(false);
  });
});

// ─── hotelPricesQuerySchema ──────────────────────────────────────────

describe('hotelPricesQuerySchema', () => {
  it('accepts valid destination', () => {
    const result = validateRequest(hotelPricesQuerySchema, { destination: 'BCN' });
    expect(result.success).toBe(true);
  });

  it('accepts empty query', () => {
    const result = validateRequest(hotelPricesQuerySchema, {});
    expect(result.success).toBe(true);
  });

  it('rejects numeric destination', () => {
    const result = validateRequest(hotelPricesQuerySchema, { destination: '123' });
    expect(result.success).toBe(false);
  });
});

// ─── priceAlertBodySchema ────────────────────────────────────────────

describe('priceAlertBodySchema', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  it('accepts valid alert', () => {
    const result = validateRequest(priceAlertBodySchema, {
      destination_id: validUUID,
      target_price: 300,
    });
    expect(result.success).toBe(true);
  });

  it('accepts alert with email', () => {
    const result = validateRequest(priceAlertBodySchema, {
      destination_id: validUUID,
      target_price: 300,
      email: 'user@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative target_price', () => {
    const result = validateRequest(priceAlertBodySchema, {
      destination_id: validUUID,
      target_price: -50,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = validateRequest(priceAlertBodySchema, {
      destination_id: validUUID,
      target_price: 300,
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing destination_id', () => {
    const result = validateRequest(priceAlertBodySchema, { target_price: 300 });
    expect(result.success).toBe(false);
  });
});

// ─── tripPlanBodySchema ─────────────────────────────────────────────

describe('tripPlanBodySchema', () => {
  it('accepts valid trip plan with defaults', () => {
    const result = validateRequest(tripPlanBodySchema, { city: 'Paris' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.duration).toBe(5);
      expect(result.data.style).toBe('comfort');
    }
  });

  it('accepts full trip plan', () => {
    const result = validateRequest(tripPlanBodySchema, {
      city: 'Tokyo',
      country: 'Japan',
      duration: 7,
      style: 'luxury',
      interests: 'sushi, temples',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing city', () => {
    const result = validateRequest(tripPlanBodySchema, { country: 'France' });
    expect(result.success).toBe(false);
  });

  it('rejects duration > 30', () => {
    const result = validateRequest(tripPlanBodySchema, { city: 'Paris', duration: 50 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid style', () => {
    const result = validateRequest(tripPlanBodySchema, { city: 'Paris', style: 'ultra' });
    expect(result.success).toBe(false);
  });
});

// ─── subscribeBodySchema ─────────────────────────────────────────────

describe('subscribeBodySchema', () => {
  it('accepts valid email with airport', () => {
    const result = validateRequest(subscribeBodySchema, { email: 'user@test.com', airport: 'JFK' });
    expect(result.success).toBe(true);
  });

  it('defaults airport to TPA', () => {
    const result = validateRequest(subscribeBodySchema, { email: 'user@test.com' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.airport).toBe('TPA');
  });

  it('rejects invalid email', () => {
    const result = validateRequest(subscribeBodySchema, { email: 'not-email' });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const result = validateRequest(subscribeBodySchema, { airport: 'JFK' });
    expect(result.success).toBe(false);
  });
});

// ─── validateRequest helper ──────────────────────────────────────────

describe('validateRequest', () => {
  it('returns descriptive error messages', () => {
    const result = validateRequest(swipeBodySchema, { action: 'invalid' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('destination_id');
    }
  });
});
