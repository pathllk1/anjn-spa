# ERP & Accounting System Analysis Report

**Date:** May 17, 2026
**Author:** Gemini CLI Code Analyzer
**Status:** Comprehensive Audit Complete

---

## 1. Executive Summary
The system implements a sophisticated multi-tenant ERP with a core focus on HR/Payroll, Inventory, and Accounting. The accounting engine is built on standard double-entry bookkeeping principles, utilizing a **Perpetual Inventory Model**. While the MongoDB-based implementation is robust, the presence of a parallel SQLite/libsql infrastructure introduces significant technical risk and logic fragmentation.

## 2. Architectural Overview
*   **Primary Engine:** Node.js / Express / MongoDB (Mongoose).
*   **Accounting Model:** Perpetual Inventory (Inventory A/c is an Asset, COGS is an Expense).
*   **Database Schema:**
    *   `Ledger`: Central double-entry store.
    *   `Stock` & `StockReg`: Inventory tracking.
    *   `Bill`: Sales/Purchase invoices.
    *   `Wage`: Payroll records.

## 3. Critical Gaps & Logic Flaws

### A. Manual Stock Adjustment Gap (High Risk)
In `sharedStockHandlers.js`, the `createStockMovement` function handles manual receipts, adjustments, and transfers.
*   **The Issue:** These movements update the `Stock` (quantity) and `StockReg` (movement log) but **DO NOT** post to the `Ledger`.
*   **Impact:** The "Inventory" account in the Balance Sheet will drift away from the actual physical stock value over time.
*   **Recommendation:** Integrate `inventoryLedgerHelper` into `createStockMovement` to post adjustment entries (e.g., `Dr/Cr Inventory` vs. `Stock Adjustment A/c`).

### B. Technical Debt: Dual Database Hazard
The codebase contains two parallel accounting implementations:
1.  **MongoDB Implementation:** (`server/controllers/mongo/ledger/`) — Sophisticated, perpetual inventory.
2.  **SQLite Implementation:** (`server/utils/ledgerHelper.js`) — Simple, periodic inventory logic.
*   **The Issue:** Developers may inadvertently update/fix one while the other remains stale. It is unclear if both are active in different environments.
*   **Recommendation:** Deprecate and remove the SQLite `ledgerHelper.js` if the MongoDB implementation is the intended production engine.

### C. Missing Financial Year Closing (FY-Closing)
*   **The Issue:** There is no logic to perform "Year-End Closing."
*   **Impact:** Revenue and Expense accounts never reset to zero. Retained Earnings are not automatically calculated and carried forward.
*   **Recommendation:** Implement a `closeFinancialYear` service that:
    1.  Calculates Net Profit/Loss.
    2.  Posts a closing journal: `Dr/Cr Revenue/Expense` accounts to `Profit & Loss A/c`.
    3.  Transfers `Profit & Loss A/c` balance to `Retained Earnings` (Equity).

### D. Lack of Bank Reconciliation
*   **The Issue:** Bank accounts are tracked (`BankAccount` model), but there is no interface to upload bank statements and match them against ledger entries.
*   **Impact:** Errors in bank postings (omissions, wrong amounts) are difficult to detect.
*   **Recommendation:** Create a Bank Reconciliation module allowing CSV uploads and manual/auto matching.

### E. Fixed Assets & Depreciation
*   **The Issue:** No module exists for tracking Fixed Assets (Machinery, Vehicles, IT Equipment).
*   **Impact:** Depreciation is likely being posted manually via Journal Entries, which is prone to error and omission.
*   **Recommendation:** Add a Fixed Assets module with automated monthly/yearly depreciation posting.

### F. Aging Reports (A/R & A/P)
*   **The Issue:** While the Ledger tracks Party balances, there is no specialized Aging Report.
*   **Impact:** Difficult for management to track overdue receivables (Sundry Debtors) or payables (Sundry Creditors).
*   **Recommendation:** Implement a report that buckets outstanding balances into 0-30, 31-60, 61-90, and 90+ days based on bill dates.

### G. Wages Traceability Gap (Critical Logic Flaw)
*   **The Issue:** Ledger entries for wages use generic account heads (e.g., "Salaries & Wages") and narrations (e.g., "Wages for 2025-02"). While `master_roll_id` exists in the schema, it is not consistently used to identify the employee in human-readable narrations.
*   **Impact:** A ledger report for "Salaries & Wages" shows 100 identical lines for a month, making it impossible to audit individual payouts without complex DB joins.
*   **Dynamic Solution:** 
    1.  Inject Employee Name into every ledger line's `narration` (e.g., "Salaries: John Doe - Feb 2025").
    2.  Strictly enforce `master_roll_id` and `party_id` (if applicable) for all wage-related ledger records to enable sub-ledger reporting.

### H. Vercel Timeout & Scalability (Critical Infrastructure Gap)
*   **The Issue:** Current batch processing (5 employees/batch) in a single request takes ~20 seconds. 100 employees would require 400+ seconds, far exceeding Vercel's 10-30s timeout.
*   **Impact:** Payroll for large firms (100+ staff) will consistently fail with 504 Gateway Timeouts, leading to data corruption and incomplete postings.
*   **Dynamic Solution (Atomic Iterator Model):**
    1.  **Job Initiation:** `POST /api/wages/job/start` saves the entire payload to `WageJob.wages_data` and returns a `jobId`.
    2.  **Atomic Stepping:** `POST /api/wages/job/:jobId/step` processes exactly ONE batch (5-10 records) and returns progress.
    3.  **Client-Side Orchestration:** The frontend calls `/step` repeatedly. If a request fails or times out, the client can safely retry from the last successful index.
    4.  **Performance Optimization:** Cache `ChartOfAccounts` lookups in-memory during a batch and use `Ledger.insertMany()` for the entire batch to minimize DB roundtrips.

## 4. Strengths & Commendations
*   **Perpetual Inventory Logic:** The use of `COGS` (Cost of Goods Sold) and `Inventory` (Asset) accounts during sales is an advanced feature usually found in high-end ERPs.
*   **Atomic Transactions:** The use of Mongoose sessions for vouchers and wages ensures data integrity.
*   **Standardized Naming:** The use of `voucher_group_id` for grouping multiple ledger lines is a solid architectural decision.
*   **GST Integration:** The system correctly handles GST Input/Output accounts and provides GSTR-1/3B reporting.

## 5. Technical Recommendations for Refactoring
1.  **Unified Ledger Service:** Consolidate `inventoryLedgerHelper.js`, `wagesLedgerHelper.js`, and `voucherController.js` logic into a single `AccountingService.js`.
2.  **Enforce Locking:** Implement a global "Closing Date" setting. Prevent any ledger postings (Bill, Wage, Voucher) before this date to ensure past periods remain immutable.
3.  **Strict Typing:** Convert critical accounting utilities to TypeScript (if not already planned) to prevent NaN or string-concatenation bugs in financial math.

---
*Report ends.*
