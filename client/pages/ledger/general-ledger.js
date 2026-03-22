import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api } from '../../utils/api.js';

export async function renderGeneralLedger(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const shell = `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-4">

      <!-- Header -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Accounting</p>
          <h1 class="mt-0.5 text-xl font-black tracking-tight text-gray-900">General Ledger</h1>
          <p class="text-xs text-gray-500 mt-0.5">Complete ledger of all accounts and transactions</p>
        </div>
        <button id="export-pdf-btn"
                class="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition">
          📥 Export PDF
        </button>
      </div>

      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
        <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">Period:</span>
        <input id="start-date" type="date"
               class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition">
        <span class="text-xs text-gray-400">to</span>
        <input id="end-date" type="date"
               class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition">
        <button id="apply-filter"
                class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition">
          Apply
        </button>
        <button id="clear-filter"
                class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">
          Clear
        </button>
        <span id="account-count" class="ml-auto text-xs text-gray-400"></span>
      </div>

      <!-- Table -->
      <div id="table-wrap" class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        ${skeletonTable()}
      </div>

    </div>
  `;

  renderLayout(shell, router);

  const startEl = document.getElementById('start-date');
  const endEl   = document.getElementById('end-date');

  async function loadData() {
    const startDate = startEl.value;
    const endDate   = endEl.value;

    const qs = new URLSearchParams();
    if (startDate) qs.set('start_date', startDate);
    if (endDate)   qs.set('end_date', endDate);
    const url = `/api/ledger/accounts${qs.toString() ? '?' + qs : ''}`;

    try {
      const accounts = (await api.get(url)) || [];
      document.getElementById('account-count').textContent = `${accounts.length} account${accounts.length !== 1 ? 's' : ''}`;

      if (!accounts.length) {
        document.getElementById('table-wrap').innerHTML =
          `<div class="px-6 py-12 text-center text-sm text-gray-500">No accounts found for the selected period.</div>`;
        return;
      }

      document.getElementById('table-wrap').innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50 text-left">
                <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Account Head</th>
                <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Type</th>
                <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 text-right">Debits</th>
                <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 text-right">Credits</th>
                <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 text-right">Balance</th>
                <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 text-center">Detail</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${accounts.map(a => `
                <tr class="hover:bg-gray-50 transition">
                  <td class="px-4 py-2.5 font-medium text-gray-900">${escHtml(a.account_head)}</td>
                  <td class="px-4 py-2.5">
                    <span class="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      ${escHtml(a.account_type)}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-right font-semibold text-emerald-600">₹${fmt(a.total_debit || 0)}</td>
                  <td class="px-4 py-2.5 text-right font-semibold text-red-600">₹${fmt(a.total_credit || 0)}</td>
                  <td class="px-4 py-2.5 text-right font-bold whitespace-nowrap ${(a.balance || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}">
                    ₹${fmt(Math.abs(a.balance || 0))} ${(a.balance || 0) >= 0 ? 'DR' : 'CR'}
                  </td>
                  <td class="px-4 py-2.5 text-center">
                    <a href="/ledger/account/${encodeURIComponent(a.account_head)}" data-navigo
                       class="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition">
                      View
                    </a>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      router.updatePageLinks?.();
    } catch (err) {
      document.getElementById('table-wrap').innerHTML =
        `<div class="px-6 py-10 text-center text-sm font-semibold text-red-600">Failed to load: ${escHtml(err.message)}</div>`;
    }
  }

  document.getElementById('apply-filter').addEventListener('click', loadData);

  document.getElementById('clear-filter').addEventListener('click', () => {
    startEl.value = '';
    endEl.value   = '';
    loadData();
  });

  document.getElementById('export-pdf-btn').addEventListener('click', async () => {
    try {
      const qs = new URLSearchParams();
      if (startEl.value) qs.set('start_date', startEl.value);
      if (endEl.value)   qs.set('end_date',   endEl.value);
      const url = `/api/ledger/export/general-ledger${qs.toString() ? '?' + qs : ''}`;
      const res = await fetch(url, { method: 'GET', credentials: 'include' });
      if (!res.ok) throw new Error(`Server error ${res.status}: ${await res.text()}`);
      const blob = await res.blob();
      const link = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: `General_Ledger_${new Date().toISOString().slice(0,10)}.pdf`,
      });
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      alert('Error exporting PDF: ' + err.message);
    }
  });

  loadData();
}

/* ── helpers ── */

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(n) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));
}

function skeletonTable() {
  return `
    <div class="divide-y divide-gray-100">
      <div class="grid grid-cols-6 gap-4 px-4 py-3 bg-gray-50">
        ${Array.from({ length: 6 }, () => '<div class="h-2.5 w-16 animate-pulse rounded-full bg-gray-200"></div>').join('')}
      </div>
      ${Array.from({ length: 6 }, () => `
        <div class="grid grid-cols-6 gap-4 px-4 py-3">
          ${Array.from({ length: 6 }, () => '<div class="h-2.5 w-20 animate-pulse rounded-full bg-gray-100"></div>').join('')}
        </div>
      `).join('')}
    </div>`;
}