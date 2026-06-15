export const TEST_DATA = {
  products: {
    getValid: () => ({
      name: 'Test Product ' + Math.random().toString(36).substring(7) + '-' + Date.now(),
      sku: 'SKU-' + Math.floor(Math.random() * 100000),
      price: 150.50
    }),
    invalid: {
      name: '',
      price: -10
    },
    large: {
      name: 'A'.repeat(100),
      price: 9999999
    }
  },
  customers: {
    walkIn: 'Walk-in Customer'
  },
  dates: {
    today: () => new Date().toISOString().split('T')[0],
    lastMonth: () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }
};
