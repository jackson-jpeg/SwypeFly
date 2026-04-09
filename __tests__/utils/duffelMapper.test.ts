// Tests for utils/duffelMapper.ts

import {
  getErrorMessage,
  getErrorDetail,
  getFirstDuffelError,
  compactOfferJson,
  sortOffersByPrice,
  extractCheapestOfferData,
  transformSeatMap,
  mapOrderPassengers,
  mapOrderSlices,
  mapOrderToFlightStatusSegments,
} from '@/utils/duffelMapper';

// ─── Factories ────────────────────────────────────────────────────────

function makeSegment(overrides: Record<string, unknown> = {}) {
  return {
    operating_carrier: { name: 'Delta Air Lines', iata_code: 'DL' },
    operating_carrier_flight_number: '123',
    marketing_carrier: { name: 'Delta Air Lines', iata_code: 'DL' },
    marketing_carrier_flight_number: '123',
    departing_at: '2026-06-15T08:00:00',
    arriving_at: '2026-06-15T14:30:00',
    origin: { iata_code: 'JFK', name: 'John F. Kennedy', city_name: 'New York' },
    destination: { iata_code: 'LAX', name: 'Los Angeles Intl', city_name: 'Los Angeles' },
    aircraft: { name: 'Boeing 737-800' },
    duration: 'PT6H30M',
    origin_terminal: 'T4',
    destination_terminal: 'T5',
    ...overrides,
  } as any;
}

function makeSlice(overrides: Record<string, unknown> = {}) {
  return {
    segments: [makeSegment()],
    duration: 'PT6H30M',
    origin: { iata_code: 'JFK' },
    destination: { iata_code: 'LAX' },
    ...overrides,
  } as any;
}

function makeOffer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'off_test_123',
    total_amount: '299.50',
    total_currency: 'USD',
    expires_at: '2026-06-10T23:59:59Z',
    slices: [
      makeSlice(),
      makeSlice({
        segments: [makeSegment({ departing_at: '2026-06-22T10:00:00' })],
        origin: { iata_code: 'LAX' },
        destination: { iata_code: 'JFK' },
      }),
    ],
    ...overrides,
  } as any;
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ord_test_456',
    slices: [
      {
        origin: { iata_code: 'JFK' },
        destination: { iata_code: 'LAX' },
        duration: 'PT6H30M',
        segments: [makeSegment()],
      },
    ],
    passengers: [
      { id: 'pas_1', given_name: 'John', family_name: 'Doe' },
    ],
    ...overrides,
  } as any;
}

// ─── Error helpers ────────────────────────────────────────────────────

describe('getErrorMessage', () => {
  it('returns message from Error instance', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns string directly', () => {
    expect(getErrorMessage('something failed')).toBe('something failed');
  });

  it('stringifies non-string non-Error values', () => {
    expect(getErrorMessage(42)).toBe('42');
    expect(getErrorMessage(null)).toBe('null');
    expect(getErrorMessage(undefined)).toBe('undefined');
  });
});

describe('getErrorDetail', () => {
  it('returns JSON of Duffel errors array', () => {
    const err = { errors: [{ code: 'invalid', message: 'bad field' }] };
    expect(getErrorDetail(err)).toBe(JSON.stringify(err.errors));
  });

  it('extracts errors from response.data', () => {
    const err = { response: { data: { errors: [{ code: 'not_found' }] } } };
    expect(getErrorDetail(err)).toBe(JSON.stringify([{ code: 'not_found' }]));
  });

  it('falls back to message', () => {
    expect(getErrorDetail({ message: 'timeout' })).toBe('timeout');
  });

  it('falls back to statusCode', () => {
    expect(getErrorDetail({ statusCode: 503 })).toBe('503');
  });

  it('falls back to String()', () => {
    expect(getErrorDetail(42)).toBe('42');
  });
});

