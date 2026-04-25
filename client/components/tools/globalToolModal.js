import { initToolRegistry } from './toolRegistry.js';

const MODAL_ID = 'global-tool-modal';
const SEARCH_INPUT_ID = 'global-tool-modal-search';
const RESULTS_ID = 'global-tool-modal-results';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function matchesTool(tool, query) {
  if (!query) return true;

  const normalizedQuery = query.trim().toLowerCase();
  const haystack = [
    tool.title,
    tool.subtitle,
    tool.description,
    tool.badge,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function buildModalMarkup() {
  const modal = document.createElement('div');
  modal.id = MODAL_ID;
  // Use Tailwind 'hidden' by default on the root element
  modal.className = 'hidden fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-slate-900/60 backdrop-blur-sm';
  modal.setAttribute('aria-hidden', 'true');
  
  modal.innerHTML = `
    <div class="bg-white w-full max-w-[600px] rounded-[2rem] shadow-2xl overflow-hidden transform translate-y-4 scale-95 transition-all duration-300" role="dialog" aria-modal="true" aria-labelledby="tool-modal-title">
      <div class="p-8 bg-slate-50 border-b border-slate-100">
        <div class="flex justify-between items-baseline mb-2">
          <div>
            <p class="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Global Tools</p>
            <h2 id="tool-modal-title" class="text-2xl font-black text-slate-900 tracking-tight">Utility Launcher</h2>
          </div>
          <span class="text-[10px] font-bold px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-400">Ctrl + .</span>
        </div>
        <p class="text-xs text-slate-500 font-medium">Open quick utilities from anywhere in the app.</p>
        <input
          id="${SEARCH_INPUT_ID}"
          class="w-full mt-6 px-5 py-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:border-indigo-500/30 transition-all placeholder:text-slate-300"
          type="text"
          autocomplete="off"
          placeholder="Search tools..."
        />
      </div>
      <div id="${RESULTS_ID}" class="max-h-[400px] overflow-y-auto p-4 space-y-1"></div>
      <div class="px-8 py-3 bg-slate-50 border-t border-slate-100 flex gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
        <span>Enter to open</span>
        <span>Esc to close</span>
      </div>
    </div>
  `;

  return modal;
}

function isShortcutEvent(event) {
  const hasControlOnly = event.ctrlKey && !event.altKey && !event.metaKey;
  const matchesPeriodKey =
    event.key === '.' ||
    event.key === '>' ||
    event.code === 'Period' ||
    event.code === 'NumpadDecimal';

  return hasControlOnly && matchesPeriodKey;
}

export function initGlobalToolModal() {
  if (window.__globalToolModal?.initialized) {
    return window.__globalToolModal.api;
  }

  const toolRegistry = initToolRegistry();
  const modal = buildModalMarkup();
  const panel = modal.querySelector('[role="dialog"]');
  const searchInput = modal.querySelector(`#${SEARCH_INPUT_ID}`);
  const resultsContainer = modal.querySelector(`#${RESULTS_ID}`);

  let isOpen = false;
  let activeIndex = 0;
  let visibleTools = [];
  let previousActiveElement = null;

  function renderResults() {
    const query = searchInput.value || '';
    visibleTools = toolRegistry.getTools().filter(tool => matchesTool(tool, query));

    if (!visibleTools.length) {
      resultsContainer.innerHTML = '<div class="text-center text-slate-400 py-8 text-sm font-bold uppercase tracking-widest">No matching tools</div>';
      return;
    }

    activeIndex = Math.min(activeIndex, visibleTools.length - 1);

    resultsContainer.innerHTML = `
      <div class="grid grid-cols-1 gap-2">
        ${visibleTools.map((tool, index) => `
          <button
            type="button"
            class="group flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${index === activeIndex ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white border-slate-50 hover:bg-slate-50 hover:border-slate-100'}"
            data-tool-index="${index}"
          >
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black uppercase tracking-tighter shadow-sm transition-all ${index === activeIndex ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}">
              ${escapeHtml(tool.badge)}
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="text-sm font-black truncate ${index === activeIndex ? 'text-white' : 'text-slate-800'}">${escapeHtml(tool.title)}</h4>
              <p class="text-[10px] font-bold truncate uppercase tracking-widest ${index === activeIndex ? 'text-indigo-200' : 'text-slate-400'}">${escapeHtml(tool.subtitle)}</p>
            </div>
            <div class="text-[10px] font-black uppercase tracking-[0.2em] transition-all ${index === activeIndex ? 'text-white translate-x-0 opacity-100' : 'text-indigo-600 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0'}">
              Launch
            </div>
          </button>
        `).join('')}
      </div>
    `;
  }

  function focusActiveItem() {
    const activeItem = resultsContainer.querySelector(`[data-tool-index="${activeIndex}"]`);
    activeItem?.scrollIntoView({ block: 'nearest' });
  }

  function close() {
    if (!isOpen) return;

    isOpen = false;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    modal.setAttribute('aria-hidden', 'true');
    previousActiveElement?.focus?.();
  }

  function open() {
    if (isOpen) return;

    previousActiveElement = document.activeElement;
    isOpen = true;
    activeIndex = 0;
    searchInput.value = '';
    renderResults();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.setAttribute('aria-hidden', 'false');
    window.requestAnimationFrame(() => searchInput.focus());
  }

  function toggle() {
    if (isOpen) {
      close();
      return;
    }

    open();
  }

  function runActiveTool() {
    const tool = visibleTools[activeIndex];
    if (!tool) return;

    close();
    toolRegistry.openToolModal(tool.id);
  }

  searchInput.addEventListener('input', () => {
    activeIndex = 0;
    renderResults();
  });

  resultsContainer.addEventListener('mousemove', (event) => {
    const item = event.target.closest('[data-tool-index]');
    if (!item) return;

    const nextIndex = Number(item.dataset.toolIndex);
    if (Number.isNaN(nextIndex) || nextIndex === activeIndex) return;

    activeIndex = nextIndex;
    renderResults();
  });

  resultsContainer.addEventListener('click', (event) => {
    const item = event.target.closest('[data-tool-index]');
    if (!item) return;

    activeIndex = Number(item.dataset.toolIndex);
    runActiveTool();
  });

  modal.addEventListener('click', (event) => {
    if (!panel.contains(event.target)) {
      close();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (isShortcutEvent(event)) {
      event.preventDefault();
      event.stopPropagation();
      toggle();
      return;
    }

    if (!isOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = visibleTools.length ? (activeIndex + 1) % visibleTools.length : 0;
      renderResults();
      focusActiveItem();
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = visibleTools.length
        ? (activeIndex - 1 + visibleTools.length) % visibleTools.length
        : 0;
      renderResults();
      focusActiveItem();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      runActiveTool();
    }
  }, true);

  document.body.appendChild(modal);

  const api = { open, close, toggle };
  window.__globalToolModal = {
    initialized: true,
    api,
  };
  window.openGlobalToolModal = open;
  window.closeGlobalToolModal = close;
  window.toggleGlobalToolModal = toggle;

  return api;
}
