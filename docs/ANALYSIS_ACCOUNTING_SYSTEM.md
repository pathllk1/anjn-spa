# Accounting System Analysis & Implementation Plan

## 1. Current State Assessment
The existing accounting system is a functional but rudimentary double-entry ledger. While it handles basic Sales, Purchase, Payment, and Receipt vouchers, it lacks the structural depth required for Indian statutory compliance (GST, TDS/TCS) and professional auditing (Tally-like hierarchy).

### 1.1 Process Flow (Current)
1.  **Sales/Purchase**: Automatically posts to the ledger via `inventoryLedgerHelper.js`. Uses "Perpetual Inventory" (Inventory DR, COGS CR).
2.  **Vouchers**: `Payment` and `Receipt` vouchers are single-party transactions (Party vs. Bank/Cash).
3.  **Journal Entries**: Multi-line balanced transactions for adjustments.
4.  **Ledger Resolution**: `resolveLedgerPostingAccount` performs a loose regex match on `account_head`. If not found, it uses a "fallback" type.
5.  **Opening Balances**: Managed as a separate collection `OpeningBalance`, not integrated into the main `Ledger` stream for Trial Balance calculation (leads to potential mismatches).

---

## 2. Identified Gaps (Indian Accounting Perspective)

### 2.1 Lack of Hierarchical Chart of Accounts (COA)
*   **Gap**: The system uses flat strings for account heads. Indian accounting requires grouping (e.g., `SBI Bank` belongs to `Bank Accounts`, which belongs to `Current Assets`).
*   **Impact**: Financial statements (Balance Sheet, P&L) cannot be grouped by categories. Direct vs. Indirect expenses cannot be distinguished easily.

### 2.2 Missing "Contra" Voucher Type
*   **Gap**: There is no dedicated "Contra" voucher for Bank-to-Cash, Cash-to-Bank, or Bank-to-Bank transfers.
*   **Impact**: Users are forced to use Journal Entries or Receipt/Payment vouchers, which distorts "Party" reports and cash flow analysis.

### 2.3 Improper Financial Year (FY) Handling
*   **Gap**: While sequence numbers use FY prefixes (e.g., 24-25), there is no hard "Year Close" mechanism.
*   **Impact**: Balances from the previous year are not automatically carried forward. Running a Trial Balance for "All Time" is slow and may include closed periods.

### 2.4 GST Integration Gaps
*   **Gap**: GST is posted to generic "CGST Input Credit" or "SGST Payable" heads.
*   **Impact**: Does not support GST multi-registration within the same firm (State-wise GST ledgers). No support for RCM (Reverse Charge) ledger flows (Liability vs. Input).

### 2.5 TDS / TCS Absence
*   **Gap**: No mechanism to deduct TDS (Tax Deducted at Source) on payments or TCS on sales.
*   **Impact**: Violation of Indian Income Tax Act for businesses above threshold.

### 2.6 Rounding & Narration Inconsistency
*   **Gap**: Narration is often document-level only. Tally-style accounting requires line-level narration for clarity in General Ledgers.

---

## 3. Implementation Plan (The "Indian BMS" Upgrade)

### Phase 1: Structural Foundation (The Tally Model)
1.  **Introduce Account Groups**: Create a `AccountGroup` model with parent-child relationships (e.g., `Fixed Assets`, `Current Liabilities`, `Sundry Debtors`).
2.  **Refactor Ledger Model**: 
    *   Add `group_id` to `Ledger` entries.
    *   Add `line_narration` in addition to `voucher_narration`.
3.  **Implement Contra Vouchers**: Add a new controller and UI for Contra entries (strictly Bank/Cash only).

### Phase 2: Statutory Compliance
1.  **State-wise GST Ledgers**: Auto-resolve GST heads to state-specific accounts (e.g., `CGST-MH-Input`, `SGST-KA-Output`).
2.  **TDS Logic**: Add a TDS deduction field in Purchase/Payment modules with auto-posting to a `TDS Payable` ledger.

### Phase 3: Financial Year Management
1.  **Closing/Opening Automation**: A "Year-End Processing" tool that:
    *   Calculates net balance of all accounts.
    *   Creates a `JV` (Journal) in the *new* year as "Opening Balance".
    *   Locks the previous year's entries.

### Phase 4: Advanced Reporting
1.  **Group-wise Trial Balance**: Summarize balances by Account Group.
2.  **Schedule-VI Balance Sheet**: Modern Indian format for Balance Sheets.
3.  **GST-3B / GSTR-1 Reconciliation**: Data exports specifically formatted for GST portals.

---

## 4. Technical Roadmap (Directives)

### Schema Updates
```prisma
// Proposed additions to schema.prisma
model AccountGroup {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  name      String
  parent_id String?  @db.ObjectId
  firm_id   String   @db.ObjectId
}

model Ledger {
  // ... existing fields
  group_id       String? @db.ObjectId
  line_narration String?
  is_opening     Boolean @default(false)
}
```

### Next Immediate Actions
1.  **Refactor `resolveLedgerPostingAccount`**: It must check for a master `Account` list first, rather than just looking at past transactions.
2.  **Create `AccountMaster`**: Move from "floating strings" to a predefined list of accounts per firm.
