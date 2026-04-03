import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api, fetchWithCSRF } from '../../utils/api.js';
import { fetchBankAccounts, populateBankAccountSelect } from '../../utils/bankAccounts.js';

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

const ACCOUNT_TYPES = [
  'INCOME', 'EXPENSE', 'COGS', 'GENERAL',
  'ASSET', 'LIABILITY', 'CASH', 'BANK',
  'DEBTOR', 'CREDITOR', 'CAPITAL', 'RETAINED_EARNINGS',
  'LOAN', 'PREPAID_EXPENSE', 'ACCUMULATED_DEPRECIATION',
  'ALLOWANCE_FOR_DOUBTFUL_DEBTS', 'DISCOUNT_RECEIVED', 'DISCOUNT_GIVEN'
];

export async function renderNewVoucher(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = `
    <div class="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Accounting</p>
          <h1 class="mt-0.5 text-2xl font-black tracking-tight text-gray-900">New Voucher</h1>
          <p class="text-xs text-gray-500 mt-0.5">Create a new payment or receipt voucher</p>
        </div>
        <div class="flex gap-2">
          <a href="/ledger/bank-accounts" data-navigo class="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 transition">
            Bank Accounts
          </a>
          <a href="/ledger/vouchers" data-navigo class="inline-flex items-center rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200 transition">
            ← Back
          </a>
        </div>
      </div>

      <form id="voucher-form" class="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-4">Voucher Type *</label>
          <div class="flex gap-8">
            <label class="flex items-center cursor-pointer group">
              <input type="radio" name="voucher_type" value="RECEIPT" required class="w-5 h-5 text-emerald-600 bg-gray-100 border-gray-300 focus:ring-emerald-500">
              <span class="ml-2.5 text-sm font-bold text-gray-700 group-hover:text-emerald-600 transition">Receipt Voucher</span>
            </label>
            <label class="flex items-center cursor-pointer group">
              <input type="radio" name="voucher_type" value="PAYMENT" required class="w-5 h-5 text-red-600 bg-gray-100 border-gray-300 focus:ring-red-500">
              <span class="ml-2.5 text-sm font-bold text-gray-700 group-hover:text-red-600 transition">Payment Voucher</span>
            </label>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Transaction Date *</label>
            <input type="date" id="transaction-date" name="transaction_date" required class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium">
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Party *</label>
            <div class="relative">
              <select id="party-select" name="party_id" required class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium appearance-none">
                <option value="">Loading parties...</option>
              </select>
              <div id="party-loading-spinner" class="absolute right-4 top-1/2 -translate-y-1/2">
                <svg class="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div id="opening-balance-section" class="hidden bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="text-xs font-black uppercase tracking-widest text-blue-600 mb-1">Account Opening Balance</h4>
              <p id="ob-account-head" class="text-sm font-bold text-blue-900">-</p>
            </div>
            <div class="flex gap-2">
              <button type="button" id="view-ob-btn" class="px-3 py-2 rounded-lg bg-blue-100 text-xs font-bold text-blue-700 hover:bg-blue-200 transition">View Details</button>
              <button type="button" id="edit-ob-btn" class="px-3 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 transition">Edit</button>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div class="bg-white rounded-lg p-3 border border-blue-100">
              <span class="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Type</span>
              <p id="ob-type" class="text-sm font-bold text-gray-900 mt-1">-</p>
            </div>
            <div class="bg-white rounded-lg p-3 border border-blue-100">
              <span class="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Debit</span>
              <p id="ob-debit" class="text-sm font-bold text-emerald-600 mt-1">₹0.00</p>
            </div>
            <div class="bg-white rounded-lg p-3 border border-blue-100">
              <span class="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Credit</span>
              <p id="ob-credit" class="text-sm font-bold text-rose-600 mt-1">₹0.00</p>
            </div>
          </div>
        </div>

        <div id="no-opening-balance-section" class="hidden bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="text-xs font-black uppercase tracking-widest text-amber-600 mb-1">No Opening Balance Found</h4>
              <p id="nob-account-head" class="text-sm font-bold text-amber-900">-</p>
            </div>
            <button type="button" id="create-ob-btn" class="px-4 py-2 rounded-lg bg-amber-600 text-xs font-bold text-white hover:bg-amber-700 transition">Create Opening Balance</button>
          </div>
          <p class="text-xs text-amber-700">This account doesn't have an opening balance yet. Create one to track initial balances.</p>
        </div>

        <div id="closing-balance-section" class="hidden bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="text-xs font-black uppercase tracking-widest text-emerald-600 mb-1">Account Current Status</h4>
              <p id="cb-account-head" class="text-sm font-bold text-emerald-900">-</p>
              <p id="cb-update-date" class="text-xs text-emerald-600 mt-1">Updated: -</p>
            </div>
            <button type="button" id="view-cb-btn" class="px-3 py-2 rounded-lg bg-emerald-100 text-xs font-bold text-emerald-700 hover:bg-emerald-200 transition">View Ledger</button>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div class="bg-white rounded-lg p-3 border border-emerald-100">
              <span class="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Current Debit</span>
              <p id="cb-debit" class="text-sm font-bold text-emerald-600 mt-1">₹0.00</p>
            </div>
            <div class="bg-white rounded-lg p-3 border border-emerald-100">
              <span class="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Current Credit</span>
              <p id="cb-credit" class="text-sm font-bold text-rose-600 mt-1">₹0.00</p>
            </div>
            <div class="bg-white rounded-lg p-3 border border-emerald-100">
              <span class="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Net Balance</span>
              <p id="cb-balance" class="text-sm font-bold text-indigo-600 mt-1">₹0.00</p>
            </div>
          </div>
        </div>

        <div id="no-transaction-section" class="hidden bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
          <div>
            <h4 class="text-xs font-black uppercase tracking-widest text-gray-600 mb-1">No Transaction History</h4>
            <p id="nt-account-head" class="text-sm font-bold text-gray-900">-</p>
          </div>
          <p class="text-xs text-gray-600">This account has no transactions yet. The opening balance will be the starting point.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Amount *</label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
              <input type="number" id="amount" name="amount" step="0.01" min="0.01" required class="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-bold" placeholder="0.00">
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Payment Mode *</label>
            <select id="payment-mode" name="payment_mode" required class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium">
              <option value="">Select Payment Mode</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
        </div>

        <div id="bank-account-section" class="hidden">
          <label class="block text-sm font-bold text-gray-700 mb-2">Bank Account</label>
          <select id="bank-account-select" name="bank_account_id" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium">
            <option value="">Select Bank Account</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-bold text-gray-700 mb-2">Narration</label>
          <textarea id="narration" name="narration" rows="3" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none font-medium" placeholder="Enter voucher description"></textarea>
        </div>

        <div class="bg-slate-50 rounded-2xl p-5 border border-slate-100">
          <h4 class="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Transaction Summary</h4>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="space-y-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</span>
              <p id="summary-type" class="text-sm font-bold text-slate-900">-</p>
            </div>
            <div class="space-y-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Party</span>
              <p id="summary-party" class="text-sm font-bold text-slate-900 truncate">-</p>
            </div>
            <div class="space-y-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</span>
              <p id="summary-amount" class="text-sm font-black text-emerald-600">-</p>
            </div>
            <div class="space-y-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mode</span>
              <p id="summary-mode" class="text-sm font-bold text-slate-900">-</p>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-6 border-t border-gray-100">
          <a href="/ledger/vouchers" data-navigo class="px-6 py-2.5 rounded-xl bg-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-200 transition">Cancel</a>
          <button type="submit" id="save-btn" class="px-8 py-2.5 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition disabled:opacity-50 disabled:cursor-not-allowed">Save Voucher</button>
        </div>
      </form>
    </div>
  `;

  renderLayout(content, router);
  setTimeout(() => initVoucherForm(router), 100);
}

