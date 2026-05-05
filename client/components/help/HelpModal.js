export class HelpModal {
  constructor() {
    this.isOpen = false;
    this.selectedFile = null;
    this.helpFiles = {};
    this.init();
  }

  init() {
    this.createModal();
    this.attachEventListeners();
  }

  createModal() {
    const modal = document.createElement('div');
    modal.id = 'global-help-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in">
        <!-- Header -->
        <div class="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 flex justify-between items-center z-10">
          <div class="flex items-center gap-3">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <h2 class="text-xl font-bold">Help & Documentation</h2>
          </div>
          <button id="close-help-modal" class="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-1 transition">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="flex flex-1 overflow-hidden">
          <!-- Left Panel - File Tree -->
          <div class="w-64 border-r border-gray-200 overflow-y-auto bg-gray-50">
            <div class="p-4 space-y-2" id="help-tree">
              <!-- Populated by loadHelpContent -->
            </div>
          </div>

          <!-- Right Panel - Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <div id="help-content" class="prose prose-sm max-w-none">
              <div class="text-center text-gray-500 py-12">
                <svg class="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m0 0h6"/>
                </svg>
                <p>Select a help topic from the left panel</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  async loadHelpContent() {
    try {
      // Dynamically import help content modules
      const masterRoll = await import('./content/masterRoll.js');
      const wages = await import('./content/wages.js');
      const advances = await import('./content/advances.js');
      const dataQuality = await import('./content/dataQuality.js');
      const authentication = await import('./content/authentication.js');
      const shortcuts = await import('./content/shortcuts.js');

      this.helpFiles = {
        'HR System': {
          'Master Roll': masterRoll.content,
          'Wages': wages.content,
          'Advances': advances.content,
          'Data Quality': dataQuality.content,
          'Keyboard Shortcuts': shortcuts.content,
        },
        'Security': {
          'Authentication & Authorization': authentication.content,
        }
      };

      this.renderFileTree();
    } catch (error) {
      console.error('Error loading help content:', error);
    }
  }

  renderFileTree() {
    const treeDiv = document.getElementById('help-tree');
    if (!treeDiv) return;

    let html = '';
    for (const [category, files] of Object.entries(this.helpFiles)) {
      html += `
        <div class="mb-4">
          <div class="font-semibold text-gray-900 text-sm mb-2 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
            ${category}
          </div>
          <div class="space-y-1 ml-4">
            ${Object.keys(files).map(file => `
              <button class="help-file-btn w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-white hover:text-indigo-600 transition" data-category="${category}" data-file="${file}">
                <svg class="w-3 h-3 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                ${file}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }
    treeDiv.innerHTML = html;
  }

  attachEventListeners() {
    const modal = document.getElementById('global-help-modal');
    const closeBtn = document.getElementById('close-help-modal');

    // Load help content first
    this.loadHelpContent();

    // Close button
    closeBtn.addEventListener('click', () => this.close());

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    // File selection - use event delegation
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('help-file-btn')) {
        const category = e.target.dataset.category;
        const file = e.target.dataset.file;
        this.displayContent(category, file);
        
        // Highlight selected
        document.querySelectorAll('.help-file-btn').forEach(btn => {
          btn.classList.remove('bg-indigo-100', 'text-indigo-700');
        });
        e.target.classList.add('bg-indigo-100', 'text-indigo-700');
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Open help with ?
      if (e.key === '?' && !this.isOpen) {
        e.preventDefault();
        this.open();
      }
      // Close help with Esc
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  displayContent(category, file) {
    const content = this.helpFiles[category][file];
    const contentDiv = document.getElementById('help-content');
    contentDiv.innerHTML = `
      <div class="bg-white rounded-lg p-6">
        ${content}
      </div>
    `;
  }

  open() {
    const modal = document.getElementById('global-help-modal');
    modal.classList.remove('hidden');
    this.isOpen = true;
  }

  close() {
    const modal = document.getElementById('global-help-modal');
    modal.classList.add('hidden');
    this.isOpen = false;
  }
}

// Initialize globally
export function initGlobalHelpModal() {
  window.helpModal = new HelpModal();
}
