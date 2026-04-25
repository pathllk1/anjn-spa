export function renderCreateMode(ctx) {
  const {
    selectedMonth,
    employees,
    wageData,
    selectedEmployeeIds,
    isLoading,
    createFilters,
    createSort,
    commonPaymentData,
    firmBankAccounts,
    formatMonthDisplay,
    formatCurrency,
    calculateNetSalary,
    getFilteredCreateEmployees,
    getUniqueValues,
    sortArray
  } = ctx;

  const filteredEmployees = getFilteredCreateEmployees();
  const uniqueBanks = getUniqueValues(employees, 'bank');
  const uniqueProjects = getUniqueValues(employees, 'project');
  const uniqueSites = getUniqueValues(employees, 'site');

  function getBankAccountOptionLabel(account) {
    const parts = [
      account.account_name || account.bank_name || 'Bank Account',
      account.bank_name || null,
      account.account_number ? `A/C ${account.account_number}` : null,
    ].filter(Boolean);
    return parts.join(' • ');
  }
  
  return `
      <div class="create-mode">
        <!-- Controls -->
        <div class="create-controls">
          <div class="create-controls-row">
            <div class="create-month-field">
              <label class="create-month-label">Month</label>
              <input 
                type="month" 
                value="${selectedMonth}"
                data-action="set-month"
                class="create-month-input"
              />
            </div>
            
            <div class="create-margin-auto">
              <button 
                data-action="load-employees" 
                ${isLoading ? 'disabled' : ''}
                class="create-button"
              >
                ${isLoading ? '⏳ Loading...' : '🔄 Load Unpaid Employees'}
              </button>
            </div>

            ${employees.length > 0 ? `
              <div class="create-margin-auto">
                <button 
                  data-action="calculate-bulk"
                  class="create-button create-button-secondary"
                >
                  🧮 Calculate All
                </button>
              </div>

              <div class="create-margin-auto">
                <button 
                  id="save-wages-btn"
                  data-action="save-wages"
                  ${isLoading || selectedEmployeeIds.size === 0 ? 'disabled' : ''}
                  class="create-button create-save-button ${selectedEmployeeIds.size === 0 ? 'disabled' : ''}"
                >
                  💾 Save Wages${selectedEmployeeIds.size > 0 ? ` (${selectedEmployeeIds.size})` : ''}
                </button>
              </div>

              <div class="create-margin-auto">
                <button 
                  data-action="export-excel"
                  class="create-button create-button-export"
                >
                  📊 Export
                </button>
              </div>
            ` : ''}
          </div>

          ${employees.length > 0 ? `
            <!-- Filters -->
            <div class="create-filters-section">
              <h4 class="create-filters-header">🔍 Filters</h4>
              <div class="create-filters-grid">
                <div>
                  <input 
                    type="text" 
                    placeholder="Search by name, aadhar, account..."
                    value="${createFilters.searchTerm}"
                    data-action="search-filter"
                    data-mode="create"
                    data-field="searchTerm"
                    class="create-filter-input"
                  />
                </div>
                
                <div>
                  <select 
                    data-action="filter-select"
                    data-mode="create"
                    data-field="bankFilter"
                    class="create-filter-select"
                  >
                    <option value="all" ${createFilters.bankFilter === 'all' ? 'selected' : ''}>All Banks</option>
                    ${uniqueBanks.map(bank => `<option value="${bank}" ${createFilters.bankFilter === bank ? 'selected' : ''}>${bank}</option>`).join('')}
                  </select>
                </div>
                
                <div>
                  <select 
                    data-action="filter-select"
                    data-mode="create"
                    data-field="projectFilter"
                    class="create-filter-select"
                  >
                    <option value="all" ${createFilters.projectFilter === 'all' ? 'selected' : ''}>All Projects</option>
                    ${uniqueProjects.map(proj => `<option value="${proj}" ${createFilters.projectFilter === proj ? 'selected' : ''}>${proj}</option>`).join('')}
                  </select>
                </div>
                
                <div>
                  <select 
                    data-action="filter-select"
                    data-mode="create"
                    data-field="siteFilter"
                    class="create-filter-select"
                  >
                    <option value="all" ${createFilters.siteFilter === 'all' ? 'selected' : ''}>All Sites</option>
                    ${uniqueSites.map(site => `<option value="${site}" ${createFilters.siteFilter === site ? 'selected' : ''}>${site}</option>`).join('')}
                  </select>
                </div>
              </div>
            </div>

            <!-- Common Payment Data -->
            <div class="create-payment-data">
              <h4 class="create-payment-header">💰 Common Payment Data (Apply to Selected)</h4>
              <div class="create-payment-grid">
                <div>
                  <label class="create-payment-label">Paid Date</label>
                  <input 
                    type="date" 
                    value="${commonPaymentData.paid_date}"
                    data-action="common-payment"
                    data-field="paid_date"
                    class="create-payment-input"
                  />
                </div>
                <div>
                  <label class="create-payment-label">Cheque No</label>
                  <input 
                    type="text" 
                    value="${commonPaymentData.cheque_no}"
                    data-action="common-payment"
                    data-field="cheque_no"
                    placeholder="Optional"
                    class="create-payment-input"
                  />
                </div>
                <div>
                  <label class="create-payment-label">Paid From Bank</label>
                  <select 
                    data-action="common-payment"
                    data-field="paid_from_bank_ac"
                    class="create-payment-input"
                  >
                    <option value="">Select Bank Account</option>
                    ${firmBankAccounts.map(account => `
                      <option value="${getBankAccountOptionLabel(account)}" ${commonPaymentData.paid_from_bank_ac === getBankAccountOptionLabel(account) ? 'selected' : ''}>
                        ${getBankAccountOptionLabel(account)}
                      </option>
                    `).join('')}
                  </select>
                </div>
                <div>
                  <label class="create-payment-label">Remarks</label>
                  <input 
                    type="text" 
                    value="${commonPaymentData.remarks}"
                    data-action="common-payment"
                    data-field="remarks"
                    placeholder="Optional"
                    class="create-payment-input"
                  />
                </div>
              </div>
            </div>

            <!-- Summary -->
            <div class="create-summary">
              <h4 id="create-summary-header" class="create-summary-header">📊 Summary (${selectedEmployeeIds.size} selected / ${filteredEmployees.length} total)</h4>
              <div class="create-summary-grid">
                <div class="create-summary-card create-summary-gross">
                  <div class="create-summary-label">Total Gross</div>
                  <div class="create-summary-value"><span id="create-summary-gross">${formatCurrency(Array.from(selectedEmployeeIds).reduce((sum, empId) => sum + (wageData[empId]?.gross_salary || 0), 0))}</span></div>
                </div>
                <div class="create-summary-card create-summary-epf">
                  <div class="create-summary-label">Total EPF</div>
                  <div class="create-summary-value"><span id="create-summary-epf">${formatCurrency(Array.from(selectedEmployeeIds).reduce((sum, empId) => sum + (wageData[empId]?.epf_deduction || 0), 0))}</span></div>
                </div>
                <div class="create-summary-card create-summary-esic">
                  <div class="create-summary-label">Total ESIC</div>
                  <div class="create-summary-value"><span id="create-summary-esic">${formatCurrency(Array.from(selectedEmployeeIds).reduce((sum, empId) => sum + (wageData[empId]?.esic_deduction || 0), 0))}</span></div>
                </div>
                <div class="create-summary-card create-summary-net">
                  <div class="create-summary-label">Total Net Salary</div>
                  <div class="create-summary-value"><span id="create-summary-net">${formatCurrency(Array.from(selectedEmployeeIds).reduce((sum, empId) => {
                    const wage = wageData[empId];
                    if (!wage) return sum;
                    return sum + calculateNetSalary(
                      wage.gross_salary,
                      wage.epf_deduction,
                      wage.esic_deduction,
                      wage.other_deduction,
                      wage.other_benefit
                    );
                  }, 0))}</span></div>
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Employees Table -->
        ${employees.length > 0 ? `
          <div class="create-table-container">
            <h3 class="create-table-title">
              Unpaid Employees for ${formatMonthDisplay(selectedMonth)}
              <span class="create-table-count">(${filteredEmployees.length} of ${employees.length} employees)</span>
            </h3>
            
            <div class="create-table-wrapper">
              <table class="create-table">
                <thead>
                  <tr class="create-table-header">
                    <th class="create-table-th">
                      <input 
                        id="select-all-create"
                        type="checkbox" 
                        ${selectedEmployeeIds.size === filteredEmployees.length && filteredEmployees.length > 0 ? 'checked' : ''}
                        data-action="select-all-employees"
                        class="create-checkbox"
                      />
                    </th>
                    <th class="create-table-th create-sortable" data-action="sort" data-column="employee_name" data-mode="create">Employee ${createSort.column === 'employee_name' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th class="create-table-th">Bank Details</th>
                    <th class="create-table-th create-sortable" data-action="sort" data-column="p_day_wage" data-mode="create">Per Day ${createSort.column === 'p_day_wage' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th class="create-table-th create-sortable" data-action="sort" data-column="wage_days" data-mode="create">Days ${createSort.column === 'wage_days' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th class="create-table-th create-sortable" data-action="sort" data-column="gross_salary" data-mode="create">Gross ${createSort.column === 'gross_salary' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th class="create-table-th create-sortable" data-action="sort" data-column="epf_deduction" data-mode="create">EPF ${createSort.column === 'epf_deduction' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th class="create-table-th create-sortable" data-action="sort" data-column="esic_deduction" data-mode="create">ESIC ${createSort.column === 'esic_deduction' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th class="create-table-th create-sortable" data-action="sort" data-column="other_deduction" data-mode="create">Other Ded ${createSort.column === 'other_deduction' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th class="create-table-th create-sortable" data-action="sort" data-column="other_benefit" data-mode="create">Other Ben ${createSort.column === 'other_benefit' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th class="create-table-th create-sortable" data-action="sort" data-column="net_salary" data-mode="create">Net Salary ${createSort.column === 'net_salary' ? (createSort.asc ? '▲' : '▼') : '⇅'}</th>
                  </tr>
                </thead>
                <tbody>
                  ${sortArray(filteredEmployees, createSort.column, createSort.asc).map(emp => {
                    const wage = wageData[emp.master_roll_id] || {};
                    const isSelected = selectedEmployeeIds.has(emp.master_roll_id);
                    const netSalary = calculateNetSalary(
                      wage.gross_salary,
                      wage.epf_deduction,
                      wage.esic_deduction,
                      wage.other_deduction,
                      wage.other_benefit
                    );
                    
                    return `
                      <tr data-emp-row="${emp.master_roll_id}" class="create-table-row ${isSelected ? 'selected' : ''}">
                        <td class="create-table-td">
                          <input 
                            type="checkbox" 
                            ${isSelected ? 'checked' : ''}
                            data-action="toggle-employee"
                            data-emp-id="${emp.master_roll_id}"
                            class="create-checkbox"
                          />
                        </td>
                        <td class="create-table-td">
                          <div class="create-emp-name">${emp.employee_name}</div>
                          <div class="create-emp-details">${emp.project || 'N/A'} - ${emp.site || 'N/A'}</div>
                        </td>
                        <td class="create-table-td">
                          <div class="create-bank-name">${emp.bank}</div>
                          <div class="create-account-no">${emp.account_no}</div>
                        </td>
                        <td class="create-table-td">
                          <input 
                            type="number" 
                            step="0.01"
                            value="${wage.p_day_wage || emp.p_day_wage || 0}"
                            data-action="edit-employee"
                            data-emp-id="${emp.master_roll_id}"
                            data-field="p_day_wage"
                            class="create-input create-numeric-input"
                          />
                        </td>
                        <td class="create-table-td">
                          <input 
                            type="number" 
                            value="${wage.wage_days || 26}"
                            data-action="edit-employee"
                            data-emp-id="${emp.master_roll_id}"
                            data-field="wage_days"
                            class="create-input create-center-input"
                          />
                        </td>
                        <td class="create-table-td">
                          <input 
                            type="number" 
                            value="${wage.gross_salary || 0}"
                            data-emp-id="${emp.master_roll_id}"
                            data-field="gross_salary"
                            readonly
                            class="create-input create-readonly"
                          />
                        </td>
                        <td class="create-table-td">
                          <input 
                            type="number" 
                            step="0.01"
                            value="${wage.epf_deduction || 0}"
                            data-action="edit-employee"
                            data-emp-id="${emp.master_roll_id}"
                            data-field="epf_deduction"
                            class="create-input create-numeric-input"
                          />
                        </td>
                        <td class="create-table-td">
                          <input 
                            type="number" 
                            step="0.01"
                            value="${wage.esic_deduction || 0}"
                            data-action="edit-employee"
                            data-emp-id="${emp.master_roll_id}"
                            data-field="esic_deduction"
                            class="create-input create-numeric-input"
                          />
                        </td>
                        <td class="create-table-td">
                          <input 
                            type="number" 
                            step="0.01"
                            value="${wage.other_deduction || 0}"
                            data-action="edit-employee"
                            data-emp-id="${emp.master_roll_id}"
                            data-field="other_deduction"
                            class="create-input create-numeric-input"
                          />
                        </td>
                        <td class="create-table-td">
                          <input 
                            type="number" 
                            step="0.01"
                            value="${wage.other_benefit || 0}"
                            data-action="edit-employee"
                            data-emp-id="${emp.master_roll_id}"
                            data-field="other_benefit"
                            class="create-input create-numeric-input"
                          />
                        </td>
                        <td class="create-table-td">
                          <input 
                            type="number" 
                            value="${netSalary.toFixed(2)}"
                            data-emp-id="${emp.master_roll_id}"
                            data-field="net_salary"
                            readonly
                            class="create-input create-net-salary"
                          />
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : `
          <div class="create-no-employees">
            <div class="create-no-employees-icon">📋</div>
            <h3 class="create-no-employees-title">No Employees Loaded</h3>
            <p class="create-no-employees-message">Select a month and click "Load Unpaid Employees" to get started</p>
          </div>
        `}
      </div>
    `;
}
