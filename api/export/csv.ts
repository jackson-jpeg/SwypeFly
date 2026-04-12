import type { VercelRequest, VercelResponse } from '@vercel/node';

interface DealRow {
  id: string;
  destination: string;
  country: string;
  price: number | null;
  airline: string;
  departureDate: string;
  returnDate: string;
  tripDays: number;
  flightDuration: string;
  dealTier?: string;
  isNonstop?: boolean;
}

const CSV_HEADERS = [
  'Destination',
  'Country',
  'Price (USD)',
  'Airline',
  'Departure Date',
  'Return Date',
  'Trip Days',
  'Flight Duration',
  'Deal Tier',
  'Nonstop',
];

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function dealToRow(deal: DealRow): string {
  return [
    escapeCSV(deal.destination),
    escapeCSV(deal.country),
    deal.price != null ? String(deal.price) : '',
    escapeCSV(deal.airline || ''),
    deal.departureDate || '',
    deal.returnDate || '',
    deal.tripDays > 0 ? String(deal.tripDays) : '',
    escapeCSV(deal.flightDuration || ''),
    deal.dealTier || '',
    deal.isNonstop != null ? (deal.isNonstop ? 'Yes' : 'No') : '',
  ].join(',');
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { deals } = req.body as { deals?: DealRow[] };

  if (!deals || !Array.isArray(deals) || deals.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty "deals" array' });
  }

  if (deals.length > 200) {
    return res.status(400).json({ error: 'Maximum 200 deals per export' });
  }

  const rows = [CSV_HEADERS.join(','), ...deals.map(dealToRow)];
  const csv = rows.join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="sogojet-saved-trips.csv"');
  return res.status(200).send(csv);
}
