import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api, fetchWithCSRF } from '../../utils/api.js';
import { authManager } from '../../utils/auth.js';
import { fetchBankAccounts } from '../../utils/bankAccounts.js';
import { openAccountHeadModal } from '../../components/ledger/accountHeadModal.js';
import { createSearchableSelect } from '../../components/searchable-select.js';

const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function showToast(message, type = 'success') {
  const existing = document.getElementById('nv-toast');
  if (existing) existing.remove();
  const colors = { 
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800', 
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };
  const el = document.createElement('div');
  el.id = 'nv-toast';
  el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 border rounded-xl px-5 py-3 shadow-lg text-sm font-medium ${colors[type] || colors.success}`;
  el.innerHTML = `<span>${esc(message)}</span><button onclick="this.parentElement.remove()" class="ml-2 opacity-60 hover:opacity-100">&times;</button>`;
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 4000);
}

export async function renderNewVoucher(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = `
    <div class="max-w-[1400px] mx-auto px-4 py-2 space-y-3">
      <!-- Tally Style Master Header (Compact) -->
      <div class="bg-slate-900 rounded-xl shadow-lg border border-slate-800">
        <div class="px-5 py-3 flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <!-- Voucher Type Radios -->
            <div class="flex flex-col">
              <span class="text-[8px] font-black uppercase tracking-widest text-indigo-400 mb-0.5">Voucher Type</span>
              <div class="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                <label class="cursor-pointer">
                  <input type="radio" name="voucher_type" value="PAYMENT" required class="peer hidden" checked>
                  <div class="px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest text-slate-500 peer-checked:bg-red-600 peer-checked:text-white transition-all">Payment</div>
                </label>
                <label class="cursor-pointer">
                  <input type="radio" name="voucher_type" value="RECEIPT" required class="peer hidden">
                  <div class="px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest text-slate-500 peer-checked:bg-emerald-600 peer-checked:text-white transition-all">Receipt</div>
                </label>
              </div>
            </div>
            
            <div class="w-px h-8 bg-slate-800"></div>

            <!-- Date -->
            <div class="flex flex-col">
              <span class="text-[8px] font-black uppercase tracking-widest text-indigo-400 mb-0.5">Date</span>
              <input type="date" id="transaction-date" name="transaction_date" required 
                     class="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-bold text-white outline-none focus:border-indigo-500 transition">
            </div>

            <div class="w-px h-8 bg-slate-800"></div>

            <!-- Master Account -->
            <div class="flex flex-col min-w-[350px]">
              <span class="text-[8px] font-black uppercase tracking-widest text-indigo-400 mb-0.5">Account (Cash / Bank)</span>
              <div class="flex gap-2">
                <div id="master-account-container" class="flex-1"></div>
                <div id="master-balance-chip" class="bg-indigo-950/40 border border-indigo-500/30 px-3 py-1 rounded-lg flex flex-col justify-center items-end min-w-[110px]">
                  <span id="master-balance-amount" class="text-[10px] font-black text-indigo-300 font-mono">₹0.00</span>
                  <span id="master-balance-type" class="text-[7px] font-black text-indigo-500 uppercase tracking-tighter">Current Bal</span>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-4">
             <div class="flex flex-col items-end">
                <span id="grand-total-top" class="text-lg font-black text-white font-mono leading-none">₹0.00</span>
                <span class="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Total Value</span>
             </div>
             <a href="/ledger/vouchers" data-navigo class="p-2 text-slate-500 hover:text-white transition" title="Close Entry">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M6 18L18 6M6 6l12 12"/></svg>
             </a>
          </div>
        </div>
      </div>

      <form id="voucher-form" class="space-y-3 pb-32">
        <!-- Allocation Grid -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200">
          <table class="w-full border-collapse" id="entries-table">
            <thead>
              <tr class="text-left bg-slate-50 border-b border-slate-200">
                <th class="pl-5 pr-3 py-2 text-[8px] font-black uppercase tracking-widest text-slate-400 w-10 text-center">#</th>
                <th class="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-slate-400">Particulars (Allocation Head)</th>
                <th class="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-slate-400 w-40 text-right">Amount (₹)</th>
                <th class="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-slate-400">Row Narration</th>
                <th class="pl-3 pr-5 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody id="entries-body" class="divide-y divide-slate-100">
              <!-- Dynamic Rows -->
            </tbody>
            <tfoot>
              <tr class="bg-slate-50 border-t border-slate-200">
                <td colspan="2" class="pl-5 py-3">
                  <button type="button" id="add-row-btn" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-indigo-500 hover:text-indigo-600 transition text-[9px] font-black uppercase tracking-widest">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor"><path d="M12 4.5v15m7.5-7.5h-15"/></svg>
                    Add Row (Alt + A)
                  </button>
                </td>
                <td class="px-3 py-3 text-right">
                  <div class="flex flex-col">
                    <span id="grand-total" class="text-sm font-black text-slate-900 font-mono">₹0.00</span>
                    <span class="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Total Allocation</span>
                  </div>
                </td>
                <td colspan="2" class="px-3 py-3">
                   <input type="text" id="global-narration" name="narration" 
                          class="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-700 focus:border-indigo-500 outline-none transition" 
                          placeholder="Narration (Alt + N)">
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
           <div class="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Double-Entry Integrity: <span id="balance-status" class="text-indigo-500 ml-2">Awaiting Entry</span>
           </div>
           <div class="flex gap-2">
             <button type="button" id="keyboard-help-btn" class="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition">Keyboard Shortcuts</button>
             <button type="submit" id="save-btn" disabled 
                     class="px-8 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-indigo-100 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">
               Save Entry (Ctrl + S)
             </button>
           </div>
        </div>
      </form>
    </div>

    <!-- Sub-modal for inline creation -->
    <div id="sub-modal-backdrop" class="fixed inset-0 bg-black/60 hidden z-[60] flex items-center justify-center backdrop-blur-sm transition-opacity p-4">
      <div id="sub-modal-content" class="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-modal-up"></div>
    </div>
  `;

  renderLayout(content, router);
  setTimeout(() => initVoucherForm(router), 100);
}

function initVoucherForm(router) {
  const form = document.getElementById('voucher-form');
  const entriesBody = document.getElementById('entries-body');
  const masterContainer = document.getElementById('master-account-container');
  const masterBalEl = document.getElementById('master-balance-amount');
  const grandTotalEl = document.getElementById('grand-total');
  const grandTotalTop = document.getElementById('grand-total-top');
  const addRowBtn = document.getElementById('add-row-btn');
  const saveBtn = document.getElementById('save-btn');
  const transactionDateInput = document.getElementById('transaction-date');
  const balanceStatus = document.getElementById('balance-status');

  let allAccountHeads = [];
  let masterAccounts = [];
  let rowCount = 0;
  let masterSelectInstance = null;

  transactionDateInput.value = new Date().toISOString().split('T')[0];

  async function loadMetadata() {
    try {
      const [coaRes, partRes, leadRes, bankRes] = await Promise.all([
        api.get('/api/ledger/coa'),
        api.get('/api/inventory/purchase/parties'),
        api.get(`/api/pg/labor/leaders?firm_id=${authManager.getUser().firm_id}`),
        api.get('/api/ledger/bank-accounts')
      ]);

      const coaList = coaRes.data || [];
      const parties = Array.isArray(partRes) ? partRes : (partRes.data || []);
      const leaders = Array.isArray(leadRes) ? leadRes : (leadRes.data || []);
      const banks = Array.isArray(bankRes) ? bankRes : (bankRes.data || []);

      // 1. Master Accounts (Cash & Bank)
      masterAccounts = [
        { 
          name: 'Cash in Hand', 
          type: 'CASH', 
          id: null, 
          balance: coaList.find(a => a.account_name.toLowerCase() === 'cash in hand')?.closing_balance || 0 
        },
        ...banks.map(b => {
          const canonicalName = `${b.bank_name.trim().toUpperCase()} (A/c ...${String(b.account_number).slice(-4)})`;
          // Precise Match by ID
          const coaEntry = coaList.find(a => a.bank_account_id === b._id || a.account_name === canonicalName);
          return { 
            name: canonicalName, 
            type: 'BANK', 
            id: b._id, 
            balance: coaEntry ? coaEntry.closing_balance : 0 
          };
        })
      ];

      masterSelectInstance = createSearchableSelect(masterContainer, masterAccounts, 'Select Cash/Bank Account...', (selected) => {
        masterBalEl.textContent = `₹${Math.abs(selected.balance).toLocaleString('en-IN', {minimumFractionDigits: 2})} ${selected.balance >= 0 ? 'DR' : 'CR'}`;
        updateTotals();
      });

      // 2. Allocation Heads
      const unique = new Map();
      
      // Add from COA list (The Source of Truth)
      coaList.forEach(a => {
        if (a.account_type !== 'CASH' && a.account_type !== 'BANK') {
          unique.set(a.account_name.toLowerCase(), {
            name: a.account_name,
            type: a.account_type,
            id: a.party_id || null, 
            balance: a.closing_balance || 0
          });
        }
      });

      allAccountHeads = Array.from(unique.values()).sort((a,b) => a.name.localeCompare(b.name));

      if (entriesBody.rows.length === 0) addEntryRow();
    } catch (err) {
      console.error('Enterprise metadata load failed:', err);
    }
  }

  function addEntryRow() {
    rowCount++;
    const row = document.createElement('tr');
    row.className = 'group transition-colors relative z-[1] hover:z-[10]';
    row.innerHTML = `
      <td class="pl-5 pr-3 py-1.5 text-[9px] font-black text-slate-300 text-center">${rowCount}</td>
      <td class="px-3 py-1.5 min-w-[320px]">
        <div class="row-head-container"></div>
        <div class="row-balance-display text-[8px] font-black text-slate-400 mt-1 uppercase tracking-tight hidden">
          Live Bal: <span class="row-bal-val text-indigo-500 font-mono">₹0.00</span>
        </div>
      </td>
      <td class="px-3 py-1.5">
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-[9px]">₹</span>
          <input type="number" name="amount" step="0.01" min="0.01" required 
                 class="row-amount-input w-full pl-6 pr-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg focus:bg-white focus:border-indigo-500 outline-none transition font-black text-xs text-right">
        </div>
      </td>
      <td class="px-3 py-1.5">
        <input type="text" name="row_narration" class="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg focus:bg-white focus:border-indigo-500 outline-none transition font-bold text-[10px]" placeholder="Remark...">
      </td>
      <td class="pl-3 pr-5 py-1.5 text-center">
        <button type="button" class="row-remove-btn p-1 text-slate-200 hover:text-rose-600 transition opacity-0 group-hover:opacity-100">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </td>
    `;
    entriesBody.appendChild(row);
    
    let selectedHead = null;
    const container = row.querySelector('.row-head-container');
    const balDisplay = row.querySelector('.row-balance-display');
    const balVal = row.querySelector('.row-bal-val');

    const ss = createSearchableSelect(container, allAccountHeads, 'Select Allocation Head...', (selected) => {
      selectedHead = selected;
      if (selected) {
        balDisplay.classList.remove('hidden');
        const b = selected.balance || 0;
        balVal.textContent = `₹${Math.abs(b).toLocaleString('en-IN', {minimumFractionDigits: 2})} ${b >= 0 ? 'DR' : 'CR'}`;
        balVal.className = `row-bal-val font-mono ${b >= 0 ? 'text-indigo-500' : 'text-rose-500'}`;
      } else {
        balDisplay.classList.add('hidden');
      }
      updateTotals();
    }, () => {
      openAccountHeadModal(async () => { await loadMetadata(); });
    });

    row.getSelectedHead = () => selectedHead;
    const amount = row.querySelector('.row-amount-input');
    amount.oninput = updateTotals;
    row.querySelector('.row-remove-btn').onclick = () => { if (entriesBody.rows.length > 1) { row.remove(); updateTotals(); } };
  }

  function updateTotals() {
    let total = 0;
    document.querySelectorAll('.row-amount-input').forEach(i => total += (parseFloat(i.value) || 0));
    const fmt = `₹${total.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    grandTotalEl.textContent = fmt;
    grandTotalTop.textContent = fmt;
    
    const masterVal = masterContainer.querySelector('.ss-input').value;
    const isReady = total > 0 && !!masterVal;
    saveBtn.disabled = !isReady;
    balanceStatus.textContent = isReady ? 'Balanced (Single Entry Mode)' : 'Awaiting complete entry...';
    balanceStatus.className = isReady ? 'text-emerald-600 font-black' : 'text-slate-400 font-black';
  }

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'a') { e.preventDefault(); addEntryRow(); }
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); if (!saveBtn.disabled) form.requestSubmit(); }
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="voucher_type"]:checked').value;
    const isPayment = type === 'PAYMENT';
    const masterAccount = masterAccounts.find(m => m.name === masterContainer.querySelector('.ss-input').value);
    
    const finalEntries = [];
    let totalAmount = 0;

    Array.from(entriesBody.rows).forEach(row => {
      const head = row.getSelectedHead();
      const amt = parseFloat(row.querySelector('.row-amount-input').value) || 0;
      if (!head || amt <= 0) return;
      totalAmount += amt;
      finalEntries.push({
        account_head: head.name, account_type: head.type, party_id: head.id || null,
        debit_amount: isPayment ? amt : 0, credit_amount: isPayment ? 0 : amt,
        narration: row.querySelector('input[name="row_narration"]').value
      });
    });

    finalEntries.push({
      account_head: masterAccount.name, account_type: masterAccount.type, bank_account_id: masterAccount.id || null,
      debit_amount: isPayment ? 0 : totalAmount, credit_amount: isPayment ? totalAmount : 0,
      payment_mode: masterAccount.name.toLowerCase().includes('cash') ? 'Cash' : 'Bank Transfer'
    });

    try {
      saveBtn.disabled = true;
      const res = await fetchWithCSRF('/api/ledger/vouchers', { method: 'POST', body: JSON.stringify({
          voucher_type: type, transaction_date: transactionDateInput.value,
          narration: document.getElementById('global-narration').value, entries: finalEntries
      })});
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Voucher Posted');
      setTimeout(() => router.navigate('/ledger/vouchers'), 1000);
    } catch (err) {
      toast.error(err.message);
      saveBtn.disabled = false;
    }
  };

  addRowBtn.onclick = addEntryRow;
  loadMetadata();
}
