const CALCULATOR_STORAGE_KEY = 'global-tool-calculator-state';

function evaluateExpression(expression) {
  const sanitized = expression.replace(/\s+/g, '');
  const allowedPattern = /^[0-9+\-*/().%]+$/;

  if (!sanitized) {
    return '0';
  }

  if (!allowedPattern.test(sanitized)) {
    throw new Error('Only numbers and basic operators are allowed.');
  }

  let index = 0;

  function peek() {
    return sanitized[index];
  }

  function consume() {
    return sanitized[index++];
  }

  function parseNumber() {
    const start = index;

    while (/[0-9.]/.test(peek())) {
      consume();
    }

    const raw = sanitized.slice(start, index);
    const value = Number(raw);

    if (!raw || Number.isNaN(value)) {
      throw new Error('Invalid number in expression.');
    }

    return value;
  }

  function parsePrimary() {
    if (peek() === '(') {
      consume();
      const value = parseExpression();

      if (peek() !== ')') {
        throw new Error('Missing closing parenthesis.');
      }

      consume();
      return value;
    }

    if (peek() === '+') {
      consume();
      return parsePrimary();
    }

    if (peek() === '-') {
      consume();
      return -parsePrimary();
    }

    return parseNumber();
  }

  function parsePostfix() {
    let value = parsePrimary();

    while (peek() === '%') {
      consume();
      value /= 100;
    }

    return value;
  }

  function parseTerm() {
    let value = parsePostfix();

    while (peek() === '*' || peek() === '/') {
      const operator = consume();
      const right = parsePostfix();

      if (operator === '*') {
        value *= right;
      } else {
        if (right === 0) {
          throw new Error('Cannot divide by zero.');
        }

        value /= right;
      }
    }

    return value;
  }

  function parseExpression() {
    let value = parseTerm();

    while (peek() === '+' || peek() === '-') {
      const operator = consume();
      const right = parseTerm();

      if (operator === '+') {
        value += right;
      } else {
        value -= right;
      }
    }

    return value;
  }

  const result = parseExpression();

  if (index !== sanitized.length) {
    throw new Error('Invalid expression.');
  }

  if (!Number.isFinite(result)) {
    throw new Error('The expression could not be calculated.');
  }

  return String(Number(result.toFixed(10)));
}

function loadCalculatorState() {
  try {
    const saved = JSON.parse(localStorage.getItem(CALCULATOR_STORAGE_KEY) || '{}');
    return {
      memory: typeof saved.memory === 'number' ? saved.memory : 0,
      history: Array.isArray(saved.history) ? saved.history.slice(0, 12) : [],
      expression: typeof saved.expression === 'string' ? saved.expression : '',
      result: typeof saved.result === 'string' ? saved.result : '0',
    };
  } catch {
    return {
      memory: 0,
      history: [],
      expression: '',
      result: '0',
    };
  }
}

function saveCalculatorState(state) {
  localStorage.setItem(CALCULATOR_STORAGE_KEY, JSON.stringify({
    memory: state.memory,
    history: state.history.slice(0, 12),
    expression: state.expression,
    result: state.result,
  }));
}

