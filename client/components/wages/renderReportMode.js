/**
 * Wages Report Mode
 * Displays wages for a selected month with filtering by payment mode and cheque/instrument number
 */

export function renderReportMode({
  reportMonth = '',
  reportWages = [],
  reportFilters = {},
  uniqueChequeNumbers = [],
  isReportLoading = false,
  onMonthChange = () => {},
  onFilterChange = () => {},
  onExport = () => {},
}) {
  // Get unique payment modes from wages
  const uniquePaymentModes = [...new Set(reportWages.map(w => w.payment_mode).filter(Boolean))];

  // Apply filters
  const filteredWages = reportWages.filter(wage => {
    // Payment mode filter
    if (reportFilters.paymentMode && reportFilters.paymentMode !== 'all' && wage.payment_mode !== reportFilters.paymentMode) {
      return false;
    }

    // Cheque/Instrument number filter
    if (reportFilters.chequeNo && reportFilters.chequeNo !== 'all' && wage.cheque_no !== reportFilters.chequeNo) {
      return false;
    }

    return true;
  });

  // Calculate totals
  const totals = {
    count: filteredWages.length,
    grossSalary: filteredWages.reduce((sum, w) => sum + (w.gross_salary || 0), 0),
    epfDeduction: filteredWages.reduce((sum, w) => sum + (w.epf_deduction || 0), 0),
    esicDeduction: filteredWages.reduce((sum, w) => sum + (w.esic_deduction || 0), 0),
    otherDeduction: filteredWages.reduce((sum, w) => sum + (w.other_deduction || 0), 0),
    advanceDeduction: filteredWages.reduce((sum, w) => sum + (w.advance_deduction || 0), 0),
    netSalary: filteredWages.reduce((sum, w) => sum + (w.net_salary || 0), 0),
  };

  return `
    <div class="flex flex-col h-full gap-4 p-4 bg-slate-50">
      <!-- FILTERS SECTION -->
      <div class="bg-white rounded-lg shadow-sm border border-slate-100 p-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Month Selector -->
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold text-slate-600 uppercase">Select Month</label>
            <input
              type="month"
              value="${reportMonth}"
              data-action="report-month-change"
              class="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <!-- Payment Mode Filter -->
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold text-slate-600 uppercase">Payment Mode</label>
            <select
              data-action="report-filter"
              data-field="paymentMode"
              class="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all" ${reportFilters.paymentMode === 'all' || !reportFilters.paymentMode ? 'selected' : ''}>All Modes</option>
              <option value="CASH" ${reportFilters.paymentMode === 'CASH' ? 'selected' : ''}>Cash</option>
              <option value="CHEQUE" ${reportFilters.paymentMode === 'CHEQUE' ? 'selected' : ''}>Cheque</option>
              <option value="NEFT" ${reportFilters.paymentMode === 'NEFT' ? 'selected' : ''}>NEFT</option>
              <option value="RTGS" ${reportFilters.paymentMode === 'RTGS' ? 'selected' : ''}>RTGS</option>
              <option value="IMPS" ${reportFilters.paymentMode === 'IMPS' ? 'selected' : ''}>IMPS</option>
              <option value="UPI" ${reportFilters.paymentMode === 'UPI' ? 'selected' : ''}>UPI</option>
            </select>
          </div>

          <!-- Cheque/Instrument Number Filter (Dropdown) -->
          <div class="flex flex-col gap-2">
            <label class="text-xs font-bold text-slate-600 uppercase">Cheque/Ref No</label>
            <select
              data-action="report-filter"
              data-field="chequeNo"
              class="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all" ${reportFilters.chequeNo === 'all' || !reportFilters.chequeNo ? 'selected' : ''}>All Cheques</option>
              ${uniqueChequeNumbers.map(cheque => `
                <option value="${cheque}" ${reportFilters.chequeNo === cheque ? 'selected' : ''}>
                  ${cheque || '(No Cheque)'}
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Export Button -->
        <div class="flex justify-end gap-2 mt-4">
          <button
            data-action="export-report"
            class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors"
          >
            📊 Export to Excel
          </button>
        </div>
      </div>

      <!-- SUMMARY SECTION -->
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div class="bg-white rounded-lg shadow-sm border border-slate-100 p-3">
          <div class="text-xs font-bold text-slate-500 uppercase">Records</div>
          <div class="text-lg font-black text-slate-800">${totals.count}</div>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-slate-100 p-3">
          <div class="text-xs font-bold text-slate-500 uppercase">Gross</div>
          <div class="text-lg font-black text-slate-800 font-mono">₹${(totals.grossSalary / 100000).toFixed(1)}L</div>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-slate-100 p-3">
          <div class="text-xs font-bold text-amber-600 uppercase">EPF</div>
          <div class="text-lg font-black text-amber-700 font-mono">₹${(totals.epfDeduction / 1000).toFixed(1)}K</div>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-slate-100 p-3">
          <div class="text-xs font-bold text-amber-600 uppercase">ESIC</div>
          <div class="text-lg font-black text-amber-700 font-mono">₹${(totals.esicDeduction / 1000).toFixed(1)}K</div>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-slate-100 p-3">
          <div class="text-xs font-bold text-rose-600 uppercase">Other</div>
          <div class="text-lg font-black text-rose-700 font-mono">₹${(totals.otherDeduction / 1000).toFixed(1)}K</div>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-slate-100 p-3">
          <div class="text-xs font-bold text-rose-600 uppercase">Advance</div>
          <div class="text-lg font-black text-rose-700 font-mono">₹${(totals.advanceDeduction / 1000).toFixed(1)}K</div>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-slate-100 p-3">
          <div class="text-xs font-bold text-emerald-600 uppercase">Net</div>
          <div class="text-lg font-black text-emerald-700 font-mono">₹${(totals.netSalary / 100000).toFixed(1)}L</div>
        </div>
      </div>

      <!-- TABLE SECTION -->
      <div class="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden flex-1 min-h-0">
        <div class="overflow-y-auto max-h-full scrollbar-thin scrollbar-thumb-slate-200">
          <table class="w-full border-collapse">
            <thead class="sticky top-0 z-10">
              <tr class="bg-slate-900 border-b border-white/5">
                <th class="px-4 py-3 text-left text-xs font-black text-slate-300 uppercase">Employee</th>
                <th class="px-4 py-3 text-center text-xs font-black text-slate-300 uppercase">Paid Date</th>
                <th class="px-4 py-3 text-center text-xs font-black text-slate-300 uppercase">Mode</th>
                <th class="px-4 py-3 text-center text-xs font-black text-slate-300 uppercase">Cheque/Ref</th>
                <th class="px-4 py-3 text-right text-xs font-black text-slate-300 uppercase">Gross</th>
                <th class="px-4 py-3 text-right text-xs font-black text-slate-300 uppercase">EPF</th>
                <th class="px-4 py-3 text-right text-xs font-black text-slate-300 uppercase">ESIC</th>
                <th class="px-4 py-3 text-right text-xs font-black text-slate-300 uppercase">Other</th>
                <th class="px-4 py-3 text-right text-xs font-black text-slate-300 uppercase">Advance</th>
                <th class="px-4 py-3 text-right text-xs font-black text-emerald-400 uppercase">Net</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              ${
                filteredWages.length > 0
                  ? filteredWages
                      .map(
                        (wage) => `
                    <tr class="hover:bg-slate-50 transition-colors">
                      <td class="px-4 py-3 text-sm font-bold text-slate-800">
                        <div>${wage.master_roll_id?.employee_name || 'N/A'}</div>
                        <div class="text-xs text-slate-500">${wage.master_roll_id?.aadhar || ''}</div>
                      </td>
                      <td class="px-4 py-3 text-center text-sm font-bold text-slate-700">${wage.paid_date || '-'}</td>
                      <td class="px-4 py-3 text-center">
                        <span class="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded">
                          ${wage.payment_mode || 'N/A'}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-center text-sm font-bold text-slate-700">
                        ${wage.cheque_no ? `<span class="px-2 py-1 bg-slate-100 rounded font-mono text-xs">${wage.cheque_no}</span>` : '-'}
                      </td>
                      <td class="px-4 py-3 text-right text-sm font-bold text-slate-800 font-mono">₹${(wage.gross_salary || 0).toLocaleString('en-IN')}</td>
                      <td class="px-4 py-3 text-right text-sm font-bold text-amber-700 font-mono">₹${(wage.epf_deduction || 0).toLocaleString('en-IN')}</td>
                      <td class="px-4 py-3 text-right text-sm font-bold text-amber-700 font-mono">₹${(wage.esic_deduction || 0).toLocaleString('en-IN')}</td>
                      <td class="px-4 py-3 text-right text-sm font-bold text-slate-700 font-mono">₹${(wage.other_deduction || 0).toLocaleString('en-IN')}</td>
                      <td class="px-4 py-3 text-right text-sm font-bold text-rose-700 font-mono">₹${(wage.advance_deduction || 0).toLocaleString('en-IN')}</td>
                      <td class="px-4 py-3 text-right text-sm font-black text-emerald-700 font-mono bg-emerald-50">₹${(wage.net_salary || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  `
                      )
                      .join('')
                  : `
                    <tr>
                      <td colspan="10" class="px-4 py-8 text-center text-slate-500 font-bold">
                        ${reportMonth ? 'No wages found for the selected filters' : 'Please select a month to view wages'}
                      </td>
                    </tr>
                  `
              }
            </tbody>
            <tfoot class="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td colspan="4" class="px-4 py-3 text-right font-black text-slate-800">TOTAL:</td>
                <td class="px-4 py-3 text-right text-sm font-black text-slate-800 font-mono">₹${(totals.grossSalary).toLocaleString('en-IN')}</td>
                <td class="px-4 py-3 text-right text-sm font-black text-amber-700 font-mono">₹${(totals.epfDeduction).toLocaleString('en-IN')}</td>
                <td class="px-4 py-3 text-right text-sm font-black text-amber-700 font-mono">₹${(totals.esicDeduction).toLocaleString('en-IN')}</td>
                <td class="px-4 py-3 text-right text-sm font-black text-slate-700 font-mono">₹${(totals.otherDeduction).toLocaleString('en-IN')}</td>
                <td class="px-4 py-3 text-right text-sm font-black text-rose-700 font-mono">₹${(totals.advanceDeduction).toLocaleString('en-IN')}</td>
                <td class="px-4 py-3 text-right text-sm font-black text-emerald-700 font-mono bg-emerald-100">₹${(totals.netSalary).toLocaleString('en-IN')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  `;
}
