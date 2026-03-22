import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api, fetchWithCSRF } from '../../utils/api.js';
import { openVoucherModal } from '../../components/voucher-modal.js';

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

function showToast(msg, type = 'success') {
  const existing = document.getElementById('v-toast');
  if (existing) existing.remove();
  const colors = { success: 'bg-emerald-50 border-emerald-200 text-emerald-800', error: 'bg-red-50 border-red-200 text-red-800' };
  const el = document.createElement('div');
  el.id = 'v-toast';
  el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 border rounded-xl px-5 py-3 shadow-lg text-sm font-medium ${colors[type] || colors.success}`;
  el.innerHTML = `<span>${esc(msg)}</span><button onclick="this.parentElement.remove()" class="ml-2 opacity-60 hover:opacity-100">&times;</button>`;
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 4000);
}

export async function renderVouchers(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const shell = `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-4">

      <!-- Header -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Accounting</p>
          <h1 class="mt-0.5 text-xl font-black tracking-tight text-gray-900">Vouchers</h1>
          <p class="text-xs text-gray-500 mt-0.5">Payment and receipt vouchers</p>
        </div>
        <div class="flex gap-2">
          <a href="/ledger/bank-accounts" data-navigo
             class="inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition">
            Bank Accounts
          </a>
          <button id="create-voucher-btn"
                  class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            New
          </button>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
        <!-- Search -->
        <div class="relative min-w-[160px]">
          <svg class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400"
               fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 0z"/>
          </svg>
          <input id="v-search" type="text" placeholder="Search vouchers…"
                 class="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition">
        </div>

        <!-- Type filter -->
        <select id="v-type"
                class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition">
          <option value="">All Types</option>
          <option value="RECEIPT">Receipt</option>
          <option value="PAYMENT">Payment</option>
        </select>

        <span class="text-xs text-gray-400 hidden sm:inline">|</span>

        <!-- Date range -->
        <input id="v-start-date" type="date"
               class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition">
        <span class="text-xs text-gray-400">to</span>
        <input id="v-end-date" type="date"
               class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition">

        <button id="v-apply"
                class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition">
          Apply
        </button>
        <button id="v-clear"
                class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">
          Clear
        </button>
      </div>

      <!-- Summary cards -->
      <div id="v-summary" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        ${skeletonCards(4)}
      </div>

      <!-- Table -->
      <div id="v-table-wrap" class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        ${skeletonTable()}
      </div>

      <!-- Pagination -->
      <div id="v-pagination" class="flex items-center justify-between text-sm text-gray-500"></div>

    </div>
    <div id="modal-container"></div>
  `;

  renderLayout(shell, router);

  let currentPage = 1;
  const LIMIT = 15;

  const searchEl    = document.getElementById('v-search');
  const typeEl      = document.getElementById('v-type');
  const startEl     = document.getElementById('v-start-date');
  const endEl       = document.getElementById('v-end-date');

  function buildQs() {
    const qs = new URLSearchParams();
    const s = searchEl.value.trim();
    const t = typeEl.value;
    const sd = startEl.value;
    const ed = endEl.value;
    if (s)  qs.set('search',      s);
    if (t)  qs.set('voucher_type', t);
    if (sd) qs.set('start_date',  sd);
    if (ed) qs.set('end_date',    ed);
    qs.set('page',  String(currentPage));
    qs.set('limit', String(LIMIT));
    return qs;
  }

  async function loadSummary() {
    try {
      const data = await api.get('/api/ledger/vouchers-summary');
      document.getElementById('v-summary').innerHTML = `
        <div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Receipts</p>
          <p class="mt-1 text-lg font-black text-emerald-600">₹${fmt(data.total_receipts || 0)}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Payments</p>
          <p class="mt-1 text-lg font-black text-red-600">₹${fmt(data.total_payments || 0)}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Net Position</p>
          <p class="mt-1 text-lg font-black ${(data.net_position || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}">
            ₹${fmt(Math.abs(data.net_position || 0))}
          </p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Last 30d Txns</p>
          <p class="mt-1 text-lg font-black text-gray-900">${data.recent_transactions_count ?? 0}</p>
        </div>
      `;
    } catch {
      document.getElementById('v-summary').innerHTML = '';
    }
  }

  async function loadVouchers() {
    const wrap = document.getElementById('v-table-wrap');
    wrap.innerHTML = skeletonTable();

    try {
      const data = await api.get('/api/ledger/vouchers?' + buildQs());
      const vouchers   = data.vouchers || [];
      const total      = data.total ?? 0;
      const totalPages = data.totalPages ?? 1;

      if (!vouchers.length) {
        wrap.innerHTML = `
          <div class="px-6 py-14 text-center space-y-2">
            <p class="text-sm font-semibold text-gray-600">No vouchers found</p>
            <p class="text-xs text-gray-400">Adjust filters or create a new voucher.</p>
          </div>`;
        renderPagination(currentPage, totalPages, total);
        return;
      }

      wrap.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50 text-left">
                <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Voucher No</th>
                <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Type</th>
                <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Date</th>
                <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Party</th>
                <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 text-right">Amount</th>
                <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Mode</th>
                <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 text-center">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${vouchers.map(v => {
                const isReceipt = v.voucher_type === 'RECEIPT';
                return `
                  <tr class="hover:bg-gray-50 transition">
                    <td class="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">${esc(v.voucher_no)}</td>
                    <td class="px-4 py-2.5">
                      <span class="rounded-full px-2 py-0.5 text-xs font-bold border
                        ${isReceipt ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}">
                        ${esc(v.voucher_type)}
                      </span>
                    </td>
                    <td class="px-4 py-2.5 text-gray-600 whitespace-nowrap">${fmtDate(v.transaction_date)}</td>
                    <td class="px-4 py-2.5 text-gray-700 max-w-[140px] truncate">${esc(v.party_name || '—')}</td>
                    <td class="px-4 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">₹${fmt(v.amount || 0)}</td>
                    <td class="px-4 py-2.5 text-gray-500 whitespace-nowrap">${esc(v.payment_mode || '—')}</td>
                    <td class="px-4 py-2.5 text-center">
                      <div class="flex justify-center gap-1.5">
                        <button class="view-voucher rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
                                data-id="${v.voucher_id}">View</button>
                        <button class="delete-voucher rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                                data-id="${v.voucher_id}">Delete</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      // View handlers
      wrap.querySelectorAll('.view-voucher').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            const voucher = await api.get(`/api/ledger/vouchers/${btn.dataset.id}`);
            openVoucherModal(voucher, {
              onUpdate: async () => {
                await loadSummary();
                await loadVouchers();
              },
            });
          } catch (err) {
            showToast('Error loading voucher: ' + err.message, 'error');
          }
        });
      });

      // Delete handlers
      wrap.querySelectorAll('.delete-voucher').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this voucher?')) return;
          try {
            const res = await fetchWithCSRF(`/api/ledger/vouchers/${btn.dataset.id}`, { method: 'DELETE' });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Failed to delete');
            showToast('Voucher deleted', 'success');
            await loadSummary();
            await loadVouchers();
          } catch (err) {
            showToast('Error: ' + err.message, 'error');
          }
        });
      });

      renderPagination(currentPage, totalPages, total);
    } catch (err) {
      wrap.innerHTML = `
        <div class="px-6 py-10 text-center">
          <p class="text-sm font-semibold text-red-600">Failed to load vouchers</p>
          <p class="text-xs text-gray-400 mt-1">${esc(err.message)}</p>
          <button id="v-retry" class="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700 transition">
            Retry
          </button>
        </div>`;
      document.getElementById('v-retry')?.addEventListener('click', loadVouchers);
    }
  }

  function renderPagination(page, totalPages, total) {
    const el = document.getElementById('v-pagination');
    if (!totalPages || totalPages <= 1) {
      el.innerHTML = `<span class="text-xs">${total} voucher${total !== 1 ? 's' : ''}</span>`;
      return;
    }
    const btn = (label, p, disabled) =>
      `<button class="px-3 py-1.5 rounded-lg border text-xs font-medium transition
        ${disabled ? 'border-gray-100 text-gray-300 cursor-not-allowed' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}"
        data-page="${p}" ${disabled ? 'disabled' : ''}>${label}</button>`;
    el.innerHTML = `
      <span class="text-xs">${total} vouchers &bull; Page ${page} of ${totalPages}</span>
      <div class="flex gap-1">
        ${btn('&laquo;', 1,         page === 1)}
        ${btn('&lsaquo;', page - 1, page === 1)}
        ${btn('&rsaquo;', page + 1, page === totalPages)}
        ${btn('&raquo;', totalPages, page === totalPages)}
      </div>`;
    el.querySelectorAll('button[data-page]').forEach(b => {
      b.addEventListener('click', () => { currentPage = parseInt(b.dataset.page); loadVouchers(); });
    });
  }

  // Wire events
  document.getElementById('create-voucher-btn').addEventListener('click', () => {
    router.navigate('/ledger/vouchers/new');
  });

  document.getElementById('v-apply').addEventListener('click', () => {
    currentPage = 1;
    loadVouchers();
  });

  document.getElementById('v-clear').addEventListener('click', () => {
    searchEl.value = '';
    typeEl.value   = '';
    startEl.value  = '';
    endEl.value    = '';
    currentPage    = 1;
    loadVouchers();
  });

  // Search on Enter
  searchEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { currentPage = 1; loadVouchers(); }
  });

  // Initial load
  loadSummary();
  loadVouchers();
}

/* ── skeleton helpers ── */

function skeletonCards(n) {
  return Array.from({ length: n }, () => `
    <div class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div class="h-2 w-16 animate-pulse rounded-full bg-gray-200"></div>
      <div class="mt-2 h-5 w-24 animate-pulse rounded-lg bg-gray-200"></div>
    </div>
  `).join('');
}

function skeletonTable() {
  return `
    <div class="divide-y divide-gray-100">
      <div class="grid grid-cols-7 gap-4 px-4 py-3 bg-gray-50">
        ${Array.from({ length: 7 }, () => '<div class="h-2.5 w-14 animate-pulse rounded-full bg-gray-200"></div>').join('')}
      </div>
      ${Array.from({ length: 5 }, () => `
        <div class="grid grid-cols-7 gap-4 px-4 py-3">
          ${Array.from({ length: 7 }, () => '<div class="h-2.5 w-20 animate-pulse rounded-full bg-gray-100"></div>').join('')}
        </div>
      `).join('')}
    </div>`;
}