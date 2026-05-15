/**
 * gst-returns.js - Unified GST Dashboard (GSTR-1 & GSTR-3B)
 * Provides a tabbed interface for all GST compliance reports.
 */

import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api } from '../../utils/api.js';
import { GSTR3BManager } from './gstr3b.js';

export async function renderGSTReturns(router, params) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = getGSTReturnsHTML();
  renderLayout(content, router);

  setTimeout(() => {
    initGSTReturnsScripts(params?.tab || 'gstr1');
  }, 100);
}

function getGSTReturnsHTML() {
  return `
<div class="space-y-4">
  <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
    <div>
      <h1 class="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
        GST Returns Dashboard
      </h1>
      <p class="text-sm text-gray-600 mt-1">GSTR-1 & GSTR-3B Compliance (FY 2025-26 Ready)</p>
    </div>
    
    <div class="flex flex-wrap items-center gap-2">
      <button id="generate-report-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition text-nowrap">
        Generate Report
      </button>
      <div id="gstr1-actions" class="flex gap-2">
        <button id="validate-btn" class="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg font-medium text-sm transition" disabled>
          Validate
        </button>
        <button id="export-json-btn" class="bg-slate-700 hover:bg-slate-800 text-white px-3 py-2 rounded-lg font-medium text-sm transition" disabled>
          JSON
        </button>
        <button id="export-excel-btn" class="bg-green-700 hover:bg-green-800 text-white px-3 py-2 rounded-lg font-medium text-sm transition" disabled>
          Excel
        </button>
        <button id="export-pdf-btn" class="bg-red-700 hover:bg-red-800 text-white px-3 py-2 rounded-lg font-medium text-sm transition" disabled>
          PDF
        </button>
      </div>
      <div id="gstr3b-actions" class="flex gap-2 hidden">
        <button id="export-3b-pdf-btn" class="bg-red-700 hover:bg-red-800 text-white px-3 py-2 rounded-lg font-medium text-sm transition">
          Download PDF
        </button>
      </div>
    </div>
  </div>

  <!-- Primary Dashboard Tabs -->
  <div class="flex gap-4 border-b border-gray-200">
    <button class="gst-main-tab px-6 py-3 font-bold text-sm border-b-2 border-indigo-600 text-indigo-600 transition" data-main-tab="gstr1">
      GSTR-1 (Outward)
    </button>
    <button class="gst-main-tab px-6 py-3 font-bold text-sm border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition" data-main-tab="gstr3b">
      GSTR-3B (Summary)
    </button>
  </div>

  <!-- Shared Filters -->
  <div class="bg-white shadow-lg rounded-xl p-6 border border-gray-200">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-2">Select Month & Year</label>
        <input type="month" id="report-month" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-700 mb-2">Firm GSTIN</label>
        <select id="firm-gstin" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
          <option value="">Select GSTIN</option>
        </select>
      </div>
      <div class="flex items-end">
        <button id="apply-filters-btn" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition">
          Apply Filters
        </button>
      </div>
    </div>
  </div>

  <!-- GSTR-1 Content Wrapper -->
  <div id="gstr1-wrapper" class="space-y-4">
    <div id="summary-cards" class="grid grid-cols-1 md:grid-cols-4 gap-4 hidden">
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div class="text-2xl font-bold text-blue-600" id="total-invoices">0</div>
        <div class="text-xs text-blue-700 font-medium mt-1">Total Invoices</div>
      </div>
      <div class="bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="text-2xl font-bold text-green-600" id="total-taxable">₹0</div>
        <div class="text-xs text-green-700 font-medium mt-1">Total Taxable Value</div>
      </div>
      <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div class="text-2xl font-bold text-purple-600" id="total-gst">₹0</div>
        <div class="text-xs text-purple-700 font-medium mt-1">Total GST</div>
      </div>
      <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div class="text-2xl font-bold text-orange-600" id="total-invoice-value">₹0</div>
        <div class="text-xs text-orange-700 font-medium mt-1">Total Invoice Value</div>
      </div>
    </div>

    <div id="validation-alert" class="hidden"></div>

    <div class="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden">
      <div class="flex flex-wrap gap-1 border-b border-gray-200 p-4 overflow-x-auto bg-gray-50/50">
        <button class="gstr1-tab px-3 py-2 font-medium text-xs border-b-2 border-indigo-600 text-indigo-600 whitespace-nowrap" data-tab="b2b">4A. B2B</button>
        <button class="gstr1-tab px-3 py-2 font-medium text-xs border-b-2 border-transparent text-gray-600 hover:text-gray-900 whitespace-nowrap" data-tab="b2b-rc">4B. B2B (RC)</button>
        <button class="gstr1-tab px-3 py-2 font-medium text-xs border-b-2 border-transparent text-gray-600 hover:text-gray-900 whitespace-nowrap" data-tab="b2cl">5. B2CL</button>
        <button class="gstr1-tab px-3 py-2 font-medium text-xs border-b-2 border-transparent text-gray-600 hover:text-gray-900 whitespace-nowrap" data-tab="exports">6. Exports</button>
        <button class="gstr1-tab px-3 py-2 font-medium text-xs border-b-2 border-transparent text-gray-600 hover:text-gray-900 whitespace-nowrap" data-tab="b2cs">7. B2CS</button>
        <button class="gstr1-tab px-3 py-2 font-medium text-xs border-b-2 border-transparent text-gray-600 hover:text-gray-900 whitespace-nowrap" data-tab="nil-rated">8. Nil Rated</button>
        <button class="gstr1-tab px-3 py-2 font-medium text-xs border-b-2 border-transparent text-gray-600 hover:text-gray-900 whitespace-nowrap" data-tab="amendments">9. Amendments</button>
        <button class="gstr1-tab px-3 py-2 font-medium text-xs border-b-2 border-transparent text-gray-600 hover:text-gray-900 whitespace-nowrap" data-tab="advances">11. Advances</button>
        <button class="gstr1-tab px-3 py-2 font-medium text-xs border-b-2 border-transparent text-gray-600 hover:text-gray-900 whitespace-nowrap" data-tab="hsn-b2b">12. HSN (B2B)</button>
        <button class="gstr1-tab px-3 py-2 font-medium text-xs border-b-2 border-transparent text-gray-600 hover:text-gray-900 whitespace-nowrap" data-tab="hsn-b2c">12. HSN (B2C)</button>
        <button class="gstr1-tab px-3 py-2 font-medium text-xs border-b-2 border-transparent text-gray-600 hover:text-gray-900 whitespace-nowrap" data-tab="documents">13. Documents</button>
      </div>

      <div class="p-6" id="gstr1-tab-container">
        <div class="text-center text-gray-500 py-8">Generate report to view GSTR-1 data</div>
      </div>
    </div>
  </div>

  <!-- GSTR-3B Content Wrapper -->
  <div id="gstr3b-wrapper" class="hidden space-y-4">
    <div id="gstr3b-container">
      <div class="bg-white shadow-lg rounded-xl border border-gray-200 p-12 text-center">
        <div class="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        </div>
        <h3 class="text-lg font-bold text-gray-900">GSTR-3B Summary Report</h3>
        <p class="text-gray-500 max-w-sm mx-auto mt-2">Generate the report to see your auto-populated liability and ITC summary for the selected period.</p>
      </div>
    </div>
  </div>

  <!-- Validation Modal (GSTR-1) -->
  <div id="validation-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
      <div class="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
        <h2 class="text-xl font-bold text-white flex items-center gap-2">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Validation Report
        </h2>
        <button id="close-validation-modal" class="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-1 transition">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="overflow-y-auto flex-1 px-6 py-4" id="validation-modal-content"></div>
      <div class="border-t border-gray-200 px-6 py-4 flex justify-end">
        <button id="close-validation-modal-btn" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition">Close</button>
      </div>
    </div>
  </div>
</div>
`;
}

