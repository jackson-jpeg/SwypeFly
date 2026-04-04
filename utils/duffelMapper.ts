// ─── Duffel SDK → Frontend Type Mapping ─────────────────────────────────────
// Shared offer/segment mapping logic used across api/booking.ts, api/feed.ts,
// api/search.ts, and api/prices/refresh.ts.

import type {
  Offer,
  OfferSlice,
  OfferSliceSegment,
  OfferRequest,
  Order,
  OrderSlice,
  OrderSliceSegment,
  OrderPassenger,
  SeatMap,
  SeatMapCabinRow,
  SeatMapCabinRowSection,
  SeatMapCabinRowSectionElement,
  SeatMapCabinRowSectionElementSeat,
} from '@duffel/api/types';

// ─── Error helper ───────────────────────────────────────────────────────────

interface DuffelErrorLike {
  errors?: { code?: string; message?: string; source?: { field?: string } }[];
  response?: { data?: unknown };
  body?: unknown;
  message?: string;
  statusCode?: number;
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err);
}

export function getErrorDetail(err: unknown): string {
  const e = err as DuffelErrorLike;
  const duffelErrors = e?.errors ?? (e?.response?.data as DuffelErrorLike | undefined)?.errors;
  if (duffelErrors) return JSON.stringify(duffelErrors);
  return e?.message ?? e?.statusCode?.toString() ?? String(err);
}

export function getFirstDuffelError(
  err: unknown,
): { code?: string; message?: string; source?: { field?: string } } | null {
  const e = err as DuffelErrorLike;
  const errors = e?.errors ?? (e?.response?.data as DuffelErrorLike | undefined)?.errors;
  return Array.isArray(errors) ? errors[0] ?? null : null;
}

// ─── Compact offer JSON (for caching in DB) ────────────────────────────────

export interface CompactSegment {
  operating_carrier: { name?: string | null; iata_code?: string | null };
  operating_carrier_flight_number?: string;
  departing_at: string;
  arriving_at: string;
  origin: { iata_code?: string | null };
  destination: { iata_code?: string | null };
  aircraft?: { name?: string } | null;
}

export interface CompactSlice {
  segments: CompactSegment[];
}

export interface CompactOffer {
  id: string;
  total_amount: string;
  total_currency: string;
  expires_at: string;
  slices: CompactSlice[];
}

type OfferLike = Omit<Offer, 'available_services'> | Offer;

export function compactOfferJson(offer: OfferLike): string {
  const compact: CompactOffer = {
    id: offer.id,
    total_amount: offer.total_amount,
    total_currency: offer.total_currency,
    expires_at: offer.expires_at,
    slices: (offer.slices ?? []).map((slice: OfferSlice) => ({
      segments: (slice.segments ?? []).map((seg: OfferSliceSegment) => ({
        operating_carrier: {
          name: seg.operating_carrier?.name,
          iata_code: seg.operating_carrier?.iata_code,
        },
        operating_carrier_flight_number: seg.operating_carrier_flight_number,
        departing_at: seg.departing_at,
        arriving_at: seg.arriving_at,
        origin: { iata_code: seg.origin?.iata_code },
        destination: { iata_code: seg.destination?.iata_code },
        aircraft: seg.aircraft ? { name: seg.aircraft.name } : null,
      })),
    })),
  };
  return JSON.stringify(compact);
}

// ─── Cheapest offer extraction (for feed/search/refresh) ────────────────────

export function sortOffersByPrice(
  offers: OfferLike[],
): OfferLike[] {
  return [...offers].sort(
    (a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount),
  );
}

export function extractCheapestOfferData(cheapest: OfferLike): {
  price: number;
  airline: string;
  airlineCode: string;
  departureDate: string;
  returnDate: string;
  duration: string;
  offerId: string;
  offerExpiresAt: string;
} {
  const price = Math.round(parseFloat(cheapest.total_amount));
  const firstSlice = cheapest.slices?.[0];
  const firstSeg = firstSlice?.segments?.[0];
  const lastSlice = cheapest.slices?.[cheapest.slices.length - 1];
  const lastSeg = lastSlice?.segments?.[0];

  const airline =
    firstSeg?.operating_carrier?.name ??
    firstSeg?.operating_carrier?.iata_code ??
    '';
  const airlineCode = firstSeg?.operating_carrier?.iata_code ?? '';

  const departureDate = firstSeg?.departing_at?.split('T')[0] ?? '';
  const returnDate = lastSeg?.departing_at?.split('T')[0] ?? '';

  let duration = '';
  if (firstSlice?.duration) {
    const match = firstSlice.duration.match(/PT(\d+)H(\d+)?M?/);
    if (match) duration = `${match[1]}h ${match[2] || '0'}m`;
  }

  return {
    price,
    airline,
    airlineCode,
    departureDate,
    returnDate,
    duration,
    offerId: cheapest.id ?? '',
    offerExpiresAt: cheapest.expires_at ?? '',
  };
}

// ─── OfferRequest result helpers ────────────────────────────────────────────

export function getOffersFromResult(
  result: OfferRequest,
): Omit<Offer, 'available_services'>[] {
  return result.offers ?? [];
}

// ─── Seat map transformer ───────────────────────────────────────────────────

export interface TransformedSeat {
  column: string;
  available: boolean;
  extraLegroom: boolean;
  price: number;
  currency: string;
  designator: string;
  serviceId: string | null;
}

export interface TransformedSeatRow {
  rowNumber: number;
  seats: TransformedSeat[];
}

export interface TransformedSeatMap {
  columns: string[];
  exitRows: number[];
  aisleAfterColumns: string[];
  rows: TransformedSeatRow[];
}

