import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api, fetchWithCSRF } from '../../utils/api.js';
import { authManager } from '../../utils/auth.js';
import { LaborModals } from '../../components/labor/LaborModals.js';
import { toast } from '../../components/admin/toast.js';

export async function renderLaborDashboard(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const user = authManager.getUser();
  const firmId = user.firm_id;

  try {
    // 1. Fetch Leaders and Periods in parallel
    const [leadersRes, periodsRes] = await Promise.all([
      api.get(`/api/pg/labor/leaders?firm_id=${firmId}`),
      api.get(`/api/pg/labor/periods?firm_id=${firmId}`)
    ]);

    const leaders = leadersRes.data || [];
    const periods = periodsRes.data || [];

    const content = `
      <div class="w-full px-4 py-8 space-y-8">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 class="text-3xl font-black text-slate-900 tracking-tight">Labor Management</h1>
            <p class="text-slate-500 font-medium">Track dynamic labor, attendance, and settlements.</p>
          </div>
          <div class="flex gap-3 w-full md:w-auto">
            <button id="add-leader-btn" class="flex-1 md:flex-none bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
              New Leader
            </button>
            <button id="add-period-btn" class="flex-1 md:flex-none bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              Start Work Period
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Active Periods -->
          <div class="lg:col-span-2 space-y-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 class="text-xl font-black text-slate-800 flex items-center gap-2 whitespace-nowrap">
                 <svg class="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                 Recent Work Periods
              </h2>
              <div class="flex items-center gap-2 w-full sm:w-auto">
                <span class="text-[10px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap">Filter:</span>
                <select id="leader-filter" class="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-sm w-full sm:w-40">
                  <option value="">All Leaders</option>
                  ${leaders.map(l => `<option value="${l.name}">${l.name}</option>`).join('')}
                </select>
              </div>
            </div>
            ${periods.length === 0 ? `
              <div class="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center">
                <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg class="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                </div>
                <h3 class="text-slate-900 font-bold mb-1">No work periods found</h3>
                <p class="text-slate-500 text-sm max-w-xs mx-auto">Start a new work period to begin tracking attendance and daily wages for your labor team.</p>
              </div>
            ` : `
              <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table class="w-full text-left border-collapse">
                  <thead class="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Leader</th>
                      <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Range</th>
                      <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                      <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-50" id="periods-table-body">
                    ${periods.map(p => `
                      <tr class="hover:bg-slate-50/80 transition cursor-pointer labor-period-row group" data-id="${p.id}">
                        <td class="px-6 py-4">
                           <div class="font-bold text-slate-900">${p.leader_name}</div>
                           <div class="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Batch ID: ${p.id.substring(0, 8)}</div>
                        </td>
                        <td class="px-6 py-4">
                           <div class="text-sm font-medium text-slate-600">
                             ${new Date(p.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - 
                             ${new Date(p.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                           </div>
                        </td>
                        <td class="px-6 py-4 text-sm">
                          <span class="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${p.status === 'Open' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}">
                            ${p.status}
                          </span>
                        </td>
                        <td class="px-6 py-4 text-right">
                          <div class="flex items-center justify-end gap-2">
                             ${p.status === 'Open' ? `
                               <button class="edit-period-btn p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition lg:opacity-0 lg:group-hover:opacity-100" data-period='${JSON.stringify(p).replace(/'/g, "&apos;")}' title="Edit Period">
                                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                               </button>
                               <button class="delete-period-btn p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition lg:opacity-0 lg:group-hover:opacity-100" data-id="${p.id}" title="Delete Batch">
                                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                               </button>
                             ` : ''}
                             <a href="/labor/periods/${p.id}" data-navigo class="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-1.5 rounded-lg font-bold text-xs transition inline-block">
                                View Details
                             </a>
                          </div>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- Leaders Sidebar -->
          <div class="space-y-4">
            <h2 class="text-xl font-black text-slate-800 flex items-center gap-2">
               <svg class="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/></svg>
               Labor Leaders
            </h2>
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 divide-y divide-slate-50">
              ${leaders.length === 0 ? `
                <p class="text-slate-400 text-sm text-center py-8 italic font-medium">No leaders registered yet.</p>
              ` : leaders.map(l => `
                <div class="p-4 flex flex-col group hover:bg-slate-50 transition rounded-xl">
                  <div class="flex justify-between items-center mb-1">
                    <div class="font-bold text-slate-900">${l.name}</div>
                    <div class="flex items-center gap-1">
                      <button class="edit-leader-btn p-1 text-slate-300 hover:text-indigo-600 transition lg:opacity-0 lg:group-hover:opacity-100" data-leader='${JSON.stringify(l).replace(/'/g, "&apos;")}' title="Edit Leader">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button class="delete-leader-btn p-1 text-slate-300 hover:text-rose-600 transition lg:opacity-0 lg:group-hover:opacity-100" data-id="${l.id}" data-name="${l.name}" title="Delete Leader">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                  <div class="flex justify-between items-center mb-2">
                    <div class="text-xs text-slate-400 font-medium">${l.phone || 'No phone recorded'}</div>
                    <span class="text-[10px] ${l.status === 'Active' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'} px-2 py-0.5 rounded-lg font-black uppercase tracking-widest">
                      ${l.status}
                    </span>
                  </div>
                  ${l.bank_name ? `
                    <div class="bg-slate-50 group-hover:bg-white p-2 rounded-lg border border-slate-100 space-y-1">
                       <div class="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                          <svg class="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                          ${l.bank_name}
                       </div>
                       <div class="text-[10px] font-medium text-slate-400 pl-4.5">
                          ${l.account_number || 'No A/C'} • ${l.ifsc_code || 'No IFSC'}
                       </div>
                    </div>
                  ` : `
                    <div class="text-[9px] text-slate-300 italic">No bank details added</div>
                  `}
                </div>
              `).join('')}
            </div>
            
            <div class="bg-indigo-900 rounded-2xl p-5 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
               <div class="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 blur-xl"></div>
               <div class="relative z-10">
                  <h4 class="font-bold mb-1">Quick Tip</h4>
                  <p class="text-indigo-200 text-xs leading-relaxed">Each leader manages a specific batch of workers. Attendance is tracked daily and settled in bulk.</p>
               </div>
            </div>
          </div>
        </div>
      </div>
    `;

    renderLayout(content, router);
    setupDashboardEvents(router, firmId, leaders);

  } catch (error) {
    console.error('Labor Dashboard Error:', error);
    renderLayout(`<div class="p-8 text-red-600">Failed to load labor data: ${error.message}</div>`, router);
  }
}

