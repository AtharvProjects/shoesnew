import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { ProductsPage } from '../pages/products.page';
import { BillingPage } from '../pages/billing.page';
import { ReportsPage } from '../pages/reports.page';

type MyFixtures = {
  loginPage: LoginPage;
  productsPage: ProductsPage;
  billingPage: BillingPage;
  reportsPage: ReportsPage;
};

export const test = base.extend<MyFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  productsPage: async ({ page }, use) => {
    await use(new ProductsPage(page));
  },
  billingPage: async ({ page }, use) => {
    await use(new BillingPage(page));
  },
  reportsPage: async ({ page }, use) => {
    await use(new ReportsPage(page));
  },
});

export { expect } from '@playwright/test';
