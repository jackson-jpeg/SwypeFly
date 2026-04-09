import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Mock setup ───────────────────────────────────────────────────────────────

let mockQueryResult: { data: unknown; error: unknown; count?: number } = {
  data: [],
  error: null,
  count: 0,
};

const createChain = () => {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'insert', 'upsert', 'update', 'delete',
    'eq', 'neq', 'in', 'contains', 'ilike',
    'gte', 'lte', 'gt', 'lt', 'is', 'not', 'or',
    'order', 'limit', 'range',
  ];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.single = jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: Array.isArray(mockQueryResult.data)
        ? mockQueryResult.data[0] ?? null
        : mockQueryResult.data,
      error: mockQueryResult.error,
    }),
  );
  (chain as any).then = jest.fn().mockImplementation((resolve: any) => {
    const result = {
      data: mockQueryResult.data,
      error: mockQueryResult.error,
      count: mockQueryResult.count ?? 0,
    };
    if (resolve) return Promise.resolve(resolve(result));
    return Promise.resolve(result);
  });
  return chain;
};

let mockChain = createChain();
const mockFrom = jest.fn().mockReturnValue(mockChain);

// We need separate chains for price_calendar and subscribers calls
let mockSubscriberChain = createChain();
let mockSubscriberResult: { data: unknown; error: unknown } = { data: [], error: null };

jest.mock('../../services/supabaseServer', () => ({
  supabase: {
    from: (...args: unknown[]) => {
      const table = args[0] as string;
      if (table === 'subscribers') {
        return mockSubscriberChain;
      }
      return mockFrom(...args);
    },
  },
  TABLES: {
    priceCalendar: 'price_calendar',
    subscribers: 'subscribers',
  },
}));

const mockSend = jest.fn().mockResolvedValue({ id: 'email-123' });
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

const mockEnv: Record<string, unknown> = {
  CRON_SECRET: 'test-cron-secret',
  RESEND_API_KEY: 'test-resend-key',
  BOOKING_MARKUP_PERCENT: 3,
  VERCEL_ENV: 'development',
};

jest.mock('../../utils/env', () => ({
  get env() {
    return mockEnv;
  },
}));

jest.mock('../../utils/apiResponse', () => ({
  sendError: jest.fn((res: any, status: number, code: string, message: string) => {
    res.status(status).json({ ok: false, error: { code, message } });
  }),
}));

import handler from '../../api/newsletter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
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
    send: jest.fn().mockReturnThis(),
  };
  return res as unknown as VercelResponse & {
    status: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
    send: jest.Mock;
  };
}

function makeDealRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'deal-1',
    destination_id: 'dest-1',
    city: 'Barcelona',
    country: 'Spain',
    destination_iata: 'BCN',
    origin: 'JFK',
    price: 287,
    deal_score: 85,
    deal_tier: 'great',
    savings_percent: 30,
    usual_price: 410,
    is_nonstop: true,
    airline: 'Delta',
    departure_date: '2026-05-15',
    return_date: '2026-05-22',
    trip_days: 7,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/newsletter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChain = createChain();
    mockFrom.mockReturnValue(mockChain);
    mockQueryResult = { data: [], error: null, count: 0 };

    mockSubscriberChain = createChain();
    mockSubscriberResult = { data: [], error: null };
    // Override subscriber chain's then to use its own result
    (mockSubscriberChain as any).then = jest.fn().mockImplementation((resolve: any) => {
      const result = { data: mockSubscriberResult.data, error: mockSubscriberResult.error };
      if (resolve) return Promise.resolve(resolve(result));
      return Promise.resolve(result);
    });

    // Reset env to defaults
    mockEnv.CRON_SECRET = 'test-cron-secret';
    mockEnv.RESEND_API_KEY = 'test-resend-key';
    mockEnv.BOOKING_MARKUP_PERCENT = 3;
    mockEnv.VERCEL_ENV = 'development';
  });

  // ─── Auth ──────────────────────────────────────────────────────────────────

  it('rejects without cron secret', async () => {
    const req = makeReq({ query: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects with wrong secret', async () => {
    const req = makeReq({ query: { secret: 'wrong-secret' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // ─── No deals found ───────────────────────────────────────────────────────

  it('returns 200 with sent=0 when no deals found', async () => {
    mockQueryResult = { data: [], error: null };

    const req = makeReq({ query: { secret: 'test-cron-secret' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.sent).toBe(0);
    expect(body.message).toMatch(/no quality deals/i);
  });

  // ─── No subscribers ───────────────────────────────────────────────────────

  it('returns 200 with sent=0 when no subscribers', async () => {
    mockQueryResult = { data: [makeDealRow()], error: null };
    mockSubscriberResult = { data: [], error: null };

    const req = makeReq({ query: { secret: 'test-cron-secret' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.sent).toBe(0);
    expect(body.message).toMatch(/no active subscribers/i);
  });

  // ─── RESEND_API_KEY not configured ────────────────────────────────────────

  it('returns 200 with sent=0 when RESEND_API_KEY not configured', async () => {
    mockEnv.RESEND_API_KEY = '';
    mockQueryResult = { data: [makeDealRow()], error: null };

    const req = makeReq({ query: { secret: 'test-cron-secret' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.sent).toBe(0);
    expect(body.message).toMatch(/resend_api_key not configured/i);
  });

  // ─── Successful send ──────────────────────────────────────────────────────

  it('successfully sends newsletter to subscribers', async () => {
    mockQueryResult = {
      data: [makeDealRow(), makeDealRow({ id: 'deal-2', destination_id: 'dest-2', city: 'Paris', destination_iata: 'CDG' })],
      error: null,
    };
    mockSubscriberResult = {
      data: [{ email: 'alice@example.com' }, { email: 'bob@example.com' }],
      error: null,
    };

    const req = makeReq({ query: { secret: 'test-cron-secret' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.sent).toBe(2);
    expect(body.deals).toBe(2);
    expect(mockSend).toHaveBeenCalledTimes(2);
    // Check send was called with correct from/to
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.stringContaining('SoGoJet'),
        to: 'alice@example.com',
        subject: expect.stringContaining('Flight Deals'),
        html: expect.stringContaining('Barcelona'),
      }),
    );
  });

  // ─── Preview mode ─────────────────────────────────────────────────────────

  it('preview mode returns HTML directly', async () => {
    mockQueryResult = { data: [makeDealRow()], error: null };

    const req = makeReq({ query: { preview: 'true' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('<!DOCTYPE html>'));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Barcelona'));
    // Should NOT call Resend
    expect(mockSend).not.toHaveBeenCalled();
  });

  // ─── DB errors ─────────────────────────────────────────────────────────────

  it('handles DB errors gracefully (500)', async () => {
    mockQueryResult = { data: null, error: { message: 'DB connection failed' } };

    // Override the chain's then to throw (simulating getTopDeals throwing)
    (mockChain as any).then = jest.fn().mockImplementation((resolve: any) => {
      const result = { data: null, error: { message: 'DB connection failed' } };
      if (resolve) return Promise.resolve(resolve(result));
      return Promise.resolve(result);
    });
    // The handler catches the thrown error from getTopDeals
    // Since supabase returns error, getTopDeals will `throw error`
    // We need the chain to resolve with an error so the code throws
    const req = makeReq({ query: { secret: 'test-cron-secret' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // ─── Deduplication ────────────────────────────────────────────────────────

  it('deduplicates deals by destination', async () => {
    mockQueryResult = {
      data: [
        makeDealRow({ destination_id: 'dest-1', deal_score: 90 }),
        makeDealRow({ id: 'deal-2', destination_id: 'dest-1', deal_score: 80 }),
        makeDealRow({ id: 'deal-3', destination_id: 'dest-2', city: 'Paris', deal_score: 75 }),
      ],
      error: null,
    };
    mockSubscriberResult = {
      data: [{ email: 'test@example.com' }],
      error: null,
    };

    const req = makeReq({ query: { secret: 'test-cron-secret' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    // 2 unique destinations, not 3
    expect(body.deals).toBe(2);
  });
});
