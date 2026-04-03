import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api } from '../../utils/api.js';

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const fmtINR = (n) =>
  '₹\u202f' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

function showToast(message, type = 'success') {
  const existing = document.getElementById('cb-toast');
  if (existing) existing.remove();
  const colors = { 
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800', 
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };
  const el = document.createElement('div');
  el.id = 'cb-toast';
  el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 border rounded-xl px-5 py-3 shadow-lg text-sm font-medium ${colors[type] || colors.success}`;
  el.innerHTML = `<span>${esc(message)}</span><button onclick="this.parentElement.remove()" class="ml-2 opacity-60 hover:opacity-100">&times;</button>`;
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 4000);
}

export async function renderClosingBalances(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const shell = `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-4">

      <!-- Header -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Accounting</p>
          <h1 class="mt-0.5 text-xl font-black tracking-tight text-gray-900">Closing Balances</h1>
          <p class="text-xs text-gray-500 mt-0.5">View and manage period-end closing balances</p>
        </div>
        <div class="flex gap-2">
          <button id="quick-generate-btn"
                  class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Generate Today
          </button>
          <button id="bulk-generate-btn"
                  class="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Custom Date
          </button>
        </div>
      </div>

      <!-- Info Banner -->
      <div class="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
        <p class="font-bold mb-1">📋 About Closing Balances</p>
        <p>Closing balances are automatically calculated at period-end from opening balances and all transactions (receipts, payments, journal entries, bills). They are locked and cannot be edited. These become the opening balances for the next period.</p>
      </div>

      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div class="relative flex-1 min-w-[240px]">
          <span class="absolute inset-y-0 left-3 flex items-center text-gray-400">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </span>
          <input id="search-input" type="text" placeholder="Search account heads..."
                 class="w-full rounded-xl border border-gray-100 bg-gray-50 pl-10 pr-4 py-2 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition">
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs font-bold uppercase tracking-wide text-gray-400">Date:</span>
          <input id="closing-date-filter" type="date"
                 class="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition">
        </div>

        <div class="flex items-center gap-2">
          <button id="apply-filter"
                  class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition">
            Apply
          </button>
          <button id="clear-filter"
                  class="rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition">
            Reset
          </button>
        </div>
      </div>

      <!-- Table -->
      <div id="table-wrap" class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div class="px-6 py-10 text-center text-sm font-bold text-gray-500">Loading...</div>
      </div>

    </div>
  `;

  renderLayout(shell, router);

  const searchEl = document.getElementById('search-input');
  const dateEl = document.getElementById('closing-date-filter');
  let allRecords = [];

  async function loadData() {
    const qs = new URLSearchParams();
    if (dateEl.value) qs.set('closing_date', dateEl.value);
    if (searchEl.value) qs.set('search', searchEl.value);

    try {
      const result = await api.get(`/api/ledger/closing-balances${qs.toString() ? '?' + qs : ''}`);
      allRecords = result.records || [];
      renderTable(allRecords);
    } catch (err) {
      document.getElementById('table-wrap').innerHTML =
        `<div class="px-6 py-10 text-center text-sm font-bold text-red-600">Failed to load: ${esc(err.message)}</div>`;
    }
  }

  function renderTable(records) {
    if (!records.length) {
      document.getElementById('table-wrap').innerHTML =
        `<div class="px-6 py-12 text-center text-sm font-bold text-gray-500">No closing balances found. Generate closing balances to get started.</div>`;
      return;
    }

    const totalDebits = records.reduce((s, r) => s + (r.debit_amount || 0), 0);
    const totalCredits = records.reduce((s, r) => s + (r.credit_amount || 0), 0);

    document.getElementById('table-wrap').innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100 bg-slate-50 text-left">
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Account Head</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Type</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Closing Date</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Debit</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Credit</th>
              <th class="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            ${records.map(r => `
              <tr class="hover:bg-slate-50/50 transition duration-200">
                <td class="px-5 py-4 font-bold text-slate-900">${esc(r.account_head)}</td>
                <td class="px-5 py-4">
                  <span class="rounded-lg bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                    ${esc(r.account_type)}
                  </span>
                </td>
                <td class="px-5 py-4 text-sm text-gray-600">${esc(r.closing_date)}</td>
                <td class="px-5 py-4 text-right font-black text-emerald-600">${fmtINR(r.debit_amount || 0)}</td>
                <td class="px-5 py-4 text-right font-black text-rose-600">${fmtINR(r.credit_amount || 0)}</td>
                <td class="px-5 py-4 flex items-center gap-2">
                  <button class="view-cb-btn text-emerald-600 hover:text-emerald-700 font-bold text-sm" data-id="${esc(r._id)}">View</button>
                  <button class="delete-cb-btn text-red-600 hover:text-red-700 font-bold text-sm" data-id="${esc(r._id)}">Delete</button>
                </td>
              </tr>
            `).join('')}
            <tr class="border-t-2 border-slate-200 bg-slate-50/50 font-black">
              <td colspan="3" class="px-5 py-5 text-[10px] uppercase tracking-widest text-slate-700">Totals</td>
              <td class="px-5 py-5 text-right text-emerald-600">${fmtINR(totalDebits)}</td>
              <td class="px-5 py-5 text-right text-rose-600">${fmtINR(totalCredits)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    // Attach event listeners
    document.querySelectorAll('.view-cb-btn').forEach(btn => {
      btn.addEventListener('click', () => openViewModal(btn.dataset.id));
    });

    document.querySelectorAll('.delete-cb-btn').forEach(btn => {
      btn.addEventListener('click', () => openDeleteConfirm(btn.dataset.id));
    });
  }

  function openViewModal(id) {
    const record = allRecords.find(r => r._id === id);
    if (!record) return;

    const modal = document.createElement('div');
    modal.id = 'view-cb-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4">
        <h2 class="text-lg font-black text-gray-900">Closing Balance Details</h2>
        <div class="space-y-3 bg-slate-50 rounded-lg p-4">
          <div class="flex justify-between items-center">
            <span class="text-xs font-bold uppercase tracking-wide text-gray-600">Account Head</span>
            <span class="text-sm font-bold text-gray-900">${esc(record.account_head)}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-xs font-bold uppercase tracking-wide text-gray-600">Account Type</span>
            <span class="text-sm font-bold text-emerald-600">${esc(record.account_type)}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-xs font-bold uppercase tracking-wide text-gray-600">Closing Date</span>
            <span class="text-sm font-bold text-gray-900">${esc(record.closing_date)}</span>
          </div>
          <div class="border-t border-gray-200 pt-3 mt-3">
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs font-bold uppercase tracking-wide text-gray-600">Debit</span>
              <span class="text-sm font-bold text-emerald-600">${fmtINR(record.debit_amount || 0)}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs font-bold uppercase tracking-wide text-gray-600">Credit</span>
              <span class="text-sm font-bold text-rose-600">${fmtINR(record.credit_amount || 0)}</span>
            </div>
          </div>
          <div class="border-t border-gray-200 pt-3 mt-3">
            <span class="text-xs font-bold uppercase tracking-wide text-gray-600">Narration</span>
            <p class="text-sm text-gray-700 mt-1">${esc(record.narration)}</p>
          </div>
          <div class="border-t border-gray-200 pt-3 mt-3">
            <span class="text-xs font-bold uppercase tracking-wide text-gray-600">Status</span>
            <p class="text-sm font-bold mt-1">
              <span class="rounded-lg bg-blue-50 border border-blue-100 text-blue-700 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
                🔒 Locked (Auto-generated)
              </span>
            </p>
          </div>
        </div>
        <div class="flex gap-3 pt-4">
          <button id="view-cb-close" class="flex-1 rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('view-cb-close').addEventListener('click', () => modal.remove());
  }

  function openDeleteConfirm(id) {
    const record = allRecords.find(r => r._id === id);
    if (!record) return;

    const modal = document.createElement('div');
    modal.id = 'delete-cb-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 space-y-4">
        <h2 class="text-lg font-black text-gray-900">Delete Closing Balance?</h2>
        <p class="text-sm text-gray-600">Are you sure you want to delete the closing balance for <strong>${esc(record.account_head)}</strong> on ${esc(record.closing_date)}? This action cannot be undone.</p>
        <div class="flex gap-3 pt-4">
          <button id="delete-cb-cancel" class="flex-1 rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition">Cancel</button>
          <button id="delete-cb-confirm" class="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition">Delete</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('delete-cb-cancel').addEventListener('click', () => modal.remove());
    document.getElementById('delete-cb-confirm').addEventListener('click', async () => {
      try {
        await api.delete(`/api/ledger/closing-balances/${id}`);
        modal.remove();
        showToast('Closing balance deleted successfully', 'success');
        loadData();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    });
  }

  function openBulkGenerateModal() {
    const today = new Date().toISOString().split('T')[0];
    const modal = document.createElement('div');
    modal.id = 'bulk-generate-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4">
        <h2 class="text-lg font-black text-gray-900">Generate Closing Balances</h2>
        <p class="text-sm text-gray-600">Auto-generate closing balances for all accounts from opening date through the selected date. This will aggregate all opening balances and transactions.</p>
        
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Closing Date</label>
          <input id="bulk-closing-date" type="date" value="${today}"
                 class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition">
          <p class="text-xs text-gray-500 mt-1">Default: Today (${today})</p>
        </div>

        <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">
          <p class="font-bold mb-1">✅ What it does:</p>
          <ul class="list-disc list-inside space-y-1">
            <li>Calculates from opening balance date to selected date</li>
            <li>Includes all receipts, payments, bills, and journal entries</li>
            <li>Auto-generates for all accounts with activity</li>
            <li>Locks balances to prevent modification</li>
            <li>Skips accounts with no transactions</li>
          </ul>
        </div>

        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
          <p class="font-bold mb-1">💡 Note:</p>
          <p>Closing balances become opening balances for the next period. If you run this again for the same date, existing balances will be skipped.</p>
        </div>

        <div class="flex gap-3 pt-4">
          <button id="bulk-generate-cancel" class="flex-1 rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition">Cancel</button>
          <button id="bulk-generate-save" class="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition">Generate Now</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('bulk-generate-cancel').addEventListener('click', () => modal.remove());
    document.getElementById('bulk-generate-save').addEventListener('click', async () => {
      const closingDate = document.getElementById('bulk-closing-date').value.trim();

      if (!closingDate) return showToast('Closing date is required', 'error');

      try {
        const btn = document.getElementById('bulk-generate-save');
        btn.disabled = true;
        btn.textContent = 'Generating...';

        const result = await api.post('/api/ledger/closing-balances/bulk', {
          closing_date: closingDate,
        });

        modal.remove();
        showToast(`✅ ${result.created_count} closing balance(s) generated for ${result.closing_date}`, 'success');
        
        if (result.errors && result.errors.length > 0) {
          showToast(`⚠️ Warning: ${result.errors.length} account(s) had errors`, 'info');
          console.error('Errors:', result.errors);
        }

        loadData();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    });
  }

  document.getElementById('bulk-generate-btn').addEventListener('click', openBulkGenerateModal);
  document.getElementById('quick-generate-btn').addEventListener('click', async () => {
    // Auto-generate for today without showing modal
    const today = new Date().toISOString().split('T')[0];
    const btn = document.getElementById('quick-generate-btn');
    
    try {
      btn.disabled = true;
      btn.textContent = 'Generating...';

      const result = await api.post('/api/ledger/closing-balances/bulk', {
        closing_date: today,
      });

      showToast(`✅ ${result.created_count} closing balance(s) generated for ${result.closing_date}`, 'success');
      
      if (result.errors && result.errors.length > 0) {
        showToast(`⚠️ Warning: ${result.errors.length} account(s) had errors`, 'info');
      }

      loadData();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Today';
    }
  });
  document.getElementById('apply-filter').addEventListener('click', loadData);
  document.getElementById('clear-filter').addEventListener('click', () => {
    searchEl.value = '';
    dateEl.value = '';
    loadData();
  });
  searchEl.addEventListener('input', loadData);

  loadData();
}
