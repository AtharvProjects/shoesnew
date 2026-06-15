# QA & Automation Strategy: Gajraj Billing

## 1. Automated Testing Framework
We use **Playwright** for high-reliability end-to-end testing. The suite is structured using the **Page Object Model (POM)** for maximum maintainability and legibility.

### 🔍 Test Coverage:
- **Login Flow**: Future-ready placeholder for authentication modules.
- **Product Management**: Validation of CRUD operations, unique SKU enforcement, and deletion confirmation logic.
- **Advanced Billing Engine**: Validates subtotal + GST + Hamali + RoundOff calculations and stock availability alerts.
- **Analytics & Reporting**: Ensures accurate summary stats across date ranges and verifies Excel/PDF export integrity.
- **Edge Cases**: Simulation of network failures, API timeouts, and stress tests for UI resilience.

## 2. Directory Structure
```text
tests/
├── pages/       # Page Object Models (Reusable UI logic)
├── e2e/         # Actual test scripts (Separated by feature)
├── fixtures/    # Custom test extensions for auto-injection
└── data/        # Centralized test data and mock configurations
```

## 3. How to Run Automation
```powershell
# 1. Run all tests across Chromium, Firefox, and WebKit
npx playwright test

# 2. Run tests in a specific browser
npx playwright test --project=chromium

# 3. Open Interactive UI Test Runner
npx playwright test --ui

# 4. View detailed HTML report
npx playwright show-report
```

## 4. Maintenance Logs
- **v1.0.4**: Implementation of POM-based comprehensive Playwright suite.
- **v1.0.5**: Added cross-browser support and parallel execution config.
- **v1.0.6**: Integrated API integration tests for CRUD endpoints.

