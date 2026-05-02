import { api } from '../../utils/api.js';

/**
 * Enterprise-Grade Data Quality Analysis Modal
 * SCOPE: Only ACTIVE employees are analyzed and reported.
 */
export class DataQualityModal {
  constructor(onEdit) {
    this.masterRolls = [];
    this.currentTab = 'missing';
    this.missingDataReport = [];
    this.invalidDataReport = [];
    this.isOpen = false;
    this.onEdit = onEdit; // Callback to trigger external edit modal
  }

  /**
   * Initialize data (called when page data refreshes)
   */
  init(masterRolls) {
    // ROOT FILTER: Only accept Active employees for this module
    this.masterRolls = Array.isArray(masterRolls) 
      ? masterRolls.filter(emp => emp.status === 'Active') 
      : [];
      
    if (this.isOpen) {
      this.generateReports();
      this.renderReports();
    }
  }

  /**
   * Open the modal with 95% screen layout
   */
  open(data) {
    this.isOpen = true;
    // ROOT FILTER: Only accept Active employees for this module
    if (data) {
      this.masterRolls = data.filter(emp => emp.status === 'Active');
    }
    
    this.render();
    this.generateReports();
    this.renderReports();
  }

  close() {
    this.isOpen = false;
    const root = document.getElementById('data-quality-modal-root');
    if (root) root.remove();
  }

