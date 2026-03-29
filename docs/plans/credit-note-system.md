# Detailed Implementation Plan: Credit Note & Debit Note System

This document provides a technical blueprint for implementing Sales Returns (Credit Notes) and Purchase Returns (Debit Notes) with full Perpetual Inventory and Accounting integration.

## 1. Architectural Overview

The system will leverage existing atomic stock update patterns and ledger posting helpers. A "Return" is treated as a specialized transaction that references an original bill to ensure price and cost consistency.

---

## 2. Backend Implementation (Node.js/MongoDB)

### 2.1 Model Updates (`server/models/`)
*   **`Bill.model.js`**:
    *   Add `ref_bill_id`: `{ type: Schema.Types.ObjectId, ref: 'Bill', default: null }`
    *   Ensure `btype` enum documentation includes `CREDIT_NOTE` and `DEBIT_NOTE`.
*   **`StockReg.model.js`**:
    *   Type enum update: `SALE`, `PURCHASE`, `CREDIT_NOTE`, `DEBIT_NOTE`.

### 2.2 Controller Logic (`server/controllers/mongo/inventory/`)

#### 2.2.1 Credit Note (Sales Return) - `sls/inventory.js`
1.  **Transaction Start:** Open mongoose session.
2.  **Fetch Original:** Load original `Bill` and its `StockReg` entries.
3.  **Stock Restoration:** For each item in the return cart:
    *   Find the original `StockReg` to get the `cost_rate` (WAC at time of sale).
    *   **Atomic Update:**
        ```javascript
        await Stock.findOneAndUpdate(
          { _id: item.stockId, firm_id },
          { $inc: { 
              qty: returnedQty, 
              total: returnedQty * originalCostRate // Restore asset value at original cost
          }}
        );
        ```
4.  **Create Credit Note Bill:**
    *   `btype: 'CREDIT_NOTE'`, `ref_bill_id: originalBillId`.
    *   Use `billUtils.getNextBillNumber(firmId, 'CREDIT_NOTE')`.
5.  **Audit Trail:** Create `StockReg` with `type: 'CREDIT_NOTE'`.
6.  **Ledger Posting:** Call `postCreditNoteLedger` from `inventoryLedgerHelper.js`.

#### 2.2.2 Debit Note (Purchase Return) - `prs/inventory.js`
1.  **Transaction Start.**
2.  **Stock Deduction:** 
    *   **Atomic Update:**
        ```javascript
        // Use buildAtomicPurchaseReversePipeline logic from prs/inventory.js
        // but with type DEBIT_NOTE in StockReg.
        ```
3.  **Create Debit Note Bill:** `btype: 'DEBIT_NOTE'`.
4.  **Ledger Posting:** Call `postDebitNoteLedger`.

### 2.3 Shared Utilities (`billUtils.js`)
*   Update `BILL_PREFIX` to include `CN` for Credit Notes and `DN` for Debit Notes.

---

## 3. Frontend Implementation (Vanilla JS / SPA)

### 3.1 State Management (`sls/stateManager.js`)
*   Add `mode: 'REGULAR' | 'RETURN'` to initial state.
*   Add `originalBillId: null`.
*   Update `loadExistingBillData` (or create `loadReturnData`) to:
    *   Fetch original bill.
    *   Initialize cart with 0 quantities but original rates/HSN/GST.
    *   Set `mode: 'RETURN'`.

### 3.2 Orchestrator (`sls/index.js`)
*   **Routing:** Handle `?returnFrom=[ID]` URL parameter.
*   **UI Adjustments:**
    *   Change Header title to **"Credit Note (Sales Return)"**.
    *   Add a banner: "Returning items from Bill #INV/..."
    *   Change "Save Invoice" button to **"Save Credit Note"**.
    *   Apply a distinct theme (e.g., amber border) to indicate return mode.

### 3.3 Reporting Page (`inventory-reports.js`)
*   **Action Button:** In the "View" modal and table rows, add a **"Return Items"** button for `ACTIVE` Sales/Purchase bills.
*   **Visuals:** Add badges for `CN` (Credit Note) and `DN` (Debit Note) with specific colors.
*   **Filtering:** Add `CREDIT_NOTE` and `DEBIT_NOTE` to the Type filter dropdown.

---

## 4. Accounting Entry Details (Recap)

### Credit Note (Sales Return)
| Account | DR | CR | Narration |
| :--- | :--- | :--- | :--- |
| **Party (Debtor)** | | Total | Return against Bill #... |
| **Sales** | Taxable | | Revenue Reversal |
| **GST Payable** | GST Amt | | Tax Liability Reduction |
| **Inventory** | COGS | | Goods back in stock |
| **COGS** | | COGS | Expense Reversal |

---

## 5. Verification & Edge Cases

### 5.1 Validation Rules
*   **Max Return Qty:** Frontend and Backend must ensure `returnedQty <= (originalQty - alreadyReturnedQty)`.
*   **Financial Year:** Returns should ideally stay within the same financial year or follow statutory GST timelines.

### 5.2 Test Scenarios
1.  **Full Return:** Return all items from a bill. Verify stock matches pre-sale levels.
2.  **Partial Return:** Return 1 out of 5 items. Verify WAC remains stable.
3.  **Service Items:** Returns for service items should only affect Revenue/GST/Ledger, not Inventory/Stock.
4.  **Cancelled Bill Return:** System must block returns against `CANCELLED` bills.
5.  **Multi-GSTIN:** Ensure return uses the same `firm_gstin` as the original bill.