export function createCalculatorToolModal() {
  const state = loadCalculatorState();

  function sync(root) {
    const inputEl = root.querySelector('#tool-calculator-input');
    const resultEl = root.querySelector('#tool-calculator-result');
    const memoryEl = root.querySelector('#tool-calculator-memory');
    const historyEl = root.querySelector('#tool-calculator-history');

    if (inputEl) {
      inputEl.value = state.expression;
    }

    if (resultEl) {
      resultEl.textContent = state.result;
    }

    if (memoryEl) {
      memoryEl.textContent = state.memory ? `Memory ${state.memory}` : 'Memory empty';
    }

    if (historyEl) {
      if (!state.history.length) {
        historyEl.innerHTML = '<div class="text-xs text-gray-400 text-center py-4">No calculations yet.</div>';
      } else {
        historyEl.innerHTML = state.history
          .map((item, index) => `
            <button type="button" class="w-full text-left px-2 py-2 rounded bg-gray-700 hover:bg-gray-600 text-xs transition" data-history-index="${index}">
              <div class="text-gray-300 truncate">${item.expression}</div>
              <div class="text-orange-400 font-semibold">${item.result}</div>
            </button>
          `)
          .join('');
      }
    }

    saveCalculatorState(state);
  }

  function setExpression(root, value) {
    state.expression = value;
    state.result = value || '0';
    sync(root);
  }

  function appendValue(root, value) {
    state.expression += value;
    state.result = state.expression || '0';
    sync(root);
  }

  function runEvaluation(root) {
    try {
      const result = evaluateExpression(state.expression);
      const expression = state.expression || '0';
      state.result = result;
      state.expression = result;
      state.history = [{ expression, result }, ...state.history].slice(0, 12);
      sync(root);
    } catch (error) {
      state.result = error.message || 'Error';
      sync(root);
    }
  }

  async function copyResult() {
    if (!navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(state.result);
  }

  return {
    id: 'calculator',
    title: 'Calculator',
    subtitle: 'Workspace-grade math utility',
    description: 'Expression input, memory controls, clipboard copy, and persistent history.',
    badge: 'Math',
    render() {
      return `
        <div class="hidden fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" data-tool-modal="calculator" role="dialog" aria-modal="true" aria-labelledby="tool-calculator-title">
          <div class="absolute inset-0" data-dismiss-modal></div>
          <div class="relative bg-gray-900 border border-gray-700 rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
            <div class="border-b border-gray-700 p-6 flex justify-between items-start bg-gray-800/50">
              <div>
                <p class="text-xs font-black text-indigo-400 uppercase tracking-widest">Calculator</p>
                <h2 id="tool-calculator-title" class="text-2xl font-black text-white mt-1 tracking-tighter italic">Calculation Workspace</h2>
              </div>
              <button type="button" class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 text-gray-400 hover:text-white transition" data-close-utility aria-label="Close dialog">✕</button>
            </div>
            <div class="flex-1 overflow-auto p-8">
              <div class="flex flex-col lg:flex-row gap-8 h-full">
                <div class="flex-1 space-y-6">
                  <div class="bg-black rounded-3xl p-8 space-y-4 shadow-inner border border-white/5">
                    <div class="flex justify-between items-center px-1">
                      <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Expression</div>
                      <div id="tool-calculator-memory" class="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Memory empty</div>
                    </div>
                    <input id="tool-calculator-input" class="w-full bg-transparent text-gray-400 text-2xl font-bold px-1 outline-none placeholder:text-gray-800" type="text" autocomplete="off" placeholder="(2400*18)/12" />
                    <div id="tool-calculator-result" class="text-6xl font-black text-white text-right py-4 font-mono tracking-tighter italic">0</div>
                    <div class="flex gap-3">
                      <button type="button" class="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] font-black uppercase tracking-widest py-3 rounded-xl transition" data-calc-action="copy-result">Copy result</button>
                      <button type="button" class="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] font-black uppercase tracking-widest py-3 rounded-xl transition" data-calc-action="clear-history">Clear history</button>
                    </div>
                  </div>
                  
                  <div class="grid grid-cols-5 gap-3 bg-gray-800/30 p-4 rounded-3xl border border-gray-800">
                    <button type="button" class="bg-gray-800 hover:bg-gray-700 text-indigo-400 py-3 rounded-xl text-xs font-black transition uppercase tracking-widest" data-calc-action="memory-clear">MC</button>
                    <button type="button" class="bg-gray-800 hover:bg-gray-700 text-indigo-400 py-3 rounded-xl text-xs font-black transition uppercase tracking-widest" data-calc-action="memory-recall">MR</button>
                    <button type="button" class="bg-gray-800 hover:bg-gray-700 text-indigo-400 py-3 rounded-xl text-xs font-black transition uppercase tracking-widest" data-calc-action="memory-add">M+</button>
                    <button type="button" class="bg-gray-800 hover:bg-gray-700 text-indigo-400 py-3 rounded-xl text-xs font-black transition uppercase tracking-widest" data-calc-action="memory-subtract">M-</button>
                    <button type="button" class="bg-gray-800 hover:bg-gray-700 text-indigo-400 py-3 rounded-xl text-xs font-black transition uppercase tracking-widest" data-calc-action="toggle-sign">+/-</button>
                  </div>
                  
                  <div class="grid grid-cols-4 gap-4 bg-gray-800/30 p-4 rounded-3xl border border-gray-800">
                    <button type="button" class="bg-gray-800 hover:bg-gray-700 text-white py-5 rounded-2xl font-black text-lg transition shadow-sm border border-gray-700/50" data-calc-action="clear">AC</button>
                    <button type="button" class="bg-gray-800 hover:bg-gray-700 text-white py-5 rounded-2xl font-black text-lg transition shadow-sm border border-gray-700/50" data-calc-action="backspace">BS</button>
                    <button type="button" class="bg-gray-800 hover:bg-gray-700 text-white py-5 rounded-2xl font-black text-lg transition shadow-sm border border-gray-700/50" data-calc-value="(">(</button>
                    <button type="button" class="bg-gray-800 hover:bg-gray-700 text-white py-5 rounded-2xl font-black text-lg transition shadow-sm border border-gray-700/50" data-calc-value=")">)</button>
                    
                    <button type="button" class="bg-gray-700 hover:bg-gray-600 text-white py-5 rounded-2xl font-black text-xl transition" data-calc-value="7">7</button>
                    <button type="button" class="bg-gray-700 hover:bg-gray-600 text-white py-5 rounded-2xl font-black text-xl transition" data-calc-value="8">8</button>
                    <button type="button" class="bg-gray-700 hover:bg-gray-600 text-white py-5 rounded-2xl font-black text-xl transition" data-calc-value="9">9</button>
                    <button type="button" class="bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-2xl font-black text-xl transition shadow-lg shadow-indigo-900/20" data-calc-value="/">/</button>
                    
                    <button type="button" class="bg-gray-700 hover:bg-gray-600 text-white py-5 rounded-2xl font-black text-xl transition" data-calc-value="4">4</button>
                    <button type="button" class="bg-gray-700 hover:bg-gray-600 text-white py-5 rounded-2xl font-black text-xl transition" data-calc-value="5">5</button>
                    <button type="button" class="bg-gray-700 hover:bg-gray-600 text-white py-5 rounded-2xl font-black text-xl transition" data-calc-value="6">6</button>
                    <button type="button" class="bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-2xl font-black text-xl transition shadow-lg shadow-indigo-900/20" data-calc-value="*">*</button>
                    
                    <button type="button" class="bg-gray-700 hover:bg-gray-600 text-white py-5 rounded-2xl font-black text-xl transition" data-calc-value="1">1</button>
                    <button type="button" class="bg-gray-700 hover:bg-gray-600 text-white py-5 rounded-2xl font-black text-xl transition" data-calc-value="2">2</button>
                    <button type="button" class="bg-gray-700 hover:bg-gray-600 text-white py-5 rounded-2xl font-black text-xl transition" data-calc-value="3">3</button>
                    <button type="button" class="bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-2xl font-black text-xl transition shadow-lg shadow-indigo-900/20" data-calc-value="-">-</button>
                    
                    <button type="button" class="bg-gray-700 hover:bg-gray-600 text-white py-5 rounded-2xl font-black text-xl transition col-span-2" data-calc-value="0">0</button>
                    <button type="button" class="bg-gray-700 hover:bg-gray-600 text-white py-5 rounded-2xl font-black text-xl transition" data-calc-value=".">.</button>
                    <button type="button" class="bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-2xl font-black text-xl transition shadow-lg shadow-indigo-900/20" data-calc-value="+">+</button>
                    
                    <button type="button" class="bg-gray-800 hover:bg-gray-700 text-gray-400 py-5 rounded-2xl font-black text-xl transition col-span-2 uppercase tracking-widest text-sm" data-calc-value="%">%</button>
                    <button type="button" class="bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl font-black text-xl transition col-span-2 shadow-lg shadow-emerald-900/20" data-calc-action="equals">=</button>
                  </div>
                </div>
                
                <div class="w-full lg:w-64 bg-gray-800/50 rounded-3xl p-6 flex flex-col border border-gray-800">
                  <div class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Account History</div>
                  <div id="tool-calculator-history" class="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-gray-700"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    },
    init(root) {
      const inputEl = root.querySelector('#tool-calculator-input');

      if (!inputEl) return;

      root.addEventListener('click', async (event) => {
        const target = event.target.closest('[data-calc-value], [data-calc-action], [data-history-index]');
        if (!target) return;

        if (target.dataset.historyIndex) {
          const item = state.history[Number(target.dataset.historyIndex)];
          if (!item) return;
          state.expression = item.expression;
          state.result = item.result;
          sync(root);
          return;
        }

        if (target.dataset.calcValue) {
          appendValue(root, target.dataset.calcValue);
          return;
        }

        switch (target.dataset.calcAction) {
          case 'clear':
            setExpression(root, '');
            break;
          case 'backspace':
            setExpression(root, state.expression.slice(0, -1));
            break;
          case 'equals':
            runEvaluation(root);
            break;
          case 'memory-clear':
            state.memory = 0;
            sync(root);
            break;
          case 'memory-recall':
            appendValue(root, String(state.memory || 0));
            break;
          case 'memory-add':
            state.memory += Number(evaluateExpression(state.expression || state.result || '0'));
            sync(root);
            break;
          case 'memory-subtract':
            state.memory -= Number(evaluateExpression(state.expression || state.result || '0'));
            sync(root);
            break;
          case 'toggle-sign':
            if (!state.expression) {
              setExpression(root, '-');
            } else if (state.expression.startsWith('-')) {
              setExpression(root, state.expression.slice(1));
            } else {
              setExpression(root, `-${state.expression}`);
            }
            break;
          case 'clear-history':
            state.history = [];
            sync(root);
            break;
          case 'copy-result':
            await copyResult();
            break;
          default:
            break;
        }
      });

      inputEl.addEventListener('input', () => {
        state.expression = inputEl.value;
        state.result = inputEl.value || '0';
        sync(root);
      });

      inputEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          runEvaluation(root);
        }
      });

      sync(root);
    },
    onOpen(root) {
      sync(root);
      root.querySelector('#tool-calculator-input')?.focus();
    },
  };
}
