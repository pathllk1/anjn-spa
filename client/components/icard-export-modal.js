import { fetchWithCSRF } from '../utils/api.js';

/**
 * Icard Export Modal Component for Master Roll
 * Allows filtering employees by project / site / category and exporting I-cards.
 */
export class IcardExportModal {
  constructor() {
    this.employees = [];
    this.isOpen    = false;
    this.filters   = { project: '', site: '', category: '' };
    this.options   = { projects: [], sites: [], categories: [] };
  }

  /* ── Open / Close ──────────────────────────────────────────────────── */

  async open() {
    this.isOpen = true;
    await this.fetchData();
    this.render();
  }

  close() {
    this.isOpen = false;
    const modal = document.getElementById('icard-export-modal-root');
    if (modal) modal.remove();
  }

  /* ── Data ──────────────────────────────────────────────────────────── */

  async fetchData() {
    try {
      const response = await fetch('/api/master-rolls', {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        this.employees = data.data;
        this.extractOptions();
      }
    } catch (error) {
      console.error('Error fetching employees for I-cards:', error);
      alert('Failed to load employees');
    }
  }

  extractOptions() {
    const unique = (key) =>
      [...new Set(this.employees.map(e => e[key]).filter(Boolean))].sort();
    this.options.projects   = unique('project');
    this.options.sites      = unique('site');
    this.options.categories = unique('category');
  }

  /* ── Export ────────────────────────────────────────────────────────── */

  async handleExport(format) {
    const btn      = document.getElementById(`icard-export-${format}-btn`);
    const origHTML = btn.innerHTML;
    btn.disabled   = true;
    btn.innerHTML  = `
      <span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
      Generating…
    `;

    try {
      const params   = new URLSearchParams({ format, ...this.filters }).toString();
      const response = await fetch(`/api/master-rolls/export-icards?${params}`, {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Export failed');
      }

      const blob     = await response.blob();
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement('a');
      a.href         = url;
      a.download     = [
        'Employee_ICards',
        this.filters.project  || 'AllProjects',
        this.filters.site     || 'AllSites',
        this.filters.category || 'AllCategories',
      ].join('_') + (format === 'pdf' ? '.pdf' : '.xlsx');
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error.message}`);
    } finally {
      btn.disabled  = false;
      btn.innerHTML = origHTML;
    }
  }

  /* ── Render ────────────────────────────────────────────────────────── */

  render() {
    let root = document.getElementById('icard-export-modal-root');
    if (!root) {
      root    = document.createElement('div');
      root.id = 'icard-export-modal-root';
      document.body.appendChild(root);
    }

    const selectCls = [
      'w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5',
      'text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all',
    ].join(' ');

    const optionHTML = (arr, current) =>
      arr.map(v => `<option value="${v}" ${current === v ? 'selected' : ''}>${v}</option>`).join('');

    root.innerHTML = `
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden">

          <!-- Header -->
          <div class="bg-gradient-to-r from-rose-600 to-pink-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
            <div class="flex items-center gap-3">
              <div class="bg-white/20 p-2 rounded-lg">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"/>
                </svg>
              </div>
              <div>
                <h2 class="text-xl font-bold">Export Employee I-Cards</h2>
                <p class="text-rose-100 text-xs">Filter and generate I-cards as PDF or Excel</p>
              </div>
            </div>
            <button id="icard-close-x" class="text-white/80 hover:text-white transition-colors">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 space-y-4">

            <!-- Project filter -->
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Project</label>
              <select id="icard-filter-project" class="${selectCls}">
                <option value="">All Projects</option>
                ${optionHTML(this.options.projects, this.filters.project)}
              </select>
            </div>

            <!-- Site filter -->
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Site</label>
              <select id="icard-filter-site" class="${selectCls}">
                <option value="">All Sites</option>
                ${optionHTML(this.options.sites, this.filters.site)}
              </select>
            </div>

            <!-- Category filter  ← NEW -->
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Category</label>
              <select id="icard-filter-category" class="${selectCls}">
                <option value="">All Categories</option>
                ${optionHTML(this.options.categories, this.filters.category)}
              </select>
            </div>

            <!-- Employee count preview -->
            <p id="icard-preview-count" class="text-xs text-slate-400 text-center pt-1">
              ${this._countLabel()}
            </p>

            <!-- Export buttons -->
            <div class="pt-2 border-t border-slate-100">
              <div class="grid grid-cols-2 gap-3">
                <button id="icard-export-pdf-btn"
                  class="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-rose-200 transition-all text-sm">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                  </svg>
                  Export PDF
                </button>
                <button id="icard-export-xlsx-btn"
                  class="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 transition-all text-sm">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  Export Excel
                </button>
              </div>
            </div>

          </div>

          <!-- Footer -->
          <div class="bg-slate-50 px-6 py-3 flex justify-center">
            <p class="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              Enterprise Grade Documents
            </p>
          </div>

        </div>
      </div>
    `;

    this.attachEvents();
  }

  /* ── Events ────────────────────────────────────────────────────────── */

  attachEvents() {
    document.getElementById('icard-close-x').onclick = () => this.close();

    const updateCount = () => {
      const el = document.getElementById('icard-preview-count');
      if (el) el.textContent = this._countLabel();
    };

    document.getElementById('icard-filter-project').onchange = (e) => {
      this.filters.project = e.target.value;
      updateCount();
    };
    document.getElementById('icard-filter-site').onchange = (e) => {
      this.filters.site = e.target.value;
      updateCount();
    };
    document.getElementById('icard-filter-category').onchange = (e) => {
      this.filters.category = e.target.value;
      updateCount();
    };

    document.getElementById('icard-export-pdf-btn').onclick  = () => this.handleExport('pdf');
    document.getElementById('icard-export-xlsx-btn').onclick = () => this.handleExport('xlsx');
  }

  /* ── Helpers ───────────────────────────────────────────────────────── */

  /** Count how many loaded employees match the current filters (client-side preview). */
  _countLabel() {
    const matched = this.employees.filter(e => {
      if (this.filters.project  && e.project  !== this.filters.project)  return false;
      if (this.filters.site     && e.site     !== this.filters.site)     return false;
      if (this.filters.category && e.category !== this.filters.category) return false;
      return true;
    }).length;
    const total = this.employees.length;
    return matched === total
      ? `${total} employee${total !== 1 ? 's' : ''} will be exported`
      : `${matched} of ${total} employee${total !== 1 ? 's' : ''} match current filters`;
  }
}