import type { VercelRequest, VercelResponse } from '@vercel/node';

const mockGetDocument = jest.fn();

jest.mock('node-appwrite', () => ({
  Client: jest.fn().mockImplementation(() => ({
    setEndpoint: jest.fn().mockReturnThis(),
    setProject: jest.fn().mockReturnThis(),
    setKey: jest.fn().mockReturnThis(),
  })),
  Databases: jest.fn().mockImplementation(() => ({
    getDocument: mockGetDocument,
  })),
  Users: jest.fn().mockImplementation(() => ({})),
  Query: {
    equal: jest.fn(),
    limit: jest.fn(),
  },
}));

import handler from '../../api/og';

function makeReq(query: Record<string, string> = {}): VercelRequest {
  return {
    method: 'GET',
    headers: {},
    body: {},
    query,
  } as unknown as VercelRequest;
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res as unknown as VercelResponse & {
    status: jest.Mock;
    send: jest.Mock;
    setHeader: jest.Mock;
  };
}

describe('GET /api/og', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APPWRITE_ENDPOINT = 'https://test.appwrite.io/v1';
    process.env.APPWRITE_PROJECT_ID = 'test-project';
    process.env.APPWRITE_API_KEY = 'test-key';
  });

  it('returns HTML with default content when no params', async () => {
    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
    const html = res.send.mock.calls[0][0] as string;
    expect(html).toContain('Amazing Destination');
    expect(html).toContain('SoGo');
  });

  it('uses query params for city, country, price', async () => {
    const req = makeReq({ city: 'Paris', country: 'France', price: '299' });
    const res = makeRes();
    await handler(req, res);

    const html = res.send.mock.calls[0][0] as string;
    expect(html).toContain('Paris');
    expect(html).toContain('France');
    expect(html).toContain('$299');
  });

  it('escapes HTML in query params to prevent XSS', async () => {
    const req = makeReq({ city: '<script>alert("xss")</script>', country: '"onload="alert(1)"' });
    const res = makeRes();
    await handler(req, res);

    const html = res.send.mock.calls[0][0] as string;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;onload=&quot;');
  });

  it('fetches destination by id from database', async () => {
    mockGetDocument.mockResolvedValueOnce({
      city: 'Tokyo',
      country: 'Japan',
      tagline: 'Neon lights and ancient temples',
      image_url: 'https://example.com/tokyo.jpg',
      flight_price: 650,
      live_price: null,
      rating: 4.8,
      flight_duration: '14h',
      hotel_price_per_night: 90,
    });

    const req = makeReq({ id: 'dest-123' });
    const res = makeRes();
    await handler(req, res);

    const html = res.send.mock.calls[0][0] as string;
    expect(html).toContain('Tokyo');
    expect(html).toContain('Japan');
    expect(html).toContain('$650');
    expect(html).toContain('★ 4.8');
  });

  it('uses live_price over flight_price when available', async () => {
    mockGetDocument.mockResolvedValueOnce({
      city: 'Barcelona',
      country: 'Spain',
      image_url: 'https://example.com/bcn.jpg',
      flight_price: 450,
      live_price: 299,
      hotel_price_per_night: 120,
    });

    const req = makeReq({ id: 'dest-456' });
    const res = makeRes();
    await handler(req, res);

    const html = res.send.mock.calls[0][0] as string;
    expect(html).toContain('$299');
    expect(html).not.toContain('$450');
  });

  it('falls back gracefully when destination not found', async () => {
    mockGetDocument.mockRejectedValueOnce(new Error('Not found'));

    const req = makeReq({ id: 'nonexistent' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const html = res.send.mock.calls[0][0] as string;
    expect(html).toContain('Amazing Destination');
  });

  it('sets long cache headers', async () => {
    const req = makeReq({ city: 'Test' });
    const res = makeRes();
    await handler(req, res);

    const cacheHeader = res.setHeader.mock.calls.find(
      (c: string[]) => c[0] === 'Cache-Control',
    );
    expect(cacheHeader![1]).toContain('s-maxage=86400');
  });
});
