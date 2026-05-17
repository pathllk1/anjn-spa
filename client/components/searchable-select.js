/**
 * Searchable Select Component
 * High-performance, keyboard-friendly searchable dropdown for large lists.
 */

export function createSearchableSelect(container, options, placeholder = 'Search...', onSelect, onAddClick) {
  const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  
  const id = 'ss-' + Math.random().toString(36).substring(2, 9);
  
  container.innerHTML = `
    <div class="relative w-full group searchable-select" id="${id}">
      <div class="flex gap-2">
        <div class="relative flex-1">
          <input type="text" class="ss-input w-full px-4 py-3 bg-slate-50 border-2 border-slate-50 rounded-xl focus:bg-white focus:border-indigo-500 outline-none transition font-bold text-xs" 
                 placeholder="${esc(placeholder)}" autocomplete="off">
          <div class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none transition-transform group-focus-within:rotate-180">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path d="M19 9l-7 7-7-7"/></svg>
          </div>
        </div>
        ${onAddClick ? `
          <button type="button" class="ss-add-btn p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-600 hover:text-white transition shadow-sm">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor"><path d="M12 4.5v15m7.5-7.5h-15"/></svg>
          </button>
        ` : ''}
      </div>

      <!-- Dropdown -->
      <div class="ss-dropdown hidden absolute z-[100] left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-[300px] flex flex-col">
        <div class="ss-results overflow-y-auto flex-1 divide-y divide-slate-50"></div>
        <div class="ss-no-results hidden p-8 text-center">
          <p class="text-xs font-bold text-slate-400">No matches found</p>
        </div>
      </div>
    </div>
  `;

  const wrapper = container.querySelector('.searchable-select');
  const input = wrapper.querySelector('.ss-input');
  const dropdown = wrapper.querySelector('.ss-dropdown');
  const resultsCont = wrapper.querySelector('.ss-results');
  const noResults = wrapper.querySelector('.ss-no-results');
  const addBtn = wrapper.querySelector('.ss-add-btn');

  let selectedIndex = -1;
  let filteredOptions = [...options];

  function renderResults() {
    if (filteredOptions.length === 0) {
      resultsCont.innerHTML = '';
      noResults.classList.remove('hidden');
    } else {
      noResults.classList.add('hidden');
      resultsCont.innerHTML = filteredOptions.map((opt, i) => `
        <div class="ss-item px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors flex flex-col gap-0.5 ${i === selectedIndex ? 'bg-indigo-50' : ''}" data-idx="${i}">
          <span class="text-[11px] font-black text-slate-800">${esc(opt.name)}</span>
          <div class="flex items-center gap-2">
            <span class="text-[9px] font-black text-slate-400 uppercase tracking-tighter">${esc(opt.type)}</span>
            ${opt.balance !== undefined ? `<span class="text-[9px] font-bold text-indigo-400">Bal: ₹${Math.abs(opt.balance).toLocaleString()} ${opt.balance >= 0 ? 'DR' : 'CR'}</span>` : ''}
          </div>
        </div>
      `).join('');
    }
  }

  function filter(term) {
    const t = term.toLowerCase().trim();
    filteredOptions = options.filter(o => 
      o.name.toLowerCase().includes(t) || 
      o.type.toLowerCase().includes(t)
    );
    selectedIndex = filteredOptions.length > 0 ? 0 : -1;
    renderResults();
  }

  function selectItem(idx) {
    const opt = filteredOptions[idx];
    if (!opt) return;
    input.value = opt.name;
    dropdown.classList.add('hidden');
    if (onSelect) onSelect(opt);
    input.blur();
  }

  input.addEventListener('focus', () => {
    dropdown.classList.remove('hidden');
    renderResults();
  });

  input.addEventListener('input', (e) => {
    filter(e.target.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % filteredOptions.length;
      renderResults();
      const active = resultsCont.children[selectedIndex];
      if (active) active.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + filteredOptions.length) % filteredOptions.length;
      renderResults();
      const active = resultsCont.children[selectedIndex];
      if (active) active.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0) selectItem(selectedIndex);
    } else if (e.key === 'Escape') {
      dropdown.classList.add('hidden');
      input.blur();
    }
  });

  resultsCont.addEventListener('click', (e) => {
    const item = e.target.closest('.ss-item');
    if (item) {
      selectItem(parseInt(item.dataset.idx));
    }
  });

  if (addBtn) {
    addBtn.onclick = onAddClick;
  }

  // Close dropdown when clicking outside
  document.addEventListener('mousedown', (e) => {
    if (!wrapper.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  return {
    setValue: (val) => { input.value = val; },
    setOptions: (newOptions) => { 
      options = [...newOptions]; 
      filteredOptions = [...newOptions];
      renderResults();
    }
  };
}
