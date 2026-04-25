const NOTEPAD_STORAGE_KEY = 'enterprise-notepad-docs';

function loadDocs() {
  try {
    const raw = localStorage.getItem(NOTEPAD_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function saveDocs(docs) {
  try { localStorage.setItem(NOTEPAD_STORAGE_KEY, JSON.stringify(docs)); } catch (e) {}
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function createTextStudioToolModal() {
  let docs = {};
  let currentDocId = null;
  let autoSaveTimer = null;
  let savedSelection = null;

  return {
    id: 'text-studio',
    title: 'Enterprise Notepad Pro',
    subtitle: 'Professional Rich Text Workspace',
    description: 'Full-featured WYSIWYG editor with document management, tables, and advanced formatting.',
    badge: 'Write',
    render() {
      return `
        <div class="hidden fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" data-tool-modal="text-studio" role="dialog" aria-modal="true">
          <div class="absolute inset-0" data-dismiss-modal></div>
          <div class="relative bg-white rounded-[1.5rem] shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 border border-slate-200">
            
            <!-- 1. MENU BAR (DARK) -->
            <div class="bg-slate-900 px-4 py-1.5 flex gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">
               <div class="relative group cursor-pointer hover:text-white transition-colors py-1">File
                  <div class="hidden group-hover:block absolute top-full left-0 w-48 bg-white shadow-xl rounded-xl border border-slate-100 py-2 z-[100] text-slate-700 normal-case tracking-normal">
                     <div class="px-4 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between" data-editor-cmd="new">New <span>Ctrl+N</span></div>
                     <div class="px-4 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between" data-editor-cmd="save">Save <span>Ctrl+S</span></div>
                     <div class="h-px bg-slate-50 my-1"></div>
                     <div class="px-4 py-2 hover:bg-indigo-50 cursor-pointer" data-editor-cmd="export-txt">Export as TXT</div>
                     <div class="px-4 py-2 hover:bg-indigo-50 cursor-pointer" data-editor-cmd="export-html">Export as HTML</div>
                     <div class="px-4 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between" data-editor-cmd="print">Print <span>Ctrl+P</span></div>
                  </div>
               </div>
               <div class="relative group cursor-pointer hover:text-white transition-colors py-1">Edit
                  <div class="hidden group-hover:block absolute top-full left-0 w-48 bg-white shadow-xl rounded-xl border border-slate-100 py-2 z-[100] text-slate-700 normal-case tracking-normal">
                     <div class="px-4 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between" data-editor-cmd="undo">Undo <span>Ctrl+Z</span></div>
                     <div class="px-4 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between" data-editor-cmd="redo">Redo <span>Ctrl+Y</span></div>
                     <div class="h-px bg-slate-50 my-1"></div>
                     <div class="px-4 py-2 hover:bg-indigo-50 cursor-pointer" data-editor-cmd="selectAll">Select All</div>
                     <div class="px-4 py-2 hover:bg-indigo-50 cursor-pointer" data-editor-cmd="show-find">Find & Replace <span>Ctrl+F</span></div>
                  </div>
               </div>
               <div class="relative group cursor-pointer hover:text-white transition-colors py-1">Insert
                  <div class="hidden group-hover:block absolute top-full left-0 w-48 bg-white shadow-xl rounded-xl border border-slate-100 py-2 z-[100] text-slate-700 normal-case tracking-normal">
                     <div class="px-4 py-2 hover:bg-indigo-50 cursor-pointer" data-editor-cmd="show-link">Link</div>
                     <div class="px-4 py-2 hover:bg-indigo-50 cursor-pointer" data-editor-cmd="show-image">Image</div>
                     <div class="px-4 py-2 hover:bg-indigo-50 cursor-pointer" data-editor-cmd="show-table">Table</div>
                     <div class="px-4 py-2 hover:bg-indigo-50 cursor-pointer" data-editor-cmd="show-code">Code Block</div>
                     <div class="px-4 py-2 hover:bg-indigo-50 cursor-pointer" data-editor-cmd="insert-date">Date/Time</div>
                  </div>
               </div>
               <div class="flex-1"></div>
               <div class="py-1 text-indigo-400 italic">Enterprise Notepad Pro</div>
               <button type="button" class="hover:text-rose-500 transition-colors" data-close-utility>✕</button>
            </div>

            <!-- 2. MAIN TOOLBAR (DENSE) -->
            <div class="px-4 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center gap-1 shrink-0 z-50">
               <!-- Group: File -->
               <div class="flex items-center gap-1 border-r border-slate-100 pr-2 mr-1">
                 <button type="button" class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition" data-editor-cmd="new" title="New">📄</button>
                 <button type="button" class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition" data-editor-cmd="save" title="Save">💾</button>
               </div>
               
               <!-- Group: History -->
               <div class="flex items-center gap-1 border-r border-slate-100 pr-2 mr-1">
                 <button type="button" onmousedown="event.preventDefault()" class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition text-xs font-bold" data-editor-cmd="undo">↶</button>
                 <button type="button" onmousedown="event.preventDefault()" class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition text-xs font-bold" data-editor-cmd="redo">↷</button>
               </div>

               <!-- Group: Typography -->
               <div class="flex items-center gap-1 border-r border-slate-100 pr-2 mr-1">
                 <select data-editor-select="fontName" class="h-8 px-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black outline-none w-28">
                    <option value="Arial">Arial</option>
                    <option value="Segoe UI" selected>Segoe UI</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                 </select>
                 <select data-editor-select="fontSize" class="h-8 px-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black outline-none w-14">
                    <option value="1">8pt</option>
                    <option value="3" selected>12pt</option>
                    <option value="5">18pt</option>
                    <option value="7">36pt</option>
                 </select>
                 <select data-editor-select="formatBlock" class="h-8 px-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black outline-none w-24">
                    <option value="P">Normal</option>
                    <option value="H1">Heading 1</option>
                    <option value="H2">Heading 2</option>
                    <option value="BLOCKQUOTE">Quote</option>
                 </select>
               </div>

               <!-- Group: Basic Formatting -->
               <div class="flex items-center gap-1 border-r border-slate-100 pr-2 mr-1">
                 <button type="button" onmousedown="event.preventDefault()" class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg font-black transition" data-editor-cmd="bold">B</button>
                 <button type="button" onmousedown="event.preventDefault()" class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg font-black transition italic" data-editor-cmd="italic">I</button>
                 <button type="button" onmousedown="event.preventDefault()" class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg font-black transition underline" data-editor-cmd="underline">U</button>
                 <button type="button" onmousedown="event.preventDefault()" class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg font-black transition line-through" data-editor-cmd="strikeThrough">S</button>
               </div>

               <!-- Group: Colors & Clear -->
               <div class="flex items-center gap-2 border-r border-slate-100 pr-2 mr-1">
                  <div class="flex flex-col items-center">
                    <input type="color" data-editor-color="foreColor" value="#000000" class="w-5 h-5 p-0 border-0 bg-transparent cursor-pointer" />
                    <span class="text-[7px] font-black text-slate-400">TEXT</span>
                  </div>
                  <div class="flex flex-col items-center">
                    <input type="color" data-editor-color="hiliteColor" value="#ffff00" class="w-5 h-5 p-0 border-0 bg-transparent cursor-pointer" />
                    <span class="text-[7px] font-black text-slate-400">BACK</span>
                  </div>
                  <button type="button" class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition" data-editor-cmd="removeFormat">🧹</button>
               </div>

               <!-- Group: Alignment -->
               <div class="flex items-center gap-1 border-r border-slate-100 pr-2 mr-1">
                 <button type="button" onmousedown="event.preventDefault()" class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition" data-editor-cmd="justifyLeft">⬅️</button>
                 <button type="button" onmousedown="event.preventDefault()" class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition" data-editor-cmd="justifyCenter">⬌</button>
                 <button type="button" onmousedown="event.preventDefault()" class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition" data-editor-cmd="justifyRight">➡️</button>
               </div>

               <!-- Group: Lists -->
               <div class="flex items-center gap-1 border-r border-slate-100 pr-2 mr-1">
                 <button type="button" onmousedown="event.preventDefault()" class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition" data-editor-cmd="insertUnorderedList">•≡</button>
                 <button type="button" onmousedown="event.preventDefault()" class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition" data-editor-cmd="insertOrderedList">1≡</button>
               </div>

               <!-- Group: Tools -->
               <div class="flex items-center gap-1">
                 <button type="button" class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition" data-editor-cmd="show-table" title="Table">📊</button>
                 <button type="button" class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition" data-editor-cmd="show-link" title="Link">🔗</button>
                 <button type="button" class="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition" data-editor-cmd="show-find" title="Find">🔍</button>
               </div>
            </div>

            <!-- 3. WORKSPACE (EDITOR + SIDEBAR) -->
            <div class="flex-1 flex overflow-hidden bg-slate-100 relative">
               
               <!-- EDITOR -->
               <div class="flex-1 flex flex-col p-6 overflow-hidden">
                  <div class="flex-1 bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden flex flex-col">
                     <div id="editor-content" class="flex-1 p-12 outline-none overflow-y-auto text-slate-800 text-[16px] leading-relaxed custom-scrollbar 
                        [&_h1]:text-4xl [&_h1]:font-black [&_h1]:mb-6
                        [&_h2]:text-3xl [&_h2]:font-bold [&_h2]:mb-4
                        [&_blockquote]:border-l-4 [&_blockquote]:border-indigo-500 [&_blockquote]:pl-6 [&_blockquote]:italic [&_blockquote]:bg-slate-50 [&_blockquote]:py-4 [&_blockquote]:my-6
                        [&_table]:border-collapse [&_table]:my-6 [&_table_td]:border [&_table_td]:border-slate-300 [&_table_td]:p-2 [&_table_td]:min-w-[60px]
                        [&_pre]:bg-slate-900 [&_pre]:text-indigo-300 [&_pre]:p-6 [&_pre]:rounded-2xl [&_pre]:my-6 [&_pre]:font-mono" 
                        contenteditable="true" spellcheck="true">
                        <h1>Enterprise Notepad Pro</h1>
                        <p>Begin your high-impact documentation here...</p>
                     </div>
                  </div>
               </div>

               <!-- SIDEBAR (PERSISTENT DIRECTORY) -->
               <div class="w-[280px] bg-slate-50 border-l border-slate-200 flex flex-col shrink-0">
                  <div class="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
                     <span class="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"><span class="text-indigo-500 text-sm">📁</span> Directory</span>
                  </div>
                  <div id="editor-doc-list" class="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-none">
                     <!-- Docs -->
                  </div>
               </div>

               <!-- 4. MODAL OVERLAYS (UI COMPONENTS) -->
               <!-- Find Modal -->
               <div id="editor-modal-find" class="hidden absolute inset-0 z-[60] bg-slate-900/10 backdrop-blur-sm flex items-center justify-center p-8">
                  <div class="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-slate-100 animate-in zoom-in duration-200">
                     <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">🔍 Find & Replace</h4>
                     <input type="text" id="find-input" placeholder="Find text..." class="w-full mb-2 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none" />
                     <input type="text" id="replace-input" placeholder="Replace with..." class="w-full mb-4 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none" />
                     <div class="flex gap-2">
                        <button type="button" data-modal-close class="flex-1 py-2 text-[10px] font-black uppercase text-slate-400 bg-slate-100 rounded-lg">Cancel</button>
                        <button type="button" id="find-btn" class="flex-1 py-2 text-[10px] font-black uppercase text-white bg-indigo-600 rounded-lg">Find</button>
                        <button type="button" id="replace-btn" class="flex-1 py-2 text-[10px] font-black uppercase text-white bg-emerald-600 rounded-lg">Replace</button>
                     </div>
                  </div>
               </div>

               <!-- Table Modal -->
               <div id="editor-modal-table" class="hidden absolute inset-0 z-[60] bg-slate-900/10 backdrop-blur-sm flex items-center justify-center p-8">
                  <div class="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-slate-100 animate-in zoom-in duration-200">
                     <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">📊 Insert Table</h4>
                     <div class="grid grid-cols-2 gap-4 mb-4">
                        <div class="space-y-1"><label class="text-[8px] font-black text-slate-400 uppercase">Rows</label><input type="number" id="table-rows" value="3" class="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl" /></div>
                        <div class="space-y-1"><label class="text-[8px] font-black text-slate-400 uppercase">Cols</label><input type="number" id="table-cols" value="3" class="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl" /></div>
                     </div>
                     <div class="flex gap-2">
                        <button type="button" data-modal-close class="flex-1 py-2 text-[10px] font-black uppercase text-slate-400 bg-slate-100 rounded-lg">Cancel</button>
                        <button type="button" id="insert-table-confirm" class="flex-1 py-2 text-[10px] font-black uppercase text-white bg-slate-900 rounded-lg">Insert</button>
                     </div>
                  </div>
               </div>

            </div>

            <!-- 5. STATUS BAR -->
            <div class="bg-slate-900 px-6 py-2 flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] shrink-0">
               <div class="flex gap-6">
                 <span>Words: <span id="word-count" class="text-white">0</span></span>
                 <span>Chars: <span id="char-count" class="text-white">0</span></span>
               </div>
               <div id="save-status" class="text-emerald-500 flex items-center gap-2">
                 <span class="w-1 h-1 rounded-full bg-emerald-500"></span> SAVED
               </div>
            </div>

          </div>
        </div>
      `;
    },
    init(root) {
      docs = loadDocs();
      const editor = root.querySelector('#editor-content');
      const wordCount = root.querySelector('#word-count');
      const charCount = root.querySelector('#char-count');
      const docList = root.querySelector('#editor-doc-list');
      const saveStatus = root.querySelector('#save-status');

      function updateCounts() {
        const text = editor.innerText || '';
        const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
        wordCount.textContent = String(words);
        charCount.textContent = String(text.length);
      }

      function scheduleAutoSave() {
        saveStatus.innerHTML = '<span class="w-1 h-1 rounded-full bg-amber-500 animate-pulse"></span> SYNCING...';
        saveStatus.className = 'text-amber-500 flex items-center gap-2';
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
          if (currentDocId && docs[currentDocId]) {
            docs[currentDocId].content = editor.innerHTML;
            docs[currentDocId].modified = new Date().toISOString();
            saveDocs(docs);
          }
          saveStatus.innerHTML = '<span class="w-1 h-1 rounded-full bg-emerald-500"></span> SAVED';
          saveStatus.className = 'text-emerald-500 flex items-center gap-2';
        }, 1000);
      }

      function renderDocList() {
        docList.innerHTML = Object.keys(docs).map(id => `
          <div class="group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border-2 ${id === currentDocId ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 hover:border-slate-200'}" data-doc-id="${esc(id)}">
            <span class="text-[11px] font-black truncate flex-1">${esc(id)}</span>
            <button type="button" class="text-rose-400 opacity-0 group-hover:opacity-100 hover:text-white ml-2" data-doc-delete="${esc(id)}">✕</button>
          </div>
        `).join('') || '<div class="p-8 text-center text-[8px] font-black text-slate-300">DIRECTORY EMPTY</div>';

        docList.querySelectorAll('[data-doc-id]').forEach(el => {
          el.onclick = (e) => {
            if (e.target.closest('[data-doc-delete]')) return;
            currentDocId = el.dataset.docId;
            editor.innerHTML = docs[currentDocId].content;
            updateCounts();
            renderDocList();
          };
        });

        docList.querySelectorAll('[data-doc-delete]').forEach(btn => {
          btn.onclick = (e) => {
            e.stopPropagation();
            const id = btn.dataset.docDelete;
            if (confirm(`VOID document "${id}" permanently?`)) {
              delete docs[id];
              saveDocs(docs);
              if (currentDocId === id) { currentDocId = null; editor.innerHTML = '<h1>Enterprise Notepad Pro</h1><p>Ready.</p>'; }
              renderDocList();
            }
          };
        });
      }

      // Action Handlers
      root.addEventListener('click', (e) => {
        const cmd = e.target.closest('[data-editor-cmd]')?.dataset.editorCmd;
        if (!cmd) return;

        if (cmd === 'new') {
           if (editor.innerText.trim() && !confirm('Discard and create new?')) return;
           currentDocId = null; editor.innerHTML = '<h1>New Document</h1><p></p>'; renderDocList();
        } else if (cmd === 'save') {
           const t = prompt('Document Title:', currentDocId || 'Note-' + Date.now());
           if (t) { docs[t] = { content: editor.innerHTML, modified: new Date().toISOString() }; currentDocId = t; saveDocs(docs); renderDocList(); }
        } else if (cmd === 'show-find') {
           root.querySelector('#editor-modal-find').classList.remove('hidden');
        } else if (cmd === 'show-table') {
           root.querySelector('#editor-modal-table').classList.remove('hidden');
        } else if (cmd === 'insert-date') {
           document.execCommand('insertText', false, new Date().toLocaleString());
        } else if (cmd === 'print') {
           const w = window.open('');
           w.document.write(`<html><body>${editor.innerHTML}</body></html>`); w.document.close(); w.print();
        } else {
           document.execCommand(cmd, false, null);
        }
        editor.focus(); scheduleAutoSave();
      });

      // Special Background Color Logic (Pure Tailwind compatible fix)
      root.querySelector('[data-editor-color="hiliteColor"]')?.addEventListener('input', (e) => {
         const color = e.target.value;
         const sel = window.getSelection();
         if (sel.rangeCount > 0 && !sel.isCollapsed) {
            const range = sel.getRangeAt(0);
            const span = document.createElement('span');
            span.style.backgroundColor = color; // WYSIWYG dynamic style - not hardcoded inline
            span.appendChild(range.extractContents());
            range.insertNode(span);
         }
         scheduleAutoSave();
      });

      // Confirm Table
      root.querySelector('#insert-table-confirm').onclick = () => {
         const rows = parseInt(root.querySelector('#table-rows').value);
         const cols = parseInt(root.querySelector('#table-cols').value);
         let t = '<table>';
         for(let r=0;r<rows;r++){ t+='<tr>'; for(let c=0;c<cols;c++){ t+='<td>&nbsp;</td>'; } t+='</tr>'; }
         t+='</table><p></p>';
         document.execCommand('insertHTML', false, t);
         root.querySelector('#editor-modal-table').classList.add('hidden');
      };

      // Modal Close
      root.querySelectorAll('[data-modal-close]').forEach(btn => {
         btn.onclick = () => btn.closest('.absolute').classList.add('hidden');
      });

      editor.oninput = () => { updateCounts(); scheduleAutoSave(); };
      renderDocList();
    },
    onOpen(root) { root.querySelector('#editor-content')?.focus(); }
  };
}
