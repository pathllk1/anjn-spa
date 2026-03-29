# Bug Report: Inventory Return System (Credit & Debit Notes)

## 1. FIXED: Ledger Parameter Mismatch
*The backend code has been updated to include `rof`, `otherCharges`, and `taxableItemsTotal` in the ledger posting calls.*

## 2. FIXED: Trial Balance Mismatch in Debit Note
*Debit notes now reverse goods at the original net purchase cost from the source `StockReg.total/qty`, while bill-level `other_charges` are reversed separately on the note. This matches the way purchases are posted in this system and avoids synthetic gain/loss plug entries.*

## 3. FIXED: Missing Physical Stock Validation
*`createDebitNote` now verifies that the firm has enough physical stock before allowing a return to a supplier.*

## 4. FIXED: Sales Return Cost Rate Fallback
*The system now throws an explicit error if the original cost rate is missing, preventing inventory valuation corruption.*

## 5. FIXED: Typo in Validation Message
*Extra space removed from error messages.*

## 6. FIXED: Date Handling Inconsistency
*`getLocalDateString()` is now used to ensure returns are dated according to local time rather than UTC.*

---

# NEW CRITICAL BUGS IDENTIFIED

## 7. FIXED: Credit Note Cancellation is Broken
**Location:** `server/controllers/mongo/inventory/sls/inventory.js` (cancelBill)
**Description:** 
1. **Wrong Ledger Deletion:** Hardcoded to delete `voucher_type: 'SALES'`. It will fail to remove the ledger entries for a `CREDIT_NOTE`.
2. **Wrong Stock Direction:** Assumes it is reversing a Sale, so it INCREMENTS stock. Since a Credit Note already incremented stock (received goods back), cancelling it should DECREMENT stock. Currently, cancelling a Credit Note will double-count the returned items in inventory.

## 8. FIXED: Debit Note Cancellation is Broken
**Location:** `server/controllers/mongo/inventory/prs/inventory.js` (cancelBill)
**Description:** 
1. **Wrong Ledger Deletion:** Hardcoded to delete `voucher_type: 'PURCHASE'`. It will fail to remove ledger entries for a `DEBIT_NOTE`.
2. **Wrong Stock Direction:** Assumes it is reversing a Purchase (removing stock). Since a Debit Note already removed stock (returned goods to supplier), cancelling it should INCREMENT stock. Currently, cancelling a Debit Note will double-subtract the items from inventory.

## 9. FIXED: Editing Credit/Debit Notes Corrupts Data
**Location:** `updateBill` in both SLS and PRS controllers.
**Description:** Return-note editing is now blocked at the backend.
*   **Impact:** Credit/Debit Notes can no longer be silently converted into normal Sales/Purchase bills by the generic edit flow.
*   **Current behavior:** Users must cancel and recreate return notes instead of editing them through `updateBill`.

## 10. FIXED: Missing WAC Logic in Credit Note Stock Restoration
**Location:** `server/controllers/mongo/inventory/sls/inventory.js` (createCreditNote)
**Description:** While the code restores the `total` value using `costPerUnit`, it does not re-calculate the `rate` (WAC) of the `Stock` record itself. 
*   **Impact:** The `Stock.total` and `Stock.qty` increase, but the `Stock.rate` field (which stores the current WAC for quick lookup) remains at the old value until the next purchase. This may lead to incorrect valuation displays in the UI.

## 11. FIXED: Service Item Rejection in Returns
**Location:** `aggregateReturnCart` in Return Controllers.
**Description:** The function throws an error if `stockId` is missing. 
*   **Impact:** If an original bill contains a service line (which has no `stockId`), the return process might fail even if the user is not trying to return that service, depending on how the frontend sends the data.

## 12. FIXED: Missing Round-off and Other Charges Reversal Logic
**Location:** Return Controllers.
**Description:** Return-note creation now allocates original `other_charges` proportionally to the returned goods value and recalculates `rof` through the same totals helper used by normal bills.
*   **Impact:** Credit/Debit Notes now reverse charges and round-off in a consistent, auditable way for partial returns.