describe('getFirstDuffelError', () => {
  it('returns first error from errors array', () => {
    const err = { errors: [{ code: 'a', message: 'first' }, { code: 'b' }] };
    expect(getFirstDuffelError(err)).toEqual({ code: 'a', message: 'first' });
  });

  it('returns first error from response.data.errors', () => {
    const err = { response: { data: { errors: [{ code: 'nested' }] } } };
    expect(getFirstDuffelError(err)).toEqual({ code: 'nested' });
  });

  it('returns null when no errors', () => {
    expect(getFirstDuffelError({})).toBeNull();
    expect(getFirstDuffelError({ errors: [] })).toBeNull();
  });

  it('returns null for non-object', () => {
    expect(getFirstDuffelError('string')).toBeNull();
  });
});

// ─── compactOfferJson ─────────────────────────────────────────────────

describe('compactOfferJson', () => {
  it('produces valid JSON with required fields', () => {
    const json = compactOfferJson(makeOffer());
    const parsed = JSON.parse(json);
    expect(parsed.id).toBe('off_test_123');
    expect(parsed.total_amount).toBe('299.50');
    expect(parsed.total_currency).toBe('USD');
    expect(parsed.slices).toHaveLength(2);
    expect(parsed.slices[0].segments[0].operating_carrier.name).toBe('Delta Air Lines');
    expect(parsed.slices[0].segments[0].origin.iata_code).toBe('JFK');
    expect(parsed.slices[0].segments[0].destination.iata_code).toBe('LAX');
  });

  it('handles offer with no slices', () => {
    const json = compactOfferJson(makeOffer({ slices: [] }));
    const parsed = JSON.parse(json);
    expect(parsed.slices).toEqual([]);
  });

  it('handles segment with no aircraft', () => {
    const seg = makeSegment({ aircraft: null });
    const offer = makeOffer({ slices: [makeSlice({ segments: [seg] })] });
    const parsed = JSON.parse(compactOfferJson(offer));
    expect(parsed.slices[0].segments[0].aircraft).toBeNull();
  });

  it('handles segment with aircraft', () => {
    const parsed = JSON.parse(compactOfferJson(makeOffer()));
    expect(parsed.slices[0].segments[0].aircraft.name).toBe('Boeing 737-800');
  });
});

// ─── sortOffersByPrice ────────────────────────────────────────────────

describe('sortOffersByPrice', () => {
  it('sorts offers ascending by total_amount', () => {
    const offers = [
      makeOffer({ total_amount: '500.00' }),
      makeOffer({ total_amount: '100.00' }),
      makeOffer({ total_amount: '300.00' }),
    ];
    const sorted = sortOffersByPrice(offers);
    expect(sorted.map((o: any) => o.total_amount)).toEqual(['100.00', '300.00', '500.00']);
  });

  it('does not mutate original array', () => {
    const offers = [
      makeOffer({ total_amount: '500.00' }),
      makeOffer({ total_amount: '100.00' }),
    ];
    sortOffersByPrice(offers);
    expect(offers[0].total_amount).toBe('500.00');
  });

  it('handles single offer', () => {
    const sorted = sortOffersByPrice([makeOffer()]);
    expect(sorted).toHaveLength(1);
  });

  it('handles empty array', () => {
    expect(sortOffersByPrice([])).toEqual([]);
  });
});

// ─── extractCheapestOfferData ─────────────────────────────────────────

