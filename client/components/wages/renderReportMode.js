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
    employerEpf: filteredWages.reduce((sum, w) => sum + (w.epf_deduction || 0), 0),
    employerEsic: filteredWages.reduce((sum, w) => sum + Math.ceil((w.gross_salary || 0) * 0.0325), 0),
    otherDeduction: filteredWages.reduce((sum, w) => sum + (w.other_deduction || 0), 0),
    advanceDeduction: filteredWages.reduce((sum, w) => sum + (w.advance_deduction || 0), 0),
    netSalary: filteredWages.reduce((sum, w) => sum + (w.net_salary || 0), 0),
  };

  const totalEmployerPart = totals.employerEpf + totals.employerEsic;

  // Calculate Previous Month for DOE logic
  let prevMonth = '';
  if (reportMonth) {
    const [year, m] = reportMonth.split('-').map(Number);
    const prevDate = new Date(year, m - 2, 1);
    prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  }

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

        <!-- Export Buttons -->
        <div class="flex justify-end gap-2 mt-4">
          <button
            data-action="export-bank-report"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            🏦 Bank Report
          </button>
          <button
            data-action="export-epf-esic-report"
            class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
          >
            📋 EPF/ESIC Report
          </button>
          <button
            data-action="download-bulk-wage-slips"
            class="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition-colors"
          >
            📦 Download All Slips
          </button>
        </div>
      </div>

      <!-- SUMMARY SECTION -->
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div class="bg-white rounded-lg shadow-sm border border-slate-100 p-3">
          <div class="text-xs font-bold text-slate-500 uppercase">Records</div>
          <div class="text-lg font-black text-slate-800">${totals.count}</div>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-slate-100 p-3">
          <div class="text-xs font-bold text-slate-500 uppercase">Gross</div>
          <div class="text-lg font-black text-slate-800 font-mono">₹${(totals.grossSalary / 100000).toFixed(1)}L</div>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-slate-100 p-3">
          <div class="text-xs font-bold text-amber-600 uppercase">EPF (E)</div>
          <div class="text-lg font-black text-amber-700 font-mono">₹${(totals.epfDeduction / 1000).toFixed(1)}K</div>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-slate-100 p-3">
          <div class="text-xs font-bold text-amber-600 uppercase">ESIC (E)</div>
          <div class="text-lg font-black text-amber-700 font-mono">₹${(totals.esicDeduction / 1000).toFixed(1)}K</div>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-slate-100 p-3">
          <div class="text-xs font-bold text-indigo-600 uppercase">EPF (ER)</div>
          <div class="text-lg font-black text-indigo-700 font-mono">₹${(totals.employerEpf / 1000).toFixed(1)}K</div>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-slate-100 p-3">
          <div class="text-xs font-bold text-indigo-600 uppercase">ESIC (ER)</div>
          <div class="text-lg font-black text-indigo-700 font-mono">₹${(totals.employerEsic / 1000).toFixed(1)}K</div>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-slate-100 p-3 bg-indigo-50 border-indigo-100">
          <div class="text-xs font-bold text-indigo-800 uppercase">Total ER</div>
          <div class="text-lg font-black text-indigo-900 font-mono">₹${(totalEmployerPart / 1000).toFixed(1)}K</div>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-slate-100 p-3 bg-emerald-50 border-emerald-100">
          <div class="text-xs font-bold text-emerald-800 uppercase">Net Pay</div>
          <div class="text-lg font-black text-emerald-900 font-mono">₹${(totals.netSalary / 100000).toFixed(1)}L</div>
        </div>
      </div>

      <!-- TABLE SECTION -->
      <div class="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden flex-1 min-h-0">
        <div class="overflow-y-auto max-h-full scrollbar-thin scrollbar-thumb-slate-200">
          <table class="w-full border-collapse">
            <thead class="sticky top-0 z-10">
              <tr class="bg-slate-900 border-b border-white/5">
                <th class="px-4 py-3 text-left text-xs font-black text-slate-300 uppercase">Employee</th>
                <th class="px-4 py-3 text-left text-xs font-black text-slate-300 uppercase">Project / Site</th>
                <th class="px-2 py-3 text-center text-[10px] font-black text-slate-300 uppercase">DOJ</th>
                <th class="px-2 py-3 text-center text-[10px] font-black text-slate-300 uppercase">DOE</th>
                <th class="px-4 py-3 text-center text-xs font-black text-slate-300 uppercase">Paid Date</th>
                <th class="px-4 py-3 text-center text-xs font-black text-slate-300 uppercase">Mode</th>
                <th class="px-4 py-3 text-right text-xs font-black text-slate-300 uppercase">Gross</th>
                <th class="px-4 py-3 text-right text-xs font-black text-amber-500 uppercase">EPF(E)</th>
                <th class="px-4 py-3 text-right text-xs font-black text-amber-500 uppercase">ESIC(E)</th>
                <th class="px-4 py-3 text-right text-xs font-black text-indigo-400 uppercase">EPF(ER)</th>
                <th class="px-4 py-3 text-right text-xs font-black text-indigo-400 uppercase">ESIC(ER)</th>
                <th class="px-4 py-3 text-right text-xs font-black text-rose-300 uppercase">Adv.</th>
                <th class="px-4 py-3 text-right text-xs font-black text-emerald-400 uppercase">Net</th>
                <th class="px-4 py-3 text-center text-xs font-black text-slate-300 uppercase">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              ${
                filteredWages.length > 0
                  ? filteredWages
                      .map(
                        (wage) => {
                          const mr = wage.master_roll_id;
                          const joiningDisplay = (mr?.date_of_joining && mr.date_of_joining.startsWith(reportMonth)) ? mr.date_of_joining : '-';
                          const exitDisplay = (mr?.date_of_exit && mr.date_of_exit.startsWith(prevMonth)) ? mr.date_of_exit : '-';

                          return `
                    <tr class="hover:bg-slate-50 transition-colors">
                      <td class="px-4 py-3 text-sm font-bold text-slate-800">
                        <div>${mr?.employee_name || 'N/A'}</div>
                        <div class="text-xs text-slate-500 font-mono">${mr?.account_no || ''}</div>
                      </td>
                      <td class="px-4 py-3 text-sm text-slate-600">
                        <div class="font-bold">${mr?.project || 'General'}</div>
                        <div class="text-[10px] font-black uppercase tracking-tighter opacity-60">${mr?.site || 'N/A'}</div>
                      </td>
                      <td class="px-2 py-3 text-center text-[10px] font-bold text-slate-500">${joiningDisplay}</td>
                      <td class="px-2 py-3 text-center text-[10px] font-bold text-rose-500">${exitDisplay}</td>
                      <td class="px-4 py-3 text-center text-sm font-bold text-slate-700">${wage.paid_date || '-'}</td>
                      <td class="px-4 py-3 text-center">
                        <span class="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded uppercase">
                          ${wage.payment_mode || 'N/A'}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-right text-sm font-bold text-slate-800 font-mono">₹${(wage.gross_salary || 0).toLocaleString('en-IN')}</td>
                      <td class="px-4 py-3 text-right text-sm font-bold text-amber-700 font-mono">₹${(wage.epf_deduction || 0).toLocaleString('en-IN')}</td>
                      <td class="px-4 py-3 text-right text-sm font-bold text-amber-700 font-mono">₹${(wage.esic_deduction || 0).toLocaleString('en-IN')}</td>
                      <td class="px-4 py-3 text-right text-sm font-bold text-indigo-700 font-mono">₹${(wage.epf_deduction || 0).toLocaleString('en-IN')}</td>
                      <td class="px-4 py-3 text-right text-sm font-bold text-indigo-700 font-mono">₹${Math.ceil((wage.gross_salary || 0) * 0.0325).toLocaleString('en-IN')}</td>
                      <td class="px-4 py-3 text-right text-sm font-bold text-rose-700 font-mono">₹${(wage.advance_deduction || 0).toLocaleString('en-IN')}</td>
                      <td class="px-4 py-3 text-right text-sm font-black text-emerald-700 font-mono bg-emerald-50">₹${(wage.net_salary || 0).toLocaleString('en-IN')}</td>
                      <td class="px-4 py-3 text-center">
                        <button data-action="download-wage-slip" data-wage-id="${wage._id}" class="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded hover:bg-blue-100 transition-colors uppercase">
                          Slip
                        </button>
                      </td>
                    </tr>
                  `;
                        }
                      )
                      .join('')
                  : `
                    <tr>
                      <td colspan="14" class="px-4 py-8 text-center text-slate-500 font-bold">
                        ${reportMonth ? 'No wages found for the selected filters' : 'Please select a month to view wages'}
                      </td>
                    </tr>
                  `
              }
            </tbody>
            <tfoot class="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td colspan="6" class="px-4 py-3 text-right font-black text-slate-800 uppercase text-xs">Total:</td>
                <td class="px-4 py-3 text-right text-sm font-black text-slate-800 font-mono">₹${(totals.grossSalary).toLocaleString('en-IN')}</td>
                <td class="px-4 py-3 text-right text-sm font-black text-amber-700 font-mono">₹${(totals.epfDeduction).toLocaleString('en-IN')}</td>
                <td class="px-4 py-3 text-right text-sm font-black text-amber-700 font-mono">₹${(totals.esicDeduction).toLocaleString('en-IN')}</td>
                <td class="px-4 py-3 text-right text-sm font-black text-indigo-700 font-mono">₹${(totals.employerEpf).toLocaleString('en-IN')}</td>
                <td class="px-4 py-3 text-right text-sm font-black text-indigo-700 font-mono">₹${(totals.employerEsic).toLocaleString('en-IN')}</td>
                <td class="px-4 py-3 text-right text-sm font-black text-rose-700 font-mono">₹${(totals.advanceDeduction).toLocaleString('en-IN')}</td>
                <td class="px-4 py-3 text-right text-sm font-black text-emerald-700 font-mono bg-emerald-100">₹${(totals.netSalary).toLocaleString('en-IN')}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  `;
}
