import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api, fetchWithCSRF } from '../../utils/api.js';
import { toast } from '../../components/admin/toast.js';
import { openAccountHeadModal } from '../../components/ledger/accountHeadModal.js';

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmtINR = (n) => '₹\u202f' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(Number(n || 0));

const ACCOUNT_TYPES = [
  'INCOME', 'EXPENSE', 'ASSET', 'LIABILITY', 'CASH', 'BANK',
  'DEBTOR', 'CREDITOR', 'LABOR_LEADER', 'CAPITAL', 'GENERAL', 'PAYABLE'
];

export async function renderChartOfAccounts(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const shell = `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.25em] text-indigo-500">Accounting Master</p>
          <h1 class="mt-1 text-2xl font-black tracking-tight text-slate-900">Chart of Accounts</h1>
          <p class="text-xs text-slate-500 font-bold mt-1">Manage and configure your firm's financial heads</p>
        </div>
        <div class="flex gap-2">
          <button id="sync-coa-btn" class="inline-flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-200 transition">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"/></svg>
            Sync Heads
          </button>
          <button id="add-account-btn" class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            New Account
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div class="relative flex-1 min-w-[280px]">
          <span class="absolute inset-y-0 left-3.5 flex items-center text-slate-400">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </span>
          <input id="search-input" type="text" placeholder="Search account heads..."
                 class="w-full rounded-xl border-2 border-slate-50 bg-slate-50 pl-11 pr-4 py-2.5 text-sm font-bold focus:bg-white focus:border-indigo-500 outline-none transition">
        </div>
        <select id="type-filter" class="rounded-xl border-2 border-slate-50 bg-slate-50 px-4 py-2.5 text-sm font-black uppercase tracking-widest text-slate-600 focus:bg-white focus:border-indigo-500 outline-none transition">
          <option value="">All Types</option>
          ${ACCOUNT_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>

      <!-- Main Table -->
      <div id="coa-table-wrap" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        <div class="flex items-center justify-center py-20">
          <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    </div>

    <!-- Sub-modal for inline creation and editing -->
    <div id="sub-modal-backdrop" class="fixed inset-0 z-50 hidden bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div id="sub-modal-content" class="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-modal-up"></div>
    </div>
  `;

  renderLayout(shell, router);

  const searchInput = document.getElementById('search-input');
  const typeFilter = document.getElementById('type-filter');
  const subModal = document.getElementById('sub-modal-backdrop');
  const subContent = document.getElementById('sub-modal-content');
  let coaData = [];

  async function loadData() {
    try {
      const qs = new URLSearchParams();
      if (searchInput.value) qs.set('search', searchInput.value);
      if (typeFilter.value) qs.set('type', typeFilter.value);

      const response = await api.get(`/api/ledger/coa?${qs.toString()}`);
      coaData = response.data || [];
      renderTable(coaData);
    } catch (err) {
      document.getElementById('coa-table-wrap').innerHTML = `
        <div class="p-12 text-center">
          <p class="text-sm font-bold text-rose-600">Failed to load Chart of Accounts: ${err.message}</p>
        </div>
      `;
    }
  }

  function renderTable(data) {
    if (!data.length) {
      document.getElementById('coa-table-wrap').innerHTML = `
        <div class="p-20 text-center space-y-4">
          <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
            <svg class="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          </div>
          <p class="text-sm font-bold text-slate-500">No account heads found. Try syncing or adding a new one.</p>
        </div>
      `;
      return;
    }

    const tableHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-900 border-b border-white/10">
              <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Account Master</th>
              <th class="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Opening</th>
              <th class="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-emerald-400 text-right bg-emerald-950/20">Debits (+)</th>
              <th class="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-rose-400 text-right bg-rose-950/20">Credits (-)</th>
              <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white text-right bg-indigo-900/40">Closing Balance</th>
              <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${data.map(acc => {
              const bal = acc.closing_balance || 0;
              const isDr = bal >= 0;
              return `
              <tr class="hover:bg-slate-50 transition-colors group">
                <td class="px-6 py-4">
                  <div class="flex items-center gap-3">
                    <div class="w-2 h-10 rounded-full ${getTypeColor(acc.account_type)}"></div>
                    <div>
                       <p class="text-sm font-black text-slate-900 leading-tight">${esc(acc.account_name)}</p>
                       <div class="flex items-center gap-2 mt-1">
                         <span class="text-[9px] font-black uppercase text-slate-400 tracking-tighter">${acc.account_type}</span>
                         ${acc.is_system ? '<span class="text-[8px] font-black uppercase text-indigo-500 bg-indigo-50 px-1 rounded">System</span>' : ''}
                         ${acc.account_code ? `<span class="text-[8px] font-bold text-slate-400 border border-slate-200 px-1 rounded">${acc.account_code}</span>` : ''}
                       </div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-4 text-right">
                  <span class="text-xs font-bold text-slate-500 font-mono">${fmtINR(acc.opening_balance)}</span>
                </td>
                <td class="px-4 py-4 text-right bg-emerald-50/30">
                  <span class="text-xs font-bold text-emerald-600 font-mono">${acc.current_debit > 0 ? fmtINR(acc.current_debit) : '-'}</span>
                </td>
                <td class="px-4 py-4 text-right bg-rose-50/30">
                  <span class="text-xs font-bold text-rose-600 font-mono">${acc.current_credit > 0 ? fmtINR(acc.current_credit) : '-'}</span>
                </td>
                <td class="px-6 py-4 text-right bg-indigo-50/30">
                  <div class="flex flex-col items-end">
                    <span class="text-sm font-black font-mono ${isDr ? 'text-indigo-700' : 'text-rose-700'}">${fmtINR(Math.abs(bal))}</span>
                    <span class="text-[9px] font-black ${isDr ? 'text-indigo-400' : 'text-rose-400'}">${isDr ? 'DEBIT' : 'CREDIT'}</span>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <div class="flex justify-center gap-1">
                    <a href="/ledger/account/${encodeURIComponent(acc.account_name)}" data-navigo class="p-2 text-slate-300 hover:text-indigo-600 transition" title="View Ledger">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
                    </a>
                    <button class="edit-acc-btn p-2 text-slate-300 hover:text-slate-600 transition" data-id="${acc._id}" title="Edit Account">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M16.862 4.487l1.687-1.688a1.875 1.125 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
                    </button>
                    ${!acc.is_system ? `
                      <button class="delete-acc-btn p-2 text-slate-300 hover:text-rose-600 transition" data-id="${acc._id}" title="Delete Account">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('coa-table-wrap').innerHTML = tableHTML;
    router.updatePageLinks();

    // Events
    document.querySelectorAll('.edit-acc-btn').forEach(btn => btn.onclick = () => openEditModal(btn.dataset.id));
    document.querySelectorAll('.delete-acc-btn').forEach(btn => btn.onclick = () => deleteAccount(btn.dataset.id));
  }

  function getTypeColor(type) {
    const map = {
      INCOME: 'bg-emerald-500',
      EXPENSE: 'bg-rose-500',
      ASSET: 'bg-sky-500',
      LIABILITY: 'bg-amber-500',
      BANK: 'bg-indigo-500',
      CASH: 'bg-teal-500',
      DEBTOR: 'bg-blue-400',
      CREDITOR: 'bg-pink-400',
      LABOR_LEADER: 'bg-orange-500'
    };
    return map[type] || 'bg-slate-300';
  }

  async function openEditModal(id = null) {
    const acc = id ? coaData.find(a => a._id === id) : null;
    const isNew = !id;

    const modal = subModal;
    const content = subContent;

    content.innerHTML = `
      <form id="coa-form" class="flex flex-col">
        <div class="bg-slate-900 p-6 flex justify-between items-center text-white">
          <h3 class="font-black uppercase tracking-widest text-sm">${isNew ? 'New Account Head' : 'Edit Account Head'}</h3>
          <button type="button" class="close-modal text-2xl opacity-60 hover:opacity-100">&times;</button>
        </div>
        
        <div class="p-8 space-y-5">
          <div class="space-y-2">
            <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400">Account Name *</label>
            <input type="text" name="account_name" value="${acc ? esc(acc.account_name) : ''}" required 
                   class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition font-bold"
                   placeholder="e.g. Electricity Charges">
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400">Category *</label>
              <select name="account_type" required 
                      class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition font-bold uppercase tracking-tight">
                ${ACCOUNT_TYPES.map(t => `<option value="${t}" ${acc?.account_type === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>
            <div class="space-y-2">
              <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400">Code (Optional)</label>
              <input type="text" name="account_code" value="${acc?.account_code || ''}" 
                     class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition font-bold font-mono"
                     placeholder="GL-001">
            </div>
          </div>

          <div class="space-y-2">
            <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400">Opening Balance (₹)</label>
            <input type="number" name="opening_balance" step="0.01" value="${acc?.opening_balance || 0}"
                   class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition font-black font-mono"
                   placeholder="0.00">
          </div>

          <div class="space-y-2">
            <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400">Description</label>
            <textarea name="description" rows="2" 
                      class="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition font-medium text-sm resize-none">${acc?.description || ''}</textarea>
          </div>

          <div class="pt-4 flex gap-3">
            <button type="button" class="close-modal flex-1 py-3 rounded-xl bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition">Cancel</button>
            <button type="submit" class="flex-1 py-3 rounded-xl bg-indigo-600 text-[10px] font-black uppercase tracking-widest text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition">
              ${isNew ? 'Create Account' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    `;

    modal.classList.remove('hidden');

    const closeModal = () => modal.classList.add('hidden');
    content.querySelectorAll('.close-modal').forEach(b => b.onclick = closeModal);

    document.getElementById('coa-form').onsubmit = async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target));
      body.opening_balance = parseFloat(body.opening_balance) || 0;

      try {
        const url = isNew ? '/api/ledger/coa' : `/api/ledger/coa/${acc._id}`;
        const method = isNew ? 'POST' : 'PUT';

        const res = await fetchWithCSRF(url, { method, body: JSON.stringify(body) });
        if (!res.ok) throw new Error((await res.json()).error);
        
        toast.success(isNew ? 'Account created!' : 'Account updated!');
        closeModal();
        loadData();
      } catch (err) {
        toast.error(err.message);
      }
    };
  }

  async function deleteAccount(id) {
    if (!confirm('Are you sure you want to delete this account head?')) return;
    try {
      const res = await fetchWithCSRF(`/api/ledger/coa/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Account deleted');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  document.getElementById('sync-coa-btn').onclick = async () => {
    try {
      toast.info('Syncing master list...');
      const res = await api.get('/api/ledger/coa/sync');
      toast.success(res.message);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  document.getElementById('add-account-btn').onclick = () => {
    openAccountHeadModal(async (result) => {
      // If it's a GL head, we need to save it to COA master
      if (result.is_gl) {
        try {
          const res = await fetchWithCSRF('/api/ledger/coa', { 
            method: 'POST', 
            body: JSON.stringify({
              account_name: result.account_head,
              account_type: result.account_type,
              opening_balance: 0
            })
          });
          if (!res.ok) throw new Error((await res.json()).error);
          toast.success('GL Account Created');
        } catch (err) {
          toast.error(err.message);
        }
      } else {
        // Business Party is already saved to Party model by the modal
        // We just need to sync it to COA
        await api.get('/api/ledger/coa/sync');
        toast.success('Business Party Added to Master');
      }
      loadData();
    });
  };

  searchInput.oninput = () => loadData();
  typeFilter.onchange = () => loadData();

  loadData();
}