function initGSTReturnsScripts(initialTab) {
  const manager = new GSTReturnsManager();
  manager.init(initialTab);
}

class GSTReturnsManager {
  constructor() {
    this.currentGSTR1 = null;
    this.firmGstins = [];
    this.activeMainTab = 'gstr1';
    this.activeGSTR1Tab = 'b2b';
    this.gstr3bManager = new GSTR3BManager('gstr3b-container');
  }

  init(initialTab) {
    this.cacheElements();
    this.attachEventListeners();
    this.loadFirmGstins();
    this.setDefaultDates();
    if (initialTab) this.switchMainTab(initialTab);
  }

  cacheElements() {
    this.elements = {
      reportMonth: document.getElementById('report-month'),
      firmGstin: document.getElementById('firm-gstin'),
      generateBtn: document.getElementById('generate-report-btn'),
      applyFiltersBtn: document.getElementById('apply-filters-btn'),
      validateBtn: document.getElementById('validate-btn'),
      exportJsonBtn: document.getElementById('export-json-btn'),
      exportExcelBtn: document.getElementById('export-excel-btn'),
      exportPdfBtn: document.getElementById('export-pdf-btn'),
      export3bPdfBtn: document.getElementById('export-3b-pdf-btn'),
      summaryCards: document.getElementById('summary-cards'),
      validationAlert: document.getElementById('validation-alert'),
      mainTabs: document.querySelectorAll('.gst-main-tab'),
      gstr1Wrapper: document.getElementById('gstr1-wrapper'),
      gstr3bWrapper: document.getElementById('gstr3b-wrapper'),
      gstr1Tabs: document.querySelectorAll('.gstr1-tab'),
      gstr1TabContainer: document.getElementById('gstr1-tab-container'),
      gstr1Actions: document.getElementById('gstr1-actions'),
      gstr3bActions: document.getElementById('gstr3b-actions'),
      validationModal: document.getElementById('validation-modal'),
      validationModalContent: document.getElementById('validation-modal-content'),
      closeValidationModalBtn: document.getElementById('close-validation-modal-btn'),
      closeValidationModalIcon: document.getElementById('close-validation-modal'),
    };
  }

