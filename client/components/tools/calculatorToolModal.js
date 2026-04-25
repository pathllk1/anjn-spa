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
        historyEl.innerHTML = '<div class="tool-calculator__history-empty">No calculations yet.</div>';
      } else {
        historyEl.innerHTML = state.history
          .map((item, index) => `
            <button type="button" class="tool-calculator__history-item" data-history-index="${index}">
              <span class="tool-calculator__history-expression">${item.expression}</span>
              <span class="tool-calculator__history-result">${item.result}</span>
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
        <div class="tool-utility-card hidden tool-utility-card--wide" data-tool-modal="calculator" role="dialog" aria-modal="true" aria-labelledby="tool-calculator-title">
          <div class="tool-utility-card__header">
            <div>
              <p class="tool-utility-card__eyebrow">Calculator</p>
              <h2 id="tool-calculator-title" class="tool-utility-card__title">Calculation Workspace</h2>
            </div>
            <button type="button" class="tool-utility-card__close" data-close-utility aria-label="Close dialog">x</button>
          </div>
          <div class="tool-utility-card__body">
            <div class="tool-calculator">
              <div class="tool-calculator__main">
                <div class="tool-calculator__screen">
                  <div class="tool-calculator__screen-top">
                    <div class="tool-calculator__label">EXPRESSION</div>
                    <div id="tool-calculator-memory" class="tool-calculator__memory">Memory empty</div>
                  </div>
                  <input id="tool-calculator-input" class="tool-calculator__input" type="text" autocomplete="off" placeholder="(2400*18)/12" />
                  <div id="tool-calculator-result" class="tool-calculator__result">0</div>
                  <div class="tool-calculator__actions">
                    <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-calc-action="copy-result">Copy result</button>
                    <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-calc-action="clear-history">Clear history</button>
                  </div>
                </div>
                <div class="tool-calculator__memory-actions">
                  <button type="button" class="tool-calculator__mini-key" data-calc-action="memory-clear">MC</button>
                  <button type="button" class="tool-calculator__mini-key" data-calc-action="memory-recall">MR</button>
                  <button type="button" class="tool-calculator__mini-key" data-calc-action="memory-add">M+</button>
                  <button type="button" class="tool-calculator__mini-key" data-calc-action="memory-subtract">M-</button>
                  <button type="button" class="tool-calculator__mini-key" data-calc-action="toggle-sign">+/-</button>
                </div>
                <div class="tool-calculator__keys">
                  <button type="button" class="tool-calculator__key tool-calculator__key--muted" data-calc-action="clear">AC</button>
                  <button type="button" class="tool-calculator__key tool-calculator__key--muted" data-calc-action="backspace">BS</button>
                  <button type="button" class="tool-calculator__key tool-calculator__key--muted" data-calc-value="(">(</button>
                  <button type="button" class="tool-calculator__key tool-calculator__key--muted" data-calc-value=")">)</button>
                  
                  <button type="button" class="tool-calculator__key" data-calc-value="7">7</button>
                  <button type="button" class="tool-calculator__key" data-calc-value="8">8</button>
                  <button type="button" class="tool-calculator__key" data-calc-value="9">9</button>
                  <button type="button" class="tool-calculator__key tool-calculator__key--accent" data-calc-value="/">/</button>
                  
                  <button type="button" class="tool-calculator__key" data-calc-value="4">4</button>
                  <button type="button" class="tool-calculator__key" data-calc-value="5">5</button>
                  <button type="button" class="tool-calculator__key" data-calc-value="6">6</button>
                  <button type="button" class="tool-calculator__key tool-calculator__key--accent" data-calc-value="*">*</button>
                  
                  <button type="button" class="tool-calculator__key" data-calc-value="1">1</button>
                  <button type="button" class="tool-calculator__key" data-calc-value="2">2</button>
                  <button type="button" class="tool-calculator__key" data-calc-value="3">3</button>
                  <button type="button" class="tool-calculator__key tool-calculator__key--accent" data-calc-value="-">-</button>
                  
                  <button type="button" class="tool-calculator__key tool-calculator__key--wide" data-calc-value="0">0</button>
                  <button type="button" class="tool-calculator__key" data-calc-value=".">.</button>
                  <button type="button" class="tool-calculator__key tool-calculator__key--accent" data-calc-value="+">+</button>
                  
                  <button type="button" class="tool-calculator__key tool-calculator__key--muted tool-calculator__key--wide" data-calc-value="%">%</button>
                  <button type="button" class="tool-calculator__key tool-calculator__key--accent tool-calculator__key--wide" data-calc-action="equals">=</button>
                </div>
              </div>
              <div class="tool-calculator__sidebar">
                <div class="tool-calculator__history-header">
                  <span>Recent history</span>
                </div>
                <div id="tool-calculator-history" class="tool-calculator__history"></div>
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
