export function renderManageMode(ctx) {
  const {
    manageMonth,
    existingWages,
    editedWages,
    selectedWageIds,
    isManageLoading,
    isBulkEditMode,
    bulkEditData,
    manageFilters,
    manageSort,
    formatMonthDisplay,
    formatDateDisplay,
    formatCurrency,
    calculateNetSalary,
    getFilteredManageWages,
    getUniqueValues,
    sortArray,
    toNumber
  } = ctx;

  const filteredWages = getFilteredManageWages();
  const uniqueBanks = getUniqueValues(existingWages.map(w => w.master_roll_id).filter(Boolean), 'bank');
  const uniqueProjects = getUniqueValues(existingWages.map(w => w.master_roll_id).filter(Boolean), 'project');
  const uniqueSites = getUniqueValues(existingWages.map(w => w.master_roll_id).filter(Boolean), 'site');
  
  return `
      <div class="manage-mode">
        <!-- Controls -->
        <div class="manage-controls">
          <div class="manage-controls-row">
            <div class="manage-month-field">
              <label class="manage-month-label">Month</label>
              <input 
                type="month" 
                value="${manageMonth}"
                data-action="set-manage-month"
                class="manage-month-input"
              />
            </div>
            
            <div class="manage-margin-auto">
              <button 
                data-action="load-manage-wages" 
                ${isManageLoading ? 'disabled' : ''}
                class="manage-button"
              >
                ${isManageLoading ? '⏳ Loading...' : '🔄 Load Wages'}
              </button>
            </div>

            ${existingWages.length > 0 ? `
              <!-- Selection actions: always in DOM, shown/hidden via JS -->
              <div id="manage-selection-actions" class="${selectedWageIds.size > 0 ? 'visible' : 'hidden'}">
                <button 
                  id="bulk-edit-btn"
                  data-action="toggle-bulk-edit"
                  class="bulk-edit-button ${isBulkEditMode ? 'active' : ''}"
                >
                  ${isBulkEditMode ? '❌ Cancel Bulk Edit' : '✏️ Bulk Edit (' + selectedWageIds.size + ')'}
                </button>
                <button 
                  id="delete-selected-btn"
                  data-action="delete-selected"
                  class="delete-button"
                >
                  🗑️ Delete Selected (${selectedWageIds.size})
                </button>
              </div>

              <!-- Save edited: always in DOM, shown/hidden via JS -->
              <div id="save-edited-btn-container" class="${Object.keys(editedWages).length > 0 ? 'visible' : 'hidden'}">
                <button 
                  id="save-edited-btn"
                  data-action="save-edited"
                  ${isManageLoading ? 'disabled' : ''}
                  class="save-button"
                >
                  💾 Save Changes (${Object.keys(editedWages).length})
                </button>
              </div>

              <div class="manage-margin-auto">
                <button 
                  data-action="export-excel"
                  class="export-button"
                >
                  📊 Export
                </button>
              </div>
            ` : ''}
          </div>

          ${existingWages.length > 0 ? `
            <!-- Summary panel: always in DOM, shown/hidden via JS -->
            <div id="manage-summary-panel" class="manage-summary-panel ${selectedWageIds.size > 0 ? 'visible' : 'hidden'}">
              <h4 class="manage-summary-header">📊 Summary (${selectedWageIds.size} selected)</h4>
              <div class="manage-summary-grid">
                <div class="manage-summary-card manage-summary-gross">
                  <div class="manage-summary-card-label">Total Gross Salary</div>
                  <div class="manage-summary-card-value"><span id="summary-total-gross">${formatCurrency(Array.from(selectedWageIds).reduce((sum, wageId) => {
                    const wage = existingWages.find(w => w.id === wageId);
                    const edited = editedWages[wageId] || wage;
                    return sum + (edited ? edited.gross_salary : 0);
                  }, 0))}</span></div>
                </div>
                <div class="manage-summary-card manage-summary-epf">
                  <div class="manage-summary-card-label">Total EPF</div>
                  <div class="manage-summary-card-value"><span id="summary-total-epf">${formatCurrency(Array.from(selectedWageIds).reduce((sum, wageId) => {
                    const wage = existingWages.find(w => w.id === wageId);
                    const edited = editedWages[wageId] || wage;
                    return sum + (edited ? edited.epf_deduction : 0);
                  }, 0))}</span></div>
                </div>
                <div class="manage-summary-card manage-summary-esic">
                  <div class="manage-summary-card-label">Total ESIC</div>
                  <div class="manage-summary-card-value"><span id="summary-total-esic">${formatCurrency(Array.from(selectedWageIds).reduce((sum, wageId) => {
                    const wage = existingWages.find(w => w.id === wageId);
                    const edited = editedWages[wageId] || wage;
                    return sum + (edited ? edited.esic_deduction : 0);
                  }, 0))}</span></div>
                </div>
                <div class="manage-summary-card manage-summary-net">
                  <div class="manage-summary-card-label">Total Net Salary</div>
                  <div class="manage-summary-card-value"><span id="summary-total-net">${formatCurrency(Array.from(selectedWageIds).reduce((sum, wageId) => {
                    const wage = existingWages.find(w => w.id === wageId);
                    const edited = editedWages[wageId] || wage;
                    return sum + (edited ? calculateNetSalary(
                      toNumber(edited.gross_salary),
                      toNumber(edited.epf_deduction),
                      toNumber(edited.esic_deduction),
                      toNumber(edited.other_deduction),
                      toNumber(edited.other_benefit)
                    ) : 0);
                  }, 0))}</span></div>
                </div>
              </div>
            </div>

            <!-- Bulk Edit Form -->
            ${isBulkEditMode ? `
              <div class="bulk-edit-form">
                <h4 class="bulk-edit-header">✏️ Bulk Edit Form (${selectedWageIds.size} wages selected)</h4>
                <div class="bulk-edit-inputs">
                  <div>
                    <label class="bulk-edit-label">Wage Days</label>
                    <input 
                      type="number"
                      min="0"
                      max="31"
                      value="${bulkEditData.wage_days || ''}"
                      data-action="set-bulk-edit"
                      data-field="wage_days"
                      placeholder="Leave blank to skip"
                      class="bulk-edit-input"
                    />
                  </div>
                  <div>
                    <label class="bulk-edit-label">EPF Deduction</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value="${bulkEditData.epf_deduction || ''}"
                      data-action="set-bulk-edit"
                      data-field="epf_deduction"
                      placeholder="Leave blank to skip"
                      class="bulk-edit-input"
                    />
                  </div>
                  <div>
                    <label class="bulk-edit-label">ESIC Deduction</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value="${bulkEditData.esic_deduction || ''}"
                      data-action="set-bulk-edit"
                      data-field="esic_deduction"
                      placeholder="Leave blank to skip"
                      class="bulk-edit-input"
                    />
                  </div>
                  <div>
                    <label class="bulk-edit-label">Other Deduction</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value="${bulkEditData.other_deduction || ''}"
                      data-action="set-bulk-edit"
                      data-field="other_deduction"
                      placeholder="Leave blank to skip"
                      class="bulk-edit-input"
                    />
                  </div>
                  <div>
                    <label class="bulk-edit-label">Other Benefit</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value="${bulkEditData.other_benefit || ''}"
                      data-action="set-bulk-edit"
                      data-field="other_benefit"
                      placeholder="Leave blank to skip"
                      class="bulk-edit-input"
                    />
                  </div>
                  <div>
                    <label class="bulk-edit-label">Paid Date</label>
                    <input 
                      type="date"
                      value="${bulkEditData.paid_date || ''}"
                      data-action="set-bulk-edit"
                      data-field="paid_date"
                      class="bulk-edit-input"
                    />
                  </div>
                  <div>
                    <label class="bulk-edit-label">Cheque No</label>
                    <input 
                      type="text"
                      value="${bulkEditData.cheque_no || ''}"
                      data-action="set-bulk-edit"
                      data-field="cheque_no"
                      placeholder="Leave blank to skip"
                      class="bulk-edit-input"
                    />
                  </div>
                  <div>
                    <label class="bulk-edit-label">Paid From Bank</label>
                    <input 
                      type="text"
                      value="${bulkEditData.paid_from_bank_ac || ''}"
                      data-action="set-bulk-edit"
                      data-field="paid_from_bank_ac"
                      placeholder="Leave blank to skip"
                      class="bulk-edit-input"
                    />
                  </div>
                  <div>
                    <label class="bulk-edit-label">Remarks</label>
                    <input 
                      type="text"
                      value="${bulkEditData.remarks || ''}"
                      data-action="set-bulk-edit"
                      data-field="remarks"
                      placeholder="Leave blank to skip"
                      class="bulk-edit-input"
                    />
                  </div>
                </div>
                <div class="bulk-edit-buttons">
                  <button 
                    data-action="apply-bulk-edit"
                    class="bulk-apply-button"
                  >
                    ✅ Apply to ${selectedWageIds.size} Wages
                  </button>
                  <button 
                    data-action="clear-bulk-edit"
                    class="bulk-clear-button"
                  >
                    🔄 Clear Form
                  </button>
                </div>
              </div>
            ` : ''}

            <!-- Filters -->
            <div class="filters-section">
              <h4 class="filters-header">🔍 Filters</h4>
              <div class="filters-grid">
                <div>
                  <input 
                    type="text" 
                    placeholder="Search by name, account..."
                    value="${manageFilters.searchTerm}"
                    data-action="search-filter"
                    data-mode="manage"
                    data-field="searchTerm"
                    class="filter-input"
                  />
                </div>
                
                <div>
                  <select 
                    data-action="filter-select"
                    data-mode="manage"
                    data-field="bankFilter"
                    class="filter-select"
                  >
                    <option value="all" ${manageFilters.bankFilter === 'all' ? 'selected' : ''}>All Banks</option>
                    ${uniqueBanks.map(bank => `<option value="${bank}" ${manageFilters.bankFilter === bank ? 'selected' : ''}>${bank}</option>`).join('')}
                  </select>
                </div>
                
                <div>
                  <select 
                    data-action="filter-select"
                    data-mode="manage"
                    data-field="projectFilter"
                    class="filter-select"
                  >
                    <option value="all" ${manageFilters.projectFilter === 'all' ? 'selected' : ''}>All Projects</option>
                    ${uniqueProjects.map(proj => `<option value="${proj}" ${manageFilters.projectFilter === proj ? 'selected' : ''}>${proj}</option>`).join('')}
                  </select>
                </div>
                
                <div>
                  <select 
                    data-action="filter-select"
                    data-mode="manage"
                    data-field="siteFilter"
                    class="filter-select"
                  >
                    <option value="all" ${manageFilters.siteFilter === 'all' ? 'selected' : ''}>All Sites</option>
                    ${uniqueSites.map(site => `<option value="${site}" ${manageFilters.siteFilter === site ? 'selected' : ''}>${site}</option>`).join('')}
                  </select>
                </div>
                
                <div>
                  <select 
                    data-action="filter-select"
                    data-mode="manage"
                    data-field="paidFilter"
                    class="filter-select"
                  >
                    <option value="all" ${manageFilters.paidFilter === 'all' ? 'selected' : ''}>All Payment Status</option>
                    <option value="paid" ${manageFilters.paidFilter === 'paid' ? 'selected' : ''}>Paid</option>
                    <option value="unpaid" ${manageFilters.paidFilter === 'unpaid' ? 'selected' : ''}>Unpaid</option>
                  </select>
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Wages Table -->
        ${existingWages.length > 0 ? `
          <div class="wages-table-container">
            <h3 class="wages-table-title">
              Wage Records for ${formatMonthDisplay(manageMonth)}
              <span class="wages-table-count">(${filteredWages.length} of ${existingWages.length} records)</span>
              <span id="unsaved-changes-badge" class="${Object.keys(editedWages).length > 0 ? 'visible' : 'hidden'}">⚠️ <span id="unsaved-count">${Object.keys(editedWages).length}</span> unsaved changes</span>
            </h3>
            
            <div class="wages-table-wrapper">
              <table class="wages-table">
                <thead>
                  <tr class="wages-table-header">
                    <th class="wages-table-th">
                      <input 
                        id="select-all-manage"
                        type="checkbox" 
                        ${selectedWageIds.size === filteredWages.length && filteredWages.length > 0 ? 'checked' : ''}
                        data-action="select-all-wages"
                        class="wages-checkbox"
                      />
                    </th>
                    <th class="wages-table-th wages-sortable" data-action="sort" data-column="employee_name" data-mode="manage">Employee ${manageSort.column === 'employee_name' ? (manageSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th class="wages-table-th wages-sortable" data-action="sort" data-column="wage_days" data-mode="manage">Days ${manageSort.column === 'wage_days' ? (manageSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th class="wages-table-th wages-sortable" data-action="sort" data-column="gross_salary" data-mode="manage">Gross ${manageSort.column === 'gross_salary' ? (manageSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th class="wages-table-th wages-sortable" data-action="sort" data-column="epf_deduction" data-mode="manage">EPF ${manageSort.column === 'epf_deduction' ? (manageSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th class="wages-table-th wages-sortable" data-action="sort" data-column="esic_deduction" data-mode="manage">ESIC ${manageSort.column === 'esic_deduction' ? (manageSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th class="wages-table-th wages-sortable" data-action="sort" data-column="other_deduction" data-mode="manage">Other Ded ${manageSort.column === 'other_deduction' ? (manageSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th class="wages-table-th wages-sortable" data-action="sort" data-column="other_benefit" data-mode="manage">Other Ben ${manageSort.column === 'other_benefit' ? (manageSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th class="wages-table-th wages-sortable" data-action="sort" data-column="net_salary" data-mode="manage">Net ${manageSort.column === 'net_salary' ? (manageSort.asc ? '▲' : '▼') : '⇅'}</th>
                    <th class="wages-table-th">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  ${sortArray(filteredWages, manageSort.column, manageSort.asc).map(wage => {
                    const edited = editedWages[wage.id] || wage;
                    const isEdited = !!editedWages[wage.id];
                    const isSelected = selectedWageIds.has(wage.id);
                    const netSalary = calculateNetSalary(
                      toNumber(edited.gross_salary),
                      toNumber(edited.epf_deduction),
                      toNumber(edited.esic_deduction),
                      toNumber(edited.other_deduction),
                      toNumber(edited.other_benefit)
                    );
                    
                    return `
                      <tr data-wage-row="${String(wage.id)}" class="wages-table-row ${isSelected ? 'selected' : ''}">
                        <td class="wages-table-td">
                          <input 
                            type="checkbox" 
                            ${isSelected ? 'checked' : ''}
                            data-action="toggle-wage"
                            data-wage-id="${String(wage.id)}"
                            class="wages-checkbox"
                          />
                        </td>
                        <td class="wages-table-td">
                          <div class="wage-employee-name">${wage.master_roll_id?.employee_name}</div>
                          <div class="wage-employee-details">${wage.master_roll_id?.project || 'N/A'} - ${wage.master_roll_id?.site || 'N/A'}</div>
                        </td>
                        <td class="wages-table-td">
                          <input 
                            id="wage-${String(wage.id)}-wage_days"
                            type="number" 
                            value="${edited.wage_days ?? ''}"
                            data-action="edit-wage"
                            data-wage-id="${String(wage.id)}"
                            data-field="wage_days"
                            class="wage-input wage-days-input"
                          />
                        </td>
                        <td class="wages-table-td wages-right">
                          <span id="wage-${String(wage.id)}-gross-display" class="wage-currency">${formatCurrency(edited.gross_salary)}</span>
                        </td>
                        <td class="wages-table-td wages-right">
                          <input 
                            id="wage-${String(wage.id)}-epf_deduction"
                            type="number" 
                            step="0.01"
                            value="${edited.epf_deduction ?? ''}"
                            data-action="edit-wage"
                            data-wage-id="${String(wage.id)}"
                            data-field="epf_deduction"
                            class="wage-input wage-numeric-input"
                          />
                        </td>
                        <td class="wages-table-td wages-right">
                          <input 
                            id="wage-${String(wage.id)}-esic_deduction"
                            type="number" 
                            step="0.01"
                            value="${edited.esic_deduction ?? ''}"
                            data-action="edit-wage"
                            data-wage-id="${String(wage.id)}"
                            data-field="esic_deduction"
                            class="wage-input wage-numeric-input"
                          />
                        </td>
                        <td class="wages-table-td wages-right">
                          <input 
                            id="wage-${String(wage.id)}-other_deduction"
                            type="number" 
                            step="0.01"
                            value="${edited.other_deduction ?? ''}"
                            data-action="edit-wage"
                            data-wage-id="${String(wage.id)}"
                            data-field="other_deduction"
                            class="wage-input wage-numeric-input"
                          />
                        </td>
                        <td class="wages-table-td wages-right">
                          <input 
                            id="wage-${String(wage.id)}-other_benefit"
                            type="number" 
                            step="0.01"
                            value="${edited.other_benefit ?? ''}"
                            data-action="edit-wage"
                            data-wage-id="${String(wage.id)}"
                            data-field="other_benefit"
                            class="wage-input wage-numeric-input"
                          />
                        </td>
                        <td class="wages-table-td wages-right">
                          <span id="wage-${String(wage.id)}-net-display" class="wage-net-salary">${formatCurrency(netSalary)}</span>
                        </td>
                        <td class="wages-table-td">
                          <div class="wage-payment-info">
                            <div class="wage-payment-date">${edited.paid_date ? formatDateDisplay(edited.paid_date) : 'Not paid'}</div>
                            <div class="wage-payment-cheque">${edited.cheque_no || '-'}</div>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : `
          <div class="no-wages-container">
            <div class="no-wages-icon">📊</div>
            <h3 class="no-wages-title">No Wage Records Found</h3>
            <p class="no-wages-message">Select a month and click "Load Wages" to manage existing wage records</p>
          </div>
        `}
      </div>
    `;
}
