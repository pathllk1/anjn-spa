/**
 * Settings Applier Utility
 * Shared functions for applying settings to the UI
 * Used by both app.js and settingsToolModal.js
 */

export function applySettingToUI(key, value) {
  switch (key) {
    case 'font_size':
      document.body.style.fontSize = `${value}px`;
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

    case 'accent_color':
      applyAccentColor(value);
      break;

    case 'animations_enabled':
      applyAnimations(value);
      break;
  }
}

export function applyThemeMode(mode) {
  const html = document.documentElement;
  
  if (mode === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.classList.toggle('dark', prefersDark);
  } else {
    html.classList.toggle('dark', mode === 'dark');
  }
}

export function applyAccentColor(color) {
  const html = document.documentElement;
  
  html.classList.remove('accent-indigo', 'accent-blue', 'accent-purple', 'accent-emerald');
  html.classList.add(`accent-${color}`);
  html.dataset.accentColor = color;
}

export function applyAnimations(enabled) {
  const html = document.documentElement;
  
  if (enabled) {
    html.classList.remove('no-animations');
  } else {
    html.classList.add('no-animations');
  }
}
