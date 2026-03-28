# Accounting System UI Bug Report

**Report Date:** March 28, 2026  
**System:** ANJN SPA Accounting Module  
**Status:** Open Issues Found

---

## Bug #1: Missing XSS Protection in Voucher Modal

**Severity:** High  
**File:** `client/components/voucher-modal.js`

### Issue Description
The voucher edit modal directly inserts user data into innerHTML without XSS sanitization. User-controlled values like party names, narration, and amounts are rendered without escaping, creating a potential cross-site scripting (XSS) vulnerability.

### Affected Code Examples
- Line 102: `<span id="summary-type" class="text-sm font-medium text-gray-900">${voucher.voucher_type || '-'}</span>`
- Line 106: `<span id="summary-party" class="text-sm font-medium text-gray-900">${voucher.party_name || '-'}</span>`
- Line 110: `<span id="summary-amount" class="text-sm font-medium text-gray-900">${voucher.amount ? \`₹${parseFloat(voucher.amount).toFixed(2)}\` : '-'}</span>`
- Line 114: `<span id="summary-mode" class="text-sm font-medium text-gray-900">${voucher.payment_mode || '-'}</span>`
- Line 93: `<textarea id="narration" name="narration" rows="3" ...>${voucher.narration || ''}</textarea>`

### Recommended Fix
Add XSS sanitization function and apply to all user data:

```javascript
function esc(s) {
  return String(s ?? '').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
}

// Then use:
<span id="summary-party">${esc(voucher.party_name) || '-'}</span>
```

---

## Bug #2: Inconsistent XSS Protection Functions

**Severity:** Medium  
**Files:** Multiple accounting files

### Issue Description
Different accounting pages use different XSS protection function names, making the codebase inconsistent and harder to maintain:

| File | Function Name |
|------|---------------|
| `account-details.js` | `escHtml()` |
| `general-ledger.js` | `escHtml()` |
| `trial-balance.js` | `escHtml()` |
| `journal-entries.js` | `esc()` |
| `vouchers.js` | `esc()` |
| `new-journal-entry.js` | `escapeHtmlAttr()` |
| `bank-accounts.js` | `escapeHtml()` |
| `profit-loss.js` | `escH()` |
| `voucher-modal.js` | **NONE** |

### Recommended Fix
Standardize on a single XSS protection function across all accounting files. Suggest using `esc()` as the standard name.

---

## Bug #3: Inconsistent Error Handling (alert() vs Toast)

**Severity:** Medium  
**Files:** Multiple accounting files

### Issue Description
Some pages use browser `alert()` for error messages while others use custom toast notifications. This creates an inconsistent user experience.

### Affected Files
- `new-voucher.js`: Uses `alert()` for validation errors (lines 235, 240, 245, 250, 257, 276, 280)
- `voucher-modal.js`: Uses `alert()` for validation errors (lines 266, 271, 276, 281, 288, 314, 318)
- `trial-balance.js`: Uses `alert()` for PDF export errors (line 171)
- `account-details.js`: Uses `alert()` for PDF export errors (line 171)
- `general-ledger.js`: Uses `alert()` for PDF export errors (line 149)
- `journal-entries.js`: Uses custom toast notifications
- `vouchers.js`: Uses custom toast notifications

### Recommended Fix
Replace all `alert()` calls with toast notifications for consistency:

```javascript
// Instead of:
alert('Please select a party');

// Use:
showToast('Please select a party', 'error');
```

---

## Bug #4: Inconsistent Number Formatting

**Severity:** Low  
**Files:** Multiple accounting files

### Issue Description
Different pages use different number formatting approaches:

| File | Function | Format |
|------|----------|--------|
| `journal-entries.js` | `fmtINR()` | `₹\u202f1,234.56` |
| `vouchers.js` | `fmt()` | `1,234.56` (no ₹ symbol) |
| `account-details.js` | `fmt()` | `1,234.56` (no ₹ symbol) |
| `general-ledger.js` | `fmt()` | `1,234.56` (no ₹ symbol) |
| `trial-balance.js` | `fmt()` | `1,234.56` (no ₹ symbol) |
| `profit-loss.js` | `fmtC()` | `₹1,234.56` |

