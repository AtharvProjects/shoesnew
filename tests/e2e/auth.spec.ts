import { test, expect } from '../fixtures/base.fixture';

test.describe('Authentication (Feature Pending)', () => {
  
  test.beforeEach(async ({ loginPage }) => {
    // These tests are currently marked as fixme because login is not yet implemented in the app.
    // Once implemented, remove the test.fixme() call.
    test.fixme();
    await loginPage.goto();
  });

  test('should login with valid credentials', async ({ loginPage, page }) => {
    await loginPage.login('admin', 'admin123');
    await expect(page).toHaveURL('/');
  });

  test('should show error for invalid credentials', async ({ loginPage }) => {
    await loginPage.login('wrong', 'wrong');
    await loginPage.verifyError('Invalid username or password');
  });

  test('should show validation error for empty fields', async ({ loginPage }) => {
    await loginPage.loginBtn.click();
    await loginPage.verifyError('Username is required');
  });
});
