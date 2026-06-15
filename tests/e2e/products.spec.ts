import { test, expect } from '../fixtures/base.fixture';
import { TEST_DATA } from '../data/test-data';

test.describe('Product Management', () => {
  
  test.beforeEach(async ({ productsPage }) => {
    await productsPage.goto();
  });

  test('should add a new product with valid inputs', async ({ productsPage }) => {
    const product = TEST_DATA.products.getValid();
    await productsPage.addProduct(product);
    await productsPage.searchProduct(product.name);
    await productsPage.verifyProductInTable(product.name);
  });



  test('should show error for empty product name', async ({ productsPage }) => {
    await productsPage.addProductBtn.click();
    await productsPage.saveBtn.click();
    await productsPage.verifyToastMessage(/Product name is required/);
  });

  test('should show error for negative selling price', async ({ productsPage }) => {
    await productsPage.addProductBtn.click();
    await productsPage.nameInput.fill('Negative Price Test');
    await productsPage.sellingPriceInput.fill('-100');
    await productsPage.saveBtn.click();
    await productsPage.verifyToastMessage(/Selling price must be greater than zero/);
  });

  test('should handle duplicate SKUs gracefully', async ({ productsPage }) => {
    const uniqueSKU = `SKU-${Date.now()}`;
    const p1 = { name: 'P1', sku: uniqueSKU, price: 100 };
    const p2 = { name: 'P2', sku: uniqueSKU, price: 200 };
    
    // Add first
    await productsPage.addProduct(p1);
    
    // Attempt second with same SKU
    await productsPage.addProductBtn.click();
    await productsPage.nameInput.fill(p2.name);
    await productsPage.skuInput.fill(p2.sku);
    await productsPage.sellingPriceInput.fill(p2.price.toString());
    await productsPage.saveBtn.click();
    
    await productsPage.verifyToastMessage(/SKU already exists/);
  });

  test('should update an existing product', async ({ productsPage }) => {
    const product = TEST_DATA.products.getValid();
    await productsPage.addProduct(product);
    
    const newName = product.name + ' UPDATED';
    const row = productsPage.page.locator('tr').filter({ hasText: product.name });
    await row.locator('button').filter({ has: productsPage.page.locator('.lucide-pencil') }).click();
    
    await productsPage.nameInput.fill(newName);
    await productsPage.saveBtn.click();
    
    await productsPage.verifyToastMessage(/Product updated/);
    await productsPage.searchProduct(newName);
    await productsPage.verifyProductInTable(newName);
  });

  test('should delete a product with confirmation', async ({ productsPage }) => {
    const name = 'To Delete ' + Date.now();
    await productsPage.addProduct({ name, price: 50 });
    
    await productsPage.searchProduct(name);
    await productsPage.deleteProduct(name);
    await productsPage.verifyProductInTable(name, false);
  });
});