### Recommended Fix
Standardize on `fmtINR()` function that includes the ₹ symbol for all currency displays.

---

## Bug #5: Inconsistent Date Formatting

**Severity:** Low  
**Files:** Multiple accounting files

### Issue Description
Different pages use different date formatting approaches:

| File | Function | Format |
|------|----------|--------|
| `journal-entries.js` | `fmtDate()` | `28 Mar 2026` |
| `vouchers.js` | `fmtDate()` | `28 Mar 2026` |
| `account-details.js` | `fmtDate()` | `28 Mar 2026` |
| `new-journal-entry.js` | None | Uses raw date input |
| `new-voucher.js` | None | Uses raw date input |

### Recommended Fix
Standardize on `fmtDate()` function across all pages that display dates.

---

## Bug #6: Missing Loading States in Some Pages

**Severity:** Low  
**Files:** `new-voucher.js`, `voucher-modal.js`

### Issue Description
Some pages don't show loading states while data is being fetched:

- `new-voucher.js`: No loading indicator while parties and bank accounts are being loaded
- `voucher-modal.js`: Shows "Loading parties..." text but no spinner

### Recommended Fix
Add loading spinners for async operations:

```javascript
partySelect.innerHTML = '<option value="">Loading parties...</option>';
// Add spinner icon next to dropdown
```

---

## Bug #7: Inconsistent Button Styles

**Severity:** Low  
**Files:** Multiple accounting files

### Issue Description
Button styles vary across different pages:

| File | Primary Button Style |
|------|---------------------|
| `journal-entries.js` | `rounded-xl bg-blue-600` |
| `vouchers.js` | `rounded-xl bg-emerald-600` |
| `new-voucher.js` | `rounded-lg bg-green-600` |
| `bank-accounts.js` | `rounded-xl bg-emerald-600` |
| `trial-balance.js` | `rounded-xl bg-purple-600` |
| `account-details.js` | `rounded-xl bg-purple-600` |

### Recommended Fix
Standardize button styles across all accounting pages.

---

## Bug #8: Missing Form Validation Feedback

**Severity:** Medium  
**Files:** `new-voucher.js`, `voucher-modal.js`

### Issue Description
Form validation only shows generic alert messages without highlighting the specific fields that need attention. Users must read the error message and manually locate the field.

### Current Behavior
```javascript
if (!voucherData.party_id) {
  alert('Please select a party');
  return;
}
```

### Recommended Fix
Add visual feedback to invalid fields:

```javascript
if (!voucherData.party_id) {
  partySelect.classList.add('border-red-500', 'ring-red-200');
  showToast('Please select a party', 'error');
  return;
}
partySelect.classList.remove('border-red-500', 'ring-red-200');
```

---

## Bug #9: Inconsistent Table Styling

**Severity:** Low  
**Files:** Multiple accounting files

### Issue Description
Table styles vary across different pages:

| File | Header Style | Cell Padding |
|------|--------------|--------------|
| `journal-entries.js` | `bg-gray-50` | `px-5 py-4` |
| `vouchers.js` | `bg-gray-50` | `px-4 py-2.5` |
| `general-ledger.js` | `bg-gray-50` | `px-4 py-2.5` |
| `trial-balance.js` | `bg-gray-50` | `px-4 py-2.5` |
| `account-details.js` | `bg-gray-50` | `px-4 py-2.5` |

### Recommended Fix
Standardize table styling across all accounting pages.

---

## Bug #10: Missing Keyboard Navigation Support

**Severity:** Medium  
**Files:** Multiple accounting files

### Issue Description
Modal dialogs and forms lack proper keyboard navigation:

- `voucher-modal.js`: Escape key doesn't close modal
- `journal-entries.js`: Delete confirmation modal doesn't support Escape key
- Forms don't support Enter key to submit

### Recommended Fix
Add keyboard event listeners:

```javascript
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Enter' && e.ctrlKey) handleSubmit();
});
```

---

## Bug #11: Inconsistent Modal Close Behavior

**Severity:** Low  
**Files:** `voucher-modal.js`, `journal-entries.js`

