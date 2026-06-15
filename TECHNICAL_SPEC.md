# Technical Specification: Gajraj Billing Software v1.0

## 1. System Overview
Gajraj Billing Software is a high-performance, offline-capable billing and inventory management system designed for pharmaceutical and grocery retail. It is built using **Next.js 15** and **SQLite**, ensuring a lightweight footprint with professional-grade data integrity.

## 2. Technology Stack
- **Frontend**: React 19 / Next.js 15 (App Router)
- **Styling**: Tailwind CSS 4.0 (Custom Print Layouts)
- **Database**: SQLite (via `better-sqlite3`) with WAL mode enabled
- **Notifications**: Nodemailer (Google SMTP using App Passwords)
- **Testing**: Playwright End-to-End Automation
- **Icons**: Lucide React

## 3. Core Modules & Engineering Decisions

### 3.1 Advanced Billing Engine
- **GST Compliance**: Implemented a dynamic HSN/SAC summary table on invoices as per Indian Government regulations.
- **Print Optimization**: Enforced a zero-gap A4 layout using `height: 1px` row constraints and flexible `spacer` rows to ensure professional A4 vertical alignment.
- **Dual Flow**: Supports both GST (Tax Invoice) and Non-GST (Bill of Supply) workflows auto-calculated based on customer settings.

### 3.2 Data Security & Integrity
- **Deletion Workflow**: Sensitive data (Products/Customers) uses a "Type-to-Confirm" modal. This prevents accidental data loss from browser-native accidental clicks.
- **Backup Engine**: One-click binary extraction of the SQLite database (`gajraj_store.db`) for external cloud storage.

### 3.3 Inventory & Alerts
- **Low Stock Algorithm**: Real-time evaluation of `quantity <= low_stock_threshold`.
- **Automated Alerts**: Integration with Gmail SMTP for daily stock deficiency reports.

## 4. Automation Testing (QA)
The system utilizes **Playwright** for automated regression testing.
- **Location**: `/tests/`
- **Focus**: UI state validation, Calculation accuracy, and CRUD operations.
- **Commands**: 
  - `npx playwright test` (CLI)
  - `npx playwright test --ui` (Visual Debugger)

## 5. Security & Privacy
- **No Cloud Leakage**: All sales data remains on the local disk (`database.sqlite` is correctly ignored in `.gitignore`).
- **Environment Isolation**: Uses unique local paths for data persistence during development and builds.
