# Bug Report: Inventory Return System (Credit & Debit Notes)

## 1. Critical: Ledger Parameter Mismatch
**Location:** `server/controllers/mongo/inventory/sls/inventory.js` and `server/controllers/mongo/inventory/prs/inventory.js`
**Description:** The calls to `postCreditNoteLedger` and `postDebitNoteLedger` are missing essential parameters required for balanced accounting.
*   **Credit Note:** Missing `taxableItemsTotal` (passed as `undefined`), `rof`, and `otherCharges`. The "Sales" reversal line will have an `undefined` amount, leading to broken ledger entries.
*   **Debit Note:** Missing `rof` and `otherCharges`.

## 2. Critical: Trial Balance Mismatch in Debit Note
**Location:** `server/controllers/mongo/inventory/inventoryLedgerHelper.js` (postDebitNoteLedger)
**Description:** The journal entry for a Debit Note (Purchase Return) will not balance if capitalized costs (like freight) were added to the stock's `cost_rate`.
*   **Reason:** The system debits the Party for the *invoice value* (`ntot` based on purchase rate) but credits Inventory for the *landed cost* (`cost_rate * qty`). 
*   **Impact:** Trial Balance will be off by the difference between landed cost and invoice price for every purchase return involving capitalized charges.

## 3. Major: Missing Physical Stock Validation
**Location:** Return controllers (SLS & PRS)
**Description:** Validations only check if the return quantity exceeds the *original bill quantity*. They do NOT check if there is enough *current physical stock* to perform the return.
*   **Impact:** A user can return 10 units to a supplier even if they only have 2 left in stock (having sold 8), leading to a negative stock level (-8) without any warning or error.

## 4. Major: Sales Return Cost Rate Fallback
**Location:** `server/controllers/mongo/inventory/sls/inventory.js` (Line 834)
**Description:** During a Credit Note, if `originalReg.cost_rate` is missing, it falls back to `originalReg.rate` (the selling price).
*   **Impact:** Inventory value will be restored at the *selling price* instead of the *cost price*, artificially inflating the asset value and breaking future COGS calculations for those items.

## 5. Minor: Typo in Validation Message
**Location:** `server/controllers/mongo/inventory/sls/inventory.js` (Line 756)
**Description:** Extra space in the error message: `units of ${returnItem.item}  (max: ${maxReturnQty})`.

## 6. Minor: Date Handling Inconsistency
**Location:** Return controllers
**Description:** Uses `new Date().toISOString().split('T')[0]` which defaults to UTC. This may cause the return date to be off by one day compared to the user's local timezone if the transaction happens near midnight.