### Issue Description
Modal close behavior is inconsistent:

- `voucher-modal.js`: Closes on backdrop click and close button
- `journal-entries.js`: Delete modal closes on backdrop click and cancel button

### Recommended Fix
Standardize modal close behavior across all modals.

---

## Bug #12: Missing Confirmation for Destructive Actions

**Severity:** Medium  
**Files:** `vouchers.js`

### Issue Description
The voucher delete action uses a simple `confirm()` dialog which can be accidentally dismissed. More destructive actions should have clearer confirmation.

### Current Code (line 254)
```javascript
if (!confirm('Delete this voucher?')) return;
```

### Recommended Fix
Use a custom confirmation modal with clearer messaging, similar to the journal entries delete modal.

---

## Bug #13: Inconsistent Pagination Implementation

**Severity:** Low  
**Files:** `journal-entries.js`, `vouchers.js`

### Issue Description
Pagination implementations differ:

- `journal-entries.js`: Shows "Page X of Y" with first/prev/next/last buttons
- `vouchers.js`: Shows "Page X of Y" with first/prev/next/last buttons
- Both use different button styling

### Recommended Fix
Create a shared pagination component for consistency.

---

## Bug #14: Missing Search on Some List Pages

**Severity:** Low  
**Files:** `general-ledger.js`, `trial-balance.js`

### Issue Description
Some list pages don't have search functionality:

- `general-ledger.js`: No search input
- `trial-balance.js`: No search input

### Recommended Fix
Add search functionality to all list pages for consistency.

---

## Bug #15: Inconsistent Filter Reset Behavior

**Severity:** Low  
**Files:** Multiple accounting files

### Issue Description
Filter reset behavior varies:

- `journal-entries.js`: Clear button resets all filters
- `vouchers.js`: Clear button resets all filters
- `trial-balance.js`: Clear button resets date filters
- `general-ledger.js`: Clear button resets date filters

### Recommended Fix
Standardize filter reset behavior across all pages.

---

## Summary

| Bug | Severity | File | Status |
|-----|----------|------|--------|
| Missing XSS in voucher modal | High | `voucher-modal.js` | Needs Fix |
| Inconsistent XSS functions | Medium | Multiple files | Needs Fix |
| Inconsistent error handling | Medium | Multiple files | Needs Fix |
| Inconsistent number formatting | Low | Multiple files | Needs Fix |
| Inconsistent date formatting | Low | Multiple files | Needs Fix |
| Missing loading states | Low | `new-voucher.js`, `voucher-modal.js` | Needs Fix |
| Inconsistent button styles | Low | Multiple files | Needs Fix |
| Missing form validation feedback | Medium | `new-voucher.js`, `voucher-modal.js` | Needs Fix |
| Inconsistent table styling | Low | Multiple files | Needs Fix |
| Missing keyboard navigation | Medium | Multiple files | Needs Fix |
| Inconsistent modal behavior | Low | Multiple files | Needs Fix |
| Missing confirmation dialogs | Medium | `vouchers.js` | Needs Fix |
| Inconsistent pagination | Low | Multiple files | Needs Fix |
| Missing search on some pages | Low | Multiple files | Needs Fix |
| Inconsistent filter reset | Low | Multiple files | Needs Fix |

---

## Priority Recommendations

### High Priority
1. Fix XSS vulnerability in voucher modal (Bug #1)
2. Standardize XSS protection functions (Bug #2)
3. Replace alert() with toast notifications (Bug #3)
4. Add form validation feedback (Bug #8)
5. Add keyboard navigation support (Bug #10)

### Medium Priority
6. Standardize number formatting (Bug #4)
7. Add confirmation for destructive actions (Bug #12)
8. Standardize date formatting (Bug #5)

### Low Priority
9. Add loading states (Bug #6)
10. Standardize button styles (Bug #7)
11. Standardize table styling (Bug #9)
12. Standardize modal behavior (Bug #11)
13. Standardize pagination (Bug #13)
14. Add search to all list pages (Bug #14)
15. Standardize filter reset (Bug #15)

---

*Report generated by UI Bug Analysis Tool*
