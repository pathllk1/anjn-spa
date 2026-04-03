import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { api } from '../utils/api.js';

let accountsCharts = [];
let chartScriptPromise = null;

const QUICK_ACTIONS = [
  {
    href: '/ledger/opening-balances',
    title: 'Opening Balances',
    subtitle: 'Set up initial account balances',
    tone: 'from-indigo-600 to-blue-500',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    `,
  },
  {
    href: '/ledger/closing-balances',
    title: 'Closing Balances',
    subtitle: 'Period-end balance summaries',
    tone: 'from-teal-600 to-cyan-500',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    `,
  },
  {
    href: '/ledger/manual-ledger',
    title: 'Manual Ledger',
    subtitle: 'Create arbitrary ledger entries',
    tone: 'from-cyan-600 to-teal-500',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    `,
  },
  {
    href: '/ledger/journal-entries',
    title: 'Journal Entries',
    subtitle: 'Manual accounting adjustments',
    tone: 'from-violet-600 to-purple-500',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    `,
  },
  {
    href: '/ledger/vouchers',
    title: 'Vouchers',
    subtitle: 'Receipts and payments',
    tone: 'from-emerald-600 to-green-500',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    `,
  },
  {
    href: '/ledger/bank-accounts',
    title: 'Bank Accounts',
    subtitle: 'Firm bank masters and defaults',
    tone: 'from-cyan-600 to-sky-500',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9h16.5m-16.5 6h16.5M6 4.5h12A1.5 1.5 0 0119.5 6v12A1.5 1.5 0 0118 19.5H6A1.5 1.5 0 014.5 18V6A1.5 1.5 0 016 4.5z" />
    `,
  },
  {
    href: '/ledger/trial-balance',
    title: 'Trial Balance',
    subtitle: 'Balance check and review',
    tone: 'from-amber-500 to-orange-500',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    `,
  },
  {
    href: '/ledger/general-ledger',
    title: 'General Ledger',
    subtitle: 'Complete ledger reporting',
    tone: 'from-rose-600 to-pink-500',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006.175 4.5M12 6.042A8.967 8.967 0 0118.825 4.5M12 6.042a8.968 8.968 0 016.175 1.542m-6.175-1.542a8.968 8.968 0 00-6.175 1.542m0 0A9 9 0 0112 3m0 0a9 9 0 019 9m-9 9a9 9 0 01-9-9m9 9a9 9 0 019-9" />
    `,
  },
  {
    href: '/ledger/profit-loss',
    title: 'Profit & Loss',
    subtitle: 'Income, COGS and net margin',
    tone: 'from-violet-600 to-indigo-600',
    icon: `
      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    `,
  },
];

export async function renderAccountsDashboard(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  destroyAccountsCharts();

  const content = `
    <div id="accounts-dashboard-page" class="relative min-h-[calc(100vh-6rem)] overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_22%),linear-gradient(180deg,_#f8fbff_0%,_#eef3ff_100%)]">
      <div class="pointer-events-none absolute inset-0 opacity-60">
        <div class="absolute -left-16 top-8 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl"></div>
        <div class="absolute right-0 top-0 h-64 w-64 rounded-full bg-sky-300/15 blur-3xl"></div>
        <div class="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-fuchsia-200/10 blur-3xl"></div>
      </div>
      <div class="relative p-4 md:p-5">
        <div id="accounts-dashboard-content">${renderLoadingState()}</div>
      </div>
    </div>
  `;

  renderLayout(content, router);
  await initializeAccountsDashboard(router);
}

async function initializeAccountsDashboard(router) {
  const mount = document.getElementById('accounts-dashboard-content');
  if (!mount) return;

  try {
    const raw = await loadAccountsData();
    const model = buildAccountsModel(raw);
    mount.innerHTML = renderDashboard(model);
    router.updatePageLinks();
    bindDashboardActions(router, model);
    await renderDashboardCharts(model);
  } catch (error) {
    console.error('[ACCOUNTS_DASHBOARD] Failed to initialize:', error);
    mount.innerHTML = renderErrorState(error.message);
    router.updatePageLinks();
    bindDashboardActions(router, null);
  }
}

function bindDashboardActions(router, model) {
  const refreshBtn = document.getElementById('accounts-dashboard-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const mount = document.getElementById('accounts-dashboard-content');
      if (!mount) return;
      destroyAccountsCharts();
      mount.innerHTML = renderLoadingState();
      try {
        const raw = await loadAccountsData();
        const model = buildAccountsModel(raw);
        mount.innerHTML = renderDashboard(model);
        router.updatePageLinks();
        bindDashboardActions(router, model);
        await renderDashboardCharts(model);
      } catch (error) {
        console.error('[ACCOUNTS_DASHBOARD] Refresh failed:', error);
        mount.innerHTML = renderErrorState(error.message);
        router.updatePageLinks();
        bindDashboardActions(router, null);
      }
    });
  }

  bindTableTabs();
  if (model) bindSubLedgerModal(model, router);
}

