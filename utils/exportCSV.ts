import { Platform, Share } from 'react-native';
import type { BoardDeal } from '../types/deal';

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

function dealToRow(deal: BoardDeal): string {
  return [
    escapeCSV(deal.destination),
    escapeCSV(deal.country),
    deal.price != null ? String(deal.price) : '',
    escapeCSV(deal.airline || ''),
    deal.cheapestDate || deal.departureDate || '',
    deal.cheapestReturnDate || deal.returnDate || '',
    deal.tripDays > 0 ? String(deal.tripDays) : '',
    escapeCSV(deal.flightDuration || ''),
    deal.dealTier || '',
    deal.isNonstop != null ? (deal.isNonstop ? 'Yes' : 'No') : '',
  ].join(',');
}

function generateCSV(deals: BoardDeal[]): string {
  const rows = [CSV_HEADERS.join(','), ...deals.map(dealToRow)];
  return rows.join('\r\n');
}

export async function exportSavedCSV(deals: BoardDeal[]): Promise<void> {
  const csv = generateCSV(deals);

  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sogojet-saved-trips.csv';
    link.click();
    URL.revokeObjectURL(url);
  } else {
    // Native: use Share API with the CSV content as a message
    // For proper file sharing, expo-sharing + expo-file-system would be needed
    await Share.share({
      message: csv,
      title: 'SoGoJet Saved Trips',
    });
  }
}
