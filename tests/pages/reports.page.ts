import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class ReportsPage extends BasePage {
  readonly fromDateInput: Locator;
  readonly toDateInput: Locator;
  readonly generateReportBtn: Locator;
  readonly summaryCards: Locator;

  constructor(page: Page) {
    super(page);
    this.fromDateInput = page.locator('input[type="date"]').first();
    this.toDateInput = page.locator('input[type="date"]').nth(1);
    this.generateReportBtn = page.getByRole('button', { name: /Generate Report/i });
    this.summaryCards = page.locator('.grid.gap-4 .text-2xl.font-bold');
  }

  async goto() {
    await this.navigateTo('/reports');
  }

  async generateReport(from: string, to: string) {
    await this.fromDateInput.fill(from);
    await this.toDateInput.fill(to);
    await this.generateReportBtn.click();
    await this.waitForLoadingFinished();
  }

  async getSummaryStats() {
    const stats = await this.summaryCards.allInnerTexts();
    return {
      totalSales: stats[0],
      totalInvoices: stats[1],
      gstCollected: stats[2],
      avgBill: stats[3]
    };
  }

  async switchTab(tabName: string) {
    await this.page.getByRole('tab', { name: tabName }).click();
  }

  async verifyProductInReport(name: string) {
    await this.switchTab('Top Products');
    const row = this.page.locator('tr').filter({ hasText: name });
    await expect(row).toBeVisible();
  }
}
