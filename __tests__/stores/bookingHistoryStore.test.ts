// Mock the persist storage to avoid AsyncStorage/window issues in Node test env
jest.mock('../../utils/storage', () => ({
  createPersistStorage: () => undefined,
}));

import { useBookingHistoryStore } from '../../stores/bookingHistoryStore';
import type { BookingEntry } from '../../stores/bookingHistoryStore';

const makeBooking = (overrides: Partial<BookingEntry> = {}): BookingEntry => ({
  id: 'bk_001',
  destinationName: 'Tokyo',
  destinationImage: 'https://example.com/tokyo.jpg',
  origin: 'TPA',
  departureDate: '2026-05-01',
  returnDate: '2026-05-10',
  passengers: 2,
  totalPrice: 1200,
  currency: 'USD',
  bookingReference: 'REF123',
  airline: 'Delta',
  bookedAt: '2026-04-07T12:00:00Z',
  status: 'confirmed',
  ...overrides,
});

describe('bookingHistoryStore', () => {
  beforeEach(() => {
    useBookingHistoryStore.setState({ bookings: [] });
  });

  // ─── Initial state ──────────────────────────────────────────

  it('starts with an empty bookings array', () => {
    expect(useBookingHistoryStore.getState().bookings).toEqual([]);
  });

  // ─── addBooking ─────────────────────────────────────────────

  it('adds a booking entry', () => {
    const booking = makeBooking();
    useBookingHistoryStore.getState().addBooking(booking);

    const state = useBookingHistoryStore.getState();
    expect(state.bookings).toHaveLength(1);
    expect(state.bookings[0].id).toBe('bk_001');
    expect(state.bookings[0].destinationName).toBe('Tokyo');
  });

  it('does not add a duplicate booking with the same ID', () => {
    const booking = makeBooking({ id: 'bk_dup' });
    useBookingHistoryStore.getState().addBooking(booking);
    useBookingHistoryStore.getState().addBooking(booking);

    expect(useBookingHistoryStore.getState().bookings).toHaveLength(1);
  });

  it('prepends new bookings (newest first)', () => {
    useBookingHistoryStore.getState().addBooking(makeBooking({ id: 'bk_first' }));
    useBookingHistoryStore.getState().addBooking(makeBooking({ id: 'bk_second' }));

    const bookings = useBookingHistoryStore.getState().bookings;
    expect(bookings[0].id).toBe('bk_second');
    expect(bookings[1].id).toBe('bk_first');
  });

  // ─── removeBooking ──────────────────────────────────────────

  it('removes a booking by ID', () => {
    useBookingHistoryStore.getState().addBooking(makeBooking({ id: 'bk_remove' }));
    useBookingHistoryStore.getState().addBooking(makeBooking({ id: 'bk_keep' }));

    useBookingHistoryStore.getState().removeBooking('bk_remove');

    const bookings = useBookingHistoryStore.getState().bookings;
    expect(bookings).toHaveLength(1);
    expect(bookings[0].id).toBe('bk_keep');
  });

  it('does nothing when removing a non-existent ID', () => {
    useBookingHistoryStore.getState().addBooking(makeBooking({ id: 'bk_exists' }));
    useBookingHistoryStore.getState().removeBooking('bk_nope');

    expect(useBookingHistoryStore.getState().bookings).toHaveLength(1);
  });

  // ─── clearHistory ───────────────────────────────────────────

  it('clears all bookings', () => {
    useBookingHistoryStore.getState().addBooking(makeBooking({ id: 'bk_a' }));
    useBookingHistoryStore.getState().addBooking(makeBooking({ id: 'bk_b' }));

    useBookingHistoryStore.getState().clearHistory();

    expect(useBookingHistoryStore.getState().bookings).toEqual([]);
  });

  // ─── Booking entry fields ──────────────────────────────────

  it('booking entry has all required fields', () => {
    const booking = makeBooking();
    useBookingHistoryStore.getState().addBooking(booking);

    const stored = useBookingHistoryStore.getState().bookings[0];
    expect(stored.id).toBeDefined();
    expect(stored.destinationName).toBeDefined();
    expect(stored.destinationImage).toBeDefined();
    expect(stored.origin).toBeDefined();
    expect(stored.departureDate).toBeDefined();
    expect(stored.returnDate).toBeDefined();
    expect(stored.passengers).toBeDefined();
    expect(stored.totalPrice).toBeDefined();
    expect(stored.currency).toBeDefined();
    expect(stored.bookingReference).toBeDefined();
    expect(stored.airline).toBeDefined();
    expect(stored.bookedAt).toBeDefined();
    expect(stored.status).toBeDefined();
  });
});
