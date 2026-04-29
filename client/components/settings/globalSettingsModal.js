/**
 * Global Settings Modal
 * Provides UI for managing app-wide settings
 * Similar pattern to globalToolModal.js
 */

import { 
  getAllSettings, 
  saveSetting, 
  saveSettings, 
  clearAllSettings,
  exportSettings,
  importSettings,
  isIndexedDBAvailable
} from '../../utils/appSettingsDB.js';
import {
  SETTINGS_CATEGORIES,
  DEFAULT_SETTINGS,
  SETTINGS_DEFINITIONS,
  getSettingsByCategory,
  getAllCategories,
  getCategoryLabel,
  getSettingDefinition
} from './settingsRegistry.js';

const MODAL_ID = 'global-settings-modal';
const SEARCH_INPUT_ID = 'settings-search';
const RESULTS_ID = 'settings-results';

let currentSettings = { ...DEFAULT_SETTINGS };
let isOpen = false;
let previousActiveElement = null;

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildModalMarkup() {
  const modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.className = 'hidden fixed inset-0 z-[9998] flex items-start justify-center pt-[5vh] bg-slate-900/60 backdrop-blur-sm';
  modal.setAttribute('aria-hidden', 'true');

  modal.innerHTML = `
    <div class="bg-white w-full max-w-5xl rounded-[2rem] shadow-2xl overflow-hidden transform translate-y-4 scale-95 transition-all duration-300 max-h-[90vh] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
      <!-- Header -->
      <div class="p-8 bg-gradient-to-br from-slate-50 to-slate-100 border-b border-slate-200 shrink-0">
        <div class="flex justify-between items-baseline mb-2">
          <div>
            <p class="text-[10px] font-black text-purple-600 uppercase tracking-widest">Preferences</p>
            <h2 id="settings-modal-title" class="text-3xl font-black text-slate-900 tracking-tight">App Settings</h2>
          </div>
          <span class="text-[10px] font-bold px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-500 shadow-sm">Ctrl + ,</span>
        </div>
        <p class="text-sm text-slate-600 font-medium mt-1">Customize your application experience.</p>
        <input
          id="${SEARCH_INPUT_ID}"
          class="w-full mt-6 px-5 py-4 bg-white border-2 border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all placeholder:text-slate-400"
          type="text"
          autocomplete="off"
          placeholder="Search settings..."
        />
      </div>

      <!-- Content -->
      <div id="${RESULTS_ID}" class="flex-1 overflow-y-auto p-6"></div>

      <!-- Footer -->
      <div class="px-8 py-4 bg-slate-50 border-t border-slate-200 flex gap-4 justify-between shrink-0">
        <div class="flex gap-2">
          <button data-action="reset-defaults" class="px-4 py-2 bg-slate-100 text-slate-600 text-[9px] font-black rounded-lg hover:bg-slate-200 transition-colors uppercase tracking-widest">
            ↺ Reset Defaults
          </button>
          <button data-action="export-settings" class="px-4 py-2 bg-slate-100 text-slate-600 text-[9px] font-black rounded-lg hover:bg-slate-200 transition-colors uppercase tracking-widest">
            ⬇ Export
          </button>
          <button data-action="import-settings" class="px-4 py-2 bg-slate-100 text-slate-600 text-[9px] font-black rounded-lg hover:bg-slate-200 transition-colors uppercase tracking-widest">
            ⬆ Import
          </button>
        </div>
        <div class="flex gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  `;

  return modal;
}

function renderSettings(searchQuery = '') {
  const resultsContainer = document.getElementById(RESULTS_ID);
  const query = searchQuery.toLowerCase();

  const categories = getAllCategories();
  let html = '';

  categories.forEach(category => {
    const settings = getSettingsByCategory(category);
    const filtered = settings.filter(s => 
      s.label.toLowerCase().includes(query) || 
      s.description.toLowerCase().includes(query)
    );

    if (filtered.length === 0) return;

    html += `
      <div class="mb-8">
        <h3 class="text-sm font-black text-slate-600 uppercase tracking-widest mb-4 pb-2 border-b border-slate-200">
          ${escapeHtml(getCategoryLabel(category))}
        </h3>
        <div class="space-y-4">
          ${filtered.map(setting => renderSettingControl(setting)).join('')}
        </div>
      </div>
    `;
  });

  if (!html) {
    html = '<div class="text-center text-slate-400 py-12 text-sm font-bold uppercase tracking-widest">No matching settings</div>';
  }

  resultsContainer.innerHTML = html;
  attachSettingListeners();
}

