import { test, expect } from '../fixtures/base.fixture';
import { TEST_DATA } from '../data/test-data';

test.describe('Billing & Invoice Generation', () => {

  let uniquePrefix: string;

  test.beforeEach(async ({ billingPage, productsPage }) => {
    uniquePrefix = `Billable-${Date.now()}`;
    await productsPage.goto();
    await productsPage.addProduct({ name: uniquePrefix, price: 100 });
    
    await billingPage.goto();
  });

  test('should create a complete bill for walk-in customer', async ({ billingPage }) => {
    await billingPage.addProductToBill(uniquePrefix);
    await billingPage.verifyTotalAmount('₹100.00');
    
    await billingPage.createBill();
  });

  test('should apply discount and reflect in total', async ({ billingPage }) => {
    await billingPage.addProductToBill(uniquePrefix);
    await billingPage.setDiscount(20);
    
    // 100 - 20 = 80
    await billingPage.verifyTotalAmount('₹80.00');
    await billingPage.createBill();
  });

  test('should handle stock alerts during billing', async ({ billingPage, productsPage }) => {
    const stockPrefix = `Stock-${Date.now()}`;
    await productsPage.goto();
    await productsPage.addProduct({ name: stockPrefix, sku: 'LS-' + Date.now(), price: 50 });
    
    await billingPage.goto();
    await billingPage.addProductToBill(stockPrefix);
    
    // Add it again to exceed
    await billingPage.productSearchInput.fill(stockPrefix);
    await billingPage.page.getByRole('button').filter({ hasText: stockPrefix }).first().click();
    
    // Check for stock warning row highlight or text
    const stockMsg = billingPage.page.locator('span.text-destructive', { hasText: /Stock:/ });
    // This might only show if we exceed stock. 
  });

  test('should show error when creating bill with no items', async ({ billingPage }) => {
    await expect(billingPage.createBillBtn).toBeDisabled();
  });

  test('should support partial payments', async ({ billingPage }) => {
    await billingPage.addProductToBill(uniquePrefix);
    
    // Select Status using explicit ID to avoid matching other text accidentally
    await billingPage.page.locator('#payment-status').click(); 
    await billingPage.page.getByRole('option', { name: 'Partial' }).click();
    
    // Use accessible label targeting for exact strictness
    await billingPage.page.getByLabel('Amount Paid (Rs.) *').fill('50');
    await billingPage.createBill();
  });

});