async function loadAccountsData() {
  const [accounts, accountTypes, vouchersSummary, journalSummary] = await Promise.all([
    api.get('/api/ledger/accounts'),
    api.get('/api/ledger/account-types'),
    api.get('/api/ledger/vouchers-summary'),
    api.get('/api/ledger/journal-entries-summary'),
  ]);

  return {
    accounts: Array.isArray(accounts) ? accounts : [],
    accountTypes: Array.isArray(accountTypes) ? accountTypes : [],
    vouchersSummary: vouchersSummary || {},
    journalSummary: journalSummary || {},
  };
}

function buildAccountsModel({ accounts, accountTypes, vouchersSummary, journalSummary }) {
  const normalizedAccounts = accounts.map((account) => {
    const totalDebit = toNumber(account.total_debit);
    const totalCredit = toNumber(account.total_credit);
    const balance = toNumber(account.balance);
    return {
      ...account,
      total_debit: totalDebit,
      total_credit: totalCredit,
      balance,
      absoluteBalance: Math.abs(balance),
      balanceLabel: balance >= 0 ? 'DR' : 'CR',
    };
  });

  const normalizedTypes = accountTypes.map((summary) => ({
    ...summary,
    account_count: toNumber(summary.account_count),
    total_debit: toNumber(summary.total_debit),
    total_credit: toNumber(summary.total_credit),
    total_balance: toNumber(summary.total_balance),
  }));

  const totalAccounts = normalizedAccounts.length;
  const totalDebit = normalizedAccounts.reduce((sum, account) => sum + account.total_debit, 0);
  const totalCredit = normalizedAccounts.reduce((sum, account) => sum + account.total_credit, 0);
  const netExposure = totalDebit - totalCredit;

  const largestDrAccounts = [...normalizedAccounts]
    .filter((account) => account.balance > 0)
    .sort((a, b) => b.absoluteBalance - a.absoluteBalance)
    .slice(0, 6);

  const largestCrAccounts = [...normalizedAccounts]
    .filter((account) => account.balance < 0)
    .sort((a, b) => b.absoluteBalance - a.absoluteBalance)
    .slice(0, 6);

  const typeLeaderboard = [...normalizedTypes]
    .sort((a, b) => Math.abs(b.total_balance) - Math.abs(a.total_balance))
    .slice(0, 6);

  const accountRows = [...normalizedAccounts]
    .sort((a, b) => b.absoluteBalance - a.absoluteBalance)
    .slice(0, 12);

  return {
    accounts: normalizedAccounts,
    accountTypes: normalizedTypes,
    vouchersSummary,
    journalSummary,
    totalAccounts,
    totalDebit,
    totalCredit,
    netExposure,
    largestDrAccounts,
    largestCrAccounts,
    typeLeaderboard,
    accountRows,
    compactStats: [
      {
        label: 'Ledger Accounts',
        value: formatCompactNumber(totalAccounts),
        meta: `${formatCompactNumber(normalizedTypes.length)} account types`,
        tone: 'from-sky-500 to-blue-600',
      },
      {
        label: 'Total Debit',
        value: formatCurrency(totalDebit),
        meta: `${formatCompactNumber(largestDrAccounts.length)} major debit heads`,
        tone: 'from-emerald-500 to-green-600',
      },
      {
        label: 'Total Credit',
        value: formatCurrency(totalCredit),
        meta: `${formatCompactNumber(largestCrAccounts.length)} major credit heads`,
        tone: 'from-rose-500 to-pink-600',
      },
      {
        label: 'Net Position',
        value: `${formatCurrency(Math.abs(netExposure))} ${netExposure >= 0 ? 'DR' : 'CR'}`,
        meta: 'Ledger-wide exposure',
        tone: 'from-violet-500 to-purple-600',
      },
      {
        label: 'Receipts',
        value: formatCurrency(vouchersSummary.total_receipts || 0),
        meta: `${formatCompactNumber(vouchersSummary.recent_transactions_count || 0)} recent voucher groups`,
        tone: 'from-teal-500 to-cyan-600',
      },
      {
        label: 'Journal Entries',
        value: formatCompactNumber(journalSummary.total_journal_entries || 0),
        meta: `${formatCompactNumber(journalSummary.recent_journal_entries_count || 0)} in last 30 days`,
        tone: 'from-amber-500 to-orange-600',
      },
    ],
  };
}

