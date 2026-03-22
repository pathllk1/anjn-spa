export function renderTabs({ activeTab }) {
  return `
      <div class="tabs">
        <button 
          class="tab-btn ${activeTab === 'create' ? 'active' : ''}" 
          data-action="switch-tab"
          data-tab="create"
        >
          📝 Create Wages
        </button>
        <button 
          class="tab-btn ${activeTab === 'manage' ? 'active' : ''}" 
          data-action="switch-tab"
          data-tab="manage"
        >
          ✔️ Manage Wages
        </button>
      </div>
    `;
}