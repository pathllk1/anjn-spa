import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api, fetchWithCSRF } from '../../utils/api.js';
import { fetchBankAccounts, populateBankAccountSelect } from '../../utils/bankAccounts.js';

/* ── Helpers ────────────────────────────────────────────────────────── */
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
        <!-- Voucher Type -->
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-4">Voucher Type *</label>
          <div class="flex gap-8">
            <label class="flex items-center cursor-pointer group">
              <input type="radio" name="voucher_type" value="RECEIPT" required
                     class="w-5 h-5 text-emerald-600 bg-gray-100 border-gray-300 focus:ring-emerald-500">
              <span class="ml-2.5 text-sm font-bold text-gray-700 group-hover:text-emerald-600 transition">Receipt Voucher</span>
            </label>
            <label class="flex items-center cursor-pointer group">
              <input type="radio" name="voucher_type" value="PAYMENT" required
                     class="w-5 h-5 text-red-600 bg-gray-100 border-gray-300 focus:ring-red-500">
              <span class="ml-2.5 text-sm font-bold text-gray-700 group-hover:text-red-600 transition">Payment Voucher</span>
            </label>
          </div>
        </div>

        <!-- Basic Details -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Transaction Date *</label>
            <input type="date" id="transaction-date" name="transaction_date" required
                   class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium">
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Party *</label>
            <div class="relative">
              <select id="party-select" name="party_id" required
                      class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium appearance-none">
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

        <!-- Amount and Payment Mode -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Amount *</label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
              <input type="number" id="amount" name="amount" step="0.01" min="0.01" required
                     class="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-bold"
                     placeholder="0.00">
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2">Payment Mode *</label>
            <select id="payment-mode" name="payment_mode" required
                    class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium">
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

        <!-- Bank Account (conditional) -->
        <div id="bank-account-section" class="hidden">
          <label class="block text-sm font-bold text-gray-700 mb-2">Bank Account</label>
          <select id="bank-account-select" name="bank_account_id"
                  class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium">
            <option value="">Select Bank Account</option>
          </select>
        </div>

        <!-- Narration -->
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-2">Narration</label>
          <textarea id="narration" name="narration" rows="3"
                    class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none font-medium"
                    placeholder="Enter voucher description"></textarea>
        </div>

        <!-- Transaction Summary -->
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

        <!-- Submit Buttons -->
        <div class="flex justify-end gap-3 pt-6 border-t border-gray-100">
          <a href="/ledger/vouchers" data-navigo class="px-6 py-2.5 rounded-xl bg-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-200 transition">
            Cancel
          </a>
          <button type="submit" id="save-btn" class="px-8 py-2.5 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition disabled:opacity-50 disabled:cursor-not-allowed">
            Save Voucher
          </button>
        </div>
      </form>
    </div>
  `;

  renderLayout(content, router);

  // Initialize the form after DOM is ready
  setTimeout(() => {
    initVoucherForm(router);
  }, 100);
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

  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  transactionDateInput.value = today;

  // Load data
  loadParties();
  loadBankAccounts();

  // Keyboard navigation
  const handleKeydown = (e) => {
    if (e.key === 'Escape') router.navigate('/ledger/vouchers');
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!saveBtn.disabled) handleSubmit(new Event('submit'));
    }
  };
  document.addEventListener('keydown', handleKeydown);
  // Clean up listener when navigating away
  const originalNavigate = router.navigate;
  router.navigate = (...args) => {
    document.removeEventListener('keydown', handleKeydown);
    return originalNavigate.apply(router, args);
  };

  // Event listeners
  document.querySelectorAll('input[name="voucher_type"]').forEach(radio => {
    radio.addEventListener('change', updateSummary);
  });

  partySelect.addEventListener('change', () => {
    partySelect.classList.remove('border-red-500', 'ring-red-100');
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

  form.addEventListener('submit', handleSubmit);

  async function loadParties() {
    try {
      const response = await api.get('/api/inventory/sales/parties');
      const parties = response.data || [];

      partySpinner?.classList.add('hidden');
      partySelect.innerHTML = '<option value="">Select Party</option>' +
        parties.map(party => `<option value="${party._id}">${esc(party.firm)} (${esc(party.contact_person || 'N/A')})</option>`).join('');
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

    // Validate required fields
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

    // Check if bank account is required
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

  // Initialize summary
  updateSummary();
}
