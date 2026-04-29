/**
 * Settings Tool Modal
 * Integrates app settings into the global tools modal
 */

import { 
  getAllSettings, 
  saveSetting,
  clearAllSettings,
  exportSettings,
  importSettings
} from '../../utils/appSettingsDB.js';
import {
  DEFAULT_SETTINGS,
  SETTINGS_DEFINITIONS,
  getSettingsByCategory,
  getAllCategories,
  getCategoryLabel
} from '../settings/settingsRegistry.js';
import { applySettingToUI } from '../../utils/settingsApplier.js';

let currentSettings = { ...DEFAULT_SETTINGS };

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

async function loadSettings() {
  try {
    const settings = await getAllSettings();
    currentSettings = { ...DEFAULT_SETTINGS, ...settings };
    
    Object.entries(currentSettings).forEach(([key, value]) => {
      applySettingToUI(key, value);
    });
  } catch (error) {
    console.error('Error loading settings:', error);
  }
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

export function createSettingsToolModal() {
  return {
    id: 'settings-tool',
    title: 'App Settings',
    subtitle: 'Preferences',
    badge: '⚙️',
    description: 'Customize font, theme, layout, and behavior',

    render() {
      return `
        <div data-tool-modal="settings-tool" class="hidden fixed inset-0 z-[9999] flex items-start justify-center pt-[5vh] bg-slate-900/60 backdrop-blur-sm">
          <div class="bg-white w-full max-w-5xl rounded-[2rem] shadow-2xl overflow-hidden transform translate-y-4 scale-95 transition-all duration-300 max-h-[90vh] flex flex-col">
            <!-- Header -->
            <div class="p-8 bg-gradient-to-br from-slate-50 to-slate-100 border-b border-slate-200 shrink-0">
              <div class="flex justify-between items-baseline mb-2">
                <div>
                  <p class="text-[10px] font-black text-purple-600 uppercase tracking-widest">Preferences</p>
                  <h2 class="text-3xl font-black text-slate-900 tracking-tight">App Settings</h2>
                </div>
              </div>
              <p class="text-sm text-slate-600 font-medium mt-1">Customize your application experience.</p>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-6 space-y-8" data-settings-content></div>

            <!-- Footer -->
            <div class="px-8 py-4 bg-slate-50 border-t border-slate-200 flex gap-4 justify-between shrink-0">
              <div class="flex gap-2">
                <button data-settings-action="reset-defaults" class="px-4 py-2 bg-slate-100 text-slate-600 text-[9px] font-black rounded-lg hover:bg-slate-200 transition-colors uppercase tracking-widest">
                  ↺ Reset Defaults
                </button>
                <button data-settings-action="export-settings" class="px-4 py-2 bg-slate-100 text-slate-600 text-[9px] font-black rounded-lg hover:bg-slate-200 transition-colors uppercase tracking-widest">
                  ⬇ Export
                </button>
                <button data-settings-action="import-settings" class="px-4 py-2 bg-slate-100 text-slate-600 text-[9px] font-black rounded-lg hover:bg-slate-200 transition-colors uppercase tracking-widest">
                  ⬆ Import
                </button>
              </div>
              <button data-close-utility class="px-4 py-2 bg-purple-600 text-white text-[9px] font-black rounded-lg hover:bg-purple-700 transition-colors uppercase tracking-widest">
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      `;
    },

    async init(root) {
      await loadSettings();
      this.renderSettings(root);

      // Handle both 'change' and 'input' events for real-time updates
      root.addEventListener('change', async (e) => {
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
          const setting = SETTINGS_DEFINITIONS.find(s => s.key === key);
          const display = input.parentElement.querySelector('span');
          if (display && setting) {
            display.textContent = `${value}${setting.unit || ''}`;
          }
        }
      });

      // Real-time update for range sliders (while dragging)
      root.addEventListener('input', (e) => {
        const input = e.target;
        if (input.type === 'range') {
          const setting = SETTINGS_DEFINITIONS.find(s => s.key === input.dataset.settingKey);
          const display = input.parentElement.querySelector('span');
          if (display && setting) {
            const value = parseFloat(input.value);
            display.textContent = `${value}${setting.unit || ''}`;
            // Also apply in real-time for immediate visual feedback
            applySettingToUI(input.dataset.settingKey, value);
          }
        }
      });

      root.addEventListener('click', async (e) => {
        const action = e.target.dataset.settingsAction;

        if (action === 'reset-defaults') {
          if (!confirm('Reset all settings to defaults?')) return;
          try {
            await clearAllSettings();
            currentSettings = { ...DEFAULT_SETTINGS };
            Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => {
              applySettingToUI(key, value);
            });
            this.renderSettings(root);
            showToast('Settings reset to defaults', 'success');
          } catch (error) {
            showToast('Error resetting settings', 'error');
          }
        } else if (action === 'export-settings') {
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
            showToast('Error exporting settings', 'error');
          }
        } else if (action === 'import-settings') {
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
                this.renderSettings(root);
                showToast('Settings imported successfully', 'success');
              } else {
                showToast('Invalid settings file', 'error');
              }
            } catch (error) {
              showToast('Error importing settings', 'error');
            }
          };

          input.click();
        }
      });
    },

    renderSettings(root) {
      const content = root.querySelector('[data-settings-content]');
      const categories = getAllCategories();
      let html = '';

      categories.forEach(category => {
        const settings = getSettingsByCategory(category);
        
        html += `
          <div>
            <h3 class="text-sm font-black text-slate-600 uppercase tracking-widest mb-4 pb-2 border-b border-slate-200">
              ${escapeHtml(getCategoryLabel(category))}
            </h3>
            <div class="space-y-4">
              ${settings.map(setting => renderSettingControl(setting)).join('')}
            </div>
          </div>
        `;
      });

      content.innerHTML = html;
    },

    onOpen(modal) {
      // Focus on first input
      const firstInput = modal.querySelector('input, select');
      firstInput?.focus();
    }
  };
}
