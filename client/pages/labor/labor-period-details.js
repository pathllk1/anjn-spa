import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api, fetchWithCSRF } from '../../utils/api.js';
import { authManager } from '../../utils/auth.js';
import { renderAttendanceGrid } from '../../components/labor/DynamicAttendanceGrid.js';
import { LaborModals } from '../../components/labor/LaborModals.js';
import { toast } from '../../components/admin/toast.js';

export async function renderLaborPeriodDetails(router, params) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const { id } = params;
  const user = authManager.getUser();
  const firmId = user.firm_id;

  try {
    const response = await api.get(`/api/pg/labor/periods/${id}/details`);
    const data = response.data || {};

    // Defensive defaults
    data.period = data.period || {};
    data.workers = data.workers || [];
    data.expenses = data.expenses || [];
    data.advances = data.advances || [];

    const content = `
      <div class="w-full px-4 py-8 space-y-8">
        <!-- Header -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-200 pb-8 gap-6">
          <div class="space-y-2">
            <div class="flex items-center gap-3">
              <a href="/labor-dashboard" data-navigo class="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 p-2 rounded-xl transition shadow-sm">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
              </a>
              <span class="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                Batch ID: ${id.substring(0, 8)}
              </span>
            </div>
            <div class="flex items-center gap-3">
              <h1 class="text-4xl font-black text-slate-900 tracking-tight">
                ${data.period.leader_name}'s Team
              </h1>
              ${data.period.status === 'Open' ? `
                <button id="edit-period-btn" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition" title="Edit Period Details">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
              ` : ''}
            </div>
            <div class="flex items-center gap-2 text-slate-500 font-bold">
               <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
               <span>${new Date(data.period.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
               <span class="text-slate-300">→</span>
               <span>${new Date(data.period.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>

          <div class="flex gap-3 w-full md:w-auto">
            <button id="pay-advance-btn" class="flex-1 md:flex-none bg-white border-2 border-amber-500 text-amber-700 px-6 py-3 rounded-2xl font-black hover:bg-amber-50 transition shadow-sm flex items-center justify-center gap-2" ${data.period.status === 'Settled' ? 'disabled' : ''}>
              <span class="text-xl">₹</span> Issue Advance
            </button>
            <button id="final-settle-btn" class="flex-1 md:flex-none bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-emerald-700 shadow-xl shadow-emerald-200 transition flex items-center justify-center gap-2" ${data.period.status === 'Settled' ? 'disabled' : ''}>
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              Final Settlement
            </button>
          </div>
        </div>

        <!-- Attendance Grid Section -->
        <div class="space-y-6">
          <div class="flex justify-between items-center">
            <h2 class="text-2xl font-black text-slate-800 flex items-center gap-3">
              <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              Attendance & Daily Wages
            </h2>
            ${data.period.status === 'Settled' ? `
              <div class="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl border-2 border-emerald-100 animate-pulse">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                <span class="font-black uppercase text-xs tracking-widest">Batch Settled</span>
              </div>
            ` : ''}
          </div>
          <div id="attendance-grid-container" class="min-h-[300px]"></div>
        </div>

        <!-- Financial Summary & Expenses -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8">

          <!-- Dynamic Expenses -->
          <div class="lg:col-span-2 space-y-4">
            <h3 class="text-xl font-black text-slate-800 flex items-center gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Miscellaneous Expenses
            </h3>
            <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
               <table class="w-full text-left" id="expenses-table">
                  <thead class="bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                      <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-32">Amount</th>
                      <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16 text-right"></th>
                    </tr>
                  </thead>
                  <tbody id="expenses-body" class="divide-y divide-slate-50">
                    ${data.expenses.length === 0 ? `
                      <tr id="no-expenses-row"><td colspan="3" class="px-6 py-12 text-center text-slate-400 italic font-medium">No miscellaneous expenses recorded yet.</td></tr>
                    ` : data.expenses.map((exp, idx) => `
                      <tr class="group hover:bg-slate-50/50 transition">
                        <td class="px-6 py-4 font-bold text-slate-700">${exp.description}</td>
                        <td class="px-6 py-4 font-black text-slate-900 text-lg">₹${exp.amount.toLocaleString()}</td>
                        <td class="px-6 py-4 text-right">
                          <button class="text-slate-300 hover:text-rose-600 transition p-2 hover:bg-rose-50 rounded-xl delete-expense-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
               </table>
               <div class="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
                  <input type="text" id="new-exp-desc" placeholder="New Expense (e.g. Transport, Food)..." class="flex-1 px-5 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm">
                  <input type="number" id="new-exp-amt" placeholder="Amount" class="w-36 px-5 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-black text-lg">
                  <button id="add-exp-btn" class="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black hover:bg-black transition shadow-lg text-sm uppercase tracking-widest">Add</button>
               </div>
            </div>
          </div>

          <!-- Summary Side Card -->
          <div class="space-y-8">
            <h3 class="text-xl font-black text-slate-800">Financial Snapshot</h3>
            <div class="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-100 relative overflow-hidden group">
               <div class="absolute top-0 right-0 w-48 h-48 bg-indigo-500/20 rounded-full -mr-24 -mt-24 blur-3xl group-hover:bg-indigo-500/30 transition-all duration-700"></div>
               <div class="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full -ml-16 -mb-16 blur-2xl"></div>

               <div class="space-y-6 relative z-10">
                  <div class="flex justify-between items-center border-b border-white/5 pb-4">
                    <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Wages</span>
                    <span class="font-bold text-lg">₹<span id="sum-wages">0</span></span>
                  </div>
                  <div class="flex justify-between items-center border-b border-white/5 pb-4">
                    <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Misc Expenses</span>
                    <span class="font-bold text-lg">₹<span id="sum-expenses">0</span></span>
                  </div>
                  <div class="flex justify-between items-center text-rose-400 pb-4">
                    <span class="text-[10px] font-black uppercase tracking-widest">Total Advances</span>
                    <span class="font-bold text-lg">- ₹<span id="sum-advances">0</span></span>
                  </div>
                  <div class="pt-4 mt-4">
                    <div class="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2">Net Payable Balance</div>
                    <div class="text-5xl font-black tracking-tighter text-white">₹<span id="sum-net">0</span></div>
                  </div>
               </div>
            </div>

            <!-- Advance History -->
            <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
               <h4 class="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Advance History</h4>
               ${data.advances.length === 0 ? `
                  <div class="py-4 text-center">
                    <p class="text-sm text-slate-400 italic font-medium">No advances issued yet.</p>
                  </div>
               ` : `
                  <div class="space-y-4">
                    ${data.advances.map(adv => `
                      <div class="flex justify-between items-center p-3 rounded-2xl bg-slate-50/50 border border-slate-100 group hover:border-amber-200 transition">
                        <div class="flex items-center gap-3">
                           <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                             <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                           </div>
                           <div>
                             <div class="font-black text-slate-900 tracking-tight">₹${adv.amount.toLocaleString()}</div>
                             <div class="text-[10px] text-slate-400 font-black uppercase tracking-widest">${new Date(adv.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                           </div>
                        </div>
                        <span class="text-[9px] bg-emerald-100 px-2 py-0.5 rounded-lg font-black text-emerald-700 uppercase tracking-widest border border-emerald-200">Paid</span>
                      </div>
                    `).join('')}
                  </div>
               `}
            </div>
          </div>
        </div>
      </div>
    `;

    renderLayout(content, router);

    // Initialize Attendance Grid
    renderAttendanceGrid('attendance-grid-container', data, async (payload) => {
      try {
        // Collect current expenses from the table
        const expenses = Array.from(document.querySelectorAll('#expenses-body tr:not(#no-expenses-row)')).map(tr => ({
          description: tr.querySelector('td:nth-child(1)').textContent,
          amount: parseFloat(tr.querySelector('td:nth-child(2)').textContent.replace('₹', '').replace(/,/g, ''))
        }));

        payload.expenses = expenses;
        const response = await fetchWithCSRF(`/api/pg/labor/periods/${id}/sync`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Sync failed');

        toast.success('Batch data synced successfully!');
        renderLaborPeriodDetails(router, params);
      } catch (err) {
        toast.error('Sync failed: ' + err.message);
      }
    });

    setupPeriodEvents(data, router, id, firmId);
    updateCalculations(data);

  } catch (error) {
    console.error('Period Details Error:', error);
    renderLayout(`<div class="p-8 text-red-600">Failed to load period data: ${error.message}</div>`, router);
  }
}


function setupPeriodEvents(data, router, periodId, firmId) {
  // Edit Period Logic
  document.getElementById('edit-period-btn')?.addEventListener('click', async () => {
    try {
      const res = await api.get(`/api/pg/labor/leaders?firm_id=${firmId}`);
      const leaders = res.data || [];
      LaborModals.showEditPeriodModal(data.period, leaders, () => {
        renderLaborPeriodDetails(router, { id: periodId });
      });
    } catch (err) {
      toast.error('Failed to load leaders: ' + err.message);
    }
  });

  // Add Expense Logic
  document.getElementById('add-exp-btn')?.addEventListener('click', () => {
    const desc = document.getElementById('new-exp-desc').value;
    const amt = parseFloat(document.getElementById('new-exp-amt').value);
    
    if (desc && amt > 0) {
      const body = document.getElementById('expenses-body');
      const noRow = document.getElementById('no-expenses-row');
      if (noRow) noRow.remove();
      
      const tr = document.createElement('tr');
      tr.className = "group hover:bg-slate-50/50 transition";
      tr.innerHTML = `
        <td class="px-6 py-4 font-bold text-slate-700">${desc}</td>
        <td class="px-6 py-4 font-black text-slate-900 text-lg">₹${amt.toLocaleString()}</td>
        <td class="px-6 py-4 text-right">
          <button class="text-slate-300 hover:text-rose-600 transition p-2 hover:bg-rose-50 rounded-xl delete-expense-btn">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </td>
      `;
      body.appendChild(tr);
      document.getElementById('new-exp-desc').value = '';
      document.getElementById('new-exp-amt').value = '';
      updateCalculations(data);
    }
  });

  // Handle Expense Deletion via delegation
  document.getElementById('expenses-body')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.delete-expense-btn');
    if (btn) {
      btn.closest('tr').remove();
      updateCalculations(data);
    }
  });

  // Payment Logic
  document.getElementById('pay-advance-btn')?.addEventListener('click', () => {
     LaborModals.showAdvanceModal(firmId, periodId, data.period.leader_name, () => {
        renderLaborPeriodDetails(router, { id: periodId });
     });
  });

  document.getElementById('final-settle-btn')?.addEventListener('click', () => {
    const net = parseFloat(document.getElementById('sum-net').textContent.replace(/,/g, ''));
    const totalWages = parseFloat(document.getElementById('sum-wages').textContent.replace(/,/g, ''));
    const totalExpenses = parseFloat(document.getElementById('sum-expenses').textContent.replace(/,/g, ''));
    const totalAdvances = parseFloat(document.getElementById('sum-advances').textContent.replace(/,/g, ''));

    LaborModals.showSettlementModal(firmId, periodId, data.period.leader_name, {
      wages: totalWages,
      expenses: totalExpenses,
      advances: totalAdvances,
      net: net
    }, () => {
      renderLaborPeriodDetails(router, { id: periodId });
    });
  });
}

function updateCalculations(data) {
  // Calculate Wages from workers in data
  let totalWages = data.workers.reduce((acc, w) => acc + (Number(w.total_wages) || 0), 0);
  
  // Expenses from table
  let totalExpenses = Array.from(document.querySelectorAll('#expenses-body tr:not(#no-expenses-row)')).reduce((acc, tr) => {
    const amtStr = tr.querySelector('td:nth-child(2)')?.textContent || '0';
    return acc + parseFloat(amtStr.replace('₹', '').replace(/,/g, ''));
  }, 0);

  let totalAdvances = data.advances.reduce((acc, adv) => acc + Number(adv.amount), 0);
  let netPayable = (totalWages + totalExpenses) - totalAdvances;

  document.getElementById('sum-wages').textContent = totalWages.toLocaleString();
  document.getElementById('sum-expenses').textContent = totalExpenses.toLocaleString();
  document.getElementById('sum-advances').textContent = totalAdvances.toLocaleString();
  document.getElementById('sum-net').textContent = netPayable.toLocaleString();
}
