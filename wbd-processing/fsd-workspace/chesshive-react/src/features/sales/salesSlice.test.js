import salesReducer, { fetchMonthlySales, fetchYearlySales } from './salesSlice';

describe('salesSlice reducer', () => {
  it('should return initial state', () => {
    const initial = undefined;
    const action = { type: '@@INIT' };
    const state = salesReducer(initial, action);
    expect(state).toHaveProperty('monthly');
    expect(state).toHaveProperty('yearly');
    expect(Array.isArray(state.monthly.data)).toBe(true);
  });

  it('should handle fetchMonthlySales.fulfilled', () => {
    const mockPayload = [{ _id: 1, totalSales: 100 }, { _id: 2, totalSales: 150 }];
    const action = { type: fetchMonthlySales.fulfilled.type, payload: mockPayload };
    const state = salesReducer(undefined, action);
    expect(state.monthly.data).toEqual(mockPayload);
    expect(state.monthly.loading).toBe(false);
  });

  it('should handle fetchYearlySales.fulfilled', () => {
    const mockPayload = [{ _id: 'Jan', totalSales: 1000 }];
    const action = { type: fetchYearlySales.fulfilled.type, payload: mockPayload };
    const state = salesReducer(undefined, action);
    expect(state.yearly.data).toEqual(mockPayload);
    expect(state.yearly.loading).toBe(false);
  });
});
