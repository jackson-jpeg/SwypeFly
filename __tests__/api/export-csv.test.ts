import handler from '../../api/export/csv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function mockReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return { method: 'POST', body: {}, ...overrides } as unknown as VercelRequest;
}

function mockRes() {
  const res: Partial<VercelResponse> & { _status?: number; _headers: Record<string, string>; _body?: string } = {
    _headers: {},
    statusCode: 200,
  };
  res.status = ((code: number) => { res._status = code; return res; }) as any;
  res.setHeader = ((key: string, val: string) => { res._headers[key] = val; return res; }) as any;
  res.json = ((data: any) => { res._body = JSON.stringify(data); return res; }) as any;
  res.send = ((data: any) => { res._body = data; return res; }) as any;
  return res as VercelResponse & { _status?: number; _headers: Record<string, string>; _body?: string };
}

const sampleDeal = {
  id: 'test-1',
  destination: 'Tokyo',
  country: 'Japan',
  price: 450,
  airline: 'ANA',
  departureDate: '2026-05-15',
  returnDate: '2026-05-22',
  tripDays: 7,
  flightDuration: '14h 30m',
  dealTier: 'amazing',
  isNonstop: true,
};

describe('GET /api/export/csv', () => {
  it('rejects non-POST methods', () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    handler(req, res);
    expect(res._status).toBe(405);
  });

  it('rejects empty deals array', () => {
    const req = mockReq({ body: { deals: [] } });
    const res = mockRes();
    handler(req, res);
    expect(res._status).toBe(400);
  });

  it('rejects missing deals', () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    handler(req, res);
    expect(res._status).toBe(400);
  });

  it('returns valid CSV with headers and data', () => {
    const req = mockReq({ body: { deals: [sampleDeal] } });
    const res = mockRes();
    handler(req, res);
    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('text/csv; charset=utf-8');
    expect(res._headers['Content-Disposition']).toContain('sogojet-saved-trips.csv');

    const lines = (res._body as string).split('\r\n');
    expect(lines[0]).toBe('Destination,Country,Price (USD),Airline,Departure Date,Return Date,Trip Days,Flight Duration,Deal Tier,Nonstop');
    expect(lines[1]).toBe('Tokyo,Japan,450,ANA,2026-05-15,2026-05-22,7,14h 30m,amazing,Yes');
  });

  it('escapes commas and quotes in values', () => {
    const deal = { ...sampleDeal, destination: 'San Jose, Costa Rica', airline: 'He said "hi"' };
    const req = mockReq({ body: { deals: [deal] } });
    const res = mockRes();
    handler(req, res);
    const lines = (res._body as string).split('\r\n');
    expect(lines[1]).toContain('"San Jose, Costa Rica"');
    expect(lines[1]).toContain('"He said ""hi"""');
  });

  it('handles null/missing prices gracefully', () => {
    const deal = { ...sampleDeal, price: null, airline: '', isNonstop: undefined };
    const req = mockReq({ body: { deals: [deal] } });
    const res = mockRes();
    handler(req, res);
    const lines = (res._body as string).split('\r\n');
    expect(lines[1]).toContain('Tokyo,Japan,,');
  });

  it('rejects more than 200 deals', () => {
    const deals = Array.from({ length: 201 }, (_, i) => ({ ...sampleDeal, id: `deal-${i}` }));
    const req = mockReq({ body: { deals } });
    const res = mockRes();
    handler(req, res);
    expect(res._status).toBe(400);
  });

  it('handles multiple deals', () => {
    const deals = [
      sampleDeal,
      { ...sampleDeal, id: 'test-2', destination: 'Paris', country: 'France', price: 320, isNonstop: false },
    ];
    const req = mockReq({ body: { deals } });
    const res = mockRes();
    handler(req, res);
    const lines = (res._body as string).split('\r\n');
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[2]).toContain('Paris');
    expect(lines[2]).toContain('No');
  });
});