function initVoucherForm(router) {
  const form = document.getElementById('voucher-form');
  const transactionDateInput = document.getElementById('transaction-date');
  const partySelect = document.getElementById('party-select');
  const partySpinner = document.getElementById('party-loading-spinner');
  const amountInput = document.getElementById('amount');
  const paymentModeSelect = document.getElementById('payment-mode');
  const bankAccountSection = document.getElementById('bank-account-section');
  const bankAccountSelect = document.getElementById('bank-account-select');
  const narrationInput = document.getElementById('narration');
  const saveBtn = document.getElementById('save-btn');
  const openingBalanceSection = document.getElementById('opening-balance-section');
  const noOpeningBalanceSection = document.getElementById('no-opening-balance-section');
  const closingBalanceSection = document.getElementById('closing-balance-section');
  const noTransactionSection = document.getElementById('no-transaction-section');
  const editObBtn = document.getElementById('edit-ob-btn');
  const viewObBtn = document.getElementById('view-ob-btn');
  const createObBtn = document.getElementById('create-ob-btn');
  const viewCbBtn = document.getElementById('view-cb-btn');

  let allParties = [];
  let currentOpeningBalance = null;

  const today = new Date().toISOString().split('T')[0];
  transactionDateInput.value = today;

  loadParties();
  loadBankAccounts();

  const handleKeydown = (e) => {
    if (e.key === 'Escape') router.navigate('/ledger/vouchers');
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!saveBtn.disabled) handleSubmit(new Event('submit'));
    }
  };
  document.addEventListener('keydown', handleKeydown);
  const originalNavigate = router.navigate;
  router.navigate = (...args) => {
    document.removeEventListener('keydown', handleKeydown);
    return originalNavigate.apply(router, args);
  };

  document.querySelectorAll('input[name="voucher_type"]').forEach(radio => {
    radio.addEventListener('change', updateSummary);
  });

  partySelect.addEventListener('change', async () => {
    partySelect.classList.remove('border-red-500', 'ring-red-100');
    await loadOpeningBalance();
    await loadClosingBalance();
    updateSummary();
  });
  
  amountInput.addEventListener('input', () => {
    amountInput.classList.remove('border-red-500', 'ring-red-100');
    updateSummary();
  });

  paymentModeSelect.addEventListener('change', () => {
    paymentModeSelect.classList.remove('border-red-500', 'ring-red-100');
    handlePaymentModeChange();
  });

  editObBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentOpeningBalance) openEditObModal(currentOpeningBalance);
  });

  viewObBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentOpeningBalance) openViewObModal(currentOpeningBalance);
  });

  createObBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const partyId = partySelect.value;
    const party = allParties.find(p => p._id === partyId);
    if (party) openCreateObModal(party);
  });

  form.addEventListener('submit', handleSubmit);

  async function loadParties() {
    try {
      const response = await api.get('/api/inventory/sales/parties');
      allParties = response.data || [];
      partySpinner?.classList.add('hidden');
      partySelect.innerHTML = '<option value="">Select Party</option>' +
        allParties.map(party => `<option value="${party._id}">${esc(party.firm)} (${esc(party.contact_person || 'N/A')})</option>`).join('');
    } catch (error) {
      console.error('Failed to load parties:', error);
      partySpinner?.classList.add('hidden');
      partySelect.innerHTML = '<option value="">Failed to load parties</option>';
    }
  }

  async function loadBankAccounts() {
    try {
      const accounts = await fetchBankAccounts(true);
      const defaultAccount = accounts.find((account) => account.is_default) || accounts[0] || null;
      populateBankAccountSelect(bankAccountSelect, accounts, defaultAccount?._id || '');
    } catch (error) {
      console.error('Failed to load bank accounts:', error);
      bankAccountSelect.innerHTML = '<option value="">Failed to load bank accounts</option>';
    }
  }

  async function loadOpeningBalance() {
    const partyId = partySelect.value;
    if (!partyId) {
      openingBalanceSection.classList.add('hidden');
      noOpeningBalanceSection.classList.add('hidden');
      currentOpeningBalance = null;
      return;
    }

    try {
      const party = allParties.find(p => p._id === partyId);
      if (!party || !party.firm) {
        openingBalanceSection.classList.add('hidden');
        noOpeningBalanceSection.classList.add('hidden');
        currentOpeningBalance = null;
        return;
      }

      const response = await api.get(`/api/ledger/opening-balances?search=${encodeURIComponent(party.firm)}`);
      
      // Validate response structure
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response format from server');
      }

      const records = Array.isArray(response.records) ? response.records : [];
      
      // Case-insensitive search for matching account head
      const ob = records.find(r => 
        r && 
        r.account_head && 
        r.account_head.toLowerCase().trim() === party.firm.toLowerCase().trim()
      );

      if (ob && ob._id && ob.account_type && ob.opening_date !== undefined) {
        // Validate opening balance has required fields
        currentOpeningBalance = ob;
        displayOpeningBalance(ob);
        openingBalanceSection.classList.remove('hidden');
        noOpeningBalanceSection.classList.add('hidden');
      } else {
        // No valid opening balance found
        currentOpeningBalance = null;
        displayNoOpeningBalance(party);
        openingBalanceSection.classList.add('hidden');
        noOpeningBalanceSection.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Failed to load opening balance:', error);
      openingBalanceSection.classList.add('hidden');
      noOpeningBalanceSection.classList.add('hidden');
      currentOpeningBalance = null;
      showToast('Warning: Could not load opening balance info', 'info');
    }
  }

  function displayOpeningBalance(ob) {
    const fmtINR = (n) => '₹\u202f' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));
    document.getElementById('ob-account-head').textContent = esc(ob.account_head);
    document.getElementById('ob-type').textContent = esc(ob.account_type);
    document.getElementById('ob-debit').textContent = fmtINR(ob.debit_amount || 0);
    document.getElementById('ob-credit').textContent = fmtINR(ob.credit_amount || 0);
  }

  function displayNoOpeningBalance(party) {
    document.getElementById('nob-account-head').textContent = esc(party.firm);
  }

  async function loadClosingBalance() {
    const partyId = partySelect.value;
    if (!partyId) {
      closingBalanceSection.classList.add('hidden');
      noTransactionSection.classList.add('hidden');
      return;
    }

    try {
      const party = allParties.find(p => p._id === partyId);
      if (!party || !party.firm) {
        closingBalanceSection.classList.add('hidden');
        noTransactionSection.classList.add('hidden');
        return;
      }

      // Get ledger account details (current balance as of today)
      const response = await api.get(`/api/ledger/account/${encodeURIComponent(party.firm)}`);
      
      // Calculate current balance from all transactions
      if (!response || typeof response !== 'object') {
        noTransactionSection.classList.remove('hidden');
        closingBalanceSection.classList.add('hidden');
        return;
      }

      const records = Array.isArray(response) ? response : [];
      
      if (records.length === 0) {
        // No transactions yet
        noTransactionSection.classList.remove('hidden');
        closingBalanceSection.classList.add('hidden');
        document.getElementById('nt-account-head').textContent = esc(party.firm);
        return;
      }

      // Calculate running balance from records
      let total_debit = 0;
      let total_credit = 0;
      let latest_date = null;

      records.forEach(trx => {
        if (trx.debit_amount && trx.debit_amount > 0) total_debit += trx.debit_amount;
        if (trx.credit_amount && trx.credit_amount > 0) total_credit += trx.credit_amount;
        if (trx.transaction_date && (!latest_date || trx.transaction_date > latest_date)) {
          latest_date = trx.transaction_date;
        }
      });

      const net_balance = total_debit - total_credit;

      displayClosingBalance({
        account_head: party.firm,
        debit_amount: total_debit,
        credit_amount: total_credit,
        balance: net_balance,
        latest_date: latest_date,
      });

      noTransactionSection.classList.add('hidden');
      closingBalanceSection.classList.remove('hidden');
    } catch (error) {
      console.error('Failed to load closing balance:', error);
      closingBalanceSection.classList.add('hidden');
      noTransactionSection.classList.add('hidden');
    }
  }

  function displayClosingBalance(cb) {
    const fmtINR = (n) => '₹\u202f' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(Number(n || 0)));
    
    document.getElementById('cb-account-head').textContent = esc(cb.account_head);
    document.getElementById('cb-debit').textContent = fmtINR(cb.debit_amount || 0);
    document.getElementById('cb-credit').textContent = fmtINR(cb.credit_amount || 0);
    
    // Display net balance with color coding
    const balanceElement = document.getElementById('cb-balance');
    const absBalance = Math.abs(cb.balance || 0);
    balanceElement.textContent = fmtINR(absBalance);
    
    if (cb.balance > 0) {
      balanceElement.className = 'text-sm font-bold text-emerald-600 mt-1';
    } else if (cb.balance < 0) {
      balanceElement.className = 'text-sm font-bold text-rose-600 mt-1';
    } else {
      balanceElement.className = 'text-sm font-bold text-gray-600 mt-1';
    }
    
    // Update date
    const dateStr = cb.latest_date ? new Date(cb.latest_date).toLocaleDateString('en-IN') : 'Today';
    document.getElementById('cb-update-date').textContent = `Updated: ${dateStr}`;
  }

  viewCbBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const partyId = partySelect.value;
    const party = allParties.find(p => p._id === partyId);
    if (party) {
      router.navigate(`/ledger/account/${encodeURIComponent(party.firm)}`);
    }
  });

  function openViewObModal(ob) {
    const fmtINR = (n) => '₹\u202f' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));
    const modal = document.createElement('div');
    modal.id = 'view-ob-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4">
        <h2 class="text-lg font-black text-gray-900">Opening Balance Details</h2>
        <div class="space-y-3 bg-slate-50 rounded-lg p-4">
          <div class="flex justify-between items-center">
            <span class="text-xs font-bold uppercase tracking-wide text-gray-600">Account Head</span>
            <span class="text-sm font-bold text-gray-900">${esc(ob.account_head)}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-xs font-bold uppercase tracking-wide text-gray-600">Account Type</span>
            <span class="text-sm font-bold text-blue-600">${esc(ob.account_type)}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-xs font-bold uppercase tracking-wide text-gray-600">Opening Date</span>
            <span class="text-sm font-bold text-gray-900">${esc(ob.opening_date)}</span>
          </div>
          <div class="border-t border-gray-200 pt-3 mt-3">
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs font-bold uppercase tracking-wide text-gray-600">Debit</span>
              <span class="text-sm font-bold text-emerald-600">${fmtINR(ob.debit_amount || 0)}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs font-bold uppercase tracking-wide text-gray-600">Credit</span>
              <span class="text-sm font-bold text-rose-600">${fmtINR(ob.credit_amount || 0)}</span>
            </div>
          </div>
          <div class="border-t border-gray-200 pt-3 mt-3">
            <span class="text-xs font-bold uppercase tracking-wide text-gray-600">Narration</span>
            <p class="text-sm text-gray-700 mt-1">${esc(ob.narration)}</p>
          </div>
          <div class="border-t border-gray-200 pt-3 mt-3">
            <span class="text-xs font-bold uppercase tracking-wide text-gray-600">Status</span>
            <p class="text-sm font-bold mt-1">
              <span class="rounded-lg ${ob.is_locked ? 'bg-red-50 border border-red-100 text-red-700' : 'bg-green-50 border border-green-100 text-green-700'} px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
                ${ob.is_locked ? 'Locked' : 'Editable'}
              </span>
            </p>
          </div>
        </div>
        <div class="flex gap-3 pt-4">
          <button id="view-ob-close" class="flex-1 rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition">Close</button>
          <button id="view-ob-edit" class="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition">Edit</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('view-ob-close').addEventListener('click', () => modal.remove());
    document.getElementById('view-ob-edit').addEventListener('click', () => {
      modal.remove();
      openEditObModal(ob);
    });
  }

  function openCreateObModal(party) {
    const today = new Date().toISOString().split('T')[0];
    const modal = document.createElement('div');
    modal.id = 'create-ob-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4">
        <h2 class="text-lg font-black text-gray-900">Create Opening Balance</h2>
        <p class="text-sm text-gray-600">Set up the opening balance for <strong>${esc(party.firm)}</strong></p>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Account Type</label>
          <select id="create-ob-type" class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
            <option value="">Select Type</option>
            ${ACCOUNT_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Opening Date</label>
          <input id="create-ob-date" type="date" value="${today}" class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Debit</label>
            <input id="create-ob-debit" type="number" placeholder="0.00" step="0.01" min="0" class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Credit</label>
            <input id="create-ob-credit" type="number" placeholder="0.00" step="0.01" min="0" class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Narration</label>
          <input id="create-ob-narration" type="text" placeholder="Opening Balance" class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
        </div>
        <div class="flex gap-3 pt-4">
          <button id="create-ob-cancel" class="flex-1 rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition">Cancel</button>
          <button id="create-ob-save" class="flex-1 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 transition">Create</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('create-ob-cancel').addEventListener('click', () => modal.remove());
    document.getElementById('create-ob-save').addEventListener('click', async () => {
      const accountType = document.getElementById('create-ob-type').value.trim();
      const openingDate = document.getElementById('create-ob-date').value.trim();
      const debit = parseFloat(document.getElementById('create-ob-debit').value) || 0;
      const credit = parseFloat(document.getElementById('create-ob-credit').value) || 0;
      const narration = document.getElementById('create-ob-narration').value.trim();

      if (!accountType) return showToast('Account type is required', 'error');
      if (!openingDate) return showToast('Opening date is required', 'error');
      if (debit === 0 && credit === 0) return showToast('Either debit or credit is required', 'error');
      if (debit > 0 && credit > 0) return showToast('Cannot have both debit and credit', 'error');

      try {
        await api.post('/api/ledger/opening-balances', {
          account_head: party.firm,
          account_type: accountType,
          opening_date: openingDate,
          debit_amount: debit,
          credit_amount: credit,
          narration: narration || 'Opening Balance',
        });
        modal.remove();
        showToast('Opening balance created successfully', 'success');
        await loadOpeningBalance();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    });
  }

  function openEditObModal(ob) {
    const modal = document.createElement('div');
    modal.id = 'edit-ob-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4">
        <h2 class="text-lg font-black text-gray-900">Edit Opening Balance</h2>
        <p class="text-sm text-gray-600">Update the opening balance for <strong>${esc(ob.account_head)}</strong></p>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Account Type</label>
          <input type="text" value="${esc(ob.account_type)}" disabled class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm bg-gray-50 text-gray-600">
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Opening Date</label>
          <input id="edit-ob-date" type="date" value="${esc(ob.opening_date)}" class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Debit</label>
            <input id="edit-ob-debit" type="number" value="${ob.debit_amount || 0}" step="0.01" min="0" class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Credit</label>
            <input id="edit-ob-credit" type="number" value="${ob.credit_amount || 0}" step="0.01" min="0" class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Narration</label>
          <input id="edit-ob-narration" type="text" value="${esc(ob.narration)}" class="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition">
        </div>
        <div class="flex gap-3 pt-4">
          <button id="edit-ob-cancel" class="flex-1 rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition">Cancel</button>
          <button id="edit-ob-save" class="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('edit-ob-cancel').addEventListener('click', () => modal.remove());
    document.getElementById('edit-ob-save').addEventListener('click', async () => {
      const openingDate = document.getElementById('edit-ob-date').value.trim();
      const debit = parseFloat(document.getElementById('edit-ob-debit').value) || 0;
      const credit = parseFloat(document.getElementById('edit-ob-credit').value) || 0;
      const narration = document.getElementById('edit-ob-narration').value.trim();

      if (!openingDate) return showToast('Opening date is required', 'error');
      if (debit === 0 && credit === 0) return showToast('Either debit or credit is required', 'error');
      if (debit > 0 && credit > 0) return showToast('Cannot have both debit and credit', 'error');

      try {
        await api.put(`/api/ledger/opening-balances/${ob._id}`, {
          account_head: ob.account_head,
          account_type: ob.account_type,
          opening_date: openingDate,
          debit_amount: debit,
          credit_amount: credit,
          narration,
        });
        modal.remove();
        showToast('Opening balance updated successfully', 'success');
        await loadOpeningBalance();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    });
  }

  function handlePaymentModeChange() {
    const paymentMode = paymentModeSelect.value;
    const isBankMode = paymentMode && !paymentMode.toLowerCase().includes('cash');
    if (isBankMode) {
      bankAccountSection.classList.remove('hidden');
      bankAccountSelect.required = true;
    } else {
      bankAccountSection.classList.add('hidden');
      bankAccountSelect.required = false;
      bankAccountSelect.value = '';
    }
    updateSummary();
  }

  function updateSummary() {
    const voucherType = document.querySelector('input[name="voucher_type"]:checked')?.value || '';
    const partyOption = partySelect.options[partySelect.selectedIndex];
    const partyText = partyOption && partyOption.value ? partyOption.textContent.split(' (')[0] : '';
    const amount = parseFloat(amountInput.value) || 0;
    const paymentMode = paymentModeSelect.value;

    document.getElementById('summary-type').textContent = voucherType ? voucherType.charAt(0).toUpperCase() + voucherType.slice(1).toLowerCase() : '-';
    document.getElementById('summary-party').textContent = partyText || '-';
    document.getElementById('summary-amount').textContent = amount > 0 ? `₹${amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}` : '-';
    document.getElementById('summary-mode').textContent = paymentMode || '-';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(form);
    const voucherData = Object.fromEntries(formData);
    let hasError = false;

    if (!voucherData.voucher_type) {
      showToast('Please select voucher type', 'error');
      hasError = true;
    }
    if (!voucherData.party_id) {
      partySelect.classList.add('border-red-500', 'ring-red-100');
      hasError = true;
    }
    if (!voucherData.amount || parseFloat(voucherData.amount) <= 0) {
      amountInput.classList.add('border-red-500', 'ring-red-100');
      hasError = true;
    }
    if (!voucherData.payment_mode) {
      paymentModeSelect.classList.add('border-red-500', 'ring-red-100');
      hasError = true;
    }

    const isBankMode = voucherData.payment_mode && !voucherData.payment_mode.toLowerCase().includes('cash');
    if (isBankMode && !voucherData.bank_account_id) {
      bankAccountSelect.classList.add('border-red-500', 'ring-red-100');
      hasError = true;
    }

    if (hasError) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const response = await fetchWithCSRF('/api/ledger/vouchers', {
        method: 'POST',
        body: JSON.stringify(voucherData),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to create voucher');
      }

      showToast('Voucher created successfully!');
      setTimeout(() => router.navigate('/ledger/vouchers'), 1000);
      
    } catch (error) {
      showToast('Error creating voucher: ' + error.message, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Voucher';
    }
  }

  updateSummary();
}
