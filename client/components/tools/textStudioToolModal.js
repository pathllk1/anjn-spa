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
        <div class="tool-utility-card hidden" data-tool-modal="text-studio" role="dialog" aria-modal="true" aria-labelledby="tool-text-studio-title">
          <div class="tool-utility-card__header">
            <div>
              <p class="tool-utility-card__eyebrow">Text Tools</p>
              <h2 id="tool-text-studio-title" class="tool-utility-card__title">Text Studio</h2>
            </div>
            <button type="button" class="tool-utility-card__close" data-close-utility aria-label="Close dialog">x</button>
          </div>
          <div class="tool-utility-card__body">
            <div class="tool-text-studio">
              <div class="tool-text-studio__actions">
                <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-text-action="upper">UPPER</button>
                <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-text-action="lower">lower</button>
                <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-text-action="title">Title Case</button>
                <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-text-action="trim-lines">Trim lines</button>
                <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-text-action="dedupe-lines">Dedupe lines</button>
                <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-text-action="copy">Copy</button>
                <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-text-action="clear">Clear</button>
              </div>
              <div id="tool-text-studio-stats" class="tool-text-studio__stats">0 words  |  0 chars</div>
              <textarea id="tool-text-studio-input" class="tool-text-studio__input" placeholder="Paste text here..."></textarea>
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
