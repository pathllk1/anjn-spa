import { fetchWithCSRF } from '../utils/api.js';

/**
 * Bulk Edit Modal Component for Master Roll
 * Allows editing multiple employees in a spreadsheet-like view.
 */
export class BulkEditModal {
  constructor(onSaveSuccess) {
    this.onSaveSuccess = onSaveSuccess;
    this.employees = [];
    this.filteredEmployees = [];
    this.updates = {}; // Store changes: { id: { field: value } }
    this.isOpen = false;
    
    this.filters = {
      project: '',
      site: '',
      category: '',
      bank: ''
    };
    
    this.options = {
      projects: [],
      sites: [],
      categories: [],
      banks: []
    };
  }

  async open() {
    this.isOpen = true;
    this.updates = {};
    await this.fetchData();
    this.render();
  }

  close() {
    this.isOpen = false;
    const modal = document.getElementById('bulk-edit-modal-root');
    if (modal) modal.remove();
  }

  async fetchData() {
    try {
      const response = await fetch('/api/master-rolls', {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        this.employees = data.data;
        this.extractOptions();
        this.applyFilters();
      }
    } catch (error) {
      console.error('Error fetching employees for bulk edit:', error);
      alert('Failed to load employees');
    }
  }

  extractOptions() {
    this.options.projects = [...new Set(this.employees.map(e => e.project).filter(Boolean))].sort();
    this.options.sites = [...new Set(this.employees.map(e => e.site).filter(Boolean))].sort();
    this.options.categories = [...new Set(this.employees.map(e => e.category).filter(Boolean))].sort();
    this.options.banks = [...new Set(this.employees.map(e => e.bank).filter(Boolean))].sort();
  }

  applyFilters() {
    this.filteredEmployees = this.employees.filter(e => {
      return (!this.filters.project || e.project === this.filters.project) &&
             (!this.filters.site || e.site === this.filters.site) &&
             (!this.filters.category || e.category === this.filters.category) &&
             (!this.filters.bank || e.bank === this.filters.bank);
    });
    this.renderTableBody();
  }

  handleFilterChange(field, value) {
    this.filters[field] = value;
    this.applyFilters();
  }

  handleCellEdit(id, field, value) {
    if (!this.updates[id]) this.updates[id] = {};
    this.updates[id][field] = value;
    
    // Update local state to keep UI in sync if filters re-apply
    const emp = this.employees.find(e => e.id === id);
    if (emp) emp[field] = value;
  }

  async handleSave() {
    const updateArray = Object.entries(this.updates).map(([id, data]) => ({
      id,
      data
    }));

    if (updateArray.length === 0) {
      alert('No changes to save');
      return;
    }

    const saveBtn = document.getElementById('bulk-edit-save-btn');
    const originalText = saveBtn.innerText;
    saveBtn.disabled = true;
    saveBtn.innerText = 'Saving...';

    try {
      const response = await fetchWithCSRF('/api/master-rolls/bulk-update', {
        method: 'PUT',
        body: JSON.stringify({ updates: updateArray })
      });
      const result = await response.json();
      if (result.success) {
        if (this.onSaveSuccess) this.onSaveSuccess();
        alert(`Successfully updated ${result.updated} employees`);
        this.close();
      } else {
        alert('Error: ' + (result.error || 'Failed to update'));
      }
    } catch (error) {
      console.error('Error saving bulk updates:', error);
      alert('Network error during save');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerText = originalText;
    }
  }

  render() {
    let root = document.getElementById('bulk-edit-modal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'bulk-edit-modal-root';
      document.body.appendChild(root);
    }

    root.innerHTML = `
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-10">
        <div class="bg-white w-full h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
          
          <!-- Header -->
          <div class="bg-gradient-to-r from-green-600 via-purple-600 to-red-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
            <div class="flex items-center gap-3">
              <div class="bg-white/20 p-2 rounded-lg">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </div>
              <div>
                <h2 class="text-xl font-bold">Bulk Edit Employees</h2>
                <p class="text-indigo-100 text-xs">Directly edit employee details in the grid below</p>
              </div>
            </div>
            <button id="bulk-edit-close-x" class="text-white/80 hover:text-white transition-colors">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></button>
            </button>
          </div>

          <!-- Toolbar / Filters -->
          <div class="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center gap-4 shrink-0">
            <div class="flex items-center gap-2">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Project:</label>
              <select id="bulk-filter-project" class="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[140px]">
                <option value="">All Projects</option>
                ${this.options.projects.map(p => `<option value="${p}" ${this.filters.project === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
            <div class="flex items-center gap-2">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Site:</label>
              <select id="bulk-filter-site" class="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[140px]">
                <option value="">All Sites</option>
                ${this.options.sites.map(s => `<option value="${s}" ${this.filters.site === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="flex items-center gap-2">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Category:</label>
              <select id="bulk-filter-category" class="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[140px]">
                <option value="">All Categories</option>
                ${this.options.categories.map(c => `<option value="${c}" ${this.filters.category === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
             <div class="flex items-center gap-2">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Bank:</label>
              <select id="bulk-filter-bank" class="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[140px]">
                <option value="">All Banks</option>
                ${this.options.banks.map(b => `<option value="${b}" ${this.filters.bank === b ? 'selected' : ''}>${b}</option>`).join('')}
              </select>
            </div>
            <div class="ml-auto flex items-center gap-2">
              <span id="bulk-edit-count" class="text-xs font-medium text-slate-500 bg-slate-200 px-3 py-1 rounded-full">
                ${this.filteredEmployees.length} records
              </span>
            </div>
          </div>

          <!-- Table Container -->
          <div class="flex-1 overflow-hidden bg-slate-100 p-4">
            <div class="h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto">
              <table class="w-full text-sm border-collapse table-auto">
                <thead class="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                  <tr>
                    <th class="px-4 py-3 text-left font-bold text-slate-700 w-16 bg-slate-50">#</th>
                    <th class="px-4 py-3 text-left font-bold text-slate-700 min-w-[200px] sticky left-0 z-30 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Employee Name</th>
                    <th class="px-4 py-3 text-left font-bold text-slate-700 min-w-[140px]">Phone No</th>
                    <th class="px-4 py-3 text-left font-bold text-slate-700 min-w-[120px]">PAN</th>
                    <th class="px-4 py-3 text-left font-bold text-slate-700 min-w-[140px]">UAN</th>
                    <th class="px-4 py-3 text-left font-bold text-slate-700 min-w-[140px]">ESIC</th>
                    <th class="px-4 py-3 text-left font-bold text-slate-700 min-w-[140px]">Project</th>
                    <th class="px-4 py-3 text-left font-bold text-slate-700 min-w-[140px]">Site</th>
                    <th class="px-4 py-3 text-left font-bold text-slate-700 min-w-[140px]">Category</th>
                    <th class="px-4 py-3 text-left font-bold text-slate-700 min-w-[140px]">Bank</th>
                    <th class="px-4 py-3 text-left font-bold text-slate-700 min-w-[160px]">A/C No</th>
                    <th class="px-4 py-3 text-left font-bold text-slate-700 min-w-[120px]">IFSC</th>
                    <th class="px-4 py-3 text-left font-bold text-slate-700 min-w-[100px]">Wage (₹)</th>
                    <th class="px-4 py-3 text-left font-bold text-slate-700 min-w-[120px]">Status</th>
                  </tr>
                </thead>
                <tbody id="bulk-edit-table-body" class="divide-y divide-slate-100">
                  <!-- Rows generated here -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3 shrink-0">
            <button id="bulk-edit-cancel-btn" class="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
              Discard Changes
            </button>
            <button id="bulk-edit-save-btn" class="px-8 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              Save All Changes
            </button>
          </div>

        </div>
      </div>
    `;

    this.renderTableBody();
    this.attachEvents();
  }

  renderTableBody() {
    const tbody = document.getElementById('bulk-edit-table-body');
    if (!tbody) return;

    if (this.filteredEmployees.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="px-4 py-20 text-center text-slate-400">
            <p class="text-base font-medium">No employees match the selected filters</p>
            <p class="text-xs">Adjust your filters to see more records</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.filteredEmployees.map((e, idx) => `
      <tr class="hover:bg-indigo-50/30 transition-colors group">
        <td class="px-4 py-2.5 text-slate-400 font-mono text-xs bg-white">${idx + 1}</td>
        <td class="px-4 py-2.5 font-bold text-slate-800 sticky left-0 z-10 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">${e.employee_name}</td>
        <td class="px-4 py-2.5">
          <input type="text" data-id="${e.id}" data-field="phone_no" value="${e.phone_no || ''}" 
            class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
        </td>
        <td class="px-4 py-2.5">
          <input type="text" data-id="${e.id}" data-field="pan" value="${e.pan || ''}" 
            class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all uppercase" />
        </td>
        <td class="px-4 py-2.5">
          <input type="text" data-id="${e.id}" data-field="uan" value="${e.uan || ''}" 
            class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
        </td>
        <td class="px-4 py-2.5">
          <input type="text" data-id="${e.id}" data-field="esic_no" value="${e.esic_no || ''}" 
            class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
        </td>
        <td class="px-4 py-2.5">
          <input type="text" data-id="${e.id}" data-field="project" value="${e.project || ''}" 
            class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
        </td>
        <td class="px-4 py-2.5">
          <input type="text" data-id="${e.id}" data-field="site" value="${e.site || ''}" 
            class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
        </td>
        <td class="px-4 py-2.5">
          <input type="text" data-id="${e.id}" data-field="category" value="${e.category || ''}" 
            class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
        </td>
        <td class="px-4 py-2.5">
          <input type="text" data-id="${e.id}" data-field="bank" value="${e.bank || ''}" 
            class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
        </td>
        <td class="px-4 py-2.5">
          <input type="text" data-id="${e.id}" data-field="account_no" value="${e.account_no || ''}" 
            class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
        </td>
        <td class="px-4 py-2.5">
          <input type="text" data-id="${e.id}" data-field="ifsc" value="${e.ifsc || ''}" 
            class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all uppercase" />
        </td>
        <td class="px-4 py-2.5">
          <input type="number" data-id="${e.id}" data-field="p_day_wage" value="${e.p_day_wage || ''}" 
            class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
        </td>
        <td class="px-4 py-2.5">
          <select data-id="${e.id}" data-field="status" 
            class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all">
            <option value="Active" ${e.status === 'Active' ? 'selected' : ''}>Active</option>
            <option value="Inactive" ${e.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
            <option value="Left" ${e.status === 'Left' ? 'selected' : ''}>Left</option>
          </select>
        </td>
      </tr>
    `).join('');

    // Attach cell input listeners
    tbody.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('change', (e) => {
        this.handleCellEdit(e.target.dataset.id, e.target.dataset.field, e.target.value);
        e.target.classList.add('border-amber-400', 'bg-amber-50/30');
      });
    });
  }

  attachEvents() {
    document.getElementById('bulk-edit-close-x').onclick = () => this.close();
    document.getElementById('bulk-edit-cancel-btn').onclick = () => {
      if (Object.keys(this.updates).length > 0) {
        if (confirm('Discard all unsaved changes?')) this.close();
      } else {
        this.close();
      }
    };
    document.getElementById('bulk-edit-save-btn').onclick = () => this.handleSave();

    ['project', 'site', 'category', 'bank'].forEach(field => {
      document.getElementById(`bulk-filter-${field}`).onchange = (e) => {
        this.handleFilterChange(field, e.target.value);
        document.getElementById('bulk-edit-count').innerText = `${this.filteredEmployees.length} records`;
      };
    });
  }
}
