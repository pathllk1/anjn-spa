# Inventory Sales System: Process Flow & GST Analysis

**Date:** March 28, 2026  
**Subject:** Detailed Review of Sales Workflow and GST Determination Logic  
**Status:** COMPLETED (Improvements Implemented)

---

## 1. Overview of Sales Process Flow

The inventory sales system follows a structured multi-step process from party selection to final ledger posting.

### A. Frontend Workflow (Client-side)
1.  **Initialization:** The system loads available stocks, parties, and the firm's GST locations.
2.  **Party Selection:**
    *   User selects a party from the modal.
    *   System retrieves party details: `firm name`, `gstin`, `state`, and `state_code`.
    *   **Auto-Detection:** `autoSetBillType()` is triggered to compare the firm's active location state code with the party's state code.
3.  **Cart Management:**
    *   Items are added to the cart (Goods or Services).
    *   Real-time calculations for each line item: `Qty * Rate - Discount + Tax`.
4.  **Tax Determination:**
    *   If `firm_state_code === party_state_code` → **Intra-State** (CGST + SGST).
    *   If `firm_state_code !== party_state_code` → **Inter-State** (IGST).
5.  **Finalization:**
    *   User reviews totals (Subtotal, Tax, Round-off, Net Total).
    *   Data is sent to `/api/inventory/sales/bills` via POST.

### B. Backend Workflow (Server-side)
1.  **Validation:**
    *   Validates party existence and firm ownership.
    *   **GST Validation:** Re-verifies the `billType` (intra vs inter) against the actual stored state codes of the firm and party to prevent illegal tax collection.
2.  **Stock Update:** Decrements inventory levels for each item in the cart based on batches.
3.  **Bill Creation:** Generates a unique Bill Number (INV/YYYY-YY/XXXX) and saves the Bill document.
4.  **Ledger Posting:**
    *   Creates a `Voucher` group.
    *   Debits the `Party Account` (Total Amount).
    *   Credits the `Sales Account` (Taxable Value).
    *   Credits `GST Accounts` (CGST/SGST or IGST).
    *   Adjusts `Inventory` and `COGS` (Cost of Goods Sold) for real-time profit tracking.

---

## 2. Scenario: Party Without GST Number (Unregistered)

### Determination Logic (Updated)
When a party is marked as **UNREGISTERED** (GSTIN is empty or 'UNREGISTERED'), the system uses a robust multi-tier fallback to determine the tax type:

1.  **Explicit State Code:** Checks the `state_code` field stored in the party document.
2.  **GSTIN Extraction:** (Not applicable for unregistered parties).
3.  **Name-to-Code Mapping (New):** If no code is stored, the system uses the `INDIA_STATE_CODES` map in `stateManager.js` to look up the 2-digit code based on the party's "State" name.
4.  **Comparison:** The resolved code is compared with the Seller Firm's state code to set the bill type.

### Example Scenario
*   **Firm (Seller):** Located in Delhi (State Code: 07).
*   **Party (Buyer):** A local walk-in customer in Delhi, unregistered.
*   **System Action:**
    *   Upon selecting the party, `determineGstBillType` resolves "Delhi" → "07".
    *   `07 (Firm) === 07 (Party)` → Sets **Intra-State (CGST + SGST)**.
    *   A green **"Local"** badge appears on the sales screen.

---

## 3. Improvements Implemented

The following enhancements have been successfully applied to improve accuracy and user experience:

### 1. Robust State Code Detection
*   **Location:** `client/components/inventory/sls/stateManager.js`
*   **Change:** Added `INDIA_STATE_CODES` mapping. Updated `determineGstBillType` to fallback to name-based lookup for unregistered parties.

### 2. Mandatory Data Entry
*   **Location:** `client/components/inventory/sls/partyCreate.js`
*   **Change:** Made the "State" field mandatory (`required`). Added a real-time listener to populate the hidden/readonly `state_code` field as soon as a valid state name is typed.

### 3. Visual UI Feedback
*   **Location:** `client/components/inventory/sls/layoutRenderer.js`
*   **Change:** Added a `billTypeBadge` logic. The Party Card now clearly displays a **"Local"** (Green) or **"Out of State"** (Orange) badge, giving the operator instant visual confirmation of the tax logic being applied.

---

## 4. Maintenance / File Summary

| File Path | Responsibility |
| :--- | :--- |
| `client/components/inventory/sls/stateManager.js` | Core logic for tax type determination and state code mapping. |
| `client/components/inventory/sls/index.js` | Orchestration of auto-detection triggers. |
| `client/components/inventory/sls/partyCreate.js` | UI for ensuring valid state data during party registration. |
| `client/components/inventory/sls/layoutRenderer.js` | Visual display of detected GST status. |
| `server/controllers/mongo/inventory/sls/inventory.js` | Server-side verification of GST compliance. |

---
*Report updated on March 28, 2026*