function renderDashboard(model) {
  return `
    <section class="space-y-4">
      <header class="rounded-[22px] border border-slate-200/80 bg-white/85 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.35)] backdrop-blur">
        <div class="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                Accounts Overview
              </span>
            </div>
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-400">Accounts Dashboard</p>
              <h1 class="mt-0.5 text-lg font-black tracking-tight text-slate-900 md:text-xl">Ledger, vouchers, balances, and account-type visibility</h1>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 self-stretch lg:w-[280px]">
            <button id="accounts-dashboard-refresh" type="button" class="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="h-3.5 w-3.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              Refresh
            </button>
            <a href="/ledger/general-ledger" data-navigo class="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="h-3.5 w-3.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006.175 4.5M12 6.042A8.967 8.967 0 0118.825 4.5M12 6.042a8.968 8.968 0 016.175 1.542m-6.175-1.542a8.968 8.968 0 00-6.175 1.542m0 0A9 9 0 0112 3m0 0a9 9 0 019 9m-9 9a9 9 0 01-9-9m9 9a9 9 0 019-9" />
              </svg>
              General Ledger
            </a>
            <div class="col-span-2 grid grid-cols-3 gap-1.5 rounded-[18px] border border-slate-200 bg-slate-50 p-1.5">
              <a href="/ledger/journal-entries/new" data-navigo class="rounded-xl bg-white px-2 py-2 text-center text-xs font-semibold text-violet-700 shadow-sm transition hover:bg-violet-50 whitespace-nowrap">New Journal</a>
              <a href="/ledger/vouchers/new" data-navigo class="rounded-xl bg-white px-2 py-2 text-center text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 whitespace-nowrap">New Voucher</a>
              <a href="/ledger/profit-loss" data-navigo class="rounded-xl bg-white px-2 py-2 text-center text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50">P&amp;L</a>
            </div>
          </div>
        </div>
      </header>

      <section class="grid gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        ${model.compactStats.map(renderStatCard).join('')}
      </section>

      <section class="grid gap-3 xl:grid-cols-[1.25fr_0.95fr]">
        <div class="space-y-3">
          <div class="rounded-[20px] border border-slate-200 bg-white/90 p-4 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.4)] backdrop-blur">
            <div class="mb-3">
              <p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Account Type Mix</p>
              <h2 class="mt-0.5 text-sm font-bold text-slate-900">Debit and credit by account type</h2>
            </div>
            <div class="h-[220px]">
              <canvas id="accounts-type-chart" class="h-full w-full"></canvas>
            </div>
          </div>

          <div class="rounded-[20px] border border-slate-200 bg-white/90 p-4 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.4)] backdrop-blur">
            <div class="mb-3">
              <p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Largest Balances</p>
              <h2 class="mt-0.5 text-sm font-bold text-slate-900">Top account exposure</h2>
            </div>
            <div class="h-[240px]">
              <canvas id="accounts-balance-chart" class="h-full w-full"></canvas>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <section class="rounded-[20px] border border-slate-200 bg-slate-900 p-4 text-white shadow-[0_12px_30px_-20px_rgba(2,6,23,0.6)]">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Voucher Pulse</p>
                <h2 class="mt-0.5 text-sm font-bold text-white">Recent transaction signals</h2>
              </div>
              <div class="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-right text-xs text-slate-300">
                <div class="text-[10px]">Net position</div>
                <div class="font-semibold text-white">${formatCurrency(model.vouchersSummary.net_position || 0)}</div>
              </div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              ${renderSignalCard('Receipts', formatCurrency(model.vouchersSummary.total_receipts || 0), 'Voucher summary', 'emerald')}
              ${renderSignalCard('Payments', formatCurrency(model.vouchersSummary.total_payments || 0), 'Voucher summary', 'rose')}
              ${renderSignalCard('Recent Vouchers', formatCompactNumber(model.vouchersSummary.recent_transactions_count || 0), 'Last 30 days', 'sky')}
              ${renderSignalCard('Recent Journals', formatCompactNumber(model.journalSummary.recent_journal_entries_count || 0), 'Last 30 days', 'amber')}
            </div>
          </section>

          <section class="rounded-[20px] border border-slate-200 bg-white/90 p-4 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.4)] backdrop-blur">
            <div class="mb-2.5 flex items-start justify-between gap-3">
              <div>
                <p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Account Types</p>
                <h2 class="mt-0.5 text-sm font-bold text-slate-900">Highest impact groups</h2>
              </div>
              <a href="/ledger/trial-balance" data-navigo class="text-xs font-semibold text-sky-700 hover:text-sky-900">Trial balance</a>
            </div>
            ${renderAccountTypes(model.typeLeaderboard)}
          </section>

          <section class="rounded-[20px] border border-slate-200 bg-white/90 p-4 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.4)] backdrop-blur">
            <div class="mb-2.5">
              <p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Quick Actions</p>
              <h2 class="mt-0.5 text-sm font-bold text-slate-900">Accounting workflow</h2>
            </div>
            <div class="grid gap-2 sm:grid-cols-2">
              ${QUICK_ACTIONS.map(renderQuickAction).join('')}
            </div>
          </section>
        </div>
      </section>

      <section class="rounded-[20px] border border-slate-200 bg-white/90 p-4 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.4)] backdrop-blur">
        <div class="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Ledger Tables</p>
            <h2 class="mt-0.5 text-sm font-bold text-slate-900">Account heads and account types</h2>
          </div>
          <a href="/ledger/general-ledger" data-navigo class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-200">Open full ledger</a>
        </div>
        <div class="mb-3 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            data-accounts-tab-button="account-heads"
            class="accounts-table-tab-button rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-700"
          >
            Account Heads
          </button>
          <button
            type="button"
            data-accounts-tab-button="account-types"
            class="accounts-table-tab-button rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition"
          >
            Account Types
          </button>
        </div>
        <div data-accounts-tab-panel="account-heads" class="hidden">
          ${renderAccountsTable(model.accountRows)}
        </div>
        <div data-accounts-tab-panel="account-types">
          ${renderAccountTypesTable(model.accountTypes)}
        </div>
      </section>

      <!-- Sub-ledger modal -->
      <div id="subleder-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4
           bg-slate-900/55 backdrop-blur-[6px]">
        <div class="relative flex flex-col w-full max-w-2xl max-h-[88vh] rounded-2xl bg-white shadow-[0_32px_80px_-12px_rgba(15,23,42,0.6)] overflow-hidden">

          <!-- Coloured header banner (bg set dynamically) -->
          <div id="subleder-header" class="flex-shrink-0 px-5 pt-5 pb-4">
            <div class="flex items-start justify-between gap-3">
              <div class="space-y-1">
                <div id="subleder-badge" class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em]"></div>
                <h2 id="subleder-title" class="text-xl font-black tracking-tight text-white leading-tight">—</h2>
              </div>
              <button id="subleder-close"
                      class="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 transition text-lg leading-none mt-0.5">
                &times;
              </button>
            </div>
          </div>

          <!-- Summary chips -->
          <div id="subleder-summary"
               class="flex-shrink-0 grid grid-cols-3 gap-2 bg-white px-5 py-3 border-b border-slate-100">
          </div>

          <!-- Table -->
          <div class="overflow-y-auto flex-1">
            <table class="w-full text-sm">
              <thead class="sticky top-0 z-10">
                <tr class="bg-slate-50 border-b border-slate-200">
                  <th class="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Account Head</th>
                  <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Debits</th>
                  <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Credits</th>
                  <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Balance</th>
                  <th class="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Detail</th>
                </tr>
              </thead>
              <tbody id="subleder-body" class="divide-y divide-slate-100 bg-white"></tbody>
            </table>
          </div>

          <!-- Footer totals bar -->
          <div id="subleder-footer"
               class="flex-shrink-0 rounded-b-2xl bg-slate-900 px-5 py-3">
          </div>

        </div>
      </div>
    </section>
  `;
}