  attachEventListeners() {
    this.elements.generateBtn.addEventListener('click', () => this.generateActiveReport());
    this.elements.applyFiltersBtn.addEventListener('click', () => this.generateActiveReport());
    this.elements.validateBtn.addEventListener('click', () => this.showValidation());
    this.elements.exportJsonBtn.addEventListener('click', () => this.exportGSTR1JSON());
    this.elements.exportExcelBtn.addEventListener('click', () => this.exportGSTR1Excel());
    this.elements.exportPdfBtn.addEventListener('click', () => this.exportGSTR1PDF());
    this.elements.export3bPdfBtn.addEventListener('click', () => this.exportGSTR3BPDF());

    this.elements.mainTabs.forEach(btn => {
      btn.addEventListener('click', () => this.switchMainTab(btn.dataset.mainTab));
    });

    this.elements.gstr1Tabs.forEach(btn => {
      btn.addEventListener('click', () => this.switchGSTR1Tab(btn.dataset.tab));
    });

    this.elements.closeValidationModalBtn.addEventListener('click', () => this.closeValidationModal());
    this.elements.closeValidationModalIcon.addEventListener('click', () => this.closeValidationModal());
  }

  setDefaultDates() {
    const today = new Date();
    this.elements.reportMonth.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  }

  async loadFirmGstins() {
    try {
      const firmData = await api.get('/api/admin/my-firm');
      if (firmData.success && firmData.data) {
        const firm = firmData.data;
        const locations = firm.locations || [];
        locations.forEach(loc => {
          if (loc.gst_number) {
            const opt = document.createElement('option');
            opt.value = loc.gst_number;
            opt.textContent = `${loc.gst_number} (${loc.is_default ? 'Principal' : 'Additional'}) - ${loc.state || ''}`;
            this.elements.firmGstin.appendChild(opt);
            if (loc.is_default) this.elements.firmGstin.value = loc.gst_number;
          }
        });
        if (!this.elements.firmGstin.value && locations.length > 0) {
          this.elements.firmGstin.value = locations[0].gst_number;
        }
      }
    } catch (err) { console.error('Error loading firm GSTINs:', err); }
  }

  switchMainTab(tab) {
    this.activeMainTab = tab;
    this.elements.mainTabs.forEach(btn => {
      const active = btn.dataset.mainTab === tab;
      btn.classList.toggle('border-indigo-600', active);
      btn.classList.toggle('text-indigo-600', active);
      btn.classList.toggle('border-transparent', !active);
      btn.classList.toggle('text-gray-500', !active);
    });

    this.elements.gstr1Wrapper.classList.toggle('hidden', tab !== 'gstr1');
    this.elements.gstr3bWrapper.classList.toggle('hidden', tab !== 'gstr3b');
    this.elements.gstr1Actions.classList.toggle('hidden', tab !== 'gstr1');
    this.elements.gstr3bActions.classList.toggle('hidden', tab !== 'gstr3b');
  }

