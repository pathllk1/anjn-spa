/**
 * gstr1.js - Complete GSTR1 Report Page (All 15 Tables)
 * Displays GST Return - Outward Supplies with comprehensive data visualization
 */

import { renderLayout } from '../../components/layout.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { api } from '../../utils/api.js';

export async function renderGSTR1(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = getGSTR1HTML();
  renderLayout(content, router);

  setTimeout(() => {
    initGSTR1Scripts();
  }, 100);
}

function getGSTR1HTML() {
  return `
<div class="space-y-4">
  <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
    <div>
      <h1 class="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
        GSTR1 Report (All 15 Tables)
      </h1>
      <p class="text-sm text-gray-600 mt-1">Complete GST Return - Outward Supplies (2024-2025 Compliant)</p>
    </div>
    
    <div class="flex flex-wrap items-center gap-2">
      <button id="generate-report-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition">
        Generate Report
      </button>
      <button id="validate-btn" class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition" disabled>
        Validate
      </button>
      <button id="export-json-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition" disabled>
        JSON
      </button>
      <button id="export-excel-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition" disabled>
        Excel
      </button>
      <button id="export-csv-btn" class="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition" disabled>
        CSV
      </button>
    </div>
  </div>

  <!-- Filters -->
  <div class="bg-white shadow-lg rounded-xl p-6 border border-gray-200">
    <h3 class="font-semibold text-gray-900 mb-4 flex items-center gap-2">
      <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
      </svg>
      Report Filters
    </h3>
    
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

  <!-- Summary Cards -->
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

  <!-- Validation Alert -->
  <div id="validation-alert" class="hidden"></div>

  <!-- Tabs -->
  <div class="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden">
    <div class="flex flex-wrap gap-1 border-b border-gray-200 p-4 overflow-x-auto">
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

    <div class="p-6" id="tab-container">
      <div class="text-center text-gray-500 py-8">Generate report to view data</div>
    </div>
  </div>

  <!-- Validation Modal -->
  <div id="validation-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
      <!-- Modal Header -->
      <div class="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
        <h2 class="text-xl font-bold text-white flex items-center gap-2">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Validation Report
        </h2>
        <button id="close-validation-modal" class="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-1 transition">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Modal Content -->
      <div class="overflow-y-auto flex-1 px-6 py-4">
        <div id="validation-modal-content" class="space-y-4">
          <!-- Content will be populated by JavaScript -->
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="border-t border-gray-200 px-6 py-4 flex justify-end gap-2">
        <button id="close-validation-modal-btn" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition">
          Close
        </button>
      </div>
    </div>
  </div>
</div>
`;
}

function initGSTR1Scripts() {
  const manager = new GSTR1Manager();
  manager.init();
}

class GSTR1Manager {
  constructor() {
    this.currentReport = null;
    this.firmGstins = [];
    this.currentTab = 'b2b';
  }

