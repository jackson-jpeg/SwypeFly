import { useBookingFlowStore } from '../../stores/bookingFlowStore';
import type { Passenger, SelectedSeat, SelectedService } from '../../stores/bookingFlowStore';

describe('bookingFlowStore', () => {
  beforeEach(() => {
    useBookingFlowStore.getState().reset();
  });

  // ─── setOfferId ──────────────────────────────────────────────

  it('sets the selected offer ID', () => {
    useBookingFlowStore.getState().setOfferId('off_abc123');
    expect(useBookingFlowStore.getState().selectedOfferId).toBe('off_abc123');
  });

  it('overwrites previous offer ID', () => {
    useBookingFlowStore.getState().setOfferId('off_1');
    useBookingFlowStore.getState().setOfferId('off_2');
    expect(useBookingFlowStore.getState().selectedOfferId).toBe('off_2');
  });

  // ─── setPassengers ──────────────────────────────────────────

  it('sets passenger list', () => {
    const passengers: Passenger[] = [
      {
        givenName: 'Jane',
        familyName: 'Doe',
        bornOn: '1990-05-15',
        gender: 'f',
        title: 'ms',
        email: 'jane@example.com',
        phoneNumber: '+15551234567',
      },
    ];

    useBookingFlowStore.getState().setPassengers(passengers);
    const state = useBookingFlowStore.getState();
    expect(state.passengers).toHaveLength(1);
    expect(state.passengers[0].givenName).toBe('Jane');
    expect(state.passengers[0].familyName).toBe('Doe');
    expect(state.passengers[0].email).toBe('jane@example.com');
  });

  it('replaces existing passengers', () => {
    useBookingFlowStore.getState().setPassengers([
      { givenName: 'A', familyName: 'B', bornOn: '2000-01-01', gender: 'm', title: 'mr', email: '', phoneNumber: '' },
    ]);
    useBookingFlowStore.getState().setPassengers([
      { givenName: 'C', familyName: 'D', bornOn: '1995-06-01', gender: 'f', title: 'ms', email: '', phoneNumber: '' },
    ]);
    expect(useBookingFlowStore.getState().passengers[0].givenName).toBe('C');
  });

  // ─── setSeats ────────────────────────────────────────────────

  it('sets selected seats with serviceId', () => {
    const seats: SelectedSeat[] = [
      { designator: '14A', price: 25, currency: 'USD', serviceId: 'srv_seat_1' },
    ];
    useBookingFlowStore.getState().setSeats(seats);
    const state = useBookingFlowStore.getState();
    expect(state.selectedSeats).toHaveLength(1);
    expect(state.selectedSeats[0].designator).toBe('14A');
    expect(state.selectedSeats[0].serviceId).toBe('srv_seat_1');
  });

  it('allows seats without serviceId', () => {
    const seats: SelectedSeat[] = [
      { designator: '7C', price: 0, currency: 'USD' },
    ];
    useBookingFlowStore.getState().setSeats(seats);
    expect(useBookingFlowStore.getState().selectedSeats[0].serviceId).toBeUndefined();
  });

  // ─── setServices ─────────────────────────────────────────────

  it('sets selected services', () => {
    const services: SelectedService[] = [
      { id: 'srv_1', type: 'baggage', name: 'Extra bag 23kg', amount: 35, currency: 'USD' },
    ];
    useBookingFlowStore.getState().setServices(services);
    expect(useBookingFlowStore.getState().selectedServices).toHaveLength(1);
    expect(useBookingFlowStore.getState().selectedServices[0].name).toBe('Extra bag 23kg');
  });

  // ─── reset ───────────────────────────────────────────────────

  it('resets all state to defaults', () => {
    // Set everything
    useBookingFlowStore.getState().setOfferId('off_xyz');
    useBookingFlowStore.getState().setPassengers([
      { givenName: 'A', familyName: 'B', bornOn: '2000-01-01', gender: 'm', title: 'mr', email: 'a@b.com', phoneNumber: '+1' },
    ]);
    useBookingFlowStore.getState().setSeats([
      { designator: '1A', price: 50, currency: 'USD', serviceId: 'srv_1' },
    ]);
    useBookingFlowStore.getState().setServices([
      { id: 'srv_2', type: 'meal', name: 'Hot meal', amount: 12, currency: 'USD' },
    ]);

    // Reset
    useBookingFlowStore.getState().reset();

    const state = useBookingFlowStore.getState();
    expect(state.selectedOfferId).toBeNull();
    expect(state.passengers).toEqual([]);
    expect(state.selectedSeats).toEqual([]);
    expect(state.selectedServices).toEqual([]);
  });

  // ─── Initial state ──────────────────────────────────────────

  it('starts with empty defaults', () => {
    const state = useBookingFlowStore.getState();
    expect(state.selectedOfferId).toBeNull();
    expect(state.passengers).toEqual([]);
    expect(state.selectedSeats).toEqual([]);
    expect(state.selectedServices).toEqual([]);
  });
});
