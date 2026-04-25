const CONVERSION_GROUPS = {
  length: {
    label: 'Length',
    units: {
      meter: 1,
      kilometer: 1000,
      centimeter: 0.01,
      millimeter: 0.001,
      inch: 0.0254,
      foot: 0.3048,
    },
  },
  weight: {
    label: 'Weight',
    units: {
      kilogram: 1,
      gram: 0.001,
      pound: 0.45359237,
      ounce: 0.028349523125,
    },
  },
  currency: {
    label: 'Desk ratios',
    units: {
      unit: 1,
      dozen: 12,
      score: 20,
      gross: 144,
    },
  },
};

function buildOptions(groupKey) {
  return Object.keys(CONVERSION_GROUPS[groupKey].units)
    .map((unit) => `<option value="${unit}">${unit}</option>`)
    .join('');
}

function convert(groupKey, fromUnit, toUnit, inputValue) {
  const value = Number(inputValue);
  if (Number.isNaN(value)) {
    return '0';
  }

  const group = CONVERSION_GROUPS[groupKey];
  const inBaseUnit = value * group.units[fromUnit];
  const converted = inBaseUnit / group.units[toUnit];
  return String(Number(converted.toFixed(6)));
}

export function createUnitConverterToolModal() {
  const state = {
    group: 'length',
  };

  function sync(root) {
    const groupEl = root.querySelector('#tool-converter-group');
    const fromEl = root.querySelector('#tool-converter-from');
    const toEl = root.querySelector('#tool-converter-to');
    const inputEl = root.querySelector('#tool-converter-input');
    const outputEl = root.querySelector('#tool-converter-output');

    if (!groupEl || !fromEl || !toEl || !inputEl || !outputEl) return;

    groupEl.value = state.group;
    fromEl.innerHTML = buildOptions(state.group);
    toEl.innerHTML = buildOptions(state.group);

    const unitKeys = Object.keys(CONVERSION_GROUPS[state.group].units);
    fromEl.value = unitKeys[0];
    toEl.value = unitKeys[1] || unitKeys[0];
    outputEl.value = convert(state.group, fromEl.value, toEl.value, inputEl.value || '0');
  }

  function recalculate(root) {
    const fromEl = root.querySelector('#tool-converter-from');
    const toEl = root.querySelector('#tool-converter-to');
    const inputEl = root.querySelector('#tool-converter-input');
    const outputEl = root.querySelector('#tool-converter-output');

    if (!fromEl || !toEl || !inputEl || !outputEl) return;

    outputEl.value = convert(state.group, fromEl.value, toEl.value, inputEl.value || '0');
  }

  return {
    id: 'converter',
    title: 'Unit Converter',
    subtitle: 'Fast quantity conversions',
    description: 'Convert common lengths, weights, and grouped quantity ratios.',
    badge: 'Convert',
    render() {
      return `
        <div class="tool-utility-card hidden" data-tool-modal="converter" role="dialog" aria-modal="true" aria-labelledby="tool-converter-title">
          <div class="tool-utility-card__header">
            <div>
              <p class="tool-utility-card__eyebrow">Conversion</p>
              <h2 id="tool-converter-title" class="tool-utility-card__title">Unit Converter</h2>
            </div>
            <button type="button" class="tool-utility-card__close" data-close-utility aria-label="Close dialog">x</button>
          </div>
          <div class="tool-utility-card__body">
            <div class="tool-converter">
              <div class="tool-converter__grid">
                <label class="tool-converter__field">
                  <span>Group</span>
                  <select id="tool-converter-group" class="tool-converter__select">
                    <option value="length">Length</option>
                    <option value="weight">Weight</option>
                    <option value="currency">Desk ratios</option>
                  </select>
                </label>
                <label class="tool-converter__field">
                  <span>Value</span>
                  <input id="tool-converter-input" class="tool-converter__input" type="number" step="any" value="1" />
                </label>
                <label class="tool-converter__field">
                  <span>From</span>
                  <select id="tool-converter-from" class="tool-converter__select"></select>
                </label>
                <label class="tool-converter__field">
                  <span>To</span>
                  <select id="tool-converter-to" class="tool-converter__select"></select>
                </label>
                <label class="tool-converter__field tool-converter__field--full">
                  <span>Converted value</span>
                  <input id="tool-converter-output" class="tool-converter__input" type="text" readonly />
                </label>
              </div>
            </div>
          </div>
        </div>
      `;
    },
    init(root) {
      const groupEl = root.querySelector('#tool-converter-group');
      const fromEl = root.querySelector('#tool-converter-from');
      const toEl = root.querySelector('#tool-converter-to');
      const inputEl = root.querySelector('#tool-converter-input');

      groupEl?.addEventListener('change', () => {
        state.group = groupEl.value;
        sync(root);
      });

      fromEl?.addEventListener('change', () => recalculate(root));
      toEl?.addEventListener('change', () => recalculate(root));
      inputEl?.addEventListener('input', () => recalculate(root));

      sync(root);
    },
    onOpen(root) {
      sync(root);
      root.querySelector('#tool-converter-input')?.focus();
    },
  };
}
