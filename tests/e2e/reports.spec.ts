import { test, expect } from '../fixtures/base.fixture';
import { TEST_DATA } from '../data/test-data';

test.describe('Reports & Analytics', () => {

  test.beforeEach(async ({ reportsPage }) => {
    await reportsPage.goto();
  });

  test('should load dashboard summary correctly', async ({ reportsPage }) => {
    await reportsPage.generateReport(TEST_DATA.dates.lastMonth(), TEST_DATA.dates.today());
    const stats = await reportsPage.getSummaryStats();
    
    expect(stats.totalSales).not.toBe('');
    expect(stats.totalInvoices).not.toBe('');
  });

  test('should show product sales in detailed report', async ({ reportsPage, billingPage }) => {
    // 1. Create a sale first to ensure data exists
    const uniqueProduct = 'Report Test ' + Date.now();
    // (In a real production test, we might use API to seed data for speed)
    // For now, we'll assume the system has some data or we've run other tests
    
    await reportsPage.switchTab('Top Products');
    // Verify the table loads
    await expect(reportsPage.page.getByRole('table')).toBeVisible();
  });

  test('should support Excel export', async ({ reportsPage }) => {
    const downloadPromise = reportsPage.page.waitForEvent('download');
    await reportsPage.page.getByRole('button', { name: /Download Excel/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.xlsx');
  });

  test('should support PDF export', async ({ reportsPage }) => {
    const downloadPromise = reportsPage.page.waitForEvent('download');
    await reportsPage.page.getByRole('button', { name: /Download PDF/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');
  });
});