function renderStatCard(stat) {
  return `
    <article class="overflow-hidden rounded-[18px] border border-white/70 bg-white/90 shadow-[0_10px_28px_-20px_rgba(15,23,42,0.5)] backdrop-blur">
      <div class="h-1 bg-gradient-to-r ${stat.tone}"></div>
      <div class="p-3">
        <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">${escapeHtml(stat.label)}</p>
        <div class="mt-1 text-base font-black tracking-tight text-slate-900">${escapeHtml(stat.value)}</div>
        <div class="mt-0.5 text-[10px] font-semibold text-slate-400">${escapeHtml(stat.meta)}</div>
      </div>
    </article>
  `;
}

function renderSignalCard(title, value, subtitle, tone) {
  const toneMap = {
    emerald: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
    rose: 'border-rose-400/30 bg-rose-500/10 text-rose-100',
    sky: 'border-sky-400/30 bg-sky-500/10 text-sky-100',
    amber: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
  };

  return `
    <div class="rounded-[22px] border ${toneMap[tone] || toneMap.sky} p-3">
      <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">${escapeHtml(title)}</div>
      <div class="mt-2 text-xl font-black tracking-tight text-white">${escapeHtml(value)}</div>
      <div class="mt-1 text-xs text-slate-300">${escapeHtml(subtitle)}</div>
    </div>
  `;
}

