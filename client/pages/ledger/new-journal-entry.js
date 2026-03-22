import { renderLayout } from '../../components/layout.js';
import { requireAuth }   from '../../middleware/authMiddleware.js';
import { api }           from '../../utils/api.js';

/* ── Account type auto-detection from name keywords ─────────────── */
// BUG 21 FIX: infer account type from the typed name
function guessAccountType(name) {
  const n = (name || '').toLowerCase();
  if (/\bcash\b/.test(n))                                return 'CASH';
  if (/bank|hdfc|sbi|icici|axis|kotak|yes bank/.test(n)) return 'BANK';
  if (/debtor|receivable|customer/.test(n))               return 'DEBTOR';
  if (/creditor|payable|supplier|vendor/.test(n))         return 'CREDITOR';
  return 'GENERAL';
}

const ACCOUNT_TYPES = [
  { value: 'GENERAL',  label: 'General'  },
  { value: 'CASH',     label: 'Cash'     },
  { value: 'BANK',     label: 'Bank'     },
  { value: 'DEBTOR',   label: 'Debtor'   },
  { value: 'CREDITOR', label: 'Creditor' },
];

const fmtINR = (n) =>
  '₹\u202f' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

/* ── Main render ─────────────────────────────────────────────────── */

export async function renderNewJournalEntry(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = `
    <div class="max-w-5xl mx-auto px-4 py-10 space-y-6">

      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Accounting</p>
          <h1 class="mt-1 text-2xl font-black tracking-tight text-gray-900">New Journal Entry</h1>
          <p class="mt-1 text-sm text-gray-500">Double-entry — total debits must equal total credits</p>
        </div>
        <a href="/ledger/journal-entries" data-navigo
           class="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/>
          </svg>
          Back
        </a>
      </div>

      <!-- Form card -->
      <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

        <!-- Meta fields -->
        <div class="grid grid-cols-1 gap-5 border-b border-gray-100 bg-gray-50/60 px-6 py-5 sm:grid-cols-2">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Transaction Date *</label>
            <input type="date" id="je-date" required
                   class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Overall Narration</label>
            <input type="text" id="je-narration" placeholder="e.g. Salary payment for March 2025"
                   class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition">
          </div>
        </div>

        <!-- Lines header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 class="text-sm font-bold text-gray-900">Journal Lines</h3>
            <p class="text-xs text-gray-400 mt-0.5">Minimum 2 lines required &bull; Each line is either DR or CR</p>
          </div>
          <button type="button" id="add-line-btn"
                  class="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            Add Line
          </button>
        </div>

        <!-- Lines list -->
        <div id="je-lines" class="divide-y divide-gray-100 px-6"></div>

        <!-- Global error -->
        <div id="je-error" class="hidden mx-6 mb-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium"></div>

        <!-- Balance bar -->
        <div class="mx-6 mb-4 mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
          <div class="grid grid-cols-3 gap-4 text-center">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Total Debits</p>
              <p id="tot-dr" class="mt-1 text-xl font-black text-emerald-600">₹\u202f0.00</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Difference</p>
              <p id="tot-diff" class="mt-1 text-xl font-black text-gray-800">₹\u202f0.00</p>
              <p id="tot-status" class="text-[10px] font-bold mt-0.5 text-emerald-500">Balanced ✓</p>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Total Credits</p>
              <p id="tot-cr" class="mt-1 text-xl font-black text-red-600">₹\u202f0.00</p>
            </div>
          </div>
        </div>

        <!-- Submit -->
        <div class="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/60 px-6 py-4">
          <a href="/ledger/journal-entries" data-navigo
             class="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition">
            Cancel
          </a>
          <button type="button" id="je-save-btn"
                  class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  disabled>
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
            </svg>
            Save Journal Entry
          </button>
        </div>
      </div>
    </div>
  `;

  renderLayout(content, router);

  // BUG 16 FIX: renderLayout is synchronous DOM insertion — no setTimeout needed
  initForm(router);
}

/* ── Form controller ─────────────────────────────────────────────── */

