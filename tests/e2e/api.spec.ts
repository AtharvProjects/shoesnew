import { test, expect } from '@playwright/test';

test.describe('API Integration Tests', () => {

  test('should fetch products via API', async ({ request }) => {
    const response = await request.get('/api/products');
    expect(response.ok()).toBeTruthy();
    const products = await response.json();
    expect(Array.isArray(products)).toBeTruthy();
  });

  test('should create a new product via POST API', async ({ request }) => {
    const product = {
      name: 'API Test Product',
      sku: 'API-' + Date.now(),
      purchase_price: 50,
      selling_price: 75,
      quantity: 10,
      unit: 'pcs',
      gst_rate: 18
    };

    const response = await request.post('/api/products', {
      data: product
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    // Assuming API returns the created object or id
  });

  test('should return 404 for non-existent invoice', async ({ request }) => {
    const response = await request.get('/api/invoices/999999');
    expect(response.status()).toBe(404);
  });

  test('should fetch dashboard stats', async ({ request }) => {
    const response = await request.get('/api/dashboard');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('stats');
    expect(data.stats).toHaveProperty('totalProducts');
  });
});