function renderAccountTypes(types) {
  if (!types.length) {
    return renderInlineEmpty('No account type summaries', 'Account-type analysis will populate as ledger activity grows.');
  }

  return `
    <div class="space-y-2">
      ${types.map((summary) => `
        <div class="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-slate-800">${escapeHtml(summary.account_type)}</div>
              <div class="mt-1 text-xs text-slate-500">${escapeHtml(formatCompactNumber(summary.account_count))} accounts</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-bold text-slate-900">${escapeHtml(formatCurrency(Math.abs(summary.total_balance)))}</div>
              <div class="text-[11px] ${summary.total_balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${summary.total_balance >= 0 ? 'Net DR' : 'Net CR'}</div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderQuickAction(action) {
  return `
    <a href="${action.href}" data-navigo class="group overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_16px_35px_-30px_rgba(15,23,42,0.5)] transition hover:-translate-y-0.5 hover:border-slate-300">
      <div class="bg-gradient-to-br ${action.tone} p-4 text-white">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-bold">${escapeHtml(action.title)}</div>
            <div class="mt-1 text-xs text-white/80">${escapeHtml(action.subtitle)}</div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor" class="h-6 w-6 transition group-hover:scale-110">
            ${action.icon}
          </svg>
        </div>
      </div>
      <div class="flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700">
        <span>Open</span>
        <span class="text-slate-400 transition group-hover:text-slate-700">&rarr;</span>
      </div>
    </a>
  `;
}

function renderAccountsTable(accounts) {
  if (!accounts.length) {
    return renderInlineEmpty('No ledger accounts found', 'Create journal entries or vouchers to populate the dashboard.');
  }

  return `
    <div class="overflow-x-auto rounded-[22px] border border-slate-100">
      <table class="min-w-full divide-y divide-slate-200">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Account Head</th>
            <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Type</th>
            <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Debit</th>
            <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Credit</th>
            <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Balance</th>
            <th class="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white">
          ${accounts.map((account) => `
            <tr class="hover:bg-slate-50">
              <td class="px-4 py-3 text-sm font-semibold text-slate-800">${escapeHtml(account.account_head)}</td>
              <td class="px-4 py-3 text-sm text-slate-600">
                <span class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">${escapeHtml(account.account_type)}</span>
              </td>
              <td class="px-4 py-3 text-right text-sm font-semibold text-emerald-600">${escapeHtml(formatCurrency(account.total_debit))}</td>
              <td class="px-4 py-3 text-right text-sm font-semibold text-rose-600">${escapeHtml(formatCurrency(account.total_credit))}</td>
              <td class="px-4 py-3 text-right text-sm font-bold ${account.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
                ${escapeHtml(formatCurrency(account.absoluteBalance))} ${escapeHtml(account.balanceLabel)}
              </td>
              <td class="px-4 py-3 text-center">
                <a href="/ledger/account/${encodeURIComponent(account.account_head)}" data-navigo class="inline-flex rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800">
                  View
                </a>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderAccountTypesTable(types) {
  if (!types.length) {
    return renderInlineEmpty('No account type summaries', 'Create journal entries or vouchers to populate the account-type table.');
  }

  return `
    <div class="overflow-x-auto rounded-[22px] border border-slate-100">
      <table class="min-w-full divide-y divide-slate-200">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Account Type</th>
            <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Accounts</th>
            <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Total Debit</th>
            <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Total Credit</th>
            <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Net Balance</th>
            <th class="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Sub-Ledger</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white">
          ${types.map((summary) => `
            <tr class="hover:bg-slate-50 cursor-pointer open-subleder-btn" data-type="${escapeHtml(summary.account_type)}">
              <td class="px-4 py-2.5 text-sm font-semibold text-slate-800">${escapeHtml(summary.account_type)}</td>
              <td class="px-4 py-2.5 text-right text-sm font-semibold text-slate-700">${escapeHtml(formatCompactNumber(summary.account_count))}</td>
              <td class="px-4 py-2.5 text-right text-sm font-semibold text-emerald-600">${escapeHtml(formatCurrency(summary.total_debit))}</td>
              <td class="px-4 py-2.5 text-right text-sm font-semibold text-rose-600">${escapeHtml(formatCurrency(summary.total_credit))}</td>
              <td class="px-4 py-2.5 text-right text-sm font-bold ${summary.total_balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
                ${escapeHtml(formatCurrency(Math.abs(summary.total_balance)))} ${summary.total_balance >= 0 ? 'DR' : 'CR'}
              </td>
              <td class="px-4 py-2.5 text-center">
                <span class="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition">
                  View →
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function bindTableTabs() {
  const buttons = Array.from(document.querySelectorAll('[data-accounts-tab-button]'));
  const panels = Array.from(document.querySelectorAll('[data-accounts-tab-panel]'));

  if (!buttons.length || !panels.length) return;

  const setActiveTab = (tabName) => {
    buttons.forEach((button) => {
      const active = button.dataset.accountsTabButton === tabName;
      button.classList.toggle('bg-slate-900', active);
      button.classList.toggle('text-white', active);
      button.classList.toggle('shadow-sm', active);
      button.classList.toggle('text-slate-500', !active);
      button.classList.toggle('hover:text-slate-700', !active);
    });

    panels.forEach((panel) => {
      panel.classList.toggle('hidden', panel.dataset.accountsTabPanel !== tabName);
    });
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      setActiveTab(button.dataset.accountsTabButton);
    });
  });

  setActiveTab('account-types');
}

