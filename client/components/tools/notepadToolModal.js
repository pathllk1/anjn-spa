const NOTEPAD_STORAGE_KEY = 'global-tool-notepad-workspace';

function createNote(title = 'Untitled note') {
  return {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    body: '',
    updatedAt: new Date().toISOString(),
  };
}

function loadWorkspace() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTEPAD_STORAGE_KEY) || '{}');
    const notes = Array.isArray(saved.notes) && saved.notes.length ? saved.notes : [createNote('Workspace note')];
    const activeNoteId = notes.some((note) => note.id === saved.activeNoteId)
      ? saved.activeNoteId
      : notes[0].id;

    return { notes, activeNoteId, filter: '' };
  } catch {
    const note = createNote('Workspace note');
    return { notes: [note], activeNoteId: note.id, filter: '' };
  }
}

function persistWorkspace(state) {
  localStorage.setItem(NOTEPAD_STORAGE_KEY, JSON.stringify({
    notes: state.notes,
    activeNoteId: state.activeNoteId,
  }));
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function createNotepadToolModal() {
  const state = loadWorkspace();

  function getActiveNote() {
    return state.notes.find((note) => note.id === state.activeNoteId) || state.notes[0];
  }

  function updateStats(root, note) {
    const statsEl = root.querySelector('#tool-notepad-stats');
    if (!statsEl || !note) return;

    const words = note.body.trim() ? note.body.trim().split(/\s+/).length : 0;
    const chars = note.body.length;
    statsEl.textContent = `${words} words  |  ${chars} chars  |  Updated ${formatTimestamp(note.updatedAt)}`;
  }

  function sync(root) {
    const activeNote = getActiveNote();
    const listEl = root.querySelector('#tool-notepad-list');
    const titleEl = root.querySelector('#tool-notepad-title');
    const bodyEl = root.querySelector('#tool-notepad-input');
    const filter = state.filter.trim().toLowerCase();
    const visibleNotes = state.notes.filter((note) => {
      if (!filter) return true;
      return `${note.title} ${note.body}`.toLowerCase().includes(filter);
    });

    if (listEl) {
      listEl.innerHTML = visibleNotes
        .map((note) => `
          <button type="button" class="tool-notepad__note-item${note.id === activeNote?.id ? ' is-active' : ''}" data-note-id="${note.id}">
            <span class="tool-notepad__note-title">${note.title || 'Untitled note'}</span>
            <span class="tool-notepad__note-meta">${formatTimestamp(note.updatedAt)}</span>
          </button>
        `)
        .join('') || '<div class="tool-notepad__empty">No notes match the current filter.</div>';
    }

    if (titleEl && activeNote) {
      titleEl.value = activeNote.title;
    }

    if (bodyEl && activeNote) {
      bodyEl.value = activeNote.body;
    }

    updateStats(root, activeNote);
    persistWorkspace(state);
  }

  function setActiveNote(noteId, root) {
    if (!state.notes.some((note) => note.id === noteId)) return;
    state.activeNoteId = noteId;
    sync(root);
  }

  function saveActiveNote(root, changes) {
    const activeNote = getActiveNote();
    if (!activeNote) return;

    Object.assign(activeNote, changes, { updatedAt: new Date().toISOString() });
    sync(root);
  }

  function exportActiveNote() {
    const activeNote = getActiveNote();
    if (!activeNote) return;

    const blob = new Blob([activeNote.body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(activeNote.title || 'note').replace(/[^a-z0-9-_]+/gi, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return {
    id: 'notepad',
    title: 'Notepad',
    subtitle: 'Multi-note writing workspace',
    description: 'Autosaved note library with search, rename, duplicate, and export.',
    badge: 'Notes',
    render() {
      return `
        <div class="tool-utility-card hidden tool-utility-card--wide" data-tool-modal="notepad" role="dialog" aria-modal="true" aria-labelledby="tool-notepad-title-main">
          <div class="tool-utility-card__header">
            <div>
              <p class="tool-utility-card__eyebrow">Notepad</p>
              <h2 id="tool-notepad-title-main" class="tool-utility-card__title">Note Workspace</h2>
            </div>
            <button type="button" class="tool-utility-card__close" data-close-utility aria-label="Close dialog">x</button>
          </div>
          <div class="tool-utility-card__body">
            <div class="tool-notepad">
              <aside class="tool-notepad__sidebar">
                <div class="tool-notepad__toolbar">
                  <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-note-action="new">New note</button>
                  <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-note-action="duplicate">Duplicate</button>
                </div>
                <input id="tool-notepad-filter" class="tool-notepad__filter" type="text" placeholder="Search notes..." />
                <div id="tool-notepad-list" class="tool-notepad__note-list"></div>
              </aside>
              <section class="tool-notepad__editor">
                <div class="tool-notepad__editor-toolbar">
                  <input id="tool-notepad-title" class="tool-notepad__title-input" type="text" placeholder="Note title" />
                  <div class="tool-notepad__editor-actions">
                    <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-note-action="export">Export</button>
                    <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-note-action="delete">Delete</button>
                  </div>
                </div>
                <div id="tool-notepad-stats" class="tool-notepad__status"></div>
                <textarea id="tool-notepad-input" class="tool-notepad__input tool-notepad__input--workspace" placeholder="Write anything here..."></textarea>
              </section>
            </div>
          </div>
        </div>
      `;
    },
    init(root) {
      const filterEl = root.querySelector('#tool-notepad-filter');
      const titleEl = root.querySelector('#tool-notepad-title');
      const bodyEl = root.querySelector('#tool-notepad-input');

      root.addEventListener('click', (event) => {
        const noteItem = event.target.closest('[data-note-id]');
        if (noteItem) {
          setActiveNote(noteItem.dataset.noteId, root);
          return;
        }

        const actionButton = event.target.closest('[data-note-action]');
        if (!actionButton) return;

        switch (actionButton.dataset.noteAction) {
          case 'new': {
            const note = createNote(`Note ${state.notes.length + 1}`);
            state.notes.unshift(note);
            state.activeNoteId = note.id;
            sync(root);
            break;
          }
          case 'duplicate': {
            const active = getActiveNote();
            if (!active) return;
            const duplicate = createNote(`${active.title} copy`);
            duplicate.body = active.body;
            state.notes.unshift(duplicate);
            state.activeNoteId = duplicate.id;
            sync(root);
            break;
          }
          case 'delete': {
            if (state.notes.length === 1) {
              state.notes = [createNote('Workspace note')];
              state.activeNoteId = state.notes[0].id;
            } else {
              state.notes = state.notes.filter((note) => note.id !== state.activeNoteId);
              state.activeNoteId = state.notes[0].id;
            }
            sync(root);
            break;
          }
          case 'export':
            exportActiveNote();
            break;
          default:
            break;
        }
      });

      filterEl?.addEventListener('input', () => {
        state.filter = filterEl.value;
        sync(root);
      });

      titleEl?.addEventListener('input', () => {
        saveActiveNote(root, { title: titleEl.value || 'Untitled note' });
      });

      bodyEl?.addEventListener('input', () => {
        saveActiveNote(root, { body: bodyEl.value });
      });

      sync(root);
    },
    onOpen(root) {
      sync(root);
      root.querySelector('#tool-notepad-input')?.focus();
    },
  };
}
