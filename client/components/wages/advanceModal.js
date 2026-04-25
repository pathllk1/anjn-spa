import { api, fetchWithCSRF } from '../../utils/api.js';

export function createAdvanceModal() {
  let modalRoot = null;
  let allEmployees = [];
  let filteredEmployees = []; // For search
  let firmBankAccounts = [];
  let selectedEmployeeId = null;
  let onSuccessCallback = null;

  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  async function loadAllEmployees() {
    try {
      const res = await api.get('/api/master-rolls?activeOnly=true');
      if (res.success) {
        // Sort A-Z by name
        allEmployees = res.data.sort((a, b) => a.employee_name.localeCompare(b.employee_name));
        filteredEmployees = [...allEmployees];
      }
    } catch (e) {
      console.error('Failed to load employees for advance modal', e);
    }
  }

  function getBankAccountOptionLabel(account) {
    const parts = [
      account.account_name || account.bank_name || 'Bank Account',
      account.bank_name || null,
      account.account_number ? `A/C ${account.account_number}` : null,
    ].filter(Boolean);
    return parts.join(' • ');
  }

  function render() {
    if (!modalRoot) return;

    modalRoot.innerHTML = `
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white text-xl">💸</div>
              <div>
                <h3 class="text-lg font-black text-slate-900 leading-tight">Centralized Advance Ledger</h3>
                <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Enterprise Employee Finance Management</p>
              </div>
            </div>
            <button id="close-advance-modal" class="text-slate-400 hover:text-slate-900 transition-colors p-2 rounded-lg hover:bg-slate-200 text-2xl font-light">&times;</button>
          </div>
          
          <div class="flex flex-col md:flex-row h-[600px]">
            <!-- Sidebar: Employee Selection & Balance -->
            <div class="w-full md:w-1/3 border-r border-slate-100 flex flex-col bg-slate-50/30">
              <div class="p-4 border-b border-slate-100 bg-white">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Search Employee</label>
                <input type="text" id="adv-employee-search" placeholder="Type to filter..." 
                  class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 mb-3" />
                
                <select id="adv-employee-select" size="10" class="w-full bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 overflow-y-auto">
                  <option value="">-- Choose Employee --</option>
                  ${filteredEmployees.map(emp => `
                    <option value="${emp._id}" ${selectedEmployeeId === emp._id ? 'selected' : ''}>
                      ${esc(emp.employee_name)}
                    </option>
                  `).join('')}
                </select>
                
                <div id="adv-sidebar-balance" class="mt-6 p-4 rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-900/10 hidden">
                  <p class="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Outstanding Balance</p>
                  <p id="advance-outstanding-balance" class="text-2xl font-black font-mono">₹ 0.00</p>
                </div>
              </div>
              
              <div id="advance-history-list" class="flex-1 overflow-y-auto p-4 space-y-3">
                <div class="flex flex-col items-center justify-center h-full text-center p-6">
                  <div class="text-3xl mb-2">🔍</div>
                  <p class="text-slate-400 text-[10px] font-black uppercase tracking-widest">Select an employee to view history</p>
                </div>
              </div>
            </div>

            <!-- Content Area: New Transaction Form -->
            <div class="w-full md:w-2/3 p-8 flex flex-col justify-center bg-white relative">
              <div id="adv-form-overlay" class="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center text-center p-8">
                <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-2xl mb-4">👤</div>
                <h4 class="text-slate-900 font-black text-lg">No Employee Selected</h4>
                <p class="text-slate-500 text-sm font-medium max-w-[280px]">Please select an employee from the left sidebar to record a new advance transaction.</p>
              </div>

              <div class="max-w-md mx-auto w-full">
                <div class="mb-8">
                  <h4 class="text-xl font-black text-slate-900 mb-1">New Advance</h4>
                  <p class="text-xs text-slate-500 font-bold uppercase tracking-wider">Disburse funds to selected employee</p>
                </div>

                <form id="advance-form" class="space-y-5">
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Amount</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                        <input type="number" id="adv-amount" required step="0.01" min="1" placeholder="0.00" 
                          class="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all" />
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Disbursement Date</label>
                      <input type="date" id="adv-date" required 
                        class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all" />
                    </div>
                  </div>

                  <div>
                    <label class="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Payment Mode</label>
                    <div class="grid grid-cols-2 gap-3">
                      <label class="relative flex items-center justify-center p-3 border-2 border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-all has-[:checked]:border-slate-900 has-[:checked]:bg-slate-900 has-[:checked]:text-white group">
                        <input type="radio" name="payment-mode" value="CASH" checked class="sr-only">
                        <span class="text-xs font-black uppercase tracking-widest">💵 Cash</span>
                      </label>
                      <label class="relative flex items-center justify-center p-3 border-2 border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-all has-[:checked]:border-slate-900 has-[:checked]:bg-slate-900 has-[:checked]:text-white group">
                        <input type="radio" name="payment-mode" value="BANK" class="sr-only">
                        <span class="text-xs font-black uppercase tracking-widest">🏦 Bank</span>
                      </label>
                    </div>
                  </div>

                  <div id="adv-bank-details-container" class="hidden animate-in slide-in-from-top-2 duration-200">
                    <label class="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Disbursed From (Firm Bank)</label>
                    <select id="adv-bank-select" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all">
                      <option value="">-- Select Bank Account --</option>
                      ${firmBankAccounts.map(account => `
                        <option value="${getBankAccountOptionLabel(account)}">
                          ${getBankAccountOptionLabel(account)}
                        </option>
                      `).join('')}
                    </select>
                  </div>

                  <div>
                    <label class="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Internal Remarks</label>
                    <textarea id="adv-remarks" rows="3" placeholder="Reason for advance..." 
                      class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all resize-none"></textarea>
                  </div>

                  <div id="adv-error" class="hidden text-[11px] font-bold text-rose-600 bg-rose-50 p-4 rounded-xl border border-rose-100"></div>

                  <button type="submit" id="save-advance-btn" 
                    class="w-full py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 active:scale-[0.98] transition-all shadow-xl shadow-slate-900/20">
                    Confirm Disbursement
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    bindEvents();
    if (selectedEmployeeId) {
      onEmployeeSwitch(selectedEmployeeId);
    }
  }

  function bindEvents() {
    modalRoot.querySelector('#close-advance-modal').onclick = close;
    
    // Search Filter logic
    const searchInput = modalRoot.querySelector('#adv-employee-search');
    const empSelect = modalRoot.querySelector('#adv-employee-select');
    
    searchInput.oninput = (e) => {
      const term = e.target.value.toLowerCase();
      filteredEmployees = allEmployees.filter(emp => 
        emp.employee_name.toLowerCase().includes(term)
      );
      
      // Update select options dynamically
      empSelect.innerHTML = `
        <option value="">-- Choose Employee --</option>
        ${filteredEmployees.map(emp => `
          <option value="${emp._id}" ${selectedEmployeeId === emp._id ? 'selected' : ''}>
            ${esc(emp.employee_name)}
          </option>
        `).join('')}
      `;
    };

    empSelect.onchange = (e) => {
      onEmployeeSwitch(e.target.value);
    };

    const modeRadios = modalRoot.querySelectorAll('input[name="payment-mode"]');
    const bankDetails = modalRoot.querySelector('#adv-bank-details-container');
    modeRadios.forEach(radio => {
      radio.onchange = (e) => {
        bankDetails.classList.toggle('hidden', e.target.value !== 'BANK');
      };
    });

    const form = modalRoot.querySelector('#advance-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!selectedEmployeeId) return;

      const mode = modalRoot.querySelector('input[name="payment-mode"]:checked').value;
      const bankVal = document.getElementById('adv-bank-select').value;
      
      if (mode === 'BANK' && !bankVal) {
        const err = document.getElementById('adv-error');
        err.innerText = 'Please select a firm bank account';
        err.classList.remove('hidden');
        return;
      }

      const btn = document.getElementById('save-advance-btn');
      const err = document.getElementById('adv-error');
      
      err.classList.add('hidden');
      btn.disabled = true;
      btn.innerText = 'PROCESSING...';

      try {
        const payload = {
          masterRollId: selectedEmployeeId,
          amount: document.getElementById('adv-amount').value,
          date: document.getElementById('adv-date').value,
          paymentMode: mode,
          bankDetails: mode === 'BANK' ? bankVal : '',
          remarks: document.getElementById('adv-remarks').value
        };

        const result = await api.post('/api/advances/record', payload);
        
        if (result.success) {
          form.reset();
          document.getElementById('adv-date').value = new Date().toISOString().split('T')[0];
          await loadHistory(selectedEmployeeId);
          await loadBalance(selectedEmployeeId);
          if (onSuccessCallback) onSuccessCallback(selectedEmployeeId);
        } else {
          err.innerText = result.message || 'Failed to record advance';
          err.classList.remove('hidden');
        }
      } catch (error) {
        err.innerText = 'Connection error';
        err.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.innerText = 'CONFIRM DISBURSEMENT';
      }
    };
  }

  async function onEmployeeSwitch(empId) {
    selectedEmployeeId = empId;
    const overlay = modalRoot.querySelector('#adv-form-overlay');
    const sidebarBal = modalRoot.querySelector('#adv-sidebar-balance');
    const historyList = modalRoot.querySelector('#advance-history-list');

    if (!empId) {
      overlay.classList.remove('hidden');
      sidebarBal.classList.add('hidden');
      historyList.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-center p-6"><div class="text-3xl mb-2">🔍</div><p class="text-slate-400 text-[10px] font-black uppercase tracking-widest">Select an employee to view history</p></div>`;
      return;
    }

    overlay.classList.add('hidden');
    sidebarBal.classList.remove('hidden');
    
    await Promise.all([
      loadHistory(empId),
      loadBalance(empId)
    ]);
  }

  async function loadHistory(empId) {
    const list = document.getElementById('advance-history-list');
    list.innerHTML = `<div class="flex items-center justify-center h-full text-slate-400 text-xs font-medium">Loading history...</div>`;
    
    try {
      const result = await api.get(`/api/advances/history/${empId}`);
      if (result.success && result.data.length > 0) {
        list.innerHTML = result.data.map(rec => `
          <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-start group">
            <div class="min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${rec.type === 'ADVANCE' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}">
                  ${rec.type}
                </span>
                <span class="text-[10px] font-bold text-slate-400 font-mono">${rec.date}</span>
              </div>
              <p class="text-xs font-bold text-slate-800 truncate">${rec.remarks || (rec.type === 'ADVANCE' ? 'Disbursement' : 'Repayment')}</p>
              <p class="text-[9px] font-bold text-slate-400 mt-1">${rec.payment_mode} ${rec.bank_account_details ? '• ' + rec.bank_account_details : ''}</p>
            </div>
            <div class="text-right flex flex-col items-end">
              <p class="text-xs font-black ${rec.type === 'ADVANCE' ? 'text-slate-900' : 'text-emerald-600'} font-mono">
                ${rec.type === 'ADVANCE' ? '' : '-' }₹ ${rec.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              ${rec.payment_mode !== 'WAGE_DEDUCTION' ? `
                <button data-action="delete-advance" data-id="${rec._id}" class="mt-2 text-[9px] font-black text-rose-500 opacity-0 group-hover:opacity-100 transition-all uppercase tracking-widest">Delete</button>
              ` : ''}
            </div>
          </div>
        `).join('');

        list.onclick = async (e) => {
          const btn = e.target.closest('[data-action="delete-advance"]');
          if (!btn) return;
          if (!confirm('Delete this record?')) return;
          try {
            const res = await api.delete(`/api/advances/${btn.dataset.id}`);
            if (res.success) {
              await loadHistory(empId);
              await loadBalance(empId);
              if (onSuccessCallback) onSuccessCallback(empId);
            } else {
              alert(res.message);
            }
          } catch (err) {
            alert('Delete failed');
          }
        };
      } else {
        list.innerHTML = `<div class="flex items-center justify-center h-full text-slate-400 text-[10px] font-black uppercase tracking-widest">No transaction history</div>`;
      }
    } catch (err) {
      list.innerHTML = `<div class="p-4 text-rose-500 text-xs">Error loading history</div>`;
    }
  }

  async function loadBalance(empId) {
    const balEl = document.getElementById('advance-outstanding-balance');
    try {
      const result = await api.get(`/api/advances/balance/${empId}`);
      if (result.success) {
        balEl.innerText = `₹ ${result.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      }
    } catch (err) {
      balEl.innerText = '₹ Error';
    }
  }

  function close() {
    if (modalRoot) {
      modalRoot.remove();
      modalRoot = null;
    }
  }

  return {
    open: async (preselectedEmpId, banks, callback) => {
      selectedEmployeeId = preselectedEmpId;
      firmBankAccounts = banks || [];
      onSuccessCallback = callback;
      
      if (allEmployees.length === 0) {
        await loadAllEmployees();
      }
      
      modalRoot = document.createElement('div');
      modalRoot.id = 'advance-modal-container';
      document.body.appendChild(modalRoot);
      render();
    },
    close
  };
}

