import { renderNavbar } from './navbar.js';
import { renderSidebar } from './sidebar.js';
import { initGlobalHelpModal } from './help-modal.js';

export function renderLayout(content, router) {
  // Initialize global help modal (only once)
  if (!window.helpModal) {
    initGlobalHelpModal();
  }

  // Render navbar first
  renderNavbar(router);
  
  // Render sidebar
  renderSidebar(router);
  
  // Render page content with proper spacing for fixed navbar, sidebar, and footer
  const appContainer = document.getElementById('app');
  if (appContainer) {
    // Check if this is a home page (full-width content)
    const isFullWidth = content.includes('Welcome to SecureApp') && content.includes('Powerful Features');
    
    if (isFullWidth) {
      // For home page, render without the constraining wrapper
      appContainer.innerHTML = `
        <div class="ml-16 pt-0 pb-12 min-h-screen transition-all duration-300 animate-color-shift" id="main-content">
          <main class="p-0">
            <div class="page">
              ${content}
            </div>
          </main>
        </div>
      `;
    } else {
      // For other pages, use the standard wrapper with color shift animation
      appContainer.innerHTML = `
        <div class="ml-16 pt-16 pb-12 min-h-screen transition-all duration-300 animate-color-shift" id="main-content">
          <main class="px-6 py-4">
            <div class="page">
              ${content}
            </div>
          </main>
        </div>
      `;
    }
  }

  // Render footer
  renderFooter();
  
  // Update page links ONCE after all components are rendered
  router.updatePageLinks();
}

function renderFooter() {
  const footerContainer = document.getElementById('footer');
  if (footerContainer) {
    const currentYear = new Date().getFullYear();
    footerContainer.innerHTML = `
      <footer class="fixed bottom-0 left-0 w-full h-8 bg-gradient-to-l from-indigo-600 via-purple-600 to-pink-600 text-white border-t border-purple-700 z-10">
        <div class="h-full flex items-center justify-between px-6">
          <div class="text-xs">
            © ${currentYear} SecureApp. All rights reserved.
          </div>
          <div class="flex items-center gap-4 text-xs">
            <a href="#" class="hover:text-gray-100 transition">Privacy</a>
            <a href="#" class="hover:text-gray-100 transition">Terms</a>
            <a href="#" class="hover:text-gray-100 transition">Support</a>
          </div>
        </div>
      </footer>
    `;
  }
}