  /**
   * Robust UI Template using pure Tailwind
   */
  render() {
    let root = document.getElementById('data-quality-modal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'data-quality-modal-root';
      document.body.appendChild(root);
    }

    // Modal with 95% Width/Height
    root.innerHTML = `
      <div id="data-quality-backdrop" class="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[70] flex items-center justify-center p-2 sm:p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-[95%] h-[95%] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
          
          <!-- Enterprise Header -->
          <div class="bg-slate-900 px-8 py-5 flex justify-between items-center shrink-0 border-b border-slate-700">
            <div class="flex items-center gap-4">
              <div class="bg-emerald-500 p-2.5 rounded-xl shadow-lg shadow-emerald-500/20">
                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <h2 class="text-2xl font-black text-white tracking-tight">Active Force Intelligence</h2>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <p class="text-slate-400 text-xs font-bold uppercase tracking-widest">Auditing Active Personnel Only</p>
                </div>
              </div>
            </div>
            <button id="close-data-quality-modal" class="text-slate-400 hover:text-white hover:bg-white/10 p-2.5 rounded-xl transition-all duration-200">
              <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Main Layout -->
          <div class="flex-1 overflow-hidden flex flex-col bg-slate-50">
            
            <!-- Summary Dashboard -->
            <div class="p-8 pb-0 shrink-0">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                ${this.renderStatCard('Active Employees', 'dq-total-employees', 'bg-white', 'text-slate-900', 'border-slate-200')}
                ${this.renderStatCard('Verified Records', 'dq-complete-records', 'bg-emerald-50', 'text-emerald-700', 'border-emerald-100')}
                ${this.renderStatCard('Action Required', 'dq-incomplete-records', 'bg-amber-50', 'text-amber-700', 'border-amber-100')}
                ${this.renderStatCard('Data Failures', 'dq-invalid-records', 'bg-rose-50', 'text-rose-700', 'border-rose-100')}
              </div>
            </div>

            <!-- Tab Container -->
            <div class="px-8 mt-8 flex-1 overflow-hidden flex flex-col">
              <div class="flex gap-2 bg-slate-200/50 p-1.5 rounded-2xl w-fit shrink-0">
                <button class="data-quality-tab px-8 py-3 rounded-xl font-black text-sm transition-all duration-200 ${this.currentTab === 'missing' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500 hover:text-slate-700'}" data-tab="missing">
                  MISSING DATA AUDIT
                </button>
                <button class="data-quality-tab px-8 py-3 rounded-xl font-black text-sm transition-all duration-200 ${this.currentTab === 'invalid' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500 hover:text-slate-700'}" data-tab="invalid">
                  VALIDATION FAILURES
                </button>
              </div>

              <!-- Table Viewports -->
              <div class="mt-6 flex-1 overflow-hidden bg-white rounded-3xl border border-slate-200 shadow-inner flex flex-col mb-8">
                
                <!-- Missing Tab -->
                <div id="missing-data-tab" class="${this.currentTab === 'missing' ? '' : 'hidden'} flex-1 flex flex-col overflow-hidden">
                  <div class="overflow-auto flex-1">
                    <table class="w-full text-sm border-collapse">
                      <thead class="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th class="px-8 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[11px]">Employee</th>
                          <th class="px-8 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[11px]">Project / Site</th>
                          <th class="px-8 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[11px]">Missing Attributes</th>
                          <th class="px-8 py-4 text-center font-black text-slate-500 uppercase tracking-widest text-[11px]">Severity</th>
                          <th class="px-8 py-4 text-right font-black text-slate-500 uppercase tracking-widest text-[11px] w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody id="missing-data-tbody" class="divide-y divide-slate-100"></tbody>
                    </table>
                  </div>
                </div>

                <!-- Invalid Tab -->
                <div id="invalid-data-tab" class="${this.currentTab === 'invalid' ? '' : 'hidden'} flex-1 flex flex-col overflow-hidden">
                  <div class="overflow-auto flex-1">
                    <table class="w-full text-sm border-collapse">
                      <thead class="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th class="px-8 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[11px]">Employee</th>
                          <th class="px-8 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[11px]">Project / Site</th>
                          <th class="px-8 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[11px]">Target Field</th>
                          <th class="px-8 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[11px]">Detected Value</th>
                          <th class="px-8 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[11px]">Validation Logic</th>
                          <th class="px-8 py-4 text-right font-black text-slate-500 uppercase tracking-widest text-[11px] w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody id="invalid-data-tbody" class="divide-y divide-slate-100"></tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- Enterprise Footer -->
          <div class="bg-white border-t border-slate-200 px-10 py-6 flex justify-between items-center shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
            <div class="flex items-center gap-6">
              <div class="flex flex-col">
                <span class="text-slate-400 text-[10px] font-black uppercase tracking-tighter">Audit Scope</span>
                <span class="text-emerald-600 text-xs font-bold uppercase tracking-widest">Active Personnel Only</span>
              </div>
              <div class="w-px h-8 bg-slate-200"></div>
              <p class="text-xs text-slate-400 max-w-md leading-relaxed">Inactive, suspended, or exited employees are automatically excluded from this intelligence report.</p>
            </div>
            <div class="flex gap-4">
              <button id="close-dq-modal-footer" class="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-sm transition-all duration-200 border border-slate-200">
                DISMISS
              </button>
              <button id="export-dq-report-btn" class="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-2xl shadow-indigo-500/40 transition-all duration-200 flex items-center gap-3">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                EXPORT ACTIVE FORCE AUDIT
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  renderStatCard(label, id, bg, text, border) {
    return `
      <div class="${bg} border ${border} rounded-3xl p-6 shadow-sm transition-transform duration-300 hover:scale-[1.02]">
        <div class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">${label}</div>
        <div class="text-4xl font-black ${text} tabular-nums" id="${id}">0</div>
      </div>
    `;
  }

  attachEventListeners() {
    const root = document.getElementById('data-quality-modal-root');
    if (!root) return;

    root.querySelector('#close-data-quality-modal').onclick = () => this.close();
    root.querySelector('#close-dq-modal-footer').onclick = () => this.close();
    root.querySelector('#export-dq-report-btn').onclick = () => this.exportReport();
    
    root.querySelector('#data-quality-backdrop').onclick = (e) => {
      if (e.target.id === 'data-quality-backdrop') this.close();
    };

    root.querySelectorAll('.data-quality-tab').forEach(btn => {
      btn.onclick = (e) => this.switchTab(e.currentTarget.dataset.tab);
    });

    // Delegate edit clicks
    root.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.dq-edit-btn');
      if (editBtn && this.onEdit) {
        const id = editBtn.dataset.id;
        this.close(); // Close data quality modal
        this.onEdit(id); // Open employee edit modal
      }
    });
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    const root = document.getElementById('data-quality-modal-root');
    if (!root) return;

    root.querySelectorAll('.data-quality-tab').forEach(btn => {
      const active = btn.dataset.tab === tabName;
      btn.classList.toggle('bg-white', active);
      btn.classList.toggle('text-indigo-600', active);
      btn.classList.toggle('shadow-xl', active);
      btn.classList.toggle('text-slate-500', !active);
    });

    root.querySelector('#missing-data-tab').classList.toggle('hidden', tabName !== 'missing');
    root.querySelector('#invalid-data-tab').classList.toggle('hidden', tabName !== 'invalid');
  }

  /**
   * Enhanced Data Validation with Fake/Pattern Detection
   */
  generateReports() {
    const required = ['phone_no', 'pan', 'aadhar', 'uan', 'project', 'site'];
    
    // Missing Data
    this.missingDataReport = this.masterRolls.map(emp => {
      const missing = required.filter(f => !emp[f] || emp[f].toString().trim() === '').map(f => this.getFieldLabel(f));
      return missing.length > 0 ? { 
        name: emp.employee_name || 'Unnamed', 
        id: emp.id || emp._id, 
        fields: missing,
        project: emp.project || 'N/A',
        site: emp.site || 'N/A'
      } : null;
    }).filter(Boolean);

    // Invalid & Fake Pattern Detection
    this.invalidDataReport = [];
    this.masterRolls.forEach(emp => {
      const id = emp.id || emp._id;
      const name = emp.employee_name || 'Unnamed';
      const project = emp.project || 'N/A';
      const site = emp.site || 'N/A';
      
      // Phone Validation
      if (emp.phone_no) {
        const val = emp.phone_no.toString().trim();
        if (!/^\d{10}$/.test(val)) {
          this.invalidDataReport.push({ name, id, project, site, field: 'Phone', value: val, issue: 'Must be 10 digits' });
        } else {
          // Fake patterns
          const allSame = /^(\d)\1{9}$/.test(val);
          const sequential = '0123456789876543210'.includes(val);
          if (allSame || sequential) {
            this.invalidDataReport.push({ name, id, project, site, field: 'Phone', value: val, issue: 'FAKE/PATTERN DETECTED' });
          }
        }
      }

      // Aadhar Validation
      if (emp.aadhar) {
        const val = emp.aadhar.toString().trim();
        if (!/^\d{12}$/.test(val)) {
          this.invalidDataReport.push({ name, id, project, site, field: 'Aadhar', value: val, issue: 'Must be 12 digits' });
        } else if (/^(\d)\1{11}$/.test(val)) {
          this.invalidDataReport.push({ name, id, project, site, field: 'Aadhar', value: val, issue: 'FAKE PATTERN' });
        }
      }

      // PAN Validation
      if (emp.pan) {
        const val = emp.pan.toString().trim().toUpperCase();
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val)) {
          this.invalidDataReport.push({ name, id, project, site, field: 'PAN', value: val, issue: 'Invalid Format (ABCDE1234F)' });
        }
      }
    });
  }

  renderReports() {
    const root = document.getElementById('data-quality-modal-root');
    if (!root) return;

    const allIssueIds = new Set([...this.invalidDataReport.map(r => r.id), ...this.missingDataReport.map(r => r.id)]);

    root.querySelector('#dq-total-employees').innerText = this.masterRolls.length;
    root.querySelector('#dq-complete-records').innerText = this.masterRolls.length - allIssueIds.size;
    root.querySelector('#dq-incomplete-records').innerText = this.missingDataReport.length;
    root.querySelector('#dq-invalid-records').innerText = new Set(this.invalidDataReport.map(r => r.id)).size;

    // Table Content
    root.querySelector('#missing-data-tbody').innerHTML = this.missingDataReport.length === 0 
      ? `<tr><td colspan="5" class="px-8 py-20 text-center text-emerald-500 font-black tracking-widest">PERFECT DATA COMPLETENESS</td></tr>`
      : this.missingDataReport.map(r => `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="px-8 py-5 font-black text-slate-800">${this.escapeHtml(r.name)}</td>
          <td class="px-8 py-5">
            <div class="flex flex-col">
              <span class="text-xs font-bold text-slate-600">${this.escapeHtml(r.project)}</span>
              <span class="text-[10px] text-slate-400 uppercase tracking-tighter">${this.escapeHtml(r.site)}</span>
            </div>
          </td>
          <td class="px-8 py-5">
            <div class="flex flex-wrap gap-2">
              ${r.fields.map(f => `<span class="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-wider border border-amber-200">${f}</span>`).join('')}
            </div>
          </td>
          <td class="px-8 py-5 text-center">
            <span class="px-3 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black">${r.fields.length}</span>
          </td>
          <td class="px-8 py-5 text-right">
            <button class="dq-edit-btn p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" data-id="${r.id}" title="Edit Employee">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
          </td>
        </tr>
      `).join('');

    root.querySelector('#invalid-data-tbody').innerHTML = this.invalidDataReport.length === 0
      ? `<tr><td colspan="6" class="px-8 py-20 text-center text-emerald-500 font-black tracking-widest">ALL FORMATS VALIDATED</td></tr>`
      : this.invalidDataReport.map(r => `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="px-8 py-5 font-black text-slate-800">${this.escapeHtml(r.name)}</td>
          <td class="px-8 py-5">
            <div class="flex flex-col">
              <span class="text-xs font-bold text-slate-600">${this.escapeHtml(r.project)}</span>
              <span class="text-[10px] text-slate-400 uppercase tracking-tighter">${this.escapeHtml(r.site)}</span>
            </div>
          </td>
          <td class="px-8 py-5"><span class="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black border border-indigo-100">${r.field}</span></td>
          <td class="px-8 py-5 font-mono text-xs text-rose-600 font-black">${this.escapeHtml(r.value)}</td>
          <td class="px-8 py-5"><span class="text-xs font-black text-rose-500 italic uppercase">${r.issue}</span></td>
          <td class="px-8 py-5 text-right">
            <button class="dq-edit-btn p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" data-id="${r.id}" title="Edit Employee">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
          </td>
        </tr>
      `).join('');
  }

  /**
   * Server-Side Export with Proper Cell Formatting & Styling
   */
  async exportReport() {
    const btn = document.getElementById('export-dq-report-btn');
    if (!btn) return;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> PROCESSING...`;

    try {
      const response = await fetch('/api/master-rolls/export-data-quality', {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (!response.ok) throw new Error('Export failed on server');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `ActiveForce_AuditReport_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to download report: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    }
  }

  getFieldLabel(key) {
    const map = { phone_no: 'Phone', pan: 'PAN', aadhar: 'Aadhar', uan: 'UAN', project: 'Project', site: 'Site' };
    return map[key] || key;
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
