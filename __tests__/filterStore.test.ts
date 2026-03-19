import { useFilterStore } from '../stores/filterStore';

beforeEach(() => {
  useFilterStore.getState().clearAll();
});

describe('filterStore', () => {
  it('starts with no filters active', () => {
    const state = useFilterStore.getState();
    expect(state.priceRange).toBeNull();
    expect(state.regions).toEqual([]);
    expect(state.vibes).toEqual([]);
    expect(state.duration).toBeNull();
    expect(state.isOpen).toBe(false);
    expect(state.activeCount()).toBe(0);
  });

  it('sets and clears price range (single-select)', () => {
    const store = useFilterStore.getState();
    store.setPriceRange('under300');
    expect(useFilterStore.getState().priceRange).toBe('under300');
    expect(useFilterStore.getState().activeCount()).toBe(1);

    store.setPriceRange('under300');
    expect(useFilterStore.getState().priceRange).toBeNull();
  });

  it('toggles regions (multi-select)', () => {
    const store = useFilterStore.getState();
    store.toggleRegion('europe');
    store.toggleRegion('asia');
    expect(useFilterStore.getState().regions).toEqual(['europe', 'asia']);
    expect(useFilterStore.getState().activeCount()).toBe(2);

    store.toggleRegion('europe');
    expect(useFilterStore.getState().regions).toEqual(['asia']);
  });

  it('toggles vibes (multi-select)', () => {
    const store = useFilterStore.getState();
    store.toggleVibe('beach');
    store.toggleVibe('city');
    expect(useFilterStore.getState().vibes).toEqual(['beach', 'city']);

    store.toggleVibe('beach');
    expect(useFilterStore.getState().vibes).toEqual(['city']);
  });

  it('sets and clears duration (single-select)', () => {
    const store = useFilterStore.getState();
    store.setDuration('weekend');
    expect(useFilterStore.getState().duration).toBe('weekend');

    store.setDuration('weekend');
    expect(useFilterStore.getState().duration).toBeNull();
  });

  it('clearAll resets everything', () => {
    const store = useFilterStore.getState();
    store.setPriceRange('over1k');
    store.toggleRegion('europe');
    store.toggleVibe('beach');
    store.setDuration('week');
    store.clearAll();

    const state = useFilterStore.getState();
    expect(state.priceRange).toBeNull();
    expect(state.regions).toEqual([]);
    expect(state.vibes).toEqual([]);
    expect(state.duration).toBeNull();
  });

  it('toQueryParams builds correct API params', () => {
    const store = useFilterStore.getState();
    store.setPriceRange('300to500');
    store.toggleRegion('europe');
    store.toggleRegion('asia');
    store.toggleVibe('beach');
    store.toggleVibe('culture');
    store.setDuration('weekend');

    const params = useFilterStore.getState().toQueryParams();
    expect(params).toEqual({
      minPrice: '300',
      maxPrice: '500',
      regionFilter: 'europe,asia',
      vibeFilter: 'beach,culture',
      durationFilter: 'weekend',
    });
  });

  it('toQueryParams omits empty values', () => {
    const params = useFilterStore.getState().toQueryParams();
    expect(params).toEqual({});
  });

  it('toQueryParams handles under300 (no minPrice)', () => {
    useFilterStore.getState().setPriceRange('under300');
    const params = useFilterStore.getState().toQueryParams();
    expect(params).toEqual({ maxPrice: '300' });
  });

  it('toQueryParams handles over1k (no maxPrice)', () => {
    useFilterStore.getState().setPriceRange('over1k');
    const params = useFilterStore.getState().toQueryParams();
    expect(params).toEqual({ minPrice: '1000' });
  });

  it('open/close toggles isOpen', () => {
    const store = useFilterStore.getState();
    store.open();
    expect(useFilterStore.getState().isOpen).toBe(true);
    store.close();
    expect(useFilterStore.getState().isOpen).toBe(false);
  });

  it('activeCount sums all active filter categories', () => {
    const store = useFilterStore.getState();
    store.setPriceRange('under300');
    store.toggleRegion('europe');
    store.toggleRegion('asia');
    store.toggleVibe('beach');
    store.setDuration('weekend');
    expect(useFilterStore.getState().activeCount()).toBe(5);
  });
});
