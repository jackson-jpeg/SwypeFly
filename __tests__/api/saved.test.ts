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
const mockDeleteCalls: Array<{ table: string }> = [];

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
  chain.update = jest.fn().mockImplementation(() => {
    return chain;
  });
  chain.delete = jest.fn().mockImplementation(() => {
    mockDeleteCalls.push({ table });
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
    savedTrips: 'saved_trips',
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

import handler from '../../api/saved';

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    headers: { authorization: 'Bearer test-token' },
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

describe('api/saved', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResultQueues.clear();
    mockInsertCalls.length = 0;
    mockDeleteCalls.length = 0;
    mockVerifyClerkToken.mockResolvedValue({ userId: 'user-1' });
  });

  it('returns 401 when not authenticated', async () => {
    mockVerifyClerkToken.mockResolvedValue(null);
    const res = makeRes();
    await handler(makeReq({ query: { action: 'list' } }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('lists saved destination IDs', async () => {
    pushResult('saved_trips', {
      data: [
        { destination_id: 'dest-1' },
        { destination_id: 'dest-2' },
      ],
      error: null,
    });
    const res = makeRes();
    await handler(makeReq({ query: { action: 'list' } }), res);
    expect(res.json).toHaveBeenCalledWith({ savedIds: ['dest-1', 'dest-2'] });
  });

  it('saves a destination', async () => {
    // Dedup check: no existing doc
    pushResult('saved_trips', { data: [], error: null });
    // Insert result
    pushResult('saved_trips', { data: null, error: null });

    const res = makeRes();
    await handler(
      makeReq({ query: { action: 'save' }, body: { destination_id: 'dest-1' } }),
      res,
    );
    expect(mockInsertCalls.length).toBe(1);
    expect(mockInsertCalls[0].table).toBe('saved_trips');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('does not create duplicate when saving same destination twice', async () => {
    // Dedup check: existing doc found
    pushResult('saved_trips', {
      data: [{ id: 'doc-1', destination_id: 'dest-1' }],
      error: null,
    });

    const res = makeRes();
    await handler(
      makeReq({ query: { action: 'save' }, body: { destination_id: 'dest-1' } }),
      res,
    );
    // Insert should NOT have been called
    expect(mockInsertCalls.length).toBe(0);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('unsaves a destination', async () => {
    // Find existing doc
    pushResult('saved_trips', {
      data: [{ id: 'doc-1', destination_id: 'dest-1' }],
      error: null,
    });
    // Delete result
    pushResult('saved_trips', { data: null, error: null });

    const res = makeRes();
    await handler(
      makeReq({ query: { action: 'unsave' }, body: { destination_id: 'dest-1' } }),
      res,
    );
    expect(mockDeleteCalls.length).toBe(1);
    expect(mockDeleteCalls[0].table).toBe('saved_trips');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('returns 400 for save without destination_id', async () => {
    const res = makeRes();
    await handler(makeReq({ query: { action: 'save' }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for unknown action', async () => {
    const res = makeRes();
    await handler(makeReq({ query: { action: 'unknown' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ─── get-prefs ─────────────────────────────────────────────

  it('returns user preferences', async () => {
    pushResult('user_preferences', {
      data: [{ departure_city: 'Tampa', departure_code: 'TPA', onboarding_completed: true }],
      error: null,
    });
    const res = makeRes();
    await handler(makeReq({ query: { action: 'get-prefs' } }), res);
    expect(res.json).toHaveBeenCalledWith({
      preferences: { departure_city: 'Tampa', departure_code: 'TPA', onboarding_completed: true },
    });
  });

  it('returns null preferences when none exist', async () => {
    pushResult('user_preferences', { data: [], error: null });
    const res = makeRes();
    await handler(makeReq({ query: { action: 'get-prefs' } }), res);
    expect(res.json).toHaveBeenCalledWith({ preferences: null });
  });

  // ─── save-prefs ────────────────────────────────────────────

  it('creates new user preferences', async () => {
    // Check for existing → none found
    pushResult('user_preferences', { data: [], error: null });
    // Insert result
    pushResult('user_preferences', { data: null, error: null });

    const res = makeRes();
    await handler(
      makeReq({
        method: 'POST',
        query: { action: 'save-prefs' },
        body: { departure_code: 'JFK', departure_city: 'New York' },
      }),
      res,
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(mockInsertCalls.length).toBe(1);
    expect(mockInsertCalls[0].table).toBe('user_preferences');
  });

  it('updates existing user preferences', async () => {
    // Check for existing → found
    pushResult('user_preferences', { data: [{ id: 'pref-1' }], error: null });
    // Update result
    pushResult('user_preferences', { data: null, error: null });

    const res = makeRes();
    await handler(
      makeReq({
        method: 'POST',
        query: { action: 'save-prefs' },
        body: { onboarding_completed: true },
      }),
      res,
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('rejects save-prefs with empty body', async () => {
    const res = makeRes();
    await handler(
      makeReq({ method: 'POST', query: { action: 'save-prefs' }, body: {} }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ─── error handling ────────────────────────────────────────

  it('returns 500 on DB error', async () => {
    pushResult('saved_trips', { data: null, error: { message: 'DB down' } });
    const res = makeRes();
    await handler(makeReq({ query: { action: 'list' } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 405 for PUT method', async () => {
    const res = makeRes();
    await handler(makeReq({ method: 'PUT', query: { action: 'list' } }), res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
