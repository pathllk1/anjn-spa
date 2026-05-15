import { api, fetchWithCSRF } from '../../utils/api.js';
import { toast } from '../admin/toast.js';

export const LaborModals = {
  /**
   * Show modal to add a new Labor Leader
   */
  async showLeaderModal(firmId, onSave) {
    const modalId = 'labor-leader-modal';
    document.getElementById(modalId)?.remove();

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" id="${modalId}-backdrop"></div>
      <div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all">
        <div class="bg-indigo-600 px-6 py-4 flex justify-between items-center">
          <h3 class="text-white font-bold text-lg">New Labor Leader</h3>
          <button class="text-white/80 hover:text-white" id="${modalId}-close">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <form class="p-6 space-y-4" id="${modalId}-form">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
              <label class="block text-sm font-semibold text-slate-700 mb-1">Leader Name</label>
              <input type="text" name="name" required class="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium" placeholder="Enter name...">
            </div>
            <div class="col-span-2">
              <label class="block text-sm font-semibold text-slate-700 mb-1">Phone Number (Optional)</label>
              <input type="tel" name="phone" class="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium" placeholder="Enter phone...">
            </div>
          </div>

          <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4 mt-2">
            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank Details (Optional)</h4>
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bank Name</label>
              <input type="text" name="bank_name" class="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium" placeholder="e.g. HDFC Bank">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Account No.</label>
                <input type="text" name="account_number" class="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium" placeholder="000000000000">
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">IFSC Code</label>
                <input type="text" name="ifsc_code" class="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium" placeholder="IFSC0001234">
              </div>
            </div>
          </div>

          <div class="pt-2">
            <button type="submit" class="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
              Register Leader
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      modal.remove();
    };

    document.getElementById(`${modalId}-close`).addEventListener('click', close);
    document.getElementById(`${modalId}-backdrop`).addEventListener('click', close);

    const form = document.getElementById(`${modalId}-form`);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = {
        firm_id: firmId,
        name: formData.get('name'),
        phone: formData.get('phone'),
        bank_name: formData.get('bank_name'),
        account_number: formData.get('account_number'),
        ifsc_code: formData.get('ifsc_code')
      };

      try {
        const response = await fetchWithCSRF('/api/pg/labor/leaders', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Registration failed');
        
        toast.success('Leader registered successfully');
        close();
        if (onSave) onSave();
      } catch (err) {
        toast.error('Failed to register leader: ' + err.message);
      }
    };
  },

  /**
   * Show modal to edit an existing Labor Leader
   */
  async showEditLeaderModal(leader, onSave) {
    const modalId = 'labor-leader-edit-modal';
    document.getElementById(modalId)?.remove();

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" id="${modalId}-backdrop"></div>
      <div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all">
        <div class="bg-indigo-600 px-6 py-4 flex justify-between items-center">
          <h3 class="text-white font-bold text-lg">Edit Labor Leader</h3>
          <button class="text-white/80 hover:text-white" id="${modalId}-close">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <form class="p-6 space-y-4" id="${modalId}-form">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
              <label class="block text-sm font-semibold text-slate-700 mb-1">Leader Name</label>
              <input type="text" name="name" required value="${leader.name || ''}" class="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium" placeholder="Enter name...">
            </div>
            <div class="col-span-2">
              <label class="block text-sm font-semibold text-slate-700 mb-1">Phone Number (Optional)</label>
              <input type="tel" name="phone" value="${leader.phone || ''}" class="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium" placeholder="Enter phone...">
            </div>
            <div class="col-span-2">
              <label class="block text-sm font-semibold text-slate-700 mb-1">Status</label>
              <select name="status" class="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium">
                <option value="Active" ${leader.status === 'Active' ? 'selected' : ''}>Active</option>
                <option value="Inactive" ${leader.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
              </select>
            </div>
          </div>

          <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4 mt-2">
            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank Details (Optional)</h4>
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bank Name</label>
              <input type="text" name="bank_name" value="${leader.bank_name || ''}" class="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium" placeholder="e.g. HDFC Bank">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Account No.</label>
                <input type="text" name="account_number" value="${leader.account_number || ''}" class="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium" placeholder="000000000000">
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">IFSC Code</label>
                <input type="text" name="ifsc_code" value="${leader.ifsc_code || ''}" class="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium" placeholder="IFSC0001234">
              </div>
            </div>
          </div>

          <div class="pt-2">
            <button type="submit" class="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
              Update Leader Info
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      modal.remove();
    };

    document.getElementById(`${modalId}-close`).addEventListener('click', close);
    document.getElementById(`${modalId}-backdrop`).addEventListener('click', close);

    const form = document.getElementById(`${modalId}-form`);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = {
        name: formData.get('name'),
        phone: formData.get('phone'),
        status: formData.get('status'),
        bank_name: formData.get('bank_name'),
        account_number: formData.get('account_number'),
        ifsc_code: formData.get('ifsc_code')
      };

      try {
        const response = await fetchWithCSRF(`/api/pg/labor/leaders/${leader.id}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Update failed');
        
        toast.success('Leader updated successfully');
        close();
        if (onSave) onSave();
      } catch (err) {
        toast.error('Failed to update leader: ' + err.message);
      }
    };
  },

  /**
   * Show modal to start a new Work Period
   */
  async showPeriodModal(firmId, leaders, onSave) {
    const modalId = 'labor-period-modal';
    document.getElementById(modalId)?.remove();

    if (leaders.length === 0) {
      toast.error('Please register a leader first');
      return;
    }

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" id="${modalId}-backdrop"></div>
      <div class="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all">
        <div class="bg-indigo-600 px-6 py-4 flex justify-between items-center">
          <h3 class="text-white font-bold text-lg">Start Work Period</h3>
          <button class="text-white/80 hover:text-white" id="${modalId}-close">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <form class="p-6 space-y-6" id="${modalId}-form">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Select Leader</label>
            <select name="leader_id" required class="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium">
              ${leaders.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Start Date</label>
              <input type="date" name="start_date" required class="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">End Date</label>
              <input type="date" name="end_date" required class="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium" value="${new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]}">
            </div>
          </div>
          <div class="pt-2">
            <button type="submit" class="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
              Initialize Period
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      modal.remove();
    };

    document.getElementById(`${modalId}-close`).addEventListener('click', close);
    document.getElementById(`${modalId}-backdrop`).addEventListener('click', close);

    const form = document.getElementById(`${modalId}-form`);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = {
        firm_id: firmId,
        leader_id: formData.get('leader_id'),
        start_date: formData.get('start_date'),
        end_date: formData.get('end_date')
      };

      try {
        const response = await fetchWithCSRF('/api/pg/labor/periods', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Initialization failed');
        
        toast.success('Work period initialized');
        close();
        if (onSave) onSave();
      } catch (err) {
        toast.error('Failed to start period: ' + err.message);
      }
    };
  },

  /**
   * Show modal to edit an existing Work Period
   */
  async showEditPeriodModal(period, leaders, onSave) {
    const modalId = 'labor-period-edit-modal';
    document.getElementById(modalId)?.remove();

    const startDate = period.start_date.split('T')[0];
    const endDate = period.end_date.split('T')[0];

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" id="${modalId}-backdrop"></div>
      <div class="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all">
        <div class="bg-indigo-600 px-6 py-4 flex justify-between items-center">
          <h3 class="text-white font-bold text-lg">Edit Work Period</h3>
          <button class="text-white/80 hover:text-white" id="${modalId}-close">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <form class="p-6 space-y-6" id="${modalId}-form">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Select Leader</label>
            <select name="leader_id" required class="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium">
              ${leaders.map(l => `<option value="${l.id}" ${l.id === period.leader_id ? 'selected' : ''}>${l.name}</option>`).join('')}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Start Date</label>
              <input type="date" name="start_date" required class="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium" value="${startDate}">
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">End Date</label>
              <input type="date" name="end_date" required class="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium" value="${endDate}">
            </div>
          </div>
          <div class="pt-2">
            <button type="submit" class="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
              Update Period
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      modal.remove();
    };

    document.getElementById(`${modalId}-close`).addEventListener('click', close);
    document.getElementById(`${modalId}-backdrop`).addEventListener('click', close);

    const form = document.getElementById(`${modalId}-form`);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = {
        leader_id: formData.get('leader_id'),
        start_date: formData.get('start_date'),
        end_date: formData.get('end_date')
      };

      try {
        const response = await fetchWithCSRF(`/api/pg/labor/periods/${period.id}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Update failed');
        
        toast.success('Work period updated');
        close();
        if (onSave) onSave();
      } catch (err) {
        toast.error('Failed to update period: ' + err.message);
      }
    };
  },

  /**
   * Show modal for Advance Payment
   */
  async showAdvanceModal(firmId, periodId, leaderName, onSave) {
    const modalId = 'labor-advance-modal';
    document.getElementById(modalId)?.remove();

    // Fetch banks
    let banks = [];
    try {
      const res = await api.get(`/api/ledger/bank-accounts?firm_id=${firmId}`);
      banks = res.data || [];
    } catch (err) {
      toast.error('Failed to load bank accounts');
    }

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" id="${modalId}-backdrop"></div>
      <div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all">
        <div class="bg-amber-500 px-6 py-4 flex justify-between items-center">
          <h3 class="text-white font-bold text-lg">Issue Advance Payment</h3>
          <button class="text-white/80 hover:text-white" id="${modalId}-close">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="bg-amber-50 px-6 py-2 border-b border-amber-100">
            <span class="text-amber-800 text-[10px] font-black uppercase tracking-widest">Paying To</span>
            <div class="text-amber-900 font-bold">${leaderName}</div>
        </div>
        <form class="p-6 space-y-5" id="${modalId}-form">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Advance Amount (₹)</label>
            <input type="number" name="amount" required class="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-bold text-lg" placeholder="0.00">
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Payment Date</label>
            <input type="date" name="payment_date" required class="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Select Bank Account</label>
            <select name="bank_account_id" required class="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium">
              ${banks.map(b => `<option value="${b._id}">${b.account_name}</option>`).join('')}
            </select>
          </div>
          <div class="pt-2">
            <button type="submit" class="w-full bg-amber-500 text-white py-3 rounded-xl font-bold hover:bg-amber-600 transition shadow-lg shadow-amber-200">
              Confirm Payment
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      modal.remove();
    };

    document.getElementById(`${modalId}-close`).addEventListener('click', close);
    document.getElementById(`${modalId}-backdrop`).addEventListener('click', close);

    const form = document.getElementById(`${modalId}-form`);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = {
        firm_id: firmId,
        period_id: periodId,
        amount: parseFloat(formData.get('amount')),
        payment_date: formData.get('payment_date'),
        bank_account_id: formData.get('bank_account_id'),
        leader_name: leaderName,
        created_by: JSON.parse(localStorage.getItem('user'))?.username || 'system'
      };

      try {
        const response = await fetchWithCSRF('/api/pg/labor/payments/advance', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Payment failed');
        
        toast.success('Advance payment recorded');
        close();
        if (onSave) onSave();
      } catch (err) {
        toast.error('Payment failed: ' + err.message);
      }
    };
  },

  /**
   * Show modal for Final Settlement
   */
  async showSettlementModal(firmId, periodId, leaderName, totals, onSave) {
    const modalId = 'labor-settlement-modal';
    document.getElementById(modalId)?.remove();

    // Fetch banks
    let banks = [];
    try {
      const res = await api.get(`/api/ledger/bank-accounts?firm_id=${firmId}`);
      banks = res.data || [];
    } catch (err) {
      toast.error('Failed to load bank accounts');
    }

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" id="${modalId}-backdrop"></div>
      <div class="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all">
        <div class="bg-emerald-600 px-6 py-4 flex justify-between items-center">
          <h3 class="text-white font-bold text-lg">Final Batch Settlement</h3>
          <button class="text-white/80 hover:text-white" id="${modalId}-close">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        
        <div class="p-6 space-y-6">
          <div class="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 grid grid-cols-2 gap-4">
             <div>
                <span class="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">Total Wages</span>
                <span class="text-xl font-bold text-emerald-900">₹${totals.wages.toLocaleString()}</span>
             </div>
             <div>
                <span class="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">Misc Expenses</span>
                <span class="text-xl font-bold text-emerald-900">₹${totals.expenses.toLocaleString()}</span>
             </div>
             <div class="border-t border-emerald-100 pt-3">
                <span class="text-[10px] font-black text-rose-500 uppercase tracking-widest block mb-1">Total Advances</span>
                <span class="text-xl font-bold text-rose-700">- ₹${totals.advances.toLocaleString()}</span>
             </div>
             <div class="border-t border-emerald-100 pt-3">
                <span class="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-1">Net Payable</span>
                <span class="text-2xl font-black text-slate-900">₹${totals.net.toLocaleString()}</span>
             </div>
          </div>

          <form class="space-y-4" id="${modalId}-form">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Final Payment Date</label>
              <input type="date" name="payment_date" required class="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Payment Bank Account</label>
              <select name="bank_account_id" required class="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium">
                ${banks.map(b => `<option value="${b._id}">${b.account_name}</option>`).join('')}
              </select>
            </div>
            
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-start gap-3">
               <svg class="w-5 h-5 text-indigo-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
               <p class="text-xs text-slate-500 leading-relaxed font-medium">
                 Settling this batch will create ledger entries for wages and expenses, deduct advances, and mark the work period as **Settled**. This action cannot be undone.
               </p>
            </div>

            <div class="pt-2">
              <button type="submit" class="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200">
                Finalize & Close Batch
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      modal.remove();
    };

    document.getElementById(`${modalId}-close`).addEventListener('click', close);
    document.getElementById(`${modalId}-backdrop`).addEventListener('click', close);

    const form = document.getElementById(`${modalId}-form`);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = {
        firm_id: firmId,
        period_id: periodId,
        total_wages: totals.wages,
        total_expenses: totals.expenses,
        total_advances: totals.advances,
        net_payable: totals.net,
        payment_date: formData.get('payment_date'),
        bank_account_id: formData.get('bank_account_id'),
        leader_name: leaderName,
        created_by: JSON.parse(localStorage.getItem('user'))?.username || 'system'
      };

      try {
        const response = await fetchWithCSRF('/api/pg/labor/payments/settle', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Settlement failed');
        
        toast.success('Batch settled successfully');
        close();
        if (onSave) onSave();
      } catch (err) {
        toast.error('Settlement failed: ' + err.message);
      }
    };
  }
};