  init() {
    this.cacheElements();
    this.attachEventListeners();
    this.loadFirmGstins();
    this.setDefaultDates();
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
      exportCsvBtn: document.getElementById('export-csv-btn'),
      summaryCards: document.getElementById('summary-cards'),
      validationAlert: document.getElementById('validation-alert'),
      tabButtons: document.querySelectorAll('.gstr1-tab'),
      tabContainer: document.getElementById('tab-container'),
      validationModal: document.getElementById('validation-modal'),
      validationModalContent: document.getElementById('validation-modal-content'),
      closeValidationModalBtn: document.getElementById('close-validation-modal-btn'),
      closeValidationModalIcon: document.getElementById('close-validation-modal'),
    };
  }

  attachEventListeners() {
    this.elements.generateBtn.addEventListener('click', () => this.generateReport());
    this.elements.applyFiltersBtn.addEventListener('click', () => this.generateReport());
    this.elements.validateBtn.addEventListener('click', () => this.showValidation());
    this.elements.exportJsonBtn.addEventListener('click', () => this.exportJSON());
    this.elements.exportExcelBtn.addEventListener('click', () => this.exportExcel());
    this.elements.exportCsvBtn.addEventListener('click', () => this.exportCSV());

    this.elements.tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Modal close handlers
    this.elements.closeValidationModalBtn.addEventListener('click', () => this.closeValidationModal());
    this.elements.closeValidationModalIcon.addEventListener('click', () => this.closeValidationModal());
    
    // Close modal when clicking outside
    this.elements.validationModal.addEventListener('click', (e) => {
      if (e.target === this.elements.validationModal) {
        this.closeValidationModal();
      }
    });
  }

  setDefaultDates() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    this.elements.reportMonth.value = year + '-' + month;
  }

  async loadFirmGstins() {
    try {
      // Fetch current user's firm data (accessible to all authenticated users)
      const firmData = await api.get('/api/admin/my-firm');
      
      if (firmData.success && firmData.data) {
        const firm = firmData.data;
        // Get ALL GSTINs from locations array (new structure)
        let gstins = [];
        let defaultGstin = null;
        
        if (firm.locations && Array.isArray(firm.locations)) {
          // Extract all GST numbers from locations
          gstins = firm.locations
            .filter(loc => loc.gst_number)
            .map(loc => ({
              gstin: loc.gst_number,
              isDefault: loc.is_default || false,
              registrationType: loc.registration_type || 'PPOB',
              state: loc.state || '',
            }));
          
          // Find the default GSTIN
          const defaultLoc = firm.locations.find(loc => loc.is_default && loc.gst_number);
          if (defaultLoc) {
            defaultGstin = defaultLoc.gst_number;
          }
        }
        
        // Fallback to legacy gst_number field if no locations
        if (gstins.length === 0 && firm.gst_number) {
          gstins = [{
            gstin: firm.gst_number,
            isDefault: true,
            registrationType: 'PPOB',
            state: firm.state || '',
          }];
          defaultGstin = firm.gst_number;
        }

        // Populate dropdown with all GSTINs
        gstins.forEach(locData => {
          if (locData.gstin) {
            this.firmGstins.push(locData.gstin);
            const option = document.createElement('option');
            option.value = locData.gstin;
            // Show GSTIN with registration type and state for clarity
            const typeLabel = locData.registrationType === 'PPOB' ? '(Principal)' : '(Additional)';
            const stateText = locData.state || '';
            option.textContent = locData.gstin + ' ' + typeLabel + ' - ' + stateText;
            this.elements.firmGstin.appendChild(option);
          }
        });

        // Set default GSTIN or first one
        if (defaultGstin) {
          this.elements.firmGstin.value = defaultGstin;
        } else if (gstins.length > 0) {
          this.elements.firmGstin.value = gstins[0].gstin;
        }
      }
    } catch (err) {
      console.error('Error loading firm GSTINs:', err);
    }
  }

  async generateReport() {
    const reportMonth = this.elements.reportMonth.value;
    const firmGstin = this.elements.firmGstin.value;

    if (!reportMonth || !firmGstin) {
      alert('Please select month and GSTIN');
      return;
    }

    // Parse month (YYYY-MM) to get start and end dates
    const [year, month] = reportMonth.split('-');
    const startDate = year + '-' + month + '-01';
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = year + '-' + month + '-' + lastDay;

    try {
      this.elements.generateBtn.disabled = true;
      this.elements.generateBtn.textContent = 'Generating...';

      const url = '/api/gst/gstr1/report?startDate=' + startDate + '&endDate=' + endDate + '&firmGstin=' + firmGstin;
      const json = await api.get(url);

      if (json.success) {
        this.currentReport = json.data;
        this.renderSummary();
        this.showValidationStatus();
        this.renderCurrentTab();
        this.elements.summaryCards.classList.remove('hidden');
        this.elements.validateBtn.disabled = false;
        this.elements.exportJsonBtn.disabled = false;
        this.elements.exportExcelBtn.disabled = false;
        this.elements.exportCsvBtn.disabled = false;
      } else {
        alert('Error: ' + json.error);
      }
    } catch (err) {
      console.error('Error generating report:', err);
      alert('Failed to generate report');
    } finally {
      this.elements.generateBtn.disabled = false;
      this.elements.generateBtn.textContent = 'Generate Report';
    }
  }

  renderSummary() {
    const { summary } = this.currentReport;
    document.getElementById('total-invoices').textContent = summary.total_invoices;
    const taxableText = '₹' + summary.total_taxable_value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    document.getElementById('total-taxable').textContent = taxableText;
    const gstText = '₹' + summary.total_gst.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    document.getElementById('total-gst').textContent = gstText;
    const invoiceText = '₹' + summary.total_invoice_value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    document.getElementById('total-invoice-value').textContent = invoiceText;
  }

  showValidationStatus() {
    const { validation } = this.currentReport;
    if (!validation) return;

    const alertDiv = this.elements.validationAlert;
    const hasErrors = validation.errors && validation.errors.length > 0;
    const hasWarnings = validation.warnings && validation.warnings.length > 0;

    if (!hasErrors && !hasWarnings) {
      alertDiv.className = 'bg-green-50 border border-green-200 rounded-lg p-4';
      alertDiv.innerHTML = '<div class="flex items-center gap-2"><svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span class="font-semibold text-green-800">✓ Data Validated Successfully</span></div>';
    } else if (hasErrors) {
      alertDiv.className = 'bg-red-50 border border-red-200 rounded-lg p-4';
      alertDiv.innerHTML = '<div class="flex items-center gap-2"><svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span class="font-semibold text-red-800">' + validation.errors.length + ' Error(s) - Click Validate to view</span></div>';
    } else if (hasWarnings) {
      alertDiv.className = 'bg-yellow-50 border border-yellow-200 rounded-lg p-4';
      alertDiv.innerHTML = '<div class="flex items-center gap-2"><svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg><span class="font-semibold text-yellow-800">' + validation.warnings.length + ' Warning(s) - Click Validate to view</span></div>';
    }

    alertDiv.classList.remove('hidden');
  }

  showValidation() {
    const { validation } = this.currentReport;
    if (!validation) return;

    // Build HTML content for modal
    let html = '';

    // Status section
    const statusColor = validation.valid ? 'text-green-800' : 'text-red-800';
    const statusIcon = validation.valid ? '✓' : '✗';
    const statusText = validation.valid ? 'VALID' : 'INVALID';
    html += '<div class="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">';
    html += '<div class="flex items-center gap-3">';
    html += '<div class="text-3xl font-bold ' + statusColor + '">' + statusIcon + '</div>';
    html += '<div>';
    html += '<div class="font-bold ' + statusColor + ' text-lg">' + statusText + '</div>';
    html += '<div class="text-sm text-gray-600">Total Bills: ' + (validation.total_bills || 0) + ' | Total Items: ' + (validation.total_items || 0) + '</div>';
    html += '</div></div></div>';

    // Errors section
    if (validation.errors && validation.errors.length > 0) {
      html += '<div class="border-l-4 border-red-500 bg-red-50 p-4 rounded">';
      html += '<h3 class="font-bold text-red-800 mb-3 flex items-center gap-2">';
      html += '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>';
      html += 'ERRORS (' + validation.errors.length + ')</h3>';
      html += '<ul class="space-y-2">';
      validation.errors.forEach((err, i) => {
        html += '<li class="flex gap-2 text-sm text-red-700"><span class="font-bold flex-shrink-0">' + (i + 1) + '.</span><span>' + err + '</span></li>';
      });
      html += '</ul></div>';
    }

    // Warnings section
    if (validation.warnings && validation.warnings.length > 0) {
      html += '<div class="border-l-4 border-yellow-500 bg-yellow-50 p-4 rounded">';
      html += '<h3 class="font-bold text-yellow-800 mb-3 flex items-center gap-2">';
      html += '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>';
      html += 'WARNINGS (' + validation.warnings.length + ')</h3>';
      html += '<ul class="space-y-2">';
      validation.warnings.forEach((warn, i) => {
        html += '<li class="flex gap-2 text-sm text-yellow-700"><span class="font-bold flex-shrink-0">' + (i + 1) + '.</span><span>' + warn + '</span></li>';
      });
      html += '</ul></div>';
    }

    // Success message if no errors or warnings
    if (!validation.errors?.length && !validation.warnings?.length) {
      html += '<div class="border-l-4 border-green-500 bg-green-50 p-4 rounded">';
      html += '<div class="flex items-center gap-2 text-green-800 font-semibold">';
      html += '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>';
      html += 'All data validated successfully!</div></div>';
    }

    // Populate modal and show
    this.elements.validationModalContent.innerHTML = html;
    this.elements.validationModal.classList.remove('hidden');
  }

  closeValidationModal() {
    this.elements.validationModal.classList.add('hidden');
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    
    this.elements.tabButtons.forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('border-indigo-600', 'text-indigo-600');
        btn.classList.remove('border-transparent', 'text-gray-600');
      } else {
        btn.classList.remove('border-indigo-600', 'text-indigo-600');
        btn.classList.add('border-transparent', 'text-gray-600');
      }
    });

    this.renderCurrentTab();
  }

  renderCurrentTab() {
    if (!this.currentReport) return;

    const tabConfigs = {
      'b2b': { data: this.currentReport.table_4a_b2b_supplies, title: 'Table 4A: B2B Supplies (Regular)', columns: ['invoice_no', 'invoice_date', 'customer_gstin', 'taxable_value', 'cgst', 'sgst', 'igst', 'invoice_value'] },
      'b2b-rc': { data: this.currentReport.table_4b_b2b_reverse_charge, title: 'Table 4B: B2B Supplies (Reverse Charge)', columns: ['invoice_no', 'invoice_date', 'customer_gstin', 'place_of_supply', 'taxable_value'] },
      'b2cl': { data: this.currentReport.table_5_b2cl_supplies, title: 'Table 5: B2CL (Inter-state > ₹1 Lakh)', columns: ['invoice_no', 'invoice_date', 'state_code', 'taxable_value', 'igst', 'invoice_value'] },
      'exports': { data: this.currentReport.table_6_exports, title: 'Table 6: Exports', columns: ['export_type', 'invoice_no', 'invoice_date', 'taxable_value', 'igst', 'shipping_bill_no'] },
      'b2cs': { data: this.currentReport.table_7_b2cs_supplies, title: 'Table 7: B2CS (Small B2C)', columns: ['state_code', 'rate', 'taxable_value', 'cgst', 'sgst', 'igst'] },
      'nil-rated': { data: this.currentReport.table_8_nil_rated, title: 'Table 8: Nil Rated, Exempted, Non-GST', columns: ['description', 'inter_state', 'intra_state'] },
      'amendments': { data: this.currentReport.table_9_amendments, title: 'Table 9: Amendments', columns: ['amendment_type', 'original_invoice_no', 'amendment_invoice_no', 'customer_gstin', 'taxable_value'] },
      'advances': { data: this.currentReport.table_11_advances, title: 'Table 11: Advances Received/Adjusted', columns: ['place_of_supply', 'rate', 'gross_advance_received', 'cgst', 'sgst', 'igst'] },
      'hsn-b2b': { data: this.currentReport.table_12_hsn_b2b, title: 'Table 12: HSN Summary (B2B Tab)', columns: ['hsn', 'description', 'uqc', 'total_quantity', 'taxable_value', 'integrated_tax', 'central_tax', 'state_ut_tax'] },
      'hsn-b2c': { data: this.currentReport.table_12_hsn_b2c, title: 'Table 12: HSN Summary (B2C Tab)', columns: ['hsn', 'description', 'uqc', 'total_quantity', 'taxable_value', 'integrated_tax', 'central_tax', 'state_ut_tax'] },
      'documents': { data: this.currentReport.table_13_document_summary, title: 'Table 13: Document Summary', columns: ['nature_of_document', 'sr_no_from', 'sr_no_to', 'total_number', 'cancelled'] },
    };

    const config = tabConfigs[this.currentTab];
    if (!config) return;

    this.renderTable(config.data, config.columns, config.title);
  }

  renderTable(data, columns, title) {
    if (!data || data.length === 0) {
      this.elements.tabContainer.innerHTML = '<div class="text-center py-8"><p class="text-gray-500 font-medium">' + title + '</p><p class="text-gray-400 text-sm mt-2">No data available</p></div>';
      return;
    }

    const currencyFields = ['taxable_value', 'cgst', 'sgst', 'igst', 'cess', 'invoice_value', 'gross_advance_received', 'integrated_tax', 'central_tax', 'state_ut_tax', 'inter_state', 'intra_state'];
    
    const labels = { invoice_no: 'Invoice No', invoice_date: 'Date', customer_gstin: 'Customer GSTIN', state_code: 'State', taxable_value: 'Taxable Value', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', cess: 'Cess', invoice_value: 'Total', place_of_supply: 'Place of Supply', export_type: 'Export Type', shipping_bill_no: 'Shipping Bill', rate: 'Rate (%)', description: 'Description', inter_state: 'Inter-State', intra_state: 'Intra-State', amendment_type: 'Type', original_invoice_no: 'Original Invoice', amendment_invoice_no: 'Amendment Invoice', gross_advance_received: 'Advance Received', hsn: 'HSN', uqc: 'UQC', total_quantity: 'Quantity', integrated_tax: 'IGST', central_tax: 'CGST', state_ut_tax: 'SGST', nature_of_document: 'Nature', sr_no_from: 'From', sr_no_to: 'To', total_number: 'Total', cancelled: 'Cancelled' };
    
    let headerRow = '';
    columns.forEach(col => {
      const isRight = currencyFields.includes(col) || col === 'rate' || col === 'total_quantity' || col === 'total_number' || col === 'cancelled';
      const align = isRight ? 'right' : 'left';
      headerRow += '<th class="px-4 py-3 text-' + align + ' font-semibold text-gray-700">' + (labels[col] || col) + '</th>';
    });

    let dataRows = '';
    data.forEach(row => {
      let cells = '';
      columns.forEach(col => {
        let value = row[col];
        const isRight = currencyFields.includes(col) || col === 'rate' || col === 'total_quantity' || col === 'total_number' || col === 'cancelled';
        const align = isRight ? 'right' : 'left';
        if (currencyFields.includes(col) && typeof value === 'number') {
          value = '₹' + value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
        } else if (typeof value === 'number') {
          value = value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
        }
        cells += '<td class="px-4 py-3 text-' + align + ' text-gray-700">' + (value || '-') + '</td>';
      });
      dataRows += '<tr class="hover:bg-gray-50 transition">' + cells + '</tr>';
    });

    let html = '<div>';
    html += '<h3 class="font-semibold text-gray-900 mb-4">' + title + '</h3>';
    html += '<div class="overflow-x-auto">';
    html += '<table class="w-full text-sm">';
    html += '<thead><tr class="bg-gray-100 border-b border-gray-300">' + headerRow + '</tr></thead>';
    html += '<tbody class="divide-y divide-gray-200">' + dataRows + '</tbody>';
    html += '</table>';
    html += '</div>';
    html += '<p class="text-xs text-gray-500 mt-4">Total Records: ' + data.length + '</p>';
    html += '</div>';
    
    this.elements.tabContainer.innerHTML = html;
  }

  async exportJSON() {
    const reportMonth = this.elements.reportMonth.value;
    const firmGstin = this.elements.firmGstin.value;
    const [year, month] = reportMonth.split('-');
    const startDate = year + '-' + month + '-01';
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = year + '-' + month + '-' + lastDay;
    const url = '/api/gst/gstr1/export/json?startDate=' + startDate + '&endDate=' + endDate + '&firmGstin=' + firmGstin;
    window.location.href = url;
  }

  async exportExcel() {
    const reportMonth = this.elements.reportMonth.value;
    const firmGstin = this.elements.firmGstin.value;
    const [year, month] = reportMonth.split('-');
    const startDate = year + '-' + month + '-01';
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = year + '-' + month + '-' + lastDay;
    const url = '/api/gst/gstr1/export/excel?startDate=' + startDate + '&endDate=' + endDate + '&firmGstin=' + firmGstin;
    window.location.href = url;
  }

  async exportCSV() {
    const reportMonth = this.elements.reportMonth.value;
    const firmGstin = this.elements.firmGstin.value;
    const [year, month] = reportMonth.split('-');
    const startDate = year + '-' + month + '-01';
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = year + '-' + month + '-' + lastDay;
    const url = '/api/gst/gstr1/export/csv?startDate=' + startDate + '&endDate=' + endDate + '&firmGstin=' + firmGstin;
    window.location.href = url;
  }
}
