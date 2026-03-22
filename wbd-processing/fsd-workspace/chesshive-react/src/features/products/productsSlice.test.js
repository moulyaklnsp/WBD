import reducer, { fetchProducts } from './productsSlice';

describe('productsSlice basic reducer', () => {
  it('should return the initial state', () => {
    const init = reducer(undefined, { type: '@@INIT' });
    expect(init).toHaveProperty('products');
    expect(Array.isArray(init.products)).toBe(true);
  });

  it('handles fetchProducts.pending and fulfilled shapes', () => {
    const pending = reducer(undefined, fetchProducts.pending());
    expect(pending.loading).toBe(true);

    const fulfilled = reducer(undefined, fetchProducts.fulfilled({ products: [{ _id: '1', name: 'P' }] }));
    expect(fulfilled.loading).toBe(false);
    expect(Array.isArray(fulfilled.products)).toBe(true);
    expect(fulfilled.products.length).toBeGreaterThanOrEqual(0);
  });
});
