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
    const result = { data: mockQueryResult.data, error: mockQueryResult.error, count: mockQueryResult.count ?? 0 };
    if (resolve) return Promise.resolve(resolve(result));
    return Promise.resolve(result);
  });
  return chain;
};

let mockChain = createChain();
const mockFrom = jest.fn().mockReturnValue(mockChain);

jest.mock('../../services/supabaseServer', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
  TABLES: {
    subscribers: 'subscribers',
  },
}));

jest.mock('../../utils/env', () => ({
  env: { FRONTEND_URL: 'http://localhost:8081' },
}));

import handler from '../../api/subscribe';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let reqCounter = 0;
function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  reqCounter++;
  return {
    method: 'POST',
    headers: { 'x-forwarded-for': `10.${Math.floor(reqCounter / 256)}.${reqCounter % 256}.1` },
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('/api/subscribe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChain = createChain();
    mockFrom.mockReturnValue(mockChain);
    mockQueryResult = { data: [], error: null, count: 0 };
  });

  // ─── Subscribe (POST) ──────────────────────────────────────────

  it('rejects non-POST/non-GET methods', async () => {
    const req = makeReq({ method: 'DELETE' });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects invalid email', async () => {
    const req = makeReq({
      body: { email: 'not-an-email' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects missing email', async () => {
    const req = makeReq({ body: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates new subscriber on valid email', async () => {
    // First query: check existing - none found
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChain();
      if (callCount === 1) {
        mockQueryResult = { data: [], error: null };
      } else {
        mockQueryResult = { data: null, error: null };
      }
      return chain;
    });

    const req = makeReq({
      body: { email: 'new@example.com' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('subscribed', true);
  });

  it('returns 200 for already-subscribed active email', async () => {
    mockFrom.mockImplementation(() => {
      const chain = createChain();
      mockQueryResult = {
        data: [{ id: 'sub-1', email: 'existing@example.com', active: true }],
        error: null,
      };
      return chain;
    });

    const req = makeReq({
      body: { email: 'existing@example.com' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('subscribed', true);
    expect(body.message).toContain('Already subscribed');
  });

  it('reactivates inactive subscriber', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChain();
      if (callCount === 1) {
        // Existing inactive subscriber
        mockQueryResult = {
          data: [{ id: 'sub-2', email: 'inactive@example.com', active: false }],
          error: null,
        };
      } else {
        // Update to reactivate
        mockQueryResult = { data: null, error: null };
      }
      return chain;
    });

    const req = makeReq({
      body: { email: 'inactive@example.com' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('subscribed', true);
    expect(body.message).toContain('resubscribed');
  });

  it('returns 500 on database insert error', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = createChain();
      if (callCount === 1) {
        mockQueryResult = { data: [], error: null };
      } else {
        mockQueryResult = { data: null, error: { message: 'insert failed' } };
      }
      return chain;
    });

    // Use unique IP to avoid in-memory rate limiter from previous tests
    const req = makeReq({
      headers: { 'x-forwarded-for': '10.0.0.99' },
      body: { email: 'fail@example.com' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // ─── Unsubscribe (GET) ─────────────────────────────────────────

  describe('action=unsubscribe GET', () => {
    it('returns 400 when email is missing', async () => {
      const req = makeReq({
        method: 'GET',
        query: { action: 'unsubscribe' },
      });
      const res = makeRes();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('unsubscribes existing subscriber and returns HTML', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        const chain = createChain();
        if (callCount === 1) {
          mockQueryResult = {
            data: [{ id: 'sub-1' }],
            error: null,
          };
        } else {
          mockQueryResult = { data: null, error: null };
        }
        return chain;
      });

      const req = makeReq({
        method: 'GET',
        query: { action: 'unsubscribe', email: 'user@example.com' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      // Should return HTML with "unsubscribed" message
      expect(res.send).toHaveBeenCalled();
      const html = res.send.mock.calls[0][0];
      expect(html).toContain('unsubscribed');
    });

    it('returns success even if email not found (idempotent)', async () => {
      mockFrom.mockImplementation(() => {
        const chain = createChain();
        mockQueryResult = { data: [], error: null };
        return chain;
      });

      const req = makeReq({
        method: 'GET',
        query: { action: 'unsubscribe', email: 'nonexistent@example.com' },
      });
      const res = makeRes();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
