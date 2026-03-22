import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api } from '../../utils/api.js';

export async function renderAccountDetails(router, params) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const accountHead = decodeURIComponent(params.account_head);

  const shell = `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-4">

      <!-- Header -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Ledger</p>
          <h1 class="mt-0.5 text-xl font-black tracking-tight text-gray-900">${escHtml(accountHead)}</h1>
        </div>
        <button id="export-pdf-btn"
                class="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition">
          📥 Export PDF
        </button>
      </div>

      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
        <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">Date:</span>
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
      </div>

      <!-- Summary cards -->
      <div id="summary-cards" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        ${skeletonCards(3)}
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
    const url = `/api/ledger/account/${encodeURIComponent(accountHead)}${qs.toString() ? '?' + qs : ''}`;

    try {
      const records = (await api.get(url)) || [];

      let runningBalance = 0;
      const processed = records.map(r => {
        runningBalance += (r.debit_amount || 0) - (r.credit_amount || 0);
        return { ...r, running_balance: runningBalance };
      });
      processed.reverse();

      const totalDebits  = records.reduce((s, r) => s + (r.debit_amount  || 0), 0);
      const totalCredits = records.reduce((s, r) => s + (r.credit_amount || 0), 0);
      const closing      = runningBalance;

      document.getElementById('summary-cards').innerHTML = `
        <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Total Debits</p>
          <p class="mt-1.5 text-2xl font-black text-emerald-600">₹${fmt(totalDebits)}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Total Credits</p>
          <p class="mt-1.5 text-2xl font-black text-red-600">₹${fmt(totalCredits)}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Closing Balance</p>
          <p class="mt-1.5 text-2xl font-black ${closing >= 0 ? 'text-emerald-600' : 'text-red-600'}">
            ₹${fmt(Math.abs(closing))} <span class="text-base">${closing >= 0 ? 'DR' : 'CR'}</span>
          </p>
        </div>
      `;

      document.getElementById('table-wrap').innerHTML = processed.length
        ? `<div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200 bg-gray-50 text-left">
                  <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Date</th>
                  <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Voucher No</th>
                  <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Type</th>
                  <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Narration</th>
                  <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 text-right">Debit</th>
                  <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 text-right">Credit</th>
                  <th class="px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 text-right">Balance</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${processed.map(r => `
                  <tr class="hover:bg-gray-50 transition">
                    <td class="px-4 py-2.5 text-gray-600 whitespace-nowrap">${fmtDate(r.transaction_date)}</td>
                    <td class="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">${escHtml(r.voucher_no)}</td>
                    <td class="px-4 py-2.5">
                      <span class="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        ${escHtml(r.voucher_type)}
                      </span>
                    </td>
                    <td class="px-4 py-2.5 text-gray-500 max-w-[180px] truncate">${escHtml(r.narration || '—')}</td>
                    <td class="px-4 py-2.5 text-right font-semibold text-emerald-600">${r.debit_amount > 0 ? '₹' + fmt(r.debit_amount) : '—'}</td>
                    <td class="px-4 py-2.5 text-right font-semibold text-red-600">${r.credit_amount > 0 ? '₹' + fmt(r.credit_amount) : '—'}</td>
                    <td class="px-4 py-2.5 text-right font-bold whitespace-nowrap ${r.running_balance >= 0 ? 'text-emerald-600' : 'text-red-600'}">
                      ₹${fmt(Math.abs(r.running_balance))} ${r.running_balance >= 0 ? 'DR' : 'CR'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`
        : `<div class="px-6 py-12 text-center text-sm text-gray-500">No transactions found for the selected period.</div>`;

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
      const url = `/api/ledger/export/account-ledger/${encodeURIComponent(accountHead)}${qs.toString() ? '?' + qs : ''}`;
      const res = await fetch(url, { method: 'GET', credentials: 'include' });
      if (!res.ok) throw new Error(`Server error ${res.status}: ${await res.text()}`);
      const blob = await res.blob();
      const link = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: `Ledger_${accountHead}.pdf`,
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

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function skeletonCards(n) {
  return Array.from({ length: n }, () => `
    <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div class="h-2.5 w-20 animate-pulse rounded-full bg-gray-200"></div>
      <div class="mt-3 h-7 w-28 animate-pulse rounded-lg bg-gray-200"></div>
    </div>
  `).join('');
}

function skeletonTable() {
  return `
    <div class="divide-y divide-gray-100">
      <div class="grid grid-cols-7 gap-4 px-4 py-3 bg-gray-50">
        ${Array.from({ length: 7 }, () => '<div class="h-2.5 w-16 animate-pulse rounded-full bg-gray-200"></div>').join('')}
      </div>
      ${Array.from({ length: 5 }, () => `
        <div class="grid grid-cols-7 gap-4 px-4 py-3">
          ${Array.from({ length: 7 }, () => '<div class="h-2.5 w-20 animate-pulse rounded-full bg-gray-100"></div>').join('')}
        </div>
      `).join('')}
    </div>`;
}