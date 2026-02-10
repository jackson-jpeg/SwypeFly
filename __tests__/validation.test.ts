import {
  feedQuerySchema,
  swipeBodySchema,
  destinationQuerySchema,
  pricesQuerySchema,
  hotelPricesQuerySchema,
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

  it('rejects non-uuid id', () => {
    const result = validateRequest(destinationQuerySchema, { id: '123' });
    expect(result.success).toBe(false);
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
