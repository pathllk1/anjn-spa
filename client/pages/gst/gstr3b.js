/**
 * gstr3b.js - GSTR3B Report Component
 * Displays GST Return - Monthly Summary (Table 3.1, 4, 5)
 */

import { api } from '../../utils/api.js';

export class GSTR3BManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentReport = null;
  }

  async generateReport(reportMonth, firmGstin) {
    // Parse month (YYYY-MM) to get start and end dates
    const [year, month] = reportMonth.split('-');
    const startDate = year + '-' + month + '-01';
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = year + '-' + month + '-' + lastDay;

    try {
      this.container.innerHTML = '<div class="text-center py-12"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div><p class="mt-4 text-gray-600">Generating GSTR-3B Report...</p></div>';

      const url = '/api/gst/gstr3b/report?startDate=' + startDate + '&endDate=' + endDate + '&firmGstin=' + firmGstin;
      const json = await api.get(url);

      if (json.success) {
        this.currentReport = json.data;
        this.render();
      } else {
        this.container.innerHTML = '<div class="bg-red-50 text-red-700 p-4 rounded-lg">' + (json.error || 'Failed to load report') + '</div>';
      }
    } catch (err) {
      console.error('Error generating GSTR-3B:', err);
      this.container.innerHTML = '<div class="bg-red-50 text-red-700 p-4 rounded-lg">An unexpected error occurred</div>';
    }
  }

  render() {
    if (!this.currentReport) return;
    const { table_3_1, table_4, table_5 } = this.currentReport;

    let html = '<div class="space-y-8">';

    // Table 3.1
    html += this.renderTable31(table_3_1);
    
    // Table 4
    html += this.renderTable4(table_4);

    // Table 5
    html += this.renderTable5(table_5);

    html += '</div>';
    this.container.innerHTML = html;
  }

  renderTable31(data) {
    const rows = [
      { label: '(a) Outward taxable supplies (other than zero rated, nil rated and exempted)', key: 'a' },
      { label: '(b) Outward taxable supplies (zero rated)', key: 'b' },
      { label: '(c) Other outward supplies (Nil rated, exempted)', key: 'c' },
      { label: '(d) Inward supplies (liable to reverse charge)', key: 'd' },
      { label: '(e) Non-GST outward supplies', key: 'e' },
    ];

    let tableRows = '';
    rows.forEach(row => {
      const val = data[row.key];
      tableRows += `
        <tr class="hover:bg-gray-50 transition">
          <td class="px-4 py-3 text-sm text-gray-700 font-medium">${row.label}</td>
          <td class="px-4 py-3 text-sm text-right text-gray-900">${this.formatCurrency(val.taxable_value)}</td>
          <td class="px-4 py-3 text-sm text-right text-indigo-600">${this.formatCurrency(val.igst)}</td>
          <td class="px-4 py-3 text-sm text-right text-blue-600">${this.formatCurrency(val.cgst)}</td>
          <td class="px-4 py-3 text-sm text-right text-purple-600">${this.formatCurrency(val.sgst)}</td>
          <td class="px-4 py-3 text-sm text-right text-gray-600">${this.formatCurrency(val.cess)}</td>
        </tr>
      `;
    });

    return `
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h3 class="font-bold text-gray-900">3.1 Details of Outward Supplies and inward supplies liable to reverse charge</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-gray-100 text-xs font-bold text-gray-600 uppercase tracking-wider">
                <th class="px-4 py-3">Nature of Supplies</th>
                <th class="px-4 py-3 text-right">Total Taxable Value</th>
                <th class="px-4 py-3 text-right">IGST</th>
                <th class="px-4 py-3 text-right">CGST</th>
                <th class="px-4 py-3 text-right">SGST/UTGST</th>
                <th class="px-4 py-3 text-right">Cess</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              ${tableRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderTable4(data) {
    const aRows = [
      { label: '(1) Import of goods', key: '1' },
      { label: '(2) Import of services', key: '2' },
      { label: '(3) Inward supplies liable to reverse charge (other than 1 & 2 above)', key: '3' },
      { label: '(4) Inward supplies from ISD', key: '4' },
      { label: '(5) All other ITC', key: '5' },
    ];

    const bRows = [
      { label: '(1) As per rules 42 & 43 of CGST Rules', key: '1' },
      { label: '(2) Others', key: '2' },
    ];

    let aRowsHtml = '';
    aRows.forEach(row => {
      const val = data.a[row.key];
      aRowsHtml += this.renderITCRow(row.label, val);
    });

    let bRowsHtml = '';
    bRows.forEach(row => {
      const val = data.b[row.key];
      bRowsHtml += this.renderITCRow(row.label, val, 'text-red-600');
    });

    return `
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h3 class="font-bold text-gray-900">4. Eligible ITC</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-gray-100 text-xs font-bold text-gray-600 uppercase tracking-wider">
                <th class="px-4 py-3">Details</th>
                <th class="px-4 py-3 text-right">IGST</th>
                <th class="px-4 py-3 text-right">CGST</th>
                <th class="px-4 py-3 text-right">SGST/UTGST</th>
                <th class="px-4 py-3 text-right">Cess</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr class="bg-indigo-50/30"><td colspan="5" class="px-4 py-2 text-xs font-bold text-indigo-800 uppercase">(A) ITC Available (whether in full or part)</td></tr>
              ${aRowsHtml}
              <tr class="bg-red-50/30"><td colspan="5" class="px-4 py-2 text-xs font-bold text-red-800 uppercase">(B) ITC Reversed</td></tr>
              ${bRowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderITCRow(label, val, amountClass = 'text-gray-900') {
    return `
      <tr class="hover:bg-gray-50 transition">
        <td class="px-4 py-3 text-sm text-gray-700 font-medium">${label}</td>
        <td class="px-4 py-3 text-sm text-right ${amountClass}">${this.formatCurrency(val.igst)}</td>
        <td class="px-4 py-3 text-sm text-right ${amountClass}">${this.formatCurrency(val.cgst)}</td>
        <td class="px-4 py-3 text-sm text-right ${amountClass}">${this.formatCurrency(val.sgst)}</td>
        <td class="px-4 py-3 text-sm text-right ${amountClass}">${this.formatCurrency(val.cess)}</td>
      </tr>
    `;
  }

  renderTable5(data) {
    return `
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h3 class="font-bold text-gray-900">5. Values of exempt, nil-rated and non-GST inward supplies</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-gray-100 text-xs font-bold text-gray-600 uppercase tracking-wider">
                <th class="px-4 py-3">Nature of Supplies</th>
                <th class="px-4 py-3 text-right">Inter-State Supplies</th>
                <th class="px-4 py-3 text-right">Intra-State Supplies</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr class="hover:bg-gray-50 transition">
                <td class="px-4 py-3 text-sm text-gray-700 font-medium">From a supplier under composition scheme, Exempt and Nil rated supply</td>
                <td class="px-4 py-3 text-sm text-right text-gray-900">${this.formatCurrency(data.inter)}</td>
                <td class="px-4 py-3 text-sm text-right text-gray-900">${this.formatCurrency(data.intra)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  formatCurrency(val) {
    if (typeof val !== 'number') return '₹0.00';
    return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