function initForm(router) {
  const linesEl   = document.getElementById('je-lines');
  const saveBtn   = document.getElementById('je-save-btn');
  const errorEl   = document.getElementById('je-error');
  const dateEl    = document.getElementById('je-date');
  const narrationEl = document.getElementById('je-narration');

  // Defaults
  dateEl.value = new Date().toISOString().split('T')[0];

  let lineCounter = 0;
  let accountsCache = null;
  let accountTypesCache = null;

  async function getAccounts() {
    if (accountsCache !== null) return accountsCache;
    try {
      const res = await api.get('/api/ledger/accounts');
      // Handle every shape the server might return:
      // plain array, { accounts }, { data }, { result }, { ledgerAccounts }
      if (Array.isArray(res)) {
        accountsCache = res;
      } else if (res && typeof res === 'object') {
        accountsCache =
          res.accounts      ||
          res.data          ||
          res.result        ||
          res.ledgerAccounts||
          res.items         ||
          [];
        // Last resort: if still not an array, check every array-valued key
        if (!Array.isArray(accountsCache)) {
          const firstArray = Object.values(res).find(v => Array.isArray(v));
          accountsCache = firstArray || [];
        }
      } else {
        accountsCache = [];
      }
    } catch {
      accountsCache = [];
    }
    return accountsCache;
  }

  async function getAccountTypes() {
    if (accountTypesCache !== null) return accountTypesCache;

    let fromSummary = [];
    try {
      const res = await api.get('/api/ledger/account-types');
      if (Array.isArray(res)) {
        fromSummary = res;
      } else if (res && typeof res === 'object') {
        fromSummary =
          res.accountTypes ||
          res.account_types ||
          res.data ||
          res.result ||
          res.items ||
          [];

        if (!Array.isArray(fromSummary)) {
          const firstArray = Object.values(res).find(v => Array.isArray(v));
          fromSummary = firstArray || [];
        }
      }
    } catch {
      fromSummary = [];
    }

    const fromDB = fromSummary
      .map((entry) => String(entry?.account_type || '').trim().toUpperCase())
      .filter(Boolean);

    if (!fromDB.length) {
      const accounts = await getAccounts();
      fromDB.push(...accounts
        .map((account) => String(account?.account_type || '').trim().toUpperCase())
        .filter(Boolean));
    }

    const hardcoded = ACCOUNT_TYPES.map((type) => type.value);
    accountTypesCache = [...new Set([...fromDB, ...hardcoded])];
    return accountTypesCache;
  }

  // Start with 2 lines (minimum for double-entry)
  addLine();
  addLine();

  document.getElementById('add-line-btn').addEventListener('click', addLine);

  // BUG D FIX: single delegation handler covers BOTH remove and DR/CR toggle.
  // No direct per-button listeners anywhere — no stacking risk.
  linesEl.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.remove-line-btn');
    if (removeBtn) { removeLine(removeBtn.dataset.id); return; }

    const typeBtn = e.target.closest('.type-btn');
    if (typeBtn) {
      const row = typeBtn.closest('.je-line');
      if (row) { setToggle(row, typeBtn.dataset.type); updateBalance(); }
    }
  });

  linesEl.addEventListener('input', (e) => {
    // Auto-detect account type when user types in account head
    if (e.target.classList.contains('account-head-input')) {
      const row = e.target.closest('.je-line');
      if (!row) return;
      const typeInput = row.querySelector('.account-type-input');
      if (!typeInput) return;

      const typedHead = e.target.value.trim().toLowerCase();
      getAccounts().then((accounts) => {
        const matched = accounts.find((account) =>
          String(account?.account_head || '').trim().toLowerCase() === typedHead
        );
        const resolvedType = matched?.account_type || guessAccountType(e.target.value);
        setAccountTypeValue(typeInput, resolvedType);
      });
    }
    updateBalance();
  });

  linesEl.addEventListener('change', updateBalance);

  saveBtn.addEventListener('click', handleSubmit);

  /* ── setToggle — the ONLY place that touches toggle button classes ── */
  // Bugs A/B/C/F fix: never mutate className strings with regex.
  // Define a fixed BASE set of classes + two known active/inactive states.
  // The inactive button gets hover:bg-gray-50 back explicitly (Bug F fix).

  function setToggle(row, activeType) {
    row.querySelector('.line-type').value = activeType;
    const isDR = activeType === 'DR';
    row.querySelectorAll('.type-btn').forEach(b => {
      const isActive = b.dataset.type === activeType;
      // Reset to invariant base classes only — no regex, no leftover cruft
      b.className = 'type-btn px-3 py-2 transition text-xs font-bold';
      if (isActive) {
        b.classList.add(isDR ? 'bg-emerald-500' : 'bg-red-500', 'text-white');
      } else {
        b.classList.add('bg-white', 'text-gray-400', 'hover:bg-gray-50');
      }
    });
  }

  /* ── addLine ──────────────────────────────────────────────────── */

  async function addLine() {
    lineCounter++;
    const id = `ln-${lineCounter}`;

    const html = `
      <div class="je-line py-4" data-line-id="${id}">
        <div class="flex items-start gap-3">

          <!-- Line number -->
          <div class="mt-2.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 line-num"></div>

          <!-- DR / CR toggle -->
          <!-- BUG 18 FIX: single amount + type toggle instead of two separate fields -->
          <div class="flex flex-col gap-1 flex-shrink-0">
            <label class="text-[10px] font-bold uppercase tracking-wide text-gray-400 text-center">DR / CR</label>
            <div class="flex overflow-hidden rounded-xl border border-gray-200 text-xs font-bold">
              <button type="button" class="type-btn px-3 py-2 transition bg-emerald-500 text-white" data-type="DR">DR</button>
              <button type="button" class="type-btn px-3 py-2 transition bg-white text-gray-500 hover:bg-gray-50" data-type="CR">CR</button>
            </div>
            <input type="hidden" class="line-type" value="DR">
          </div>

          <!-- Account head -->
          <div class="flex-1 min-w-0">
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Account Head *</label>
            <div class="relative">
              <input type="text" class="account-head-input w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                     placeholder="Start typing account name…" autocomplete="off" list="${id}-datalist" required>
              <datalist id="${id}-datalist"></datalist>
            </div>
          </div>

          <!-- Account type -->
          <div class="w-32 flex-shrink-0">
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Acct Type</label>
            <select class="account-type-input w-full rounded-xl border border-gray-200 bg-white px-2 py-2.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition">
              <option value="GENERAL">GENERAL</option>
            </select>
          </div>

          <!-- Amount -->
          <div class="w-36 flex-shrink-0">
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Amount *</label>
            <input type="number" class="amount-input w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-right font-semibold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                   step="0.01" min="0.01" placeholder="0.00">
          </div>

          <!-- Narration -->
          <div class="flex-1 min-w-0">
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Line Narration</label>
            <input type="text" class="line-narration w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                   placeholder="Optional description…">
          </div>

          <!-- Remove -->
          <div class="mt-6 flex-shrink-0">
            <button type="button" class="remove-line-btn flex h-8 w-8 items-center justify-center rounded-xl text-gray-300 hover:bg-red-50 hover:text-red-500 transition" data-id="${id}" title="Remove line">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    linesEl.insertAdjacentHTML('beforeend', html);

    // Apply initial toggle state through setToggle so the first render
    // uses the same class path as every subsequent click (no divergence)
    const newRow = linesEl.querySelector(`[data-line-id="${id}"]`);
    setToggle(newRow, 'DR');

    renumberLines();
    updateBalance();

    // Populate both datalists from a single cached fetch
    Promise.all([getAccounts(), getAccountTypes()]).then(([accounts, types]) => {
      const headDl = document.getElementById(`${id}-datalist`);
      if (headDl) {
        headDl.innerHTML = accounts
          .map(a => `<option value="${String(a.account_head || '').replace(/"/g, '&quot;')}">`)
          .join('');
      }
      const typeSelect = newRow?.querySelector('.account-type-input');
      if (typeSelect) {
        typeSelect.innerHTML = types
          .map((type) => {
            const safeType = escapeHtmlAttr(String(type).trim().toUpperCase());
            return `<option value="${safeType}">${safeType}</option>`;
          })
          .join('');
        setAccountTypeValue(typeSelect, 'GENERAL');
      }
    });
  }

  /* ── removeLine ───────────────────────────────────────────────── */

  function removeLine(id) {
    const lineCount = linesEl.querySelectorAll('.je-line').length;
    if (lineCount <= 2) {
      showInlineError('At least 2 lines are required for a journal entry.');
      return;
    }
    const row = linesEl.querySelector(`[data-line-id="${id}"]`);
    if (row) row.remove();
    renumberLines();
    updateBalance();
  }

  /* ── BUG 19 FIX: renumber labels sequentially after any add/remove ── */

  function renumberLines() {
    linesEl.querySelectorAll('.je-line').forEach((row, i) => {
      const numEl = row.querySelector('.line-num');
      if (numEl) numEl.textContent = i + 1;
    });
  }

  /* ── updateBalance ────────────────────────────────────────────── */

  function updateBalance() {
    let dr = 0, cr = 0;
    linesEl.querySelectorAll('.je-line').forEach(row => {
      const type = row.querySelector('.line-type')?.value;
      const amt  = parseFloat(row.querySelector('.amount-input')?.value) || 0;
      if (type === 'DR') dr += amt;
      else               cr += amt;
    });

    const diff = Math.abs(dr - cr);
    const balanced = diff < 0.01 && dr > 0;

    document.getElementById('tot-dr').textContent   = fmtINR(dr);
    document.getElementById('tot-cr').textContent   = fmtINR(cr);
    document.getElementById('tot-diff').textContent = fmtINR(diff);

    const statusEl = document.getElementById('tot-status');
    if (balanced) {
      statusEl.textContent  = 'Balanced ✓';
      statusEl.className    = 'text-[10px] font-bold mt-0.5 text-emerald-600';
      document.getElementById('tot-diff').className = 'mt-1 text-xl font-black text-gray-800';
    } else if (dr === 0 && cr === 0) {
      statusEl.textContent  = 'Enter amounts';
      statusEl.className    = 'text-[10px] font-bold mt-0.5 text-gray-400';
      document.getElementById('tot-diff').className = 'mt-1 text-xl font-black text-gray-800';
    } else {
      const side = dr > cr ? 'DR heavy' : 'CR heavy';
      statusEl.textContent  = `Imbalanced (${side})`;
      statusEl.className    = 'text-[10px] font-bold mt-0.5 text-red-500';
      document.getElementById('tot-diff').className = 'mt-1 text-xl font-black text-red-600';
    }

    saveBtn.disabled = !balanced;
    clearInlineError();
  }

  /* ── Error helpers ────────────────────────────────────────────── */

  function showInlineError(msg) {
    // BUG 20 FIX: inline errors instead of alert()
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearInlineError() {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }

  /* ── handleSubmit ─────────────────────────────────────────────── */

  async function handleSubmit() {
    clearInlineError();

    const transactionDate = dateEl.value;
    const narration       = narrationEl.value.trim();

    if (!transactionDate) {
      showInlineError('Please select a transaction date.');
      return;
    }

    // BUG 14 FIX: named 'submitLines' to avoid shadowing outer scope
    const submitLines = [];
    let hasAccountError = false;

    linesEl.querySelectorAll('.je-line').forEach((row, i) => {
      const accountHead = row.querySelector('.account-head-input')?.value?.trim();
      const accountType = (row.querySelector('.account-type-input')?.value?.trim().toUpperCase()) || 'GENERAL';
      const type        = row.querySelector('.line-type')?.value;
      const amount      = parseFloat(row.querySelector('.amount-input')?.value) || 0;
      const lineNarr    = row.querySelector('.line-narration')?.value?.trim();

      if (!accountHead) {
        row.querySelector('.account-head-input').classList.add('border-red-400', 'ring-red-200');
        hasAccountError = true;
        return;
      }
      row.querySelector('.account-head-input').classList.remove('border-red-400', 'ring-red-200');

      if (amount > 0) {
        submitLines.push({
          account_head:  accountHead,
          account_type:  accountType,
          debit_amount:  type === 'DR' ? amount : 0,
          credit_amount: type === 'CR' ? amount : 0,
          narration:     lineNarr || narration || undefined,
        });
      }
    });

    if (hasAccountError) {
      showInlineError('Please fill in the account head for all lines.');
      return;
    }

    // BUG 17 FIX: enforce minimum 2 lines with amounts
    if (submitLines.length < 2) {
      showInlineError('At least 2 lines with amounts are required.');
      return;
    }

    const totDR = submitLines.reduce((s, l) => s + l.debit_amount,  0);
    const totCR = submitLines.reduce((s, l) => s + l.credit_amount, 0);
    if (Math.abs(totDR - totCR) >= 0.01) {
      showInlineError(`Entry is not balanced — Debits ${fmtINR(totDR)} vs Credits ${fmtINR(totCR)}.`);
      return;
    }

    saveBtn.disabled = true;
    const originalLabel = saveBtn.innerHTML;
    saveBtn.innerHTML = `
      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      Saving…`;

    try {
      const response = await api.post('/api/ledger/journal-entries', {
        entries:          submitLines,
        narration:        narration || undefined,
        transaction_date: transactionDate,
      });

      if (response.message || response.journalEntryNo) {
        router.navigate('/ledger/journal-entries');
      }
    } catch (err) {
      // BUG 20 FIX: inline error, not alert()
      showInlineError('Error saving entry: ' + (err.message || 'Unknown error'));
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalLabel;
    }
  }
}

function setAccountTypeValue(selectEl, value) {
  if (!selectEl) return;
  const normalizedValue = String(value || 'GENERAL').trim().toUpperCase() || 'GENERAL';
  const hasOption = Array.from(selectEl.options || []).some((option) => option.value === normalizedValue);

  if (!hasOption) {
    const option = document.createElement('option');
    option.value = normalizedValue;
    option.textContent = normalizedValue;
    selectEl.appendChild(option);
  }

  selectEl.value = normalizedValue;
}

function escapeHtmlAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
