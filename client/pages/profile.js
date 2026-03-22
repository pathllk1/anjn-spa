import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { fetchWithCSRF } from '../utils/api.js';
import { authManager } from '../utils/auth.js';

export async function renderProfile(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const user = authManager.getUser();

  try {
    const [profileRes, settingsRes] = await Promise.all([
      fetch('/api/pages/profile',                          { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }),
      fetch('/api/settings/system-config/gst-status',     { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }),
    ]);

    if (!profileRes.ok) throw new Error(`HTTP ${profileRes.status}`);
    const profileData = await profileRes.json();
    if (!profileData.success) throw new Error(profileData.error || 'Failed to fetch profile data');

    let gstEnabled = true;
    if (settingsRes.ok) {
      const s = await settingsRes.json();
      if (s.success) gstEnabled = s.data?.gst_enabled ?? true;
    }

    const content = `
      <div class="max-w-5xl mx-auto px-4 py-10 space-y-10">

        <!-- Page Header -->
        <div>
          <h1 class="text-3xl font-bold text-gray-900 tracking-tight">Profile</h1>
          <p class="text-gray-500 mt-1">Manage your account settings and preferences</p>
        </div>

        <!-- User Information -->
        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-gray-800">User Information</h2>
          <div class="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm grid md:grid-cols-2 gap-5">
            ${createInput('User ID',  user.id)}
            ${createInput('Username', user.username)}
            ${createInput('Email',    user.email)}
            ${createInput('Role',     user.role)}
          </div>
        </section>

        <!-- Preferences -->
        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-gray-800">Preferences</h2>
          <div class="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm grid md:grid-cols-3 gap-5">
            ${createInput('Theme',         profileData.data?.preferences?.theme         || 'light')}
            ${createInput('Notifications', profileData.data?.preferences?.notifications  ? 'Enabled' : 'Disabled')}
            ${createInput('Language',      profileData.data?.preferences?.language       || 'en')}
          </div>
        </section>

        <!-- Account Information -->
        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-gray-800">Account Information</h2>
          <div class="bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-2 text-sm text-gray-700">
            <p><span class="font-medium text-gray-600">Member Since:</span> ${profileData.data?.accountInfo?.memberSince || 'N/A'}</p>
            <p><span class="font-medium text-gray-600">Last Password Change:</span> ${profileData.data?.accountInfo?.lastPasswordChange || 'N/A'}</p>
            <p><span class="font-medium text-gray-600">Two-Factor Authentication:</span>
              ${profileData.data?.accountInfo?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </section>

        <!-- System Settings -->
        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-gray-800">System Settings</h2>
          <div class="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-gray-800">GST Calculation</h3>
                <p class="text-xs text-gray-500 mt-0.5">Enable or disable GST in invoices</p>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="gst-toggle" ${gstEnabled ? 'checked' : ''} class="sr-only peer"/>
                <div class="toggle-track"></div>
              </label>
            </div>
            <div id="gst-message" class="mt-3"></div>
          </div>
        </section>

        <!-- Security -->
        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-gray-800">Security</h2>
          <div class="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 class="text-sm font-semibold text-gray-800">Token Authentication Status</h3>
            <div class="space-y-1.5 text-sm text-gray-700">
              <p>✅ Access Token: Active (15 min expiry)</p>
              <p>✅ Refresh Token: Active (30 day expiry)</p>
              <p>✅ Auto-Refresh: Enabled (every 10 minutes)</p>
            </div>
            <button id="manual-refresh-btn"
                    class="px-4 py-2 text-sm font-semibold bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors">
              Manually Refresh Token
            </button>
            <div id="refresh-message"></div>
          </div>
        </section>


      </div>
    `;

    renderLayout(content, router);

    /* ── GST Toggle ── */
    const gstToggle  = document.getElementById('gst-toggle');
    const gstMessage = document.getElementById('gst-message');

    gstToggle?.addEventListener('change', async () => {
      gstMessage.innerHTML = statusMsg('blue', 'Updating GST setting…');
      try {
        const res = await fetchWithCSRF('/api/settings/system-config/gst-status', {
          method: 'PUT',
          body: JSON.stringify({ enabled: gstToggle.checked }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || `Failed (${res.status})`); }
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Failed to update');
        gstMessage.innerHTML = statusMsg('green', 'GST setting updated successfully!');
        setTimeout(() => { gstMessage.innerHTML = ''; }, 3000);
      } catch (err) {
        gstToggle.checked = !gstToggle.checked;
        gstMessage.innerHTML = statusMsg('red', 'Error: ' + err.message);
      }
    });

    /* ── Token Refresh ── */
    const refreshBtn     = document.getElementById('manual-refresh-btn');
    const refreshMessage = document.getElementById('refresh-message');

    refreshBtn?.addEventListener('click', async () => {
      refreshMessage.innerHTML = statusMsg('blue', 'Refreshing token…');
      try {
        await authManager.refreshToken();
        refreshMessage.innerHTML = statusMsg('green', 'Token refreshed successfully!');
        setTimeout(() => { refreshMessage.innerHTML = ''; }, 3000);
      } catch {
        refreshMessage.innerHTML = statusMsg('red', 'Token refresh failed.');
      }
    });

  } catch (error) {
    const content = `
      <div class="max-w-4xl mx-auto px-4 py-16 space-y-6">
        <h1 class="text-3xl font-bold text-gray-900">Profile</h1>
        <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl text-sm">
          Failed to load profile data: ${error.message}
        </div>
      </div>
    `;
    renderLayout(content, router);
  }
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function createInput(label, value) {
  return `
    <div class="space-y-1.5">
      <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide">${label}</label>
      <input type="text" value="${value}" disabled
             class="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg
                    bg-gray-50 text-gray-600 cursor-not-allowed"/>
    </div>
  `;
}

function statusMsg(color, text) {
  return `<div class="status-msg status-msg--${color}">${text}</div>`;
}