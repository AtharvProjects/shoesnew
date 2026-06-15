import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly sidebar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('nav'); // Assuming sidebar has a nav or similar
  }

  async navigateTo(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('load'); // Using 'load' instead of 'networkidle' for better compatibility
  }


  async clickSidebarLink(name: string) {
    await this.page.getByRole('link', { name }).click();
  }

  async verifyToastMessage(message: string | RegExp) {
    const toast = this.page.locator('ol[tabindex="-1"]'); // Sonner uses ol
    await expect(toast).toContainText(message);
  }

  async waitForLoadingFinished() {
    const spinner = this.page.locator('.animate-spin');
    await expect(spinner).not.toBeVisible({ timeout: 10000 });
  }
}
