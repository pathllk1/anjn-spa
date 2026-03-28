# Inventory System UI Bug Report

**Report Date:** March 26, 2026  
**System:** ANJN SPA Inventory Module  
**Status:** Open Issues Found

---

## Bug #1: Broken Navigation Link in Sales Edit Error Page

**Severity:** Medium  
**File:** `client/components/inventory/sls/index.js:89`

### Issue Description
When a sales bill fails to load in edit mode, the error page shows a "Back to Sales Report" button that links to `/inventory/sls-rpt`, but this route does not exist. The actual route is `/inventory/reports`.

### Current Code
```javascript
<button onclick="window.location.href='/inventory/sls-rpt'"
        class="px-4 py-2 bg-gray-600 text-white rounded shadow hover:bg-gray-700 transition">
    Back to Sales Report
</button>
```

### Expected Fix
```javascript
<button onclick="window.location.href='/inventory/reports'"
        class="px-4 py-2 bg-gray-600 text-white rounded shadow hover:bg-gray-700 transition">
    Back to Sales Report
</button>
```

---

## Bug #2: Missing FontAwesome Icon Library in Stock Management

**Severity:** Medium  
**File:** `client/components/inventory/stocks/index.js`
**Status:** ✅ FIXED

### Issue Description
The Stock Management system uses FontAwesome icon classes (`fas fa-*`) throughout the UI (e.g., `fa-boxes`, `fa-rupee-sign`, `fa-exclamation-triangle`), but FontAwesome is not loaded anywhere in the application. This results in broken icons showing as empty squares or text placeholders.

### Affected Code Examples
- Line 385: `<i class="fas fa-boxes text-blue-600"></i>`
- Line 396: `<i class="fas fa-rupee-sign text-green-600"></i>`
- Line 407: `<i class="fas fa-exclamation-triangle text-yellow-600"></i>`
- Line 418: `<i class="fas fa-weight text-purple-600"></i>`

### Fix Applied
Replaced all FontAwesome icons with Heroicons (inline SVGs) to match the rest of the application:
- `fa-boxes` → Archive Box icon
- `fa-rupee-sign` → Currency Rupee icon
- `fa-exclamation-triangle` → Exclamation Triangle icon
- `fa-weight` → Scale icon
- `fa-search` → Magnifying Glass icon
- `fa-plus` → Plus icon
- `fa-file-excel` → Document icon
- `fa-sync-alt` → Arrow Path icon
- `fa-chevron-left` → Chevron Left icon
- `fa-chevron-right` → Chevron Right icon
- `fa-th-large` → Squares 2x2 icon
- `fa-redo` → Arrow Path icon

**Fixed on:** March 28, 2026

---

## Bug #3: Missing Search Query Lowercase Conversion in Stock Filter

**Severity:** Low  
**File:** `client/components/inventory/stocks/index.js:289-295`

### Issue Description
The stock filter function compares the lowercase search term against unconverted stock properties, causing case-sensitive search to fail.

### Current Code
```javascript
if (state.searchQuery) {
    const searchMatch = 
        stock.item.toLowerCase().includes(state.searchQuery) ||
        (stock.batch && stock.batch.toLowerCase().includes(state.searchQuery)) ||
        (stock.hsn && stock.hsn.toLowerCase().includes(state.searchQuery)) ||
        (stock.oem && stock.oem.toLowerCase().includes(state.searchQuery));
    if (!searchMatch) return false;
}
```

### Expected Fix
```javascript
if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    const searchMatch = 
        stock.item.toLowerCase().includes(query) ||
        (stock.batch && stock.batch.toLowerCase().includes(query)) ||
        (stock.hsn && stock.hsn.toLowerCase().includes(query)) ||
        (stock.oem && stock.oem.toLowerCase().includes(query));
    if (!searchMatch) return false;
}
```

---

## Bug #4: Missing Party Selection Validation in Purchase/Sales Save

**Severity:** Medium  
**Files:** 
- `client/components/inventory/prs/index.js:520-522`
- `client/components/inventory/sls/index.js:519-521`

### Issue Description
While the code validates that a party is selected before saving, the error toast may not display if the toast notification system is not properly initialized. Additionally, the validation occurs after the spinner is shown, which can leave the UI in a loading state if validation fails early.

### Recommended Fix
Move validation before showing the save spinner:

```javascript
// Save
const saveBtn = document.getElementById('btn-save');
if (saveBtn) {
    saveBtn.onclick = async () => {
        // VALIDATE FIRST - before showing spinner
        if (state.cart.length === 0) {
            showToast('Cannot save an empty invoice. Please add items.', 'error');
            return;
        }
        if (!state.selectedParty) {
            showToast('Please select a party before saving.', 'error');
            return;
        }

        // THEN show spinner for actual save operation
        showSaveSpinner();
        // ... rest of save logic
    };
}
```

---

## Bug #5: Inventory Categories Page is Placeholder Only

**Severity:** Low  
**File:** `client/pages/inventory-categories.js`

### Issue Description
The Inventory Categories page (`/inventory/categories`) shows only a "Coming Soon" placeholder with no actual functionality. This is misleading to users who expect a working feature.

### Current Behavior
- Shows "Coming Soon" message
- No actual category management functionality
- Listed in dashboard navigation

### Suggested Actions
Either:
1. Remove from dashboard navigation until implemented, OR
2. Add proper category management functionality

---

## Bug #6: Stock Search Query Not Reset on Filter Change

**Severity:** Low  
**File:** `client/components/inventory/stocks/index.js:213-217`

### Issue Description
When changing the category filter, the search query is preserved but the current page is reset. This can lead to confusing UX where the user sees filtered results that don't match their search.

### Current Code
```javascript
document.getElementById('category-filter')?.addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    state.currentPage = 1; // Reset to first page
    updateDisplay();
});
```

### Recommended Enhancement
Consider clearing search when category changes, or ensure the combination works correctly:

```javascript
document.getElementById('category-filter')?.addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    state.currentPage = 1;
    // Optionally: state.searchQuery = '';
    updateDisplay();
});
```

---

## Bug #7: Missing Escape HTML in Stock Table Header Title Attribute

**Severity:** Low  
**File:** `client/components/inventory/prs/stockModal.js:118`

### Issue Description
The title attribute on the stock item div uses `escHtml()` but the title attribute itself may still break with special characters like quotes.

### Current Code
```javascript
<div class="truncate" title="${escHtml(stock.item)}">${escHtml(stock.item)}</div>
```

### Recommended Fix
Consider using a data attribute and setting title via JavaScript to avoid HTML attribute escaping issues:

```javascript
<div class="truncate stock-item-name" data-item-name="${escHtml(stock.item)}">${escHtml(stock.item)}</div>
```

Then set via JS:
```javascript
element.title = stock.item; // Browser handles escaping automatically
```

---

## Summary

| Bug | Severity | File | Status |
|-----|----------|------|--------|
| Broken sales report link | Medium | `sls/index.js` | Needs Fix |
| Missing FontAwesome icons | Medium | `stocks/index.js` | ✅ Fixed |
| Case-sensitive stock search | Low | `stocks/index.js` | Needs Fix |
| Validation timing issue | Medium | `prs/index.js`, `sls/index.js` | Needs Fix |
| Placeholder categories page | Low | `inventory-categories.js` | Needs Decision |
| Search/filter interaction | Low | `stocks/index.js` | Enhancement |
| Title attribute escaping | Low | `stockModal.js` | Enhancement |

---

*Report generated by UI Bug Analysis Tool*
