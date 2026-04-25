import { createCalendarToolModal } from './calendarToolModal.js';
import { createCalculatorToolModal } from './calculatorToolModal.js';
import { createNotepadToolModal } from './notepadToolModal.js';
import { createStopwatchToolModal } from './stopwatchToolModal.js';
import { createUnitConverterToolModal } from './unitConverterToolModal.js';
import { createTextStudioToolModal } from './textStudioToolModal.js';

const TOOL_DEFINITIONS = [
  createCalendarToolModal(),
  createCalculatorToolModal(),
  createNotepadToolModal(),
  createStopwatchToolModal(),
  createUnitConverterToolModal(),
  createTextStudioToolModal(),
];

let toolRegistryState = null;

function buildUtilityHostMarkup() {
  return `
    <div id="tool-utility-host">
      <div id="tool-utility-overlay" class="tool-utility-overlay hidden" aria-hidden="true">
        <div class="tool-utility-shell">
          ${TOOL_DEFINITIONS.map((tool) => tool.render()).join('')}
        </div>
      </div>
    </div>
  `;
}

function closeToolModal() {
  if (!toolRegistryState || !toolRegistryState.activeToolId) return;

  const activeModal = toolRegistryState.overlay.querySelector(
    `[data-tool-modal="${toolRegistryState.activeToolId}"]`
  );

  activeModal?.classList.add('hidden');
  toolRegistryState.overlay.classList.add('hidden');
  toolRegistryState.overlay.setAttribute('aria-hidden', 'true');
  toolRegistryState.activeToolId = null;
}

function openToolModal(toolId) {
  if (!toolRegistryState) return;

  const modal = toolRegistryState.overlay.querySelector(`[data-tool-modal="${toolId}"]`);
  const tool = toolRegistryState.toolsById.get(toolId);

  if (!modal || !tool) return;

  toolRegistryState.overlay.querySelectorAll('[data-tool-modal]').forEach((item) => {
    item.classList.add('hidden');
  });

  toolRegistryState.overlay.classList.remove('hidden');
  toolRegistryState.overlay.setAttribute('aria-hidden', 'false');
  modal.classList.remove('hidden');
  toolRegistryState.activeToolId = toolId;

  if (typeof tool.onOpen === 'function') {
    tool.onOpen(modal);
  }
}

export function initToolRegistry() {
  if (toolRegistryState) {
    return {
      getTools: () => TOOL_DEFINITIONS.slice(),
      openToolModal,
      closeToolModal,
    };
  }

  const host = document.createElement('div');
  host.innerHTML = buildUtilityHostMarkup();
  document.body.appendChild(host.firstElementChild);

  const overlay = document.getElementById('tool-utility-overlay');
  const toolsById = new Map(TOOL_DEFINITIONS.map((tool) => [tool.id, tool]));

  TOOL_DEFINITIONS.forEach((tool) => {
    const root = overlay.querySelector(`[data-tool-modal="${tool.id}"]`);
    if (root && typeof tool.init === 'function') {
      tool.init(root);
    }
  });

  toolRegistryState = {
    overlay,
    activeToolId: null,
    toolsById,
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay || event.target.hasAttribute('data-close-utility')) {
      closeToolModal();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toolRegistryState?.activeToolId) {
      event.preventDefault();
      closeToolModal();
    }
  });

  return {
    getTools: () => TOOL_DEFINITIONS.slice(),
    openToolModal,
    closeToolModal,
  };
}