function setupDashboardEvents(router, firmId, leaders) {
  // Leader Filter logic
  document.getElementById('leader-filter')?.addEventListener('change', (e) => {
    const selectedLeader = e.target.value;
    const rows = document.querySelectorAll('.labor-period-row');
    rows.forEach(row => {
      const leaderName = row.querySelector('.font-bold.text-slate-900').textContent.trim();
      if (!selectedLeader || leaderName === selectedLeader) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });

  document.getElementById('add-leader-btn')?.addEventListener('click', () => {
    LaborModals.showLeaderModal(firmId, () => renderLaborDashboard(router));
  });

  document.getElementById('add-period-btn')?.addEventListener('click', () => {
    LaborModals.showPeriodModal(firmId, leaders, () => renderLaborDashboard(router));
  });

  // Handle Edit Leader
  document.querySelectorAll('.edit-leader-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const leaderData = JSON.parse(btn.getAttribute('data-leader'));
      LaborModals.showEditLeaderModal(leaderData, () => renderLaborDashboard(router));
    });
  });

  // Handle Delete Leader
  document.querySelectorAll('.delete-leader-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      
      if (confirm(`Are you sure you want to delete labor leader "${name}"? This will only work if there are no work periods associated with them.`)) {
        try {
          const res = await api.delete(`/api/pg/labor/leaders/${id}`);
          toast.success(res.message || 'Leader deleted successfully');
          renderLaborDashboard(router);
        } catch (err) {
          toast.error(err.message || 'Failed to delete leader');
        }
      }
    });
  });

  // Handle row clicks for periods using delegation
  document.getElementById('periods-table-body')?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.edit-period-btn');
    if (editBtn) {
      e.stopPropagation();
      const periodData = JSON.parse(editBtn.getAttribute('data-period'));
      LaborModals.showEditPeriodModal(periodData, leaders, () => renderLaborDashboard(router));
      return;
    }

    const deleteBtn = e.target.closest('.delete-period-btn');
    if (deleteBtn) {
      e.stopPropagation();
      const id = deleteBtn.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this work period? This will permanently remove all attendance and worker data for this batch.')) {
        try {
          await api.delete(`/api/pg/labor/periods/${id}`);
          toast.success('Period deleted successfully');
          renderLaborDashboard(router);
        } catch (err) {
          toast.error('Failed to delete period: ' + err.message);
        }
      }
      return;
    }

    const row = e.target.closest('.labor-period-row');
    if (row) {
      // Prevent default to avoid double-navigation or browser reloading
      e.preventDefault();
      const id = row.getAttribute('data-id');
      router.navigate(`/labor/periods/${id}`);
    }
  });
}
