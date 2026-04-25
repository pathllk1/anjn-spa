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
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="tool-modal__panel" role="dialog" aria-modal="true" aria-labelledby="tool-modal-title">
      <div class="tool-modal__header">
        <div class="tool-modal__title-row">
          <div>
            <p class="tool-modal__eyebrow">Global Tools</p>
            <h2 id="tool-modal-title" class="tool-modal__title">Utility Launcher</h2>
          </div>
          <span class="tool-modal__hint">Ctrl + .</span>
        </div>
        <p class="tool-modal__intro">Open quick utilities from anywhere in the app.</p>
        <input
          id="${SEARCH_INPUT_ID}"
          class="tool-modal__search"
          type="text"
          autocomplete="off"
          placeholder="Search tools..."
        />
      </div>
      <div id="${RESULTS_ID}" class="tool-modal__results"></div>
      <div class="tool-modal__footer">
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
  const panel = modal.querySelector('.tool-modal__panel');
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
      resultsContainer.innerHTML = '<div class="tool-modal__empty">No matching tools found.</div>';
      return;
    }

    activeIndex = Math.min(activeIndex, visibleTools.length - 1);

    resultsContainer.innerHTML = `
      <div class="tool-modal__grid">
        ${visibleTools.map((tool, index) => `
          <button
            type="button"
            class="tool-modal__card${index === activeIndex ? ' is-active' : ''}"
            data-tool-index="${index}"
          >
            <span class="tool-modal__card-badge">${escapeHtml(tool.badge)}</span>
            <span class="tool-modal__card-title">${escapeHtml(tool.title)}</span>
            <span class="tool-modal__card-subtitle">${escapeHtml(tool.subtitle)}</span>
            <span class="tool-modal__card-desc">${escapeHtml(tool.description)}</span>
            <span class="tool-modal__card-action">Open</span>
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
    modal.classList.remove('is-open');
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
    modal.classList.add('is-open');
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
