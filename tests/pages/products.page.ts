import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class ProductsPage extends BasePage {
  readonly addProductBtn: Locator;
  readonly nameInput: Locator;
  readonly skuInput: Locator;
  readonly sellingPriceInput: Locator;
  readonly saveBtn: Locator;
  readonly searchInput: Locator;
  readonly productTable: Locator;
  readonly deleteConfirmInput: Locator;
  readonly finalDeleteBtn: Locator;

  constructor(page: Page) {
    super(page);
    this.addProductBtn = page.getByRole('button', { name: /Add Product/i }).first();
    this.nameInput = page.getByLabel(/Product Name/);
    this.skuInput = page.getByLabel(/SKU/);
    this.sellingPriceInput = page.getByLabel(/Selling Price/);
    this.saveBtn = page.getByRole('button', { name: /Add Product/i, exact: true }).or(page.getByRole('button', { name: 'Update' }));
    this.searchInput = page.getByPlaceholder(/Search products by name/);
    this.productTable = page.getByRole('table');
    this.deleteConfirmInput = page.getByPlaceholder(/type .* to confirm/i);
    this.finalDeleteBtn = page.getByRole('button', { name: /Permanently Delete/i });
  }


  async goto() {
    await this.navigateTo('/products');
  }

  async addProduct(details: { name: string, sku?: string, price: number }) {
    await this.addProductBtn.click();
    await this.nameInput.fill(details.name);
    if (details.sku) await this.skuInput.fill(details.sku);
    await this.sellingPriceInput.fill(details.price.toString());
    await this.saveBtn.click();
    await this.verifyToastMessage(/Product added|Product updated/);
  }


  async deleteProduct(name: string) {
    const row = this.page.locator('tr').filter({ hasText: name });
    await row.locator('button').filter({ has: this.page.locator('.lucide-trash2') }).click();
    
    // Fill confirmation text
    await this.page.getByText(`Please type ${name} to confirm.`).waitFor();
    const input = this.page.locator('input[placeholder="' + name + '"]');
    await input.fill(name);
    await this.finalDeleteBtn.click();
    
    await this.verifyToastMessage(/Product deleted/);
  }

  async searchProduct(name: string) {
    await this.searchInput.fill(name);
    await this.page.waitForTimeout(500); // Debounce wait
  }

  async verifyProductInTable(name: string, shouldExist: boolean = true) {
    const row = this.page.locator('tr').filter({ hasText: name });
    if (shouldExist) {
      await expect(row).toBeVisible();
    } else {
      await expect(row).not.toBeVisible();
    }
  }
}
