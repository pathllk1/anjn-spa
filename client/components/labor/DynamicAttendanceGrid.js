import { api, fetchWithCSRF } from '../../utils/api.js';

/**
 * Excel-Style Dynamic Attendance Grid
 * Supports fractional day values: 0 (Leave), 0.5 (Half), 1 (Present), 1.5/2/2.5 (Overtime)
 * Optimized for rapid keyboard entry.
 */
export function renderAttendanceGrid(containerId, periodData, onSync) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { start_date, end_date } = periodData.period;
  const dates = getDatesInRange(new Date(start_date), new Date(end_date));
  let workers = periodData.workers || [];
  let attendanceMap = mapAttendance(periodData.attendance);
  let lastFocusedCoord = null; // Track focus: { r, c, type: 'cell' | 'name' | 'wage' }
  let activeInlineInput = null; // Track active inline input element

  // Initialize with at least one row if empty
  if (workers.length === 0) {
    workers = [{ id: 'temp-' + Date.now(), labor_name: '', daily_wage: 0, attendance: [] }];
  }

  // ── Cell Display Helpers ─────────────────────────────────────────────────

  /**
   * Convert a numeric day_value to a display label
   */
  function dayValueToLabel(val) {
    if (val === null || val === undefined || val === '') return '.';
    const v = parseFloat(val);
    if (isNaN(v)) return '.';
    if (v === 0) return 'L';
    if (v === 0.5) return '\u00bd';
    if (v === 1) return 'P';
    return v.toString();
  }

  /**
   * Get CSS classes for a cell based on its day_value
   */
  function getCellClasses(val) {
    if (val === null || val === undefined || val === '') return 'text-slate-300';
    const v = parseFloat(val);
    if (isNaN(v)) return 'text-slate-300';
    if (v === 0) return 'bg-red-500 text-white shadow-inner';
    if (v === 0.5) return 'bg-amber-400 text-white shadow-inner';
    if (v === 1) return 'bg-green-500 text-white shadow-inner';
    if (v === 1.5) return 'bg-blue-500 text-white shadow-inner';
    if (v === 2) return 'bg-purple-500 text-white shadow-inner';
    if (v >= 2.5) return 'bg-purple-700 text-white shadow-inner';
    // Any other fractional value
    return 'bg-teal-500 text-white shadow-inner';
  }

  /**
   * Cycle to next value on click: empty -> 1 -> 0.5 -> 1.5 -> 2 -> 0 -> empty -> ...
   */
  function cycleValue(current) {
    if (current === null || current === undefined || current === '') return 1;
    const v = parseFloat(current);
    if (isNaN(v)) return 1;
    if (v === 0) return '';     // Leave -> empty
    if (v === 0.5) return 1.5;
    if (v === 1) return 0.5;
    if (v === 1.5) return 2;
    if (v === 2) return 0;
    return 0; // Reset for other values
  }

  // ── Render ───────────────────────────────────────────────────────────────

  function render(shouldFocusFirst = false) {
    // Build the table using DOM APIs for security (no innerHTML with user data)
    container.textContent = ''; // Clear safely

    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200';

    const table = document.createElement('table');
    table.className = 'w-full text-left border-collapse text-sm';
    table.id = 'attendance-table';

    // ── THEAD ──
    const thead = document.createElement('thead');
    thead.className = 'bg-slate-50 sticky top-0 z-10 text-[11px] uppercase tracking-wider text-slate-500 font-bold';
    const headerRow = document.createElement('tr');

    // Name header
    const thName = document.createElement('th');
    thName.className = 'px-4 py-3 border-b border-r bg-slate-50 min-w-[200px]';
    thName.textContent = 'Labor Name';
    headerRow.appendChild(thName);

    // Wage header
    const thWage = document.createElement('th');
    thWage.className = 'px-4 py-3 border-b border-r bg-slate-50 w-24 text-center';
    thWage.textContent = 'Wage/Day';
    headerRow.appendChild(thWage);

    // Date headers
    dates.forEach(d => {
      const th = document.createElement('th');
      th.className = 'px-1 py-3 border-b border-r text-center min-w-[38px]' +
        (isWeekend(d) ? ' bg-orange-50 text-orange-700' : ' bg-slate-50');
      
      const dayAbbr = document.createElement('div');
      dayAbbr.className = 'opacity-60';
      dayAbbr.textContent = d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
      
      const dayNum = document.createElement('div');
      dayNum.className = 'text-sm';
      dayNum.textContent = d.getDate();
      
      th.appendChild(dayAbbr);
      th.appendChild(dayNum);
      headerRow.appendChild(th);
    });

    // Days total header
    const thDays = document.createElement('th');
    thDays.className = 'px-3 py-3 border-b font-bold text-blue-600 text-center w-16 bg-blue-50/30';
    thDays.textContent = 'Days';
    headerRow.appendChild(thDays);

    // Total (₹) header
    const thTotal = document.createElement('th');
    thTotal.className = 'px-4 py-3 border-b font-bold text-indigo-600 text-center w-24 bg-indigo-50/30';
    thTotal.textContent = 'Total (\u20b9)';
    headerRow.appendChild(thTotal);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // ── TBODY ──
    const tbody = document.createElement('tbody');

    workers.forEach((w, wIdx) => {
      let daySum = 0;
      const tr = document.createElement('tr');
      tr.dataset.workerIdx = wIdx;
      tr.className = 'group';

      // Name cell
      const tdName = document.createElement('td');
      tdName.className = 'p-0 border-b border-r';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'w-full px-4 py-3 bg-transparent outline-none focus:bg-indigo-50 border-none font-medium text-slate-800';
      nameInput.dataset.field = 'name';
      nameInput.dataset.workerIdx = wIdx;
      nameInput.value = w.labor_name || '';
      nameInput.placeholder = 'Worker Name...';
      tdName.appendChild(nameInput);
      tr.appendChild(tdName);

      // Wage cell
      const tdWage = document.createElement('td');
      tdWage.className = 'p-0 border-b border-r';
      const wageInput = document.createElement('input');
      wageInput.type = 'number';
      wageInput.className = 'w-full px-2 py-3 bg-transparent text-center outline-none focus:bg-indigo-50 border-none font-semibold text-slate-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
      wageInput.dataset.field = 'wage';
      wageInput.dataset.workerIdx = wIdx;
      wageInput.value = w.daily_wage || 0;
      tdWage.appendChild(wageInput);
      tr.appendChild(tdWage);

      // Date cells
      dates.forEach((d, dIdx) => {
        const dateStr = d.toISOString().split('T')[0];
        const dayValue = attendanceMap[w.id]?.[dateStr];
        const numVal = (dayValue !== null && dayValue !== undefined && dayValue !== '') ? parseFloat(dayValue) : null;
        if (numVal !== null && !isNaN(numVal)) daySum += numVal;

        const td = document.createElement('td');
        td.className = 'p-0 border-b border-r text-center align-middle';

        const cellDiv = document.createElement('div');
        cellDiv.className = 'attendance-cell w-full h-12 flex items-center justify-center cursor-pointer outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 focus:z-20 transition-all font-bold text-sm ' + getCellClasses(dayValue);
        cellDiv.tabIndex = 0;
        cellDiv.dataset.date = dateStr;
        cellDiv.dataset.workerIdx = wIdx;
        cellDiv.dataset.colIdx = dIdx;
        cellDiv.textContent = dayValueToLabel(dayValue);

        td.appendChild(cellDiv);
        tr.appendChild(td);
      });

      // Days total cell
      const tdDays = document.createElement('td');
      tdDays.className = 'px-3 py-3 border-b font-bold text-blue-700 text-center bg-blue-50/50 text-sm';
      tdDays.textContent = daySum % 1 === 0 ? daySum.toString() : daySum.toFixed(1);
      tr.appendChild(tdDays);

      // Total (₹) cell
      const tdTotal = document.createElement('td');
      tdTotal.className = 'px-4 py-3 border-b font-bold text-indigo-700 text-center bg-indigo-50/50';
      tdTotal.textContent = '\u20b9' + (daySum * (w.daily_wage || 0)).toLocaleString();
      tr.appendChild(tdTotal);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrapperDiv.appendChild(table);
    container.appendChild(wrapperDiv);

    // ── Control Panel ──
    const controlPanel = document.createElement('div');
    controlPanel.className = 'mt-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200';

    // Add Worker button
    const addBtn = document.createElement('button');
    addBtn.id = 'add-row-btn';
    addBtn.className = 'bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-bold hover:bg-slate-50 hover:border-slate-400 transition flex items-center gap-2 shadow-sm';
    addBtn.textContent = '+ Add Worker (Alt + N)';
    controlPanel.appendChild(addBtn);

    // Right side: shortcuts + save
    const rightPanel = document.createElement('div');
    rightPanel.className = 'flex flex-col lg:flex-row items-start lg:items-center gap-4';

    // Keyboard shortcuts legend
    const legend = document.createElement('div');
    legend.className = 'text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1';
    const shortcuts = [
      { key: 'SPACE', label: 'Present (1)', color: 'text-green-600' },
      { key: 'H', label: 'Half (\u00bd)', color: 'text-amber-600' },
      { key: 'O', label: 'OT (1.5)', color: 'text-blue-600' },
      { key: 'D', label: 'Double (2)', color: 'text-purple-600' },
      { key: 'L', label: 'Leave', color: 'text-red-600' },
      { key: 'ENTER', label: 'Custom', color: 'text-slate-600' },
      { key: 'DEL', label: 'Clear', color: 'text-slate-400' }
    ];
    shortcuts.forEach(s => {
      const span = document.createElement('span');
      span.className = 'flex items-center gap-1 ' + s.color;

      const kbd = document.createElement('kbd');
      kbd.className = 'bg-white px-1.5 py-0.5 rounded border border-slate-300 shadow-sm text-slate-900 font-bold text-[10px]';
      kbd.textContent = s.key;

      span.appendChild(kbd);
      const labelText = document.createTextNode(' ' + s.label);
      span.appendChild(labelText);
      legend.appendChild(span);
    });
    rightPanel.appendChild(legend);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.id = 'sync-grid-btn';
    saveBtn.className = 'bg-indigo-600 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-indigo-700 shadow-lg hover:shadow-indigo-200 active:transform active:scale-95 transition-all flex items-center gap-2';
    saveBtn.textContent = '\u2714 Save All Data';
    rightPanel.appendChild(saveBtn);

    controlPanel.appendChild(rightPanel);
    container.appendChild(controlPanel);

    attachEvents();
    if (shouldFocusFirst) {
      focusFirstCell();
    } else if (lastFocusedCoord) {
      restoreFocus();
    }
  }

  function focusFirstCell() {
    const firstCell = container.querySelector('.attendance-cell');
    if (firstCell) firstCell.focus();
  }

  function restoreFocus() {
    if (!lastFocusedCoord) return;
    const { r, c, type } = lastFocusedCoord;
    let target = null;
    if (type === 'cell') {
      target = container.querySelector(`.attendance-cell[data-worker-idx="${r}"][data-col-idx="${c}"]`);
    } else if (type === 'name') {
      target = container.querySelector(`input[data-field="name"][data-worker-idx="${r}"]`);
    } else if (type === 'wage') {
      target = container.querySelector(`input[data-field="wage"][data-worker-idx="${r}"]`);
    }
    if (target) target.focus();
  }

  // ── Inline Custom Value Input ────────────────────────────────────────────

  /**
   * Show a tiny inline number input inside the cell for entering custom day values.
   */
  function showInlineInput(cell, workerIdx, colIdx, dateStr, worker) {
    // Don't open if already active in this cell
    if (activeInlineInput && activeInlineInput.parentElement === cell) return;
    dismissInlineInput();

    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.5';
    input.min = '0';
    input.max = '3';
    input.className = 'w-12 h-8 text-center text-sm font-bold rounded border-2 border-indigo-500 outline-none bg-white text-slate-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
    input.style.zIndex = '30';

    const currentVal = attendanceMap[worker.id]?.[dateStr];
    input.value = (currentVal !== null && currentVal !== undefined && currentVal !== '') ? currentVal : '';

    // Replace cell text with input
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    input.select();

    activeInlineInput = input;

    function commit() {
      const val = parseFloat(input.value);
      if (!isNaN(val) && val >= 0 && val <= 3) {
        updateAttendance(worker, dateStr, val);
      } else if (input.value === '') {
        updateAttendance(worker, dateStr, '');
      }
      activeInlineInput = null;
    }

    input.addEventListener('blur', () => {
      commit();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        commit();
        // Move to next cell after committing
        setTimeout(() => moveNext(workerIdx, colIdx), 10);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        activeInlineInput = null;
        render(); // Restore without saving
        focusCell(workerIdx, colIdx);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commit();
        if (e.shiftKey) {
          setTimeout(() => movePrev(workerIdx, colIdx), 10);
        } else {
          setTimeout(() => moveNext(workerIdx, colIdx), 10);
        }
      }
    });
  }

  function dismissInlineInput() {
    if (activeInlineInput) {
      activeInlineInput = null;
    }
  }

  // ── Event Attachment ─────────────────────────────────────────────────────

  function attachEvents() {
    const cells = Array.from(container.querySelectorAll('.attendance-cell'));
    
    cells.forEach(cell => {
      cell.addEventListener('keydown', (e) => {
        // If an inline input is active, let it handle its own keys
        if (activeInlineInput && activeInlineInput.parentElement === cell) return;

        const workerIdx = parseInt(cell.dataset.workerIdx);
        const colIdx = parseInt(cell.dataset.colIdx);
        const date = cell.dataset.date;
        const worker = workers[workerIdx];

        // Mark and Move shortcuts
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          updateAttendance(worker, date, 1);    // Present = 1
          moveNext(workerIdx, colIdx);
        }
        else if (e.key === 'l' || e.key === 'L') {
          e.preventDefault();
          updateAttendance(worker, date, 0);    // Leave = 0
          moveNext(workerIdx, colIdx);
        }
        else if (e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          updateAttendance(worker, date, 0.5);  // Half Day = 0.5
          moveNext(workerIdx, colIdx);
        }
        else if (e.key === 'o' || e.key === 'O') {
          e.preventDefault();
          updateAttendance(worker, date, 1.5);  // Overtime = 1.5
          moveNext(workerIdx, colIdx);
        }
        else if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          updateAttendance(worker, date, 2);    // Double = 2
          moveNext(workerIdx, colIdx);
        }
        else if (e.key === 'Enter' || e.code === 'Enter') {
          e.preventDefault();
          showInlineInput(cell, workerIdx, colIdx, date, worker);
        }
        else if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          updateAttendance(worker, date, '');    // Clear
        }
        // Navigation only
        else if (e.key === 'ArrowRight') {
          e.preventDefault();
          moveNext(workerIdx, colIdx);
        }
        else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          movePrev(workerIdx, colIdx);
        }
        else if (e.key === 'ArrowDown') {
          e.preventDefault();
          moveVertical(workerIdx + 1, colIdx);
        }
        else if (e.key === 'ArrowUp') {
          e.preventDefault();
          moveVertical(workerIdx - 1, colIdx);
        }
      });

      cell.addEventListener('click', () => {
        const workerIdx = parseInt(cell.dataset.workerIdx);
        const colIdx = parseInt(cell.dataset.colIdx);
        const date = cell.dataset.date;
        const worker = workers[workerIdx];
        const current = attendanceMap[worker.id]?.[date];
        
        lastFocusedCoord = { r: workerIdx, c: colIdx, type: 'cell' };
        updateAttendance(worker, date, cycleValue(current));
      });

      cell.addEventListener('focus', () => {
        lastFocusedCoord = { 
          r: parseInt(cell.dataset.workerIdx), 
          c: parseInt(cell.dataset.colIdx), 
          type: 'cell' 
        };
      });
    });

    // Worker Name/Wage Input Sync
    container.querySelectorAll('input[data-field="name"]').forEach(input => {
      input.addEventListener('change', () => {
        const idx = input.dataset.workerIdx;
        workers[idx].labor_name = input.value;
      });
      input.addEventListener('focus', () => {
        lastFocusedCoord = { r: parseInt(input.dataset.workerIdx), type: 'name' };
      });
    });

    container.querySelectorAll('input[data-field="wage"]').forEach(input => {
      input.addEventListener('change', () => {
        const idx = input.dataset.workerIdx;
        workers[idx].daily_wage = parseFloat(input.value) || 0;
        render(); // Update totals
      });
      input.addEventListener('focus', () => {
        lastFocusedCoord = { r: parseInt(input.dataset.workerIdx), type: 'wage' };
      });
    });

    // Control Panel Actions
    document.getElementById('add-row-btn')?.addEventListener('click', () => {
      workers.push({ id: 'temp-' + Date.now(), labor_name: '', daily_wage: 0 });
      render();
      // Focus the new worker's name field
      const inputs = container.querySelectorAll('input[data-field="name"]');
      inputs[inputs.length - 1].focus();
    });

    document.getElementById('sync-grid-btn')?.addEventListener('click', () => {
      const payload = {
        workers: workers.map(w => ({
          ...w,
          attendance: dates.map(d => {
            const dStr = d.toISOString().split('T')[0];
            const val = attendanceMap[w.id]?.[dStr];
            // Send numeric day_value (default to 0 for unset/empty)
            const dayValue = (val !== null && val !== undefined && val !== '') ? parseFloat(val) : 0;
            return { date: dStr, day_value: isNaN(dayValue) ? 0 : dayValue };
          })
        })),
        expenses: [] 
      };
      onSync(payload);
    });

    // Global Shortcuts
    container.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        document.getElementById('add-row-btn')?.click();
      }
    });
  }

  function moveNext(r, c) {
    if (c === dates.length - 1) {
      if (r < workers.length - 1) {
        focusCell(r + 1, 0);
      } else {
        document.getElementById('sync-grid-btn')?.focus();
      }
    } else {
      focusCell(r, c + 1);
    }
  }

  function movePrev(r, c) {
    if (c > 0) focusCell(r, c - 1);
    else if (r > 0) focusCell(r - 1, dates.length - 1);
  }

  function moveVertical(r, c) {
    if (r >= 0 && r < workers.length) focusCell(r, c);
  }

  function focusCell(r, c) {
    const target = container.querySelector(`.attendance-cell[data-worker-idx="${r}"][data-col-idx="${c}"]`);
    if (target) target.focus();
  }

  function updateAttendance(worker, date, dayValue) {
    if (!attendanceMap[worker.id]) attendanceMap[worker.id] = {};
    attendanceMap[worker.id][date] = dayValue;
    render();
  }

  function getDatesInRange(start, end) {
    const arr = [];
    let current = new Date(start);
    while (current <= end) {
      arr.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return arr;
  }

  function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  function mapAttendance(attArr) {
    const map = {};
    (attArr || []).forEach(a => {
      if (!map[a.worker_id]) map[a.worker_id] = {};
      const dStr = new Date(a.attendance_date).toISOString().split('T')[0];
      // Read numeric day_value from the database
      map[a.worker_id][dStr] = a.day_value !== undefined ? parseFloat(a.day_value) : (a.status === 'P' ? 1 : 0);
    });
    return map;
  }

  render(true); // Focus 1st cell on initial load
}