describe('extractCheapestOfferData', () => {
  it('extracts all fields from a valid offer', () => {
    const result = extractCheapestOfferData(makeOffer());
    expect(result).toEqual({
      price: 300, // Math.round(299.50)
      airline: 'Delta Air Lines',
      airlineCode: 'DL',
      departureDate: '2026-06-15',
      returnDate: '2026-06-22',
      duration: '6h 30m',
      offerId: 'off_test_123',
      offerExpiresAt: '2026-06-10T23:59:59Z',
    });
  });

  it('uses iata_code when carrier name is missing', () => {
    const seg = makeSegment({ operating_carrier: { iata_code: 'AA', name: null } });
    const offer = makeOffer({ slices: [makeSlice({ segments: [seg] })] });
    const result = extractCheapestOfferData(offer);
    expect(result.airline).toBe('AA');
    expect(result.airlineCode).toBe('AA');
  });

  it('returns empty strings when carrier is missing entirely', () => {
    const seg = makeSegment({ operating_carrier: null });
    const offer = makeOffer({ slices: [makeSlice({ segments: [seg] })] });
    const result = extractCheapestOfferData(offer);
    expect(result.airline).toBe('');
    expect(result.airlineCode).toBe('');
  });

  it('handles offer with no slices', () => {
    const offer = makeOffer({ slices: [] });
    const result = extractCheapestOfferData(offer);
    expect(result.departureDate).toBe('');
    expect(result.returnDate).toBe('');
    expect(result.duration).toBe('');
    expect(result.airline).toBe('');
  });

  it('handles duration with hours only (no minutes)', () => {
    const offer = makeOffer({
      slices: [makeSlice({ duration: 'PT5H' })],
    });
    const result = extractCheapestOfferData(offer);
    expect(result.duration).toBe('5h 0m');
  });

  it('handles missing duration', () => {
    const offer = makeOffer({
      slices: [makeSlice({ duration: null })],
    });
    const result = extractCheapestOfferData(offer);
    expect(result.duration).toBe('');
  });

  it('rounds price to nearest integer', () => {
    const offer = makeOffer({ total_amount: '199.99' });
    expect(extractCheapestOfferData(offer).price).toBe(200);

    const offer2 = makeOffer({ total_amount: '199.01' });
    expect(extractCheapestOfferData(offer2).price).toBe(199);
  });
});

// ─── transformSeatMap ─────────────────────────────────────────────────

