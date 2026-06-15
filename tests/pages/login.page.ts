import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Placeholder for LoginPage. 
 * Note: Authentication is not currently implemented in the core application,
 * but this POM is provided for future-readiness as per requirements.
 */
export class LoginPage extends BasePage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginBtn: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.usernameInput = page.getByPlaceholder(/Username/i).or(page.locator('input[name="username"]'));
    this.passwordInput = page.getByPlaceholder(/Password/i).or(page.locator('input[name="password"]'));
    this.loginBtn = page.getByRole('button', { name: /Login|Sign In/i });
    this.errorMessage = page.locator('.text-destructive');
  }

  async goto() {
    await this.navigateTo('/login');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginBtn.click();
  }

  async verifyError(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }
}