function renderSettingControl(setting) {
  const value = currentSettings[setting.key];
  const baseClass = 'flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all';

  let control = '';

  switch (setting.type) {
    case 'toggle':
      control = `
        <input 
          type="checkbox" 
          data-setting-key="${setting.key}"
          class="w-5 h-5 rounded accent-purple-600 cursor-pointer"
          ${value ? 'checked' : ''}
        />
      `;
      break;

    case 'slider':
      control = `
        <div class="flex items-center gap-3">
          <input 
            type="range" 
            data-setting-key="${setting.key}"
            min="${setting.min}" 
            max="${setting.max}" 
            step="${setting.step}"
            value="${value}"
            class="w-32 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
          />
          <span class="text-sm font-bold text-slate-600 min-w-[3rem]">${value}${setting.unit || ''}</span>
        </div>
      `;
      break;

    case 'select':
      control = `
        <select 
          data-setting-key="${setting.key}"
          class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:border-purple-500 cursor-pointer"
        >
          ${setting.options.map(opt => `
            <option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>
              ${escapeHtml(opt.label)}
            </option>
          `).join('')}
        </select>
      `;
      break;

    case 'color':
      control = `
        <input 
          type="color" 
          data-setting-key="${setting.key}"
          value="${value}"
          class="w-12 h-10 rounded-lg cursor-pointer border border-slate-200"
        />
      `;
      break;

    default:
      control = `<span class="text-slate-400">Unknown type</span>`;
  }

  return `
    <div class="${baseClass}">
      <div class="flex-1">
        <label class="text-sm font-black text-slate-800 block mb-1">
          ${escapeHtml(setting.label)}
        </label>
        <p class="text-xs text-slate-500 font-medium">
          ${escapeHtml(setting.description)}
        </p>
      </div>
      <div class="ml-4">
        ${control}
      </div>
    </div>
  `;
}

function attachSettingListeners() {
  const resultsContainer = document.getElementById(RESULTS_ID);

  resultsContainer.addEventListener('change', async (e) => {
    const input = e.target;
    const key = input.dataset.settingKey;

    if (!key) return;

    let value;
    if (input.type === 'checkbox') {
      value = input.checked;
    } else if (input.type === 'range') {
      value = parseFloat(input.value);
    } else if (input.type === 'color') {
      value = input.value;
    } else {
      value = input.value;
    }

    currentSettings[key] = value;
    await saveSetting(key, value);
    applySettingToUI(key, value);
    
    // Update display value for sliders
    if (input.type === 'range') {
      const setting = getSettingDefinition(key);
      const display = input.parentElement.querySelector('span');
      if (display && setting) {
        display.textContent = `${value}${setting.unit || ''}`;
      }
    }
  });

  // Real-time update for range sliders (while dragging)
  resultsContainer.addEventListener('input', (e) => {
    const input = e.target;
    if (input.type === 'range') {
      const setting = getSettingDefinition(input.dataset.settingKey);
      const display = input.parentElement.querySelector('span');
      if (display && setting) {
        const value = parseFloat(input.value);
        display.textContent = `${value}${setting.unit || ''}`;
        // Also apply in real-time for immediate visual feedback
        applySettingToUI(input.dataset.settingKey, value);
      }
    }
  });
}

function applySettingToUI(key, value) {
  // Apply settings to the UI
  switch (key) {
    case 'font_size':
      // Apply to body only, not root (to preserve rem-based sizing)
      document.body.style.fontSize = `${value}px`;
      // Also set CSS variable for components that need it
      document.documentElement.style.setProperty('--app-font-size', `${value}px`);
      break;

    case 'font_family':
      const fontMap = {
        'system': 'system-ui, -apple-system, sans-serif',
        'serif': 'Georgia, serif',
        'mono': 'Courier New, monospace'
      };
      document.body.style.fontFamily = fontMap[value] || 'system-ui';
      break;

    case 'line_height':
      document.body.style.lineHeight = value;
      break;

    case 'theme_mode':
      applyThemeMode(value);
      break;

    case 'primary_color':
      document.documentElement.style.setProperty('--color-primary', value);
      break;

    case 'animations_enabled':
      document.documentElement.style.setProperty('--animations', value ? '1' : '0');
      break;
  }
}