describe('transformSeatMap', () => {
  function makeSeatElement(designator: string, overrides: Record<string, unknown> = {}) {
    return {
      type: 'seat',
      designator,
      disclosures: [],
      available_services: [
        { id: `srv_${designator}`, total_amount: '25.00', total_currency: 'USD' },
      ],
      ...overrides,
    };
  }

  function makeSeatMap(rows: any[]) {
    return [
      {
        cabins: [{ rows }],
      },
    ] as any;
  }

  it('returns null for null input', () => {
    expect(transformSeatMap(null)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(transformSeatMap([] as any)).toBeNull();
  });

  it('returns null for seat map with no cabins', () => {
    expect(transformSeatMap([{ cabins: [] }] as any)).toBeNull();
  });

  it('transforms a simple seat map', () => {
    const raw = makeSeatMap([
      {
        sections: [
          { elements: [makeSeatElement('1A'), makeSeatElement('1B')] },
          { elements: [makeSeatElement('1C'), makeSeatElement('1D')] },
        ],
      },
    ]);
    const result = transformSeatMap(raw);
    expect(result).not.toBeNull();
    expect(result!.columns).toEqual(['A', 'B', 'C', 'D']);
    expect(result!.rows).toHaveLength(1);
    expect(result!.rows[0].rowNumber).toBe(1);
    expect(result!.rows[0].seats).toHaveLength(4);
    expect(result!.rows[0].seats[0].designator).toBe('1A');
    expect(result!.rows[0].seats[0].available).toBe(true);
    expect(result!.rows[0].seats[0].price).toBe(25);
    expect(result!.rows[0].seats[0].currency).toBe('USD');
  });

  it('identifies exit rows', () => {
    const raw = makeSeatMap([
      {
        sections: [
          {
            elements: [
              makeSeatElement('12A', { disclosures: ['exit_row'] }),
            ],
          },
        ],
      },
    ]);
    const result = transformSeatMap(raw);
    expect(result!.exitRows).toContain(12);
    expect(result!.rows[0].seats[0].extraLegroom).toBe(true);
  });

  it('identifies extra legroom seats', () => {
    const raw = makeSeatMap([
      {
        sections: [
          {
            elements: [
              makeSeatElement('5A', { disclosures: ['extra_legroom'] }),
            ],
          },
        ],
      },
    ]);
    const result = transformSeatMap(raw);
    expect(result!.rows[0].seats[0].extraLegroom).toBe(true);
    expect(result!.exitRows).toEqual([]); // not an exit row
  });

  it('marks seats without available_services correctly', () => {
    const raw = makeSeatMap([
      {
        sections: [
          {
            elements: [
              makeSeatElement('1A', { available_services: [], disclosures: ['not_available'] }),
            ],
          },
        ],
      },
    ]);
    const result = transformSeatMap(raw);
    expect(result!.rows[0].seats[0].available).toBe(false);
    expect(result!.rows[0].seats[0].price).toBe(0);
    expect(result!.rows[0].seats[0].serviceId).toBeNull();
  });

  it('handles seat type with no not_available disclosure as available', () => {
    const raw = makeSeatMap([
      {
        sections: [
          {
            elements: [
              makeSeatElement('1A', { available_services: [] }),
            ],
          },
        ],
      },
    ]);
    const result = transformSeatMap(raw);
    // type='seat' and no 'not_available' disclosure => available
    expect(result!.rows[0].seats[0].available).toBe(true);
  });

  it('skips non-seat elements', () => {
    const raw = makeSeatMap([
      {
        sections: [
          {
            elements: [
              { type: 'bassinet', designator: '1X' },
              makeSeatElement('1A'),
            ],
          },
        ],
      },
    ]);
    const result = transformSeatMap(raw);
    expect(result!.rows[0].seats).toHaveLength(1);
    expect(result!.rows[0].seats[0].designator).toBe('1A');
  });

  it('handles restricted_seat_general type', () => {
    const raw = makeSeatMap([
      {
        sections: [
          {
            elements: [
              makeSeatElement('3A', { type: 'restricted_seat_general' }),
            ],
          },
        ],
      },
    ]);
    const result = transformSeatMap(raw);
    expect(result!.rows).toHaveLength(1);
    expect(result!.rows[0].seats[0].designator).toBe('3A');
  });

  it('tracks aisle columns between sections', () => {
    const raw = makeSeatMap([
      {
        sections: [
          { elements: [makeSeatElement('1A'), makeSeatElement('1B'), makeSeatElement('1C')] },
          { elements: [makeSeatElement('1D'), makeSeatElement('1E'), makeSeatElement('1F')] },
        ],
      },
    ]);
    const result = transformSeatMap(raw);
    // Aisle after the last column of the first section (before last section)
    expect(result!.aisleAfterColumns).toContain('C');
  });

  it('skips rows with no valid seat designators', () => {
    const raw = makeSeatMap([
      {
        sections: [{ elements: [{ type: 'bassinet', designator: null }] }],
      },
    ]);
    const result = transformSeatMap(raw);
    expect(result!.rows).toHaveLength(0);
  });
});

// ─── mapOrderPassengers ───────────────────────────────────────────────

describe('mapOrderPassengers', () => {
  it('maps passengers with full names', () => {
    const passengers = [
      { id: 'pas_1', given_name: 'John', family_name: 'Doe' },
      { id: 'pas_2', given_name: 'Jane', family_name: 'Smith' },
    ] as any;
    const result = mapOrderPassengers(passengers);
    expect(result).toEqual([
      { id: 'pas_1', name: 'John Doe', seatDesignator: undefined },
      { id: 'pas_2', name: 'Jane Smith', seatDesignator: undefined },
    ]);
  });

  it('handles empty passenger list', () => {
    expect(mapOrderPassengers([] as any)).toEqual([]);
  });

  it('handles null/undefined input', () => {
    expect(mapOrderPassengers(null as any)).toEqual([]);
    expect(mapOrderPassengers(undefined as any)).toEqual([]);
  });
});

// ─── mapOrderSlices ───────────────────────────────────────────────────

describe('mapOrderSlices', () => {
  it('maps a slice with all fields', () => {
    const order = makeOrder();
    const result = mapOrderSlices(order.slices);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      origin: 'JFK',
      destination: 'LAX',
      departureTime: '2026-06-15T08:00:00',
      arrivalTime: '2026-06-15T14:30:00',
      duration: '6h 30m',
      stops: 0, // 1 segment - 1
      airline: 'Delta Air Lines',
      flightNumber: 'DL 123',
      aircraft: 'Boeing 737-800',
    });
  });

  it('handles multi-segment (connecting) slice', () => {
    const slice = {
      origin: { iata_code: 'JFK' },
      destination: { iata_code: 'LAX' },
      duration: 'PT10H15M',
      segments: [makeSegment(), makeSegment()],
    };
    const result = mapOrderSlices([slice] as any);
    expect(result[0].stops).toBe(1);
  });

  it('handles duration with days', () => {
    const slice = {
      origin: { iata_code: 'JFK' },
      destination: { iata_code: 'NRT' },
      duration: 'P1DT2H30M',
      segments: [makeSegment()],
    };
    const result = mapOrderSlices([slice] as any);
    expect(result[0].duration).toBe('26h 30m');
  });

  it('handles null duration', () => {
    const slice = {
      origin: { iata_code: 'JFK' },
      destination: { iata_code: 'LAX' },
      duration: null,
      segments: [makeSegment()],
    };
    const result = mapOrderSlices([slice] as any);
    expect(result[0].duration).toBe('');
  });

  it('handles missing origin/destination', () => {
    const slice = {
      origin: null,
      destination: null,
      duration: null,
      segments: [makeSegment()],
    };
    const result = mapOrderSlices([slice] as any);
    expect(result[0].origin).toBe('');
    expect(result[0].destination).toBe('');
  });

  it('handles empty slices', () => {
    expect(mapOrderSlices([] as any)).toEqual([]);
    expect(mapOrderSlices(null as any)).toEqual([]);
  });
});