function bindSubLedgerModal(model, router) {
  const modal      = document.getElementById('subleder-modal');
  const closeBtn   = document.getElementById('subleder-close');
  const titleEl    = document.getElementById('subleder-title');
  const summaryEl  = document.getElementById('subleder-summary');
  const bodyEl     = document.getElementById('subleder-body');
  const footerEl   = document.getElementById('subleder-footer');
  if (!modal) return;

  const allAccounts = model.accounts || [];

  const VALID_TYPES = new Set([
    'ASSET', 'DEBTOR', 'CASH', 'BANK', 'LIABILITY',
    'CREDITOR', 'INCOME', 'EXPENSE', 'GENERAL',
  ]);

  function openModal(accountType) {
    const heads  = allAccounts.filter(a => a.account_type === accountType);
    const sorted = [...heads].sort((a, b) => b.absoluteBalance - a.absoluteBalance);

    const totDr   = heads.reduce((s, h) => s + (h.total_debit  || 0), 0);
    const totCr   = heads.reduce((s, h) => s + (h.total_credit || 0), 0);
    const netBal  = totDr - totCr;
    const netLabel = netBal >= 0 ? 'DR' : 'CR';
    const maxAbs  = sorted.length ? sorted[0].absoluteBalance : 1;

    /* ── Coloured header ── */
    const headerEl = document.getElementById('subleder-header');
    headerEl.className = headerEl.className.replace(/\bmodal-hdr--\w+\b/g, '');
    headerEl.classList.add(`modal-hdr--${VALID_TYPES.has(accountType) ? accountType : 'GENERAL'}`);

    document.getElementById('subleder-badge').textContent = accountType;

    titleEl.textContent = accountType + ' Ledger Accounts';

    /* ── Summary chips ── */
    summaryEl.innerHTML = `
      <div class="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-center">
        <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Accounts</p>
        <p class="mt-1 text-2xl font-black text-slate-900">${heads.length}</p>
      </div>
      <div class="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
        <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-500">Total Debits</p>
        <p class="mt-1 text-base font-black text-emerald-700 truncate">${formatCurrency(totDr)}</p>
        <p class="text-[10px] text-slate-400 mt-0.5">Credits: ${formatCurrency(totCr)}</p>
      </div>
      <div class="rounded-xl border px-3 py-2 ${netBal >= 0 ? 'border-emerald-100 bg-emerald-50' : 'border-rose-100 bg-rose-50'}">
        <p class="text-[10px] font-bold uppercase tracking-[0.18em] ${netBal >= 0 ? 'text-emerald-500' : 'text-rose-400'}">Net Balance</p>
        <p class="mt-1 text-base font-black truncate ${netBal >= 0 ? 'text-emerald-700' : 'text-rose-700'}">${formatCurrency(Math.abs(netBal))}</p>
        <p class="text-[10px] font-bold mt-0.5 ${netBal >= 0 ? 'text-emerald-500' : 'text-rose-400'}">${netLabel}</p>
      </div>
    `;

    /* ── Table body ── */
    if (!sorted.length) {
      bodyEl.innerHTML = `
        <tr><td colspan="5" class="px-5 py-12 text-center text-sm font-semibold text-slate-400">No accounts in this type.</td></tr>`;
    } else {
      bodyEl.innerHTML = sorted.map((h, i) => {
        const balClass = h.balance >= 0 ? 'text-emerald-700' : 'text-rose-700';
        const barColor = h.balance >= 0 ? 'bg-emerald-400' : 'bg-rose-400';
        const barPct   = maxAbs > 0 ? Math.round((h.absoluteBalance / maxAbs) * 100) : 0;
        const rowBg    = i % 2 !== 0 ? 'bg-slate-50/60' : '';

        return `
          <tr class="hover:bg-blue-50/50 transition-colors ${rowBg}">
            <td class="px-5 py-3">
              <div class="flex items-center gap-3">
                <div class="flex-shrink-0 w-1 rounded-full js-bar-h ${barColor}"
                     data-bar-h="${Math.max(Math.round(barPct * 0.28), 6)}"></div>
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-slate-800 truncate">${escapeHtml(h.account_head)}</p>
                  <div class="mt-1 h-1 w-24 rounded-full bg-slate-100">
                    <div class="h-1 rounded-full ${barColor} transition-all js-bar-w"
                         data-bar-w="${barPct}"></div>
                  </div>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 text-right text-sm font-semibold text-emerald-600 whitespace-nowrap">
              ${escapeHtml(formatCurrency(h.total_debit))}
            </td>
            <td class="px-4 py-3 text-right text-sm font-semibold text-rose-500 whitespace-nowrap">
              ${escapeHtml(formatCurrency(h.total_credit))}
            </td>
            <td class="px-4 py-3 text-right whitespace-nowrap">
              <span class="text-sm font-black ${balClass}">${escapeHtml(formatCurrency(h.absoluteBalance))}</span>
              <span class="ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase
                           ${h.balance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                ${escapeHtml(h.balanceLabel)}
              </span>
            </td>
            <td class="px-4 py-3 text-center">
              <a href="/ledger/account/${encodeURIComponent(h.account_head)}" data-navigo
                 class="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 transition">
                Detail
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
                </svg>
              </a>
            </td>
          </tr>`;
      }).join('');

    /* ── Apply dynamic bar dimensions via JS (CSP: no inline style="" allowed) ── */
    bodyEl.querySelectorAll('.js-bar-h').forEach(el => {
      const h = Math.min(Math.max(Number(el.dataset.barH), 6), 28);
      el.style.setProperty('height', `${h}px`);
    });
    bodyEl.querySelectorAll('.js-bar-w').forEach(el => {
      el.style.setProperty('width', `${Number(el.dataset.barW)}%`);
    });
    }

    /* ── Dark footer ── */
    footerEl.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          ${escapeHtml(accountType)} Totals
        </span>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <p class="text-[10px] text-slate-500 uppercase tracking-wide">Debits</p>
            <p class="text-sm font-black text-emerald-400">${formatCurrency(totDr)}</p>
          </div>
          <div class="w-px h-8 bg-white/10 self-center"></div>
          <div class="text-right">
            <p class="text-[10px] text-slate-500 uppercase tracking-wide">Credits</p>
            <p class="text-sm font-black text-rose-400">${formatCurrency(totCr)}</p>
          </div>
          <div class="w-px h-8 bg-white/10 self-center"></div>
          <div class="rounded-xl px-3 py-1.5 text-right
                      ${netBal >= 0 ? 'bg-emerald-500/15' : 'bg-rose-500/15'}">
            <p class="text-[10px] uppercase tracking-wide ${netBal >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
              Net ${netLabel}
            </p>
            <p class="text-sm font-black ${netBal >= 0 ? 'text-emerald-300' : 'text-rose-300'}">
              ${formatCurrency(Math.abs(netBal))}
            </p>
          </div>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    router.updatePageLinks();
    modal.querySelectorAll('[data-navigo]').forEach(link => {
      link.addEventListener('click', closeModal);
    });
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  // Wire row clicks in the account-types table
  document.querySelectorAll('.open-subleder-btn').forEach(row => {
    row.addEventListener('click', () => openModal(row.dataset.type));
  });

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', onKey);
    }
  });
}