function applyThemeMode(mode) {
  const html = document.documentElement;
  
  if (mode === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.classList.toggle('dark', prefersDark);
  } else {
    html.classList.toggle('dark', mode === 'dark');
  }
}

async function loadSettings() {
  try {
    const settings = await getAllSettings();
    currentSettings = { ...DEFAULT_SETTINGS, ...settings };
    
    // Apply all settings to UI
    Object.entries(currentSettings).forEach(([key, value]) => {
      applySettingToUI(key, value);
    });
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function resetToDefaults() {
  if (!confirm('Reset all settings to defaults?')) return;

  try {
    await clearAllSettings();
    currentSettings = { ...DEFAULT_SETTINGS };
    
    // Apply all defaults
    Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => {
      applySettingToUI(key, value);
    });

    renderSettings();
    showToast('Settings reset to defaults', 'success');
  } catch (error) {
    console.error('Error resetting settings:', error);
    showToast('Error resetting settings', 'error');
  }
}

async function handleExport() {
  try {
    const json = await exportSettings();
    if (!json) throw new Error('Failed to export');

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `app-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Settings exported successfully', 'success');
  } catch (error) {
    console.error('Error exporting settings:', error);
    showToast('Error exporting settings', 'error');
  }
}

async function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;

      const text = await file.text();
      const success = await importSettings(text);

      if (success) {
        await loadSettings();
        renderSettings();
        showToast('Settings imported successfully', 'success');
      } else {
        showToast('Invalid settings file', 'error');
      }
    } catch (error) {
      console.error('Error importing settings:', error);
      showToast('Error importing settings', 'error');
    }
  };

  input.click();
}

function showToast(message, type = 'success') {
  const bgColor = type === 'error' ? '#ef4444' : '#10b981';
  if (window.Toastify) {
    Toastify({
      text: message,
      backgroundColor: bgColor,
      duration: 3000,
      gravity: 'top',
      position: 'right'
    }).showToast();
  }
}

function close() {
  if (!isOpen) return;

  isOpen = false;
  const modal = document.getElementById(MODAL_ID);
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  modal.setAttribute('aria-hidden', 'true');
  previousActiveElement?.focus?.();
}

function open() {
  if (isOpen) return;

  previousActiveElement = document.activeElement;
  isOpen = true;
  const modal = document.getElementById(MODAL_ID);
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  modal.setAttribute('aria-hidden', 'false');

  renderSettings();
  window.requestAnimationFrame(() => {
    document.getElementById(SEARCH_INPUT_ID)?.focus();
  });
}

function toggle() {
  if (isOpen) {
    close();
  } else {
    open();
  }
}

export async function initGlobalSettingsModal() {
  if (window.__globalSettingsModal?.initialized) {
    return window.__globalSettingsModal.api;
  }

  if (!isIndexedDBAvailable()) {
    console.warn('IndexedDB not available, settings will not persist');
  }

  const modal = buildModalMarkup();
  const panel = modal.querySelector('[role="dialog"]');
  const searchInput = modal.querySelector(`#${SEARCH_INPUT_ID}`);
  const resultsContainer = modal.querySelector(`#${RESULTS_ID}`);

  // Load settings on init
  await loadSettings();

  // Search functionality
  searchInput.addEventListener('input', (e) => {
    renderSettings(e.target.value);
  });

  // Modal backdrop click
  modal.addEventListener('click', (event) => {
    if (!panel.contains(event.target)) {
      close();
    }
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (event) => {
    // Ctrl+, to open settings
    if (event.ctrlKey && event.key === ',') {
      event.preventDefault();
      toggle();
      return;
    }

    if (!isOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }, true);

  // Action buttons
  modal.addEventListener('click', (e) => {
    const action = e.target.dataset.action;

    if (action === 'reset-defaults') {
      resetToDefaults();
    } else if (action === 'export-settings') {
      handleExport();
    } else if (action === 'import-settings') {
      handleImport();
    }
  });

  document.body.appendChild(modal);

  const api = { open, close, toggle };
  window.__globalSettingsModal = {
    initialized: true,
    api
  };
  window.openGlobalSettingsModal = open;
  window.closeGlobalSettingsModal = close;
  window.toggleGlobalSettingsModal = toggle;

  return api;
}