// ─── mapOrderToFlightStatusSegments ───────────────────────────────────

describe('mapOrderToFlightStatusSegments', () => {
  it('maps order segments to flight status format', () => {
    const order = makeOrder();
    const result = mapOrderToFlightStatusSegments(order, 'confirmed');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      flightNumber: '123',
      origin: 'JFK',
      destination: 'LAX',
      scheduledDeparture: '2026-06-15T08:00:00',
      estimatedDeparture: null,
      scheduledArrival: '2026-06-15T14:30:00',
      estimatedArrival: null,
      gate: null,
      terminal: 'T4',
      delayMinutes: null,
      status: 'scheduled',
    });
  });

  it('sets status to schedule_changed when booking status matches', () => {
    const order = makeOrder();
    const result = mapOrderToFlightStatusSegments(order, 'schedule_changed');
    expect(result[0].status).toBe('schedule_changed');
  });

  it('handles order with no slices', () => {
    const order = makeOrder({ slices: [] });
    expect(mapOrderToFlightStatusSegments(order, 'confirmed')).toEqual([]);
  });

  it('handles null slices', () => {
    const order = makeOrder({ slices: null });
    expect(mapOrderToFlightStatusSegments(order, 'confirmed')).toEqual([]);
  });

  it('flattens multiple slices with multiple segments', () => {
    const order = makeOrder({
      slices: [
        { segments: [makeSegment(), makeSegment()] },
        { segments: [makeSegment()] },
      ],
    });
    const result = mapOrderToFlightStatusSegments(order, 'confirmed');
    expect(result).toHaveLength(3);
  });

  it('uses marketing_carrier_flight_number when operating is missing', () => {
    const seg = makeSegment({
      operating_carrier_flight_number: '',
      marketing_carrier_flight_number: 'MK456',
    });
    const order = makeOrder({ slices: [{ segments: [seg] }] });
    const result = mapOrderToFlightStatusSegments(order, 'confirmed');
    expect(result[0].flightNumber).toBe('MK456');
  });
});
