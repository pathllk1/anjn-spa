function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  const centiseconds = String(Math.floor((milliseconds % 1000) / 10)).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}.${centiseconds}`;
}

export function createStopwatchToolModal() {
  const state = {
    mode: 'stopwatch',
    running: false,
    startedAt: null,
    elapsed: 0,
    timerDuration: 5 * 60 * 1000,
    timerRemaining: 5 * 60 * 1000,
    intervalId: null,
    laps: [],
  };

  function clearTicker() {
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
  }

  function currentValue() {
    if (!state.running || !state.startedAt) {
      return state.mode === 'stopwatch' ? state.elapsed : state.timerRemaining;
    }

    if (state.mode === 'stopwatch') {
      return state.elapsed + (Date.now() - state.startedAt);
    }

    return Math.max(0, state.timerRemaining - (Date.now() - state.startedAt));
  }

  function sync(root) {
    const displayEl = root.querySelector('#tool-stopwatch-display');
    const modeEl = root.querySelector('#tool-stopwatch-mode');
    const lapsEl = root.querySelector('#tool-stopwatch-laps');
    const timerInputEl = root.querySelector('#tool-stopwatch-timer-input');
    const label = state.mode === 'stopwatch' ? 'Stopwatch' : 'Countdown timer';

    if (displayEl) {
      displayEl.textContent = formatDuration(currentValue());
    }

    if (modeEl) {
      modeEl.textContent = label;
    }

    if (timerInputEl) {
      timerInputEl.value = String(Math.max(1, Math.round(state.timerDuration / 60000)));
    }

    if (lapsEl) {
      if (!state.laps.length) {
        lapsEl.innerHTML = '<div class="tool-stopwatch__empty">No lap entries yet.</div>';
      } else {
        lapsEl.innerHTML = state.laps
          .map((lap, index) => `
            <div class="tool-stopwatch__lap">
              <span>Lap ${state.laps.length - index}</span>
              <span>${formatDuration(lap)}</span>
            </div>
          `)
          .join('');
      }
    }
  }

  function tick(root) {
    sync(root);

    if (state.mode === 'timer' && currentValue() <= 0) {
      state.running = false;
      state.startedAt = null;
      state.timerRemaining = 0;
      clearTicker();
      sync(root);
    }
  }

  function start(root) {
    if (state.running) return;
    state.running = true;
    state.startedAt = Date.now();
    clearTicker();
    state.intervalId = setInterval(() => tick(root), 50);
    sync(root);
  }

  function pause(root) {
    if (!state.running) return;

    if (state.mode === 'stopwatch') {
      state.elapsed = currentValue();
    } else {
      state.timerRemaining = currentValue();
    }

    state.running = false;
    state.startedAt = null;
    clearTicker();
    sync(root);
  }

  function reset(root) {
    state.running = false;
    state.startedAt = null;
    state.elapsed = 0;
    state.timerRemaining = state.timerDuration;
    state.laps = [];
    clearTicker();
    sync(root);
  }

  function setMode(root, mode) {
    pause(root);
    state.mode = mode;
    reset(root);
  }

  return {
    id: 'stopwatch',
    title: 'Stopwatch',
    subtitle: 'Timer and lap tracking',
    description: 'Switch between stopwatch and countdown timer with lap history.',
    badge: 'Time',
    render() {
      return `
        <div class="tool-utility-card hidden" data-tool-modal="stopwatch" role="dialog" aria-modal="true" aria-labelledby="tool-stopwatch-title">
          <div class="tool-utility-card__header">
            <div>
              <p class="tool-utility-card__eyebrow">Time Tools</p>
              <h2 id="tool-stopwatch-title" class="tool-utility-card__title">Stopwatch and Timer</h2>
            </div>
            <button type="button" class="tool-utility-card__close" data-close-utility aria-label="Close dialog">x</button>
          </div>
          <div class="tool-utility-card__body">
            <div class="tool-stopwatch">
              <div class="tool-stopwatch__toolbar">
                <div id="tool-stopwatch-mode" class="tool-stopwatch__mode">Stopwatch</div>
                <div class="tool-stopwatch__switches">
                  <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-stopwatch-mode="stopwatch">Stopwatch</button>
                  <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-stopwatch-mode="timer">Timer</button>
                </div>
              </div>
              <div id="tool-stopwatch-display" class="tool-stopwatch__display">00:00:00.00</div>
              <div class="tool-stopwatch__controls">
                <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-stopwatch-action="start">Start</button>
                <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-stopwatch-action="pause">Pause</button>
                <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-stopwatch-action="lap">Lap</button>
                <button type="button" class="tool-utility-btn tool-utility-btn--ghost" data-stopwatch-action="reset">Reset</button>
              </div>
              <div class="tool-stopwatch__timer-config">
                <label class="tool-stopwatch__config-label" for="tool-stopwatch-timer-input">Timer minutes</label>
                <input id="tool-stopwatch-timer-input" class="tool-stopwatch__config-input" type="number" min="1" step="1" value="5" />
              </div>
              <div id="tool-stopwatch-laps" class="tool-stopwatch__laps"></div>
            </div>
          </div>
        </div>
      `;
    },
    init(root) {
      const timerInputEl = root.querySelector('#tool-stopwatch-timer-input');

      root.addEventListener('click', (event) => {
        const modeButton = event.target.closest('[data-stopwatch-mode]');
        if (modeButton) {
          setMode(root, modeButton.dataset.stopwatchMode);
          return;
        }

        const actionButton = event.target.closest('[data-stopwatch-action]');
        if (!actionButton) return;

        switch (actionButton.dataset.stopwatchAction) {
          case 'start':
            start(root);
            break;
          case 'pause':
            pause(root);
            break;
          case 'lap':
            if (state.mode === 'stopwatch') {
              state.laps = [currentValue(), ...state.laps].slice(0, 12);
              sync(root);
            }
            break;
          case 'reset':
            reset(root);
            break;
          default:
            break;
        }
      });

      timerInputEl?.addEventListener('input', () => {
        const minutes = Math.max(1, Number(timerInputEl.value || 1));
        state.timerDuration = minutes * 60 * 1000;
        if (!state.running && state.mode === 'timer') {
          state.timerRemaining = state.timerDuration;
          sync(root);
        }
      });

      sync(root);
    },
    onOpen(root) {
      sync(root);
    },
  };
}
