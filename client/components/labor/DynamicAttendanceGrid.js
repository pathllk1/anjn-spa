import { api, fetchWithCSRF } from '../../utils/api.js';

/**
 * Excel-Style Dynamic Attendance Grid
 * optimized for rapid keyboard entry.
 */
export function renderAttendanceGrid(containerId, periodData, onSync) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { start_date, end_date } = periodData.period;
  const dates = getDatesInRange(new Date(start_date), new Date(end_date));
  let workers = periodData.workers || [];
  let attendanceMap = mapAttendance(periodData.attendance);
  let lastFocusedCoord = null; // Track focus: { r, c, type: 'cell' | 'name' | 'wage' }

  // Initialize with at least one row if empty
  if (workers.length === 0) {
    workers = [{ id: 'temp-' + Date.now(), labor_name: '', daily_wage: 0, attendance: [] }];
  }

  function render(shouldFocusFirst = false) {
    container.innerHTML = `
      <div class="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
        <table class="w-full text-left border-collapse text-sm" id="attendance-table">
          <thead class="bg-slate-50 sticky top-0 z-10 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
            <tr>
              <th class="px-4 py-3 border-b border-r bg-slate-50 min-w-[200px]">Labor Name</th>
              <th class="px-4 py-3 border-b border-r bg-slate-50 w-24 text-center">Wage/Day</th>
              ${dates.map(d => `
                <th class="px-1 py-3 border-b border-r text-center min-w-[38px] ${isWeekend(d) ? 'bg-orange-50 text-orange-700' : 'bg-slate-50'}">
                  <div class="opacity-60">${d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}</div>
                  <div class="text-sm">${d.getDate()}</div>
                </th>
              `).join('')}
              <th class="px-4 py-3 border-b font-bold text-indigo-600 text-center w-24 bg-indigo-50/30">Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${workers.map((w, wIdx) => {
              let presentCount = 0;
              return `
                <tr data-worker-idx="${wIdx}" class="group">
                  <td class="p-0 border-b border-r">
                    <input type="text" class="w-full px-4 py-3 bg-transparent outline-none focus:bg-indigo-50 border-none font-medium text-slate-800" 
                           data-field="name" data-worker-idx="${wIdx}" value="${w.labor_name || ''}" placeholder="Worker Name...">
                  </td>
                  <td class="p-0 border-b border-r">
                    <input type="number" class="w-full px-2 py-3 bg-transparent text-center outline-none focus:bg-indigo-50 border-none font-semibold text-slate-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                           data-field="wage" data-worker-idx="${wIdx}" value="${w.daily_wage || 0}">
                  </td>
                  ${dates.map((d, dIdx) => {
                    const dateStr = d.toISOString().split('T')[0];
                    const status = attendanceMap[w.id]?.[dateStr] || '';
                    if (status === 'P') presentCount++;
                    
                    let cellClass = 'text-slate-300';
                    if (status === 'P') cellClass = 'bg-green-500 text-white shadow-inner';
                    if (status === 'L') cellClass = 'bg-red-500 text-white shadow-inner';

                    return `
                      <td class="p-0 border-b border-r text-center align-middle">
                        <div class="attendance-cell w-full h-12 flex items-center justify-center cursor-pointer outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 focus:z-20 transition-all font-bold text-sm ${cellClass}"
                             tabindex="0"
                             data-date="${dateStr}"
                             data-worker-idx="${wIdx}"
                             data-col-idx="${dIdx}">
                          ${status || '.'}
                        </div>
                      </td>
                    `;
                  }).join('')}
                  <td class="px-4 py-3 border-b font-bold text-indigo-700 text-center bg-indigo-50/50">
                    ₹${(presentCount * (w.daily_wage || 0)).toLocaleString()}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="mt-6 flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
        <button id="add-row-btn" class="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-bold hover:bg-slate-50 hover:border-slate-400 transition flex items-center gap-2 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v6h4a1 1 0 110 2h-4v6a1 1 0 11-2 0v-6H4a1 1 0 110-2h4V4a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
          Add Worker (Alt + N)
        </button>
        
        <div class="flex items-center gap-6">
          <div class="text-xs text-slate-500 flex gap-4">
            <span class="flex items-center gap-1"><kbd class="bg-white px-1.5 py-0.5 rounded border border-slate-300 shadow-sm text-slate-900 font-bold">SPACE</kbd> Present</span>
            <span class="flex items-center gap-1"><kbd class="bg-white px-1.5 py-0.5 rounded border border-slate-300 shadow-sm text-slate-900 font-bold">ENTER</kbd> Leave</span>
          </div>
          <button id="sync-grid-btn" class="bg-indigo-600 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-indigo-700 shadow-lg hover:shadow-indigo-200 active:transform active:scale-95 transition-all flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            Save All Data
          </button>
        </div>
      </div>
    `;

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

  function attachEvents() {
    const cells = Array.from(container.querySelectorAll('.attendance-cell'));
    
    cells.forEach((cell, idx) => {
      cell.addEventListener('keydown', (e) => {
        const workerIdx = parseInt(cell.dataset.workerIdx);
        const colIdx = parseInt(cell.dataset.colIdx);
        const date = cell.dataset.date;
        const worker = workers[workerIdx];

        // 1. Mark and Move
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          updateAttendance(worker, date, 'P');
          moveNext(workerIdx, colIdx);
        }
        else if (e.key === 'Enter' || e.code === 'Enter') {
          e.preventDefault();
          updateAttendance(worker, date, 'L');
          moveNext(workerIdx, colIdx);
        }
        // 2. Navigation only
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
        updateAttendance(worker, date, current === 'P' ? 'L' : 'P');
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
      input.addEventListener('change', (e) => {
        const idx = input.dataset.workerIdx;
        workers[idx].labor_name = e.target.value;
      });
      input.addEventListener('focus', () => {
        lastFocusedCoord = { r: parseInt(input.dataset.workerIdx), type: 'name' };
      });
    });

    container.querySelectorAll('input[data-field="wage"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = input.dataset.workerIdx;
        workers[idx].daily_wage = parseFloat(e.target.value) || 0;
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
            return { date: dStr, status: attendanceMap[w.id]?.[dStr] || 'L' };
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
    // If last date of row
    if (c === dates.length - 1) {
      // If next row exists, wrap to first date of next row
      if (r < workers.length - 1) {
        focusCell(r + 1, 0);
      } else {
        // Last cell of entire grid -> Jump to Control Panel
        document.getElementById('sync-grid-btn')?.focus();
      }
    } else {
      // Move to next date in same row
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

  function updateAttendance(worker, date, status) {
    if (!attendanceMap[worker.id]) attendanceMap[worker.id] = {};
    attendanceMap[worker.id][date] = status;
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
      map[a.worker_id][dStr] = a.status;
    });
    return map;
  }

  render(true); // Focus 1st cell on initial load
}
