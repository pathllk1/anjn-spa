function countWords(value) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

export function createTextStudioToolModal() {
  function updateStats(root, value) {
    const statsEl = root.querySelector('#tool-text-studio-stats');
    if (!statsEl) return;
    statsEl.textContent = `${countWords(value)} words  |  ${value.length} chars`;
  }

  function transform(root, action) {
    const inputEl = root.querySelector('#tool-text-studio-input');
    if (!inputEl) return;

    const value = inputEl.value;
    let nextValue = value;

    switch (action) {
      case 'upper':
        nextValue = value.toUpperCase();
        break;
      case 'lower':
        nextValue = value.toLowerCase();
        break;
      case 'title':
        nextValue = value.toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
        break;
      case 'trim-lines':
        nextValue = value
          .split('\n')
          .map((line) => line.trim())
          .join('\n');
        break;
      case 'dedupe-lines':
        nextValue = [...new Set(value.split('\n'))].join('\n');
        break;
      case 'clear':
        nextValue = '';
        break;
      default:
        break;
    }

    inputEl.value = nextValue;
    updateStats(root, nextValue);
  }

  return {
    id: 'text-studio',
    title: 'Text Studio',
    subtitle: 'Quick text cleanup',
    description: 'Change case, trim lines, dedupe lists, and copy polished text fast.',
    badge: 'Text',
    render() {
      return `
        <div class="hidden fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" data-tool-modal="text-studio" role="dialog" aria-modal="true" aria-labelledby="tool-text-studio-title">
          <div class="absolute inset-0" data-dismiss-modal></div>
          <div class="relative bg-gray-900 border border-gray-700 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
            <div class="border-b border-gray-700 p-6 flex justify-between items-start bg-gray-800/50">
              <div>
                <p class="text-xs font-black text-indigo-400 uppercase tracking-widest">Studio</p>
                <h2 id="tool-text-studio-title" class="text-2xl font-black text-white mt-1 tracking-tighter italic">Text Processor</h2>
              </div>
              <button type="button" class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 text-gray-400 hover:text-white transition" data-close-utility aria-label="Close dialog">✕</button>
            </div>
            <div class="flex-1 overflow-hidden flex flex-col bg-gray-900">
              <div class="flex flex-wrap gap-2 p-4 border-b border-gray-700 bg-gray-800/30">
                <button type="button" class="bg-gray-800 hover:bg-indigo-600 text-indigo-400 hover:text-white text-[10px] px-3 py-2 rounded-xl font-black uppercase tracking-widest transition border border-gray-700" data-text-action="upper">Upper</button>
                <button type="button" class="bg-gray-800 hover:bg-indigo-600 text-indigo-400 hover:text-white text-[10px] px-3 py-2 rounded-xl font-black uppercase tracking-widest transition border border-gray-700" data-text-action="lower">Lower</button>
                <button type="button" class="bg-gray-800 hover:bg-indigo-600 text-indigo-400 hover:text-white text-[10px] px-3 py-2 rounded-xl font-black uppercase tracking-widest transition border border-gray-700" data-text-action="title">Title</button>
                <div class="w-px h-6 bg-gray-700 mx-1"></div>
                <button type="button" class="bg-gray-800 hover:bg-indigo-600 text-gray-400 hover:text-white text-[10px] px-3 py-2 rounded-xl font-black uppercase tracking-widest transition border border-gray-700" data-text-action="trim-lines">Trim</button>
                <button type="button" class="bg-gray-800 hover:bg-indigo-600 text-gray-400 hover:text-white text-[10px] px-3 py-2 rounded-xl font-black uppercase tracking-widest transition border border-gray-700" data-text-action="dedupe-lines">Dedupe</button>
                <div class="flex-1"></div>
                <button type="button" class="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] px-4 py-2 rounded-xl font-black uppercase tracking-widest transition shadow-lg shadow-emerald-900/20" data-text-action="copy">Copy</button>
                <button type="button" class="bg-gray-800 hover:bg-rose-900/30 hover:text-rose-400 text-rose-900 text-[10px] px-4 py-2 rounded-xl font-black uppercase tracking-widest transition border border-gray-700" data-text-action="clear">Clear</button>
              </div>
              <div id="tool-text-studio-stats" class="px-6 py-2 text-[9px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-700/50 bg-gray-900">0 words  |  0 chars</div>
              <textarea id="tool-text-studio-input" class="flex-1 bg-transparent border-0 px-8 py-8 text-gray-300 text-lg leading-relaxed focus:outline-none resize-none scrollbar-thin scrollbar-thumb-gray-800 placeholder:text-gray-800" placeholder="Paste or type content here..."></textarea>
            </div>
          </div>
        </div>
      `;
    },
    init(root) {
      const inputEl = root.querySelector('#tool-text-studio-input');

      root.addEventListener('click', async (event) => {
        const actionButton = event.target.closest('[data-text-action]');
        if (!actionButton) return;

        if (actionButton.dataset.textAction === 'copy') {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(inputEl?.value || '');
          }
          return;
        }

        transform(root, actionButton.dataset.textAction);
      });

      inputEl?.addEventListener('input', () => {
        updateStats(root, inputEl.value);
      });

      updateStats(root, '');
    },
    onOpen(root) {
      root.querySelector('#tool-text-studio-input')?.focus();
    },
  };
}