function renderLoadingState() {
  return `
    <div class="space-y-4">
      <div class="rounded-[26px] border border-slate-200 bg-white/80 p-5 shadow-sm">
        <div class="h-5 w-40 animate-pulse rounded-full bg-slate-200"></div>
        <div class="mt-3 h-8 w-3/4 animate-pulse rounded-full bg-slate-200"></div>
        <div class="mt-3 h-4 w-2/3 animate-pulse rounded-full bg-slate-100"></div>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${Array.from({ length: 6 }).map(() => `
          <div class="rounded-[24px] border border-slate-200 bg-white/80 p-4 shadow-sm">
            <div class="h-3 w-20 animate-pulse rounded-full bg-slate-200"></div>
            <div class="mt-4 h-8 w-28 animate-pulse rounded-full bg-slate-300"></div>
            <div class="mt-3 h-3 w-24 animate-pulse rounded-full bg-slate-100"></div>
          </div>
        `).join('')}
      </div>
      <div class="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
        <div class="rounded-[26px] border border-slate-200 bg-white/80 p-4 shadow-sm">
          <div class="h-[280px] animate-pulse rounded-[22px] bg-slate-100"></div>
        </div>
        <div class="rounded-[26px] border border-slate-200 bg-white/80 p-4 shadow-sm">
          <div class="h-[280px] animate-pulse rounded-[22px] bg-slate-100"></div>
        </div>
      </div>
    </div>
  `;
}