export function transformSeatMap(raw: SeatMap[] | null): TransformedSeatMap | null {
  if (!raw || !Array.isArray(raw)) return null;
  const sliceMap = raw[0];
  if (!sliceMap?.cabins?.length) return null;

  const cabin = sliceMap.cabins[0];
  const allColumns = new Set<string>();
  const exitRows: number[] = [];
  const aisleAfterCols = new Set<string>();
  const rows: TransformedSeatRow[] = [];

  function isSeatElement(
    el: SeatMapCabinRowSectionElement,
  ): el is SeatMapCabinRowSectionElementSeat {
    return el.type === 'seat' || el.type === 'restricted_seat_general';
  }

  for (const row of cabin.rows ?? []) {
    // Find the first seat designator to determine row number
    const firstSeatEl = (row as SeatMapCabinRow).sections
      ?.flatMap((s) => s.elements ?? [])
      .find(isSeatElement);
    const rowNumber = firstSeatEl?.designator?.match(/^(\d+)/)?.[1];
    if (!rowNumber) continue;
    const rn = parseInt(rowNumber);
    let isExit = false;
    const seats: TransformedSeat[] = [];

    (row as SeatMapCabinRow).sections?.forEach(
      (section: SeatMapCabinRowSection, sIdx: number) => {
        for (const el of section.elements ?? []) {
          if (!isSeatElement(el)) continue;
          const col = el.designator?.replace(/^\d+/, '') ?? '';
          allColumns.add(col);
          const hasExitDisclosure = el.disclosures?.includes('exit_row') ?? false;
          if (hasExitDisclosure) isExit = true;
          const seatService = el.available_services?.[0];
          const price = seatService ? parseFloat(seatService.total_amount) || 0 : 0;
          const currency = seatService?.total_currency || 'USD';
          const isAvailable =
            (Array.isArray(el.available_services) && el.available_services.length > 0) ||
            (el.type === 'seat' && !(el.disclosures ?? []).includes('not_available'));
          seats.push({
            column: col,
            available: isAvailable,
            extraLegroom:
              hasExitDisclosure || (el.disclosures?.includes('extra_legroom') ?? false),
            price,
            currency,
            designator: el.designator || `${rn}${col}`,
            serviceId: seatService?.id || null,
          });
        }
        if (sIdx < ((row as SeatMapCabinRow).sections?.length ?? 0) - 1 && seats.length > 0) {
          aisleAfterCols.add(seats[seats.length - 1].column);
        }
      },
    );

    if (isExit) exitRows.push(rn);
    rows.push({ rowNumber: rn, seats });
  }

  const columns = Array.from(allColumns).sort();
  return {
    columns,
    exitRows,
    aisleAfterColumns: Array.from(aisleAfterCols).sort(),
    rows,
  };
}

// ─── Order slice/passenger mapping (for create-order response + flight status) ─

export interface OrderSliceResponse {
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  airline: string;
  flightNumber: string;
  aircraft: string;
}

export interface OrderPassengerResponse {
  id: string;
  name: string;
  seatDesignator?: string;
}

export function mapOrderPassengers(passengers: OrderPassenger[]): OrderPassengerResponse[] {
  return (passengers ?? []).map((p) => ({
    id: p.id,
    name: `${p.given_name} ${p.family_name}`,
    seatDesignator: undefined, // Duffel doesn't expose seat on OrderPassenger
  }));
}

function parseDurationIso(iso: string | null): string {
  if (!iso) return '';
  const dm = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!dm) return iso;
  const days = parseInt(dm[1] ?? '0', 10);
  const hours = parseInt(dm[2] ?? '0', 10);
  const mins = parseInt(dm[3] ?? '0', 10);
  const totalHours = days * 24 + hours;
  return `${totalHours}h ${mins}m`;
}

export function mapOrderSlices(slices: OrderSlice[]): OrderSliceResponse[] {
  return (slices ?? []).map((s) => ({
    origin: s.origin?.iata_code ?? '',
    destination: s.destination?.iata_code ?? '',
    departureTime: s.segments?.[0]?.departing_at ?? '',
    arrivalTime: s.segments?.[0]?.arriving_at ?? '',
    duration: parseDurationIso(s.duration),
    stops: (s.segments?.length || 1) - 1,
    airline: s.segments?.[0]?.operating_carrier?.name ?? '',
    flightNumber:
      `${s.segments?.[0]?.operating_carrier?.iata_code ?? ''} ${s.segments?.[0]?.operating_carrier_flight_number ?? ''}`.trim(),
    aircraft: s.segments?.[0]?.aircraft?.name ?? '',
  }));
}

// ─── Flight status segment mapping (from Order) ────────────────────────────

export interface FlightStatusSegment {
  flightNumber: string;
  origin: string;
  destination: string;
  scheduledDeparture: string;
  estimatedDeparture: null;
  scheduledArrival: string;
  estimatedArrival: null;
  gate: string | null;
  terminal: string | null;
  delayMinutes: null;
  status: string;
}

export function mapOrderToFlightStatusSegments(
  order: Order,
  bookingStatus: string,
): FlightStatusSegment[] {
  return (order.slices ?? []).flatMap((slice: OrderSlice) =>
    (slice.segments ?? []).map((seg: OrderSliceSegment) => ({
      flightNumber:
        seg.marketing_carrier_flight_number || seg.operating_carrier_flight_number || '',
      origin: seg.origin?.iata_code || '',
      destination: seg.destination?.iata_code || '',
      scheduledDeparture: seg.departing_at || '',
      estimatedDeparture: null,
      scheduledArrival: seg.arriving_at || '',
      estimatedArrival: null,
      gate: null,
      terminal: seg.origin_terminal || null,
      delayMinutes: null,
      status: bookingStatus === 'schedule_changed' ? 'schedule_changed' : 'scheduled',
    })),
  );
}