  switchGSTR1Tab(tab) {
    this.activeGSTR1Tab = tab;
    this.elements.gstr1Tabs.forEach(btn => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('border-indigo-600', active);
      btn.classList.toggle('text-indigo-600', active);
      btn.classList.toggle('border-transparent', !active);
      btn.classList.toggle('text-gray-600', !active);
    });
    this.renderGSTR1Tab();
  }

  async generateActiveReport() {
    const reportMonth = this.elements.reportMonth.value;
    const firmGstin = this.elements.firmGstin.value;
    if (!reportMonth || !firmGstin) return alert('Please select month and GSTIN');

    if (this.activeMainTab === 'gstr1') {
      await this.generateGSTR1(reportMonth, firmGstin);
    } else {
      await this.gstr3bManager.generateReport(reportMonth, firmGstin);
    }
  }

  async generateGSTR1(reportMonth, firmGstin) {
    const [year, month] = reportMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month}-${lastDay}`;

    try {
      this.elements.generateBtn.disabled = true;
      this.elements.generateBtn.textContent = 'Generating...';

      const json = await api.get(`/api/gst/gstr1/report?startDate=${startDate}&endDate=${endDate}&firmGstin=${firmGstin}`);
      if (json.success) {
        this.currentGSTR1 = json.data;
        this.renderGSTR1Summary();
        this.showGSTR1ValidationStatus();
        this.renderGSTR1Tab();
        this.elements.summaryCards.classList.remove('hidden');
        this.elements.validateBtn.disabled = false;
        this.elements.exportJsonBtn.disabled = false;
        this.elements.exportExcelBtn.disabled = false;
        this.elements.exportPdfBtn.disabled = false;
      } else { alert('Error: ' + json.error); }
    } catch (err) { console.error('GSTR1 Error:', err); }
    finally {
      this.elements.generateBtn.disabled = false;
      this.elements.generateBtn.textContent = 'Generate Report';
    }
  }

  renderGSTR1Summary() {
    const { summary } = this.currentGSTR1;
    document.getElementById('total-invoices').textContent = summary.total_invoices;
    document.getElementById('total-taxable').textContent = '₹' + summary.total_taxable_value.toLocaleString('en-IN');
    document.getElementById('total-gst').textContent = '₹' + (summary.total_gst || 0).toLocaleString('en-IN');
    document.getElementById('total-invoice-value').textContent = '₹' + summary.total_invoice_value.toLocaleString('en-IN');
  }

  showGSTR1ValidationStatus() {
    const { validation } = this.currentGSTR1;
    const alertDiv = this.elements.validationAlert;
    alertDiv.className = validation?.errors?.length > 0 ? 'bg-red-50 border border-red-200 rounded-lg p-4' : 'bg-green-50 border border-green-200 rounded-lg p-4';
    alertDiv.innerHTML = `<span class="font-semibold">${validation?.errors?.length > 0 ? '✗ Validation Errors Found' : '✓ Data Validated Successfully'}</span>`;
    alertDiv.classList.remove('hidden');
  }

  renderGSTR1Tab() {
    if (!this.currentGSTR1) return;
    const tabConfigs = {
      'b2b': { data: this.currentGSTR1.table_4a_b2b_supplies, title: 'Table 4A: B2B Supplies', cols: ['invoice_no', 'invoice_date', 'customer_gstin', 'taxable_value', 'igst', 'cgst', 'sgst', 'invoice_value'] },
      'b2cl': { data: this.currentGSTR1.table_5_b2cl_supplies, title: 'Table 5: B2CL (Inter-state > ₹1 Lakh)', cols: ['invoice_no', 'invoice_date', 'state_code', 'taxable_value', 'igst', 'invoice_value'] },
      'exports': { data: this.currentGSTR1.table_6_exports, title: 'Table 6: Exports', cols: ['export_type', 'invoice_no', 'invoice_date', 'taxable_value', 'igst'] },
      'b2cs': { data: this.currentGSTR1.table_7_b2cs_supplies, title: 'Table 7: B2CS (Small B2C)', cols: ['state_code', 'rate', 'taxable_value', 'igst', 'cgst', 'sgst'] },
      'hsn-b2b': { data: this.currentGSTR1.table_12_hsn_b2b, title: 'Table 12: HSN Summary (B2B)', cols: ['hsn', 'description', 'uqc', 'total_quantity', 'taxable_value', 'integrated_tax'] },
      'hsn-b2c': { data: this.currentGSTR1.table_12_hsn_b2c, title: 'Table 12: HSN Summary (B2C)', cols: ['hsn', 'description', 'uqc', 'total_quantity', 'taxable_value', 'integrated_tax'] },
      'documents': { data: this.currentGSTR1.table_13_document_summary, title: 'Table 13: Document Summary', cols: ['nature_of_document', 'sr_no_from', 'sr_no_to', 'total_number', 'cancelled'] },
      'amendments': { data: this.currentGSTR1.table_9_amendments, title: 'Table 9: Amendments', cols: ['amendment_type', 'original_invoice_no', 'amendment_invoice_no', 'taxable_value'] },
    };

    const config = tabConfigs[this.activeGSTR1Tab];
    if (!config) return;

    let html = `<h3 class="font-bold text-gray-900 mb-4">${config.title}</h3><div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="bg-gray-100">`;
    config.cols.forEach(c => html += `<th class="px-4 py-2 text-left">${c.replace(/_/g, ' ').toUpperCase()}</th>`);
    html += `</tr></thead><tbody>`;
    (config.data || []).forEach(row => {
      html += '<tr class="border-b">';
      config.cols.forEach(c => {
        let val = row[c] ?? '-';
        if (typeof val === 'number' && (c.includes('value') || c.includes('tax'))) val = '₹' + val.toLocaleString('en-IN');
        html += `<td class="px-4 py-2">${val}</td>`;
      });
      html += '</tr>';
    });
    html += `</tbody></table></div>`;
    this.elements.gstr1TabContainer.innerHTML = (config.data?.length > 0) ? html : '<div class="text-center py-8 text-gray-500">No data for this table</div>';
  }

  showValidation() {
    const { validation } = this.currentGSTR1;
    let html = '<ul class="space-y-2">';
    (validation.errors || []).forEach(e => html += `<li class="text-red-600 text-sm">✗ ${e}</li>`);
    (validation.warnings || []).forEach(w => html += `<li class="text-yellow-600 text-sm">⚠ ${w}</li>`);
    if (!validation.errors?.length && !validation.warnings?.length) html += '<li class="text-green-600 font-bold">✓ No issues found</li>';
    html += '</ul>';
    this.elements.validationModalContent.innerHTML = html;
    this.elements.validationModal.classList.remove('hidden');
  }

  closeValidationModal() { this.elements.validationModal.classList.add('hidden'); }

  exportGSTR1JSON() {
    const { startDate, endDate } = this.getDates();
    window.location.href = `/api/gst/gstr1/export/json?firmGstin=${this.elements.firmGstin.value}&startDate=${startDate}&endDate=${endDate}`;
  }

  exportGSTR1Excel() {
    const { startDate, endDate } = this.getDates();
    window.location.href = `/api/gst/gstr1/export/excel?firmGstin=${this.elements.firmGstin.value}&startDate=${startDate}&endDate=${endDate}`;
  }

  exportGSTR1PDF() {
    const { startDate, endDate } = this.getDates();
    window.location.href = `/api/gst/gstr1/export/pdf?firmGstin=${this.elements.firmGstin.value}&startDate=${startDate}&endDate=${endDate}`;
  }

  exportGSTR3BPDF() {
    const { startDate, endDate } = this.getDates();
    window.location.href = `/api/gst/gstr3b/export/pdf?firmGstin=${this.elements.firmGstin.value}&startDate=${startDate}&endDate=${endDate}`;
  }

  getDates() {
    const [year, month] = this.elements.reportMonth.value.split('-');
    const lastDay = new Date(year, month, 0).getDate();
    return {
      startDate: `${year}-${month}-01`,
      endDate: `${year}-${month}-${lastDay}`
    };
  }
}
