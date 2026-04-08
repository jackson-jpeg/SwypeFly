import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Supabase mock infrastructure ────────────────────────────────────

const mockResultQueues = new Map<string, Array<{ data: unknown; error: unknown }>>();

function pushResult(table: string, result: { data: unknown; error: unknown }) {
  if (!mockResultQueues.has(table)) mockResultQueues.set(table, []);
  mockResultQueues.get(table)!.push(result);
}

function popResult(table: string): { data: unknown; error: unknown } {
  const queue = mockResultQueues.get(table);
  if (queue && queue.length > 0) return queue.shift()!;
  return { data: [], error: null };
}

const mockInsertCalls: Array<{ table: string; data: unknown }> = [];
const mockUpdateCalls: Array<{ table: string; data: unknown }> = [];

const createChain = (table: string) => {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'eq', 'neq', 'in', 'contains', 'ilike',
    'gte', 'lte', 'gt', 'lt', 'is', 'not', 'or',
    'order', 'limit', 'range', 'match',
  ];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.insert = jest.fn().mockImplementation((data: unknown) => {
    mockInsertCalls.push({ table, data });
    return chain;
  });
  chain.update = jest.fn().mockImplementation((data: unknown) => {
    mockUpdateCalls.push({ table, data });
    return chain;
  });
  chain.single = jest.fn().mockImplementation(() => {
    const result = popResult(table);
    if (result.error) return Promise.resolve({ data: null, error: result.error });
    return Promise.resolve({
      data: Array.isArray(result.data) ? (result.data as unknown[])[0] ?? null : result.data,
      error: null,
    });
  });
  (chain as any).then = jest.fn().mockImplementation((resolve: any) => {
    const result = popResult(table);
    if (resolve) return Promise.resolve(resolve(result));
    return Promise.resolve(result);
  });
  return chain;
};

const mockFrom = jest.fn().mockImplementation((table: string) => createChain(table));

jest.mock('../../services/supabaseServer', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
  TABLES: {
    swipeHistory: 'swipe_history',
    destinations: 'destinations',
    userPreferences: 'user_preferences',
  },
}));

const mockVerifyClerkToken = jest.fn();
jest.mock('../../utils/clerkAuth', () => ({
  verifyClerkToken: (...args: unknown[]) => mockVerifyClerkToken(...args),
}));

jest.mock('../../utils/apiLogger', () => ({
  logApiError: jest.fn(),
}));

jest.mock('../../api/_cors', () => ({
  cors: () => false,
}));

jest.mock('../../utils/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 }),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));

import handler from '../../api/swipe';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: {},
    body: {},
    query: {},
    ...overrides,
  } as unknown as VercelRequest;
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res as unknown as VercelResponse & { status: jest.Mock; json: jest.Mock; setHeader: jest.Mock };
}

describe('POST /api/swipe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
    mockInsertCalls.length = 0;
    mockUpdateCalls.length = 0;
  });

  it('rejects non-POST methods', async () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects invalid body', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-123' });
    const req = makeReq({
      headers: { authorization: 'Bearer valid-token' },
      body: { action: 'liked' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('allows unauthenticated swipe with valid body (guest mode)', async () => {
    mockVerifyClerkToken.mockResolvedValue(null);
    const req = makeReq({
      body: {
        destination_id: VALID_UUID,
        action: 'viewed',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    // No swipe history inserted for guests
    expect(mockInsertCalls.length).toBe(0);
  });

  it('records swipe and updates preferences for authenticated user', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-123' });

    // 1. Insert into swipe_history — success
    pushResult('swipe_history', { data: null, error: null });
    // 2. Fetch destination feature vector via .single()
    pushResult('destinations', {
      data: {
        beach_score: 0.8,
        city_score: 0.3,
        adventure_score: 0.5,
        culture_score: 0.7,
        nightlife_score: 0.4,
        nature_score: 0.6,
        food_score: 0.9,
      },
      error: null,
    });
    // 3. Fetch user preferences
    pushResult('user_preferences', {
      data: [
        {
          id: 'prefs-1',
          pref_beach: 0.5,
          pref_city: 0.5,
          pref_adventure: 0.5,
          pref_culture: 0.5,
          pref_nightlife: 0.5,
          pref_nature: 0.5,
          pref_food: 0.5,
        },
      ],
      error: null,
    });
    // 4. Update user preferences — success
    pushResult('user_preferences', { data: null, error: null });

    const req = makeReq({
      headers: { authorization: 'Bearer valid-token' },
      body: {
        destination_id: VALID_UUID,
        action: 'saved',
        time_spent_ms: 3000,
        price_shown: 499,
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    // Swipe history was inserted
    expect(mockInsertCalls.length).toBeGreaterThanOrEqual(1);
    expect(mockInsertCalls[0].table).toBe('swipe_history');
    // Preferences were updated
    expect(mockUpdateCalls.length).toBeGreaterThanOrEqual(1);
    expect(mockUpdateCalls[0].table).toBe('user_preferences');
  });

  it('still returns 200 when preference update fails', async () => {
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-123' });

    // Insert into swipe_history — success
    pushResult('swipe_history', { data: null, error: null });
    // Destination fetch fails
    pushResult('destinations', { data: null, error: new Error('DB error') });

    const req = makeReq({
      headers: { authorization: 'Bearer valid-token' },
      body: {
        destination_id: VALID_UUID,
        action: 'saved',
        time_spent_ms: 1000,
        price_shown: 199,
      },
    });
    const res = makeRes();
    await handler(req, res);

    // Handler catches pref update errors and still returns ok
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
