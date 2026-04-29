import { fetchWithCSRF } from '../utils/api.js';

/**
 * Icard Export Modal Component for Master Roll
 * Allows filtering employees by project/site and exporting I-cards.
 */
export class IcardExportModal {
  constructor() {
    this.employees = [];
    this.isOpen = false;
    this.filters = {
      project: '',
      site: ''
    };
    this.options = {
      projects: [],
      sites: []
    };
  }

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
      }
    } catch (error) {
      console.error('Error fetching employees for I-cards:', error);
      alert('Failed to load employees');
    }
  }

  extractOptions() {
    this.options.projects = [...new Set(this.employees.map(e => e.project).filter(Boolean))].sort();
    this.options.sites = [...new Set(this.employees.map(e => e.site).filter(Boolean))].sort();
  }

  async handleExport(format) {
    const exportBtn = document.getElementById(`icard-export-${format}-btn`);
    const originalText = exportBtn.innerHTML;
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span> Generating...';

    try {
      const queryParams = new URLSearchParams(this.filters).toString();
      const response = await fetch(`/api/master-rolls/export-icards?format=${format}&${queryParams}`, {
        method: 'GET',
        headers: {
           // Auth is handled by cookies
        }
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Employee_ICards_${this.filters.project || 'All'}_${this.filters.site || 'All'}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export I-cards');
    } finally {
      exportBtn.disabled = false;
      exportBtn.innerHTML = originalText;
    }
  }

  render() {
    let root = document.getElementById('icard-export-modal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'icard-export-modal-root';
      document.body.appendChild(root);
    }

    root.innerHTML = `
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
          
          <!-- Header -->
          <div class="bg-gradient-to-r from-rose-600 to-pink-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
            <div class="flex items-center gap-3">
              <div class="bg-white/20 p-2 rounded-lg">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"/></svg>
              </div>
              <div>
                <h2 class="text-xl font-bold">Export Employee I-Cards</h2>
                <p class="text-rose-100 text-xs">Filter and generate enterprise-grade I-cards</p>
              </div>
            </div>
            <button id="icard-close-x" class="text-white/80 hover:text-white transition-colors">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 space-y-4">
            <div class="space-y-2">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Project Filter</label>
              <select id="icard-filter-project" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all">
                <option value="">All Projects</option>
                ${this.options.projects.map(p => `<option value="${p}" ${this.filters.project === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>

            <div class="space-y-2">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Site Filter</label>
              <select id="icard-filter-site" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all">
                <option value="">All Sites</option>
                ${this.options.sites.map(s => `<option value="${s}" ${this.filters.site === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>

            <div class="pt-4 border-t border-slate-100">
              <div class="grid grid-cols-2 gap-3">
                <button id="icard-export-pdf-btn" class="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-rose-200 transition-all text-sm">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9h1.5m1.5 0H13m-4 4h4m-4 4h4"/></svg>
                  Export PDF
                </button>
                <button id="icard-export-xlsx-btn" class="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 transition-all text-sm">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  Export Excel
                </button>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="bg-slate-50 px-6 py-4 flex justify-center">
            <p class="text-[10px] text-slate-400 text-center uppercase tracking-widest font-bold">Enterprise Grade Documents</p>
          </div>

        </div>
      </div>
    `;

    this.attachEvents();
  }

  attachEvents() {
    document.getElementById('icard-close-x').onclick = () => this.close();
    
    document.getElementById('icard-filter-project').onchange = (e) => {
      this.filters.project = e.target.value;
    };
    
    document.getElementById('icard-filter-site').onchange = (e) => {
      this.filters.site = e.target.value;
    };

    document.getElementById('icard-export-pdf-btn').onclick = () => this.handleExport('pdf');
    document.getElementById('icard-export-xlsx-btn').onclick = () => this.handleExport('xlsx');
  }
}
