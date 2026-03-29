# Complete Implementation Plan: Credit Note & Debit Note System

This document provides a comprehensive, "world-class" developer's blueprint for completing the Sales Returns (Credit Notes) and Purchase Returns (Debit Notes) system.

## 1. System Architecture & Flow

### 1.1 Process Flow: Sales Return (Credit Note)
1.  **Initiation:** User clicks "Return" on a Sales Bill in the Reports page.
2.  **Redirection:** Router navigates to `/inventory/sls?returnFrom=[BillID]`.
3.  **State Init:** `initSalesSystem` detects `returnFrom`, loads original bill data, clears cart, and populates returnable items from original items.
4.  **User Action:** User specifies quantities to return (validation: `qty <= originalQty`).
5.  **Submission:** Frontend calls `POST /api/inventory/sales/create-credit-note`.
6.  **Backend Atomic Operation:**
    *   Validate original bill and return quantities.
    *   Increment stock `qty` and `total` (value) using the **original cost rate** to perfectly reverse COGS.
    *   Create `StockReg` entry of type `CREDIT_NOTE`.
    *   Create `Bill` entry of type `CREDIT_NOTE` with `ref_bill_id`.
    *   Post inverted ledger entries (DR Sales, DR GST, CR Party, DR Inventory, CR COGS).

### 1.2 Process Flow: Purchase Return (Debit Note)
1.  **Initiation:** User clicks "Return" on a Purchase Bill in the Reports page.
2.  **Redirection:** Router navigates to `/inventory/prs?returnFrom=[BillID]`.
3.  **State Init:** `initPurchaseSystem` detects `returnFrom`, loads data similarly to sales.
4.  **Submission:** Frontend calls `POST /api/inventory/purchase/create-debit-note`.
5.  **Backend Atomic Operation:**
    *   Validate quantities.
    *   Decrement stock `qty` and `total` (value).
    *   Create `StockReg` entry of type `DEBIT_NOTE`.
    *   Create `Bill` entry of type `DEBIT_NOTE` with `ref_bill_id`.
    *   Post inverted ledger entries (DR Party, CR Inventory, CR GST Input Credit).

---

## 2. Implementation Checklist

### Phase 1: Models & Backend Refinement (90% Complete)
- [x] **`Bill.model.js`**: Add `ref_bill_id` (ObjectId, ref: 'Bill').
- [x] **`StockReg.model.js`**: Ensure `type` enum includes `CREDIT_NOTE`, `DEBIT_NOTE`.
- [x] **Controllers**: `createCreditNote` (sls) and `createDebitNote` (prs) implemented.
- [x] **Ledger Helpers**: `postCreditNoteLedger` and `postDebitNoteLedger` implemented.
- [ ] **Verification**: Ensure `createCreditNote` and `createDebitNote` check if the original bill is already cancelled.

### Phase 2: Sales Frontend (`client/components/inventory/sls/`)
- [ ] **`stateManager.js`**:
    *   Update `loadExistingBillData` to set `state.currentBill = bill;`.
    *   Ensure `meta` in state correctly handles return modes.
- [ ] **`index.js`**:
    *   Refine `renderMainLayout` to show "Credit Note" title and "Save Credit Note" button when `isReturnMode` is true.
    *   Add a visual "Return Banner" showing the original Bill No.
    *   Ensure the "Save" button calls the correct endpoint (`/create-credit-note`).
- [ ] **`cartManager.js`**:
    *   Ensure return quantities are handled correctly in the cart state.
- [ ] **`layoutRenderer.js`**:
    *   Modify `renderItemsList` to show "Original Qty" vs "Return Qty" for better UX in return mode.

### Phase 3: Purchase Frontend (`client/components/inventory/prs/`)
- [ ] **`index.js`**:
    *   Implement `returnFrom` parameter handling (port from sales).
    *   Implement "Return Mode" logic for state initialization and layout rendering.
    *   Update save button logic to call `/create-debit-note`.
- [ ] **`stateManager.js`**:
    *   Update `loadExistingBillData` to support return loading.

### Phase 4: Reports & Navigation (`client/pages/`)
- [ ] **`inventory-reports.js`**:
    *   Add "Return" button to the bill action menu/modal for `ACTIVE` sales and purchases.
    *   Update `typeBadge` logic to handle `CN` (Credit Note) and `DN` (Debit Note) with distinct colors (e.g., Amber for CN, Blue-Grey for DN).
    *   Update the "View Details" modal to show the link to the original bill if it's a return.

### Phase 5: PDF & Excel Export
- [ ] **`pdfMakeController.js`**:
    *   Update document title based on `btype` (Invoice vs Credit Note vs Debit Note).
    *   Ensure "Ref Bill No" is printed on returns.

---

## 3. Technical Detail: Stock Reversal Math

When a sale is returned (Credit Note):
- **Stock Qty** increments by `returnedQty`.
- **Stock Value** (`total`) increments by `returnedQty * originalSaleCostRate`.
- This ensures the **WAC** (Weighted Average Cost) does not fluctuate due to a return, as the items are coming back at the same cost they left.

When a purchase is returned (Debit Note):
- **Stock Qty** decrements by `returnedQty`.
- **Stock Value** (`total`) decrements by `returnedQty * originalPurchaseRate`.

---

## 4. Testing Strategy

1.  **Data Integrity:** Verify `Ledger` entries balance (Sum DR = Sum CR) for every return.
2.  **Stock Consistency:** Perform a sale, then a partial return, then another sale. Check if WAC remains consistent.
3.  **UI/UX:** Ensure the user cannot return more than the original quantity.
4.  **State Management:** Ensure that navigating away from a return and back to a regular invoice clears the return state.
