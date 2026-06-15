import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class BillingPage extends BasePage {
  readonly productSearchInput: Locator;
  readonly customerSelect: Locator;
  readonly discountInput: Locator;
  readonly createBillBtn: Locator;
  readonly printAndClearBtn: Locator;
  readonly itemsTable: Locator;

  constructor(page: Page) {
    super(page);
    this.productSearchInput = page.getByPlaceholder(/Search to filter products/);
    this.customerSelect = page.getByRole('combobox').first();
    this.discountInput = page.getByLabel(/Discount/);
    this.createBillBtn = page.getByRole('button', { name: /Save Invoice/i });
    this.printAndClearBtn = page.getByRole('button', { name: /Print/i });
    this.itemsTable = page.locator('table').last();
  }


  async goto() {
    await this.navigateTo('/billing');
  }

  async addProductToBill(name: string) {
    await this.productSearchInput.fill(name);
    // Wait and click specifically on the button result
    const resultBtn = this.page.getByRole('button').filter({ hasText: name }).first();
    await expect(resultBtn).toBeVisible();
    await resultBtn.click();
  }

  async setDiscount(amount: number) {
    await this.discountInput.fill(amount.toString());
  }

  async selectCustomer(name: string) {
    await this.customerSelect.click();
    await this.page.getByRole('option', { name }).click();
  }

  async createBill() {
    await this.createBillBtn.click();
    await this.verifyToastMessage(/Invoice .* created/);
  }


  async verifyTotalAmount(expected: string) {
    // Look for the total amount container
    const totalLabel = this.page.locator('span').filter({ hasText: /^Total Amount$/ }).first();
    // The amount is in the parent div alongside the label
    await expect(totalLabel.locator('..')).toContainText(expected);
  }
}