function renderErrorState(message) {
  return `
    <div class="rounded-[26px] border border-rose-200 bg-white/90 p-6 shadow-sm">
      <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-500">Accounts Dashboard</p>
      <h2 class="mt-2 text-2xl font-black tracking-tight text-slate-900">Unable to load ledger data</h2>
      <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-600">${escapeHtml(message || 'Unexpected dashboard failure.')}</p>
      <div class="mt-5 flex flex-wrap gap-3">
        <button id="accounts-dashboard-refresh" type="button" class="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
          Retry
        </button>
        <a href="/ledger/general-ledger" data-navigo class="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          Open General Ledger
        </a>
      </div>
    </div>
  `;
}

function renderInlineEmpty(title, description) {
  return `
    <div class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
      <div class="text-sm font-semibold text-slate-700">${escapeHtml(title)}</div>
      <div class="mt-1 text-xs text-slate-500">${escapeHtml(description)}</div>
    </div>
  `;
}

async function renderDashboardCharts(model) {
  const typesRoot = document.getElementById('accounts-type-chart');
  const balancesRoot = document.getElementById('accounts-balance-chart');
  if (!typesRoot || !balancesRoot) return;

  const Chart = await loadChartLibrary();

  const types = model.accountTypes.length
    ? model.accountTypes
    : [{ account_type: 'No Activity', total_debit: 0, total_credit: 0 }];

  const typeChart = new Chart(typesRoot, {
    type: 'bar',
    data: {
      labels: types.map((entry) => truncateLabel(entry.account_type, 14)),
      datasets: [
        {
          label: 'Debit',
          data: types.map((entry) => entry.total_debit),
          backgroundColor: '#10b981',
          borderRadius: 8,
        },
        {
          label: 'Credit',
          data: types.map((entry) => entry.total_credit),
          backgroundColor: '#f43f5e',
          borderRadius: 8,
        },
      ],
    },
    options: buildChartOptions({
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: { callback: (value) => formatAxisCurrency(value) },
          grid: { color: 'rgba(148,163,184,0.12)' },
        },
        x: {
          grid: { display: false },
        },
      },
    }),
  });

  const balanceLeaders = [...model.largestDrAccounts, ...model.largestCrAccounts]
    .sort((a, b) => b.absoluteBalance - a.absoluteBalance)
    .slice(0, 8);

  const chartAccounts = balanceLeaders.length
    ? balanceLeaders
    : [{ account_head: 'No balances yet', absoluteBalance: 0, balance: 0 }];

  const balanceChart = new Chart(balancesRoot, {
    type: 'bar',
    data: {
      labels: chartAccounts.map((entry) => truncateLabel(entry.account_head, 18)),
      datasets: [{
        label: 'Absolute Balance',
        data: chartAccounts.map((entry) => entry.absoluteBalance),
        backgroundColor: chartAccounts.map((entry) => entry.balance >= 0 ? '#2563eb' : '#db2777'),
        borderRadius: 10,
        borderSkipped: false,
      }],
    },
    options: buildChartOptions({
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { callback: (value) => formatAxisCurrency(value) },
          grid: { color: 'rgba(148,163,184,0.12)' },
        },
        y: {
          grid: { display: false },
        },
      },
    }),
  });

  accountsCharts.push(typeChart, balanceChart);
}

function destroyAccountsCharts() {
  accountsCharts.forEach((chart) => {
    try {
      chart.destroy();
    } catch (error) {
      console.warn('[ACCOUNTS_DASHBOARD] Failed to destroy chart:', error);
    }
  });
  accountsCharts = [];
}

function buildChartOptions(overrides = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        labels: {
          color: '#475569',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 18,
          font: { size: 11, weight: '600' },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        padding: 12,
        displayColors: true,
      },
    },
    scales: {},
    ...overrides,
  };
}

async function loadChartLibrary() {
  if (window.Chart) return window.Chart;
  if (!chartScriptPromise) {
    chartScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-accounts-chart]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.Chart), { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load local chart library')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = '/public/cdns/chart.umd.min.js';
      script.async = true;
      script.dataset.accountsChart = 'true';
      script.onload = () => {
        if (window.Chart) resolve(window.Chart);
        else reject(new Error('Local chart library loaded without Chart global'));
      };
      script.onerror = () => reject(new Error('Failed to load local chart library'));
      document.head.appendChild(script);
    });
  }
  return chartScriptPromise;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Math.abs(toNumber(value)) >= 100000 ? 0 : 2,
  }).format(toNumber(value));
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(toNumber(value));
}

function formatAxisCurrency(value) {
  const amount = toNumber(value);
  if (Math.abs(amount) >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (Math.abs(amount) >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (Math.abs(amount) >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount.toFixed(0)}`;
}

function truncateLabel(value, max) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}