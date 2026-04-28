// =============================================================================
// calculatorToolModal.js — Enterprise Multi-Calculator Suite v2
// No inline styles · No custom CSS · Pure Tailwind + classList
// =============================================================================

const CALC_STORAGE_KEY = 'enterprise-calc-v2';

// ─── Math Evaluator ───────────────────────────────────────────────────────────
function evalExpr(expr) {
  const s = expr.replace(/\s+/g, '');
  if (!s) return { ok: true, val: '0' };
  if (!/^[\d+\-*/().%e]+$/i.test(s)) return { ok: false, msg: 'Invalid characters' };
  try {
    // eslint-disable-next-line no-new-func
    const v = new Function(`return (${s})`)();
    if (typeof v !== 'number' || !isFinite(v)) return { ok: false, msg: 'Invalid result' };
    return { ok: true, val: parseFloat(v.toFixed(12)).toString() };
  } catch {
    return { ok: false, msg: 'Invalid expression' };
  }
}

// ─── State ────────────────────────────────────────────────────────────────────
let _st = null;
function st() {
  if (!_st) {
    try { _st = JSON.parse(localStorage.getItem(CALC_STORAGE_KEY)) || {}; } catch { _st = {}; }
    _st.history  = _st.history  || [];
    _st.memory   = _st.memory   ?? null;
    _st.currency = _st.currency || { base: 'USD', rates: {}, date: '' };
  }
  return _st;
}
function persist() {
  try { localStorage.setItem(CALC_STORAGE_KEY, JSON.stringify(_st)); } catch {}
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtINR  = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt2    = n => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN    = (n, d = 4) => parseFloat(Number(n).toFixed(d)).toLocaleString('en-IN');
const el      = (root, id) => root.querySelector(`#${id}`);
const setText = (root, id, v) => { const e = el(root, id); if (e) e.textContent = v; };

// ─── Unit Conversion Data ─────────────────────────────────────────────────────
const UNIT_DEFS = {
  length: {
    label: 'Length',
    units: { km: 1000, m: 1, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254, nmi: 1852 },
    names: { km: 'Kilometer', m: 'Meter', cm: 'Centimeter', mm: 'Millimeter', mi: 'Mile', yd: 'Yard', ft: 'Foot', in: 'Inch', nmi: 'Naut. Mile' },
  },
  weight: {
    label: 'Weight',
    units: { t: 1000, kg: 1, g: 0.001, mg: 1e-6, lb: 0.453592, oz: 0.028349, tola: 0.011663, carat: 0.0002 },
    names: { t: 'Metric Tonne', kg: 'Kilogram', g: 'Gram', mg: 'Milligram', lb: 'Pound', oz: 'Ounce', tola: 'Tola (IN)', carat: 'Carat' },
  },
  temperature: {
    label: 'Temperature',
    special: true,
    units: { C: null, F: null, K: null, R: null },
    names: { C: 'Celsius', F: 'Fahrenheit', K: 'Kelvin', R: 'Rankine' },
  },
  area: {
    label: 'Area',
    units: { km2: 1e6, m2: 1, cm2: 1e-4, ha: 1e4, acre: 4046.86, ft2: 0.092903, in2: 6.4516e-4, bigha: 1618.74 },
    names: { km2: 'Sq. Kilometer', m2: 'Sq. Meter', cm2: 'Sq. Centimeter', ha: 'Hectare', acre: 'Acre', ft2: 'Sq. Foot', in2: 'Sq. Inch', bigha: 'Bigha (IN)' },
  },
  volume: {
    label: 'Volume',
    units: { L: 1, mL: 0.001, m3: 1000, ft3: 28.3168, gal: 3.78541, pt: 0.473176, cup: 0.236588, tsp: 0.00492892, tbsp: 0.0147868 },
    names: { L: 'Liter', mL: 'Milliliter', m3: 'Cubic Meter', ft3: 'Cu. Foot', gal: 'US Gallon', pt: 'Pint', cup: 'Cup', tsp: 'Teaspoon', tbsp: 'Tablespoon' },
  },
  speed: {
    label: 'Speed',
    units: { ms: 1, kmh: 1 / 3.6, mph: 0.44704, kn: 0.514444, mach: 340.3 },
    names: { ms: 'm/s', kmh: 'km/h', mph: 'mph', kn: 'Knot', mach: 'Mach' },
  },
  data: {
    label: 'Data',
    units: { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776, b: 0.125, Kb: 128, Mb: 131072, Gb: 134217728 },
    names: { B: 'Byte', KB: 'Kilobyte', MB: 'Megabyte', GB: 'Gigabyte', TB: 'Terabyte', b: 'Bit', Kb: 'Kilobit', Mb: 'Megabit', Gb: 'Gigabit' },
  },
  pressure: {
    label: 'Pressure',
    units: { Pa: 1, kPa: 1000, MPa: 1e6, bar: 1e5, atm: 101325, psi: 6894.76, mmHg: 133.322, inHg: 3386.39 },
    names: { Pa: 'Pascal', kPa: 'Kilopascal', MPa: 'Megapascal', bar: 'Bar', atm: 'Atmosphere', psi: 'PSI', mmHg: 'mmHg (Torr)', inHg: 'inHg' },
  },
};

function convertUnit(cat, from, to, value) {
  const def = UNIT_DEFS[cat];
  if (!def) return NaN;
  if (from === to) return value;
  if (def.special) {
    let c;
    if (from === 'C') c = value;
    else if (from === 'F') c = (value - 32) * 5 / 9;
    else if (from === 'K') c = value - 273.15;
    else if (from === 'R') c = (value - 491.67) * 5 / 9;
    if (to === 'C') return c;
    if (to === 'F') return c * 9 / 5 + 32;
    if (to === 'K') return c + 273.15;
    if (to === 'R') return (c + 273.15) * 9 / 5;
  }
  return value * def.units[from] / def.units[to];
}

// ─── Currency ─────────────────────────────────────────────────────────────────
const CURRENCIES = [
  'USD','INR','EUR','GBP','JPY','AED','SGD','AUD','CAD','CHF',
  'CNY','HKD','SAR','THB','MYR','KRW','IDR','BRL','ZAR','NOK',
];

async function fetchRates() {
  try {
    // Call server endpoint instead of external API (avoids CSP issues)
    const res = await fetch('/api/tools/currency-rates?base=USD');
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();
    st().currency = { base: 'USD', rates: data.rates, date: data.timestamp };
    persist();
    return data.rates;
  } catch (e) {
    console.error('Failed to fetch currency rates:', e);
    return null;
  }
}

function getCrossRate(rates, from, to) {
  if (!rates || !rates[from] || !rates[to]) return null;
  const usdFrom = from === 'USD' ? 1 : rates[from];
  const usdTo   = to   === 'USD' ? 1 : rates[to];
  return usdTo / usdFrom;
}

// ─── TABS CONFIG ──────────────────────────────────────────────────────────────
const TABS = [
  { id: 'calc',     icon: '⊞',  label: 'Calc'    },
  { id: 'date',     icon: '📅', label: 'Date'    },
  { id: 'invest',   icon: '📈', label: 'Invest'  },
  { id: 'currency', icon: '💱', label: 'Forex'   },
  { id: 'units',    icon: '📐', label: 'Units'   },
  { id: 'emi',      icon: '🏦', label: 'EMI'     },
  { id: 'gst',      icon: '🧾', label: 'GST'     },
  { id: 'percent',  icon: '%',  label: 'Percent' },
  { id: 'pnl',      icon: '📊', label: 'P & L'   },
];

// ─────────────────────────────────────────────────────────────────────────────
// PANEL RENDERERS
// ─────────────────────────────────────────────────────────────────────────────

function renderCalcPanel() {
  const memKeys = [
    ['MC', 'memory-mc'], ['MR', 'memory-mr'], ['M+', 'memory-add'],
    ['M−', 'memory-sub'], ['+/−', 'toggle-sign'],
  ];
  const keys = [
    ['AC',  'fn:clear',     'bg-red-50 hover:bg-rose-600 text-rose-600 hover:text-white text-[10px] font-black uppercase border border-rose-200'],
    ['⌫',  'fn:backspace',  'bg-gray-100 hover:bg-gray-200 text-gray-600 text-base font-black border border-gray-200'],
    ['(',   'val:(',         'bg-gray-100 hover:bg-gray-200 text-gray-600 font-black border border-gray-200'],
    [')',   'val:)',         'bg-gray-100 hover:bg-gray-200 text-gray-600 font-black border border-gray-200'],
    ['7',   'val:7',         'bg-white hover:bg-gray-100 text-gray-800 font-black text-base border border-gray-200'],
    ['8',   'val:8',         'bg-white hover:bg-gray-100 text-gray-800 font-black text-base border border-gray-200'],
    ['9',   'val:9',         'bg-white hover:bg-gray-100 text-gray-800 font-black text-base border border-gray-200'],
    ['÷',   'val:/',         'bg-indigo-700 hover:bg-indigo-600 text-white font-black border border-indigo-600'],
    ['4',   'val:4',         'bg-white hover:bg-gray-100 text-gray-800 font-black text-base border border-gray-200'],
    ['5',   'val:5',         'bg-white hover:bg-gray-100 text-gray-800 font-black text-base border border-gray-200'],
    ['6',   'val:6',         'bg-white hover:bg-gray-100 text-gray-800 font-black text-base border border-gray-200'],
    ['×',   'val:*',         'bg-indigo-700 hover:bg-indigo-600 text-white font-black border border-indigo-600'],
    ['1',   'val:1',         'bg-white hover:bg-gray-100 text-gray-800 font-black text-base border border-gray-200'],
    ['2',   'val:2',         'bg-white hover:bg-gray-100 text-gray-800 font-black text-base border border-gray-200'],
    ['3',   'val:3',         'bg-white hover:bg-gray-100 text-gray-800 font-black text-base border border-gray-200'],
    ['−',   'val:-',         'bg-indigo-700 hover:bg-indigo-600 text-white font-black border border-indigo-600'],
    ['0',   'val:0',         'bg-white hover:bg-gray-100 text-gray-800 font-black text-base col-span-2 border border-gray-200'],
    ['.',   'val:.',         'bg-white hover:bg-gray-100 text-gray-800 font-black text-base border border-gray-200'],
    ['+',   'val:+',         'bg-indigo-700 hover:bg-indigo-600 text-white font-black border border-indigo-600'],
    ['%',   'val:%',         'bg-gray-100 hover:bg-gray-200 text-gray-600 font-black text-[9px] uppercase border border-gray-200'],
    ['√',   'fn:sqrt',       'bg-gray-100 hover:bg-gray-200 text-gray-600 font-black text-sm border border-gray-200'],
    ['=',   'fn:equals',     'bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xl col-span-2 shadow-lg shadow-emerald-900/30 active:scale-95 transition-transform'],
  ];
  return `
    <div data-panel="calc" class="flex h-full overflow-hidden bg-gray-50">
      <div class="flex-1 flex flex-col p-3 gap-2 min-w-0 bg-gray-50">
        <div class="bg-gray-900 rounded-xl p-3 border border-gray-700 shadow-inner shrink-0">
          <div class="flex justify-between items-center mb-1">
            <span class="text-[7px] font-black uppercase tracking-widest text-gray-400">Expression</span>
            <div class="flex items-center gap-3">
              <span id="calc-memory-label" class="text-[7px] font-black text-indigo-500 italic">—</span>
              <button type="button" data-calc-fn="copy" class="text-[7px] font-black uppercase text-gray-400 hover:text-indigo-400 transition tracking-widest">Copy</button>
              <button type="button" data-calc-fn="clear-history" class="text-[7px] font-black uppercase text-gray-400 hover:text-rose-400 transition tracking-widest">Clear</button>
            </div>
          </div>
          <input id="calc-input" class="w-full bg-transparent text-gray-400 text-sm font-mono outline-none placeholder:text-gray-800 caret-indigo-400" type="text" autocomplete="off" spellcheck="false" placeholder="e.g. (2400*18)/100" />
          <div id="calc-result" class="text-4xl font-black text-white text-right font-mono tracking-tighter leading-tight mt-1">0</div>
          <div id="calc-expr-preview" class="text-[9px] text-gray-500 text-right font-mono mt-0.5 truncate min-h-[1em]"></div>
        </div>
        <div class="grid grid-cols-5 gap-1 shrink-0">
          ${memKeys.map(([l, a]) => `
            <button type="button" data-calc-fn="${a}" class="bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200 text-[8px] font-black py-1.5 rounded-lg transition uppercase tracking-tight">${l}</button>
          `).join('')}
        </div>
        <div class="grid grid-cols-4 gap-1 flex-1">
          ${keys.map(([label, action, cls]) => {
            const [type, val] = action.split(':');
            const attr = type === 'val' ? `data-calc-val="${val}"` : `data-calc-fn="${val}"`;
            return `<button type="button" ${attr} class="rounded-lg py-2 transition shadow-md ${cls}">${label}</button>`;
          }).join('')}
        </div>
      </div>
      <div class="w-36 border-l border-gray-200 bg-white flex flex-col shrink-0">
        <div class="px-2 py-1.5 border-b border-gray-200 text-[7px] font-black text-gray-600 uppercase tracking-widest">History</div>
        <div id="calc-history" class="flex-1 overflow-y-auto p-1.5 space-y-1"></div>
      </div>
    </div>`;
}

function renderDatePanel() {
  const inputCls = 'w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-sky-500 transition';
  const selectCls = 'w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs outline-none focus:border-sky-500 transition';
  return `
    <div data-panel="date" class="hidden h-full overflow-y-auto p-4 space-y-4 bg-gray-50">
      <!-- Date Difference -->
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-sky-600 mb-3">Date Difference</div>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Start Date</label>
            <input id="date-diff-start" type="date" class="${inputCls}" />
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">End Date</label>
            <input id="date-diff-end" type="date" class="${inputCls}" />
          </div>
        </div>
        <button type="button" id="date-diff-calc" class="w-full bg-sky-700 hover:bg-sky-600 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition mb-3">Calculate Difference</button>
        <div id="date-diff-result" class="hidden">
          <div class="grid grid-cols-4 gap-2 mb-2">
            ${['days','weeks','months','years'].map(u => `
              <div class="bg-gray-50 rounded-lg p-2 text-center border border-gray-200">
                <div id="date-diff-${u}" class="text-2xl font-black text-gray-800 font-mono">—</div>
                <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest mt-0.5">${u}</div>
              </div>
            `).join('')}
          </div>
          <div id="date-diff-detail" class="text-[8px] text-gray-500 font-mono text-center bg-gray-50 rounded-lg py-1.5 px-2"></div>
        </div>
      </div>

      <!-- Date Arithmetic -->
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-emerald-700 mb-3">Add / Subtract from Date</div>
        <div class="grid grid-cols-3 gap-2 mb-3">
          <div class="col-span-3">
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Base Date</label>
            <input id="date-arith-start" type="date" class="${inputCls}" />
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Amount</label>
            <input id="date-arith-amount" type="number" value="30" class="${inputCls}" />
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Unit</label>
            <select id="date-arith-unit" class="${selectCls}">
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Operation</label>
            <select id="date-arith-op" class="${selectCls}">
              <option value="add">Add (+)</option>
              <option value="sub">Subtract (−)</option>
            </select>
          </div>
        </div>
        <button type="button" id="date-arith-calc" class="w-full bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition mb-3">Calculate Date</button>
        <div id="date-arith-result" class="hidden bg-gray-50 rounded-lg p-3 border border-gray-200 text-center">
          <div id="date-arith-out" class="text-2xl font-black text-gray-800 font-mono"></div>
          <div id="date-arith-day" class="text-[9px] text-gray-500 mt-1 font-mono"></div>
        </div>
      </div>

      <!-- Age Calculator -->
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-violet-700 mb-3">Age Calculator</div>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Date of Birth</label>
            <input id="date-age-dob" type="date" class="${inputCls}" />
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">As of Date</label>
            <input id="date-age-asof" type="date" class="${inputCls}" />
          </div>
        </div>
        <button type="button" id="date-age-calc" class="w-full bg-violet-700 hover:bg-violet-600 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition mb-3">Calculate Age</button>
        <div id="date-age-result" class="hidden">
          <div class="grid grid-cols-3 gap-2 mb-2">
            <div class="bg-gray-50 rounded-lg p-2 text-center border border-violet-900/30">
              <div id="date-age-years" class="text-3xl font-black text-gray-800 font-mono">—</div>
              <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest mt-0.5">Years</div>
            </div>
            <div class="bg-gray-50 rounded-lg p-2 text-center border border-gray-200">
              <div id="date-age-months" class="text-3xl font-black text-violet-400 font-mono">—</div>
              <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest mt-0.5">Months</div>
            </div>
            <div class="bg-gray-50 rounded-lg p-2 text-center border border-gray-200">
              <div id="date-age-days-r" class="text-3xl font-black text-gray-400 font-mono">—</div>
              <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest mt-0.5">Days</div>
            </div>
          </div>
          <div id="date-age-detail" class="text-[8px] text-gray-500 font-mono text-center bg-gray-50 rounded-lg py-1.5 px-2"></div>
        </div>
      </div>

      <!-- Working Days -->
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-amber-700 mb-3">Working Days Between Dates</div>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">From</label>
            <input id="date-work-start" type="date" class="${inputCls}" />
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">To</label>
            <input id="date-work-end" type="date" class="${inputCls}" />
          </div>
        </div>
        <button type="button" id="date-work-calc" class="w-full bg-amber-700 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition mb-3">Calculate Working Days</button>
        <div id="date-work-result" class="hidden grid grid-cols-3 gap-2 text-center">
          <div class="bg-gray-50 rounded-lg p-2 border border-gray-200">
            <div id="date-work-total" class="text-2xl font-black text-gray-800 font-mono">—</div>
            <div class="text-[7px] font-black text-gray-600 uppercase">Total</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-2 border border-emerald-900/30">
            <div id="date-work-working" class="text-2xl font-black text-emerald-400 font-mono">—</div>
            <div class="text-[7px] font-black text-gray-600 uppercase">Working</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-2 border border-gray-200">
            <div id="date-work-weekend" class="text-2xl font-black text-gray-500 font-mono">—</div>
            <div class="text-[7px] font-black text-gray-600 uppercase">Weekends</div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderInvestPanel() {
  const inputCls = 'w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-emerald-500 transition';
  const selectCls = 'w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs outline-none focus:border-emerald-500 transition';
  return `
    <div data-panel="invest" class="hidden h-full overflow-y-auto p-4 space-y-4 bg-gray-50">
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-emerald-700 mb-3">Investment Calculator</div>
        <div class="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-lg mb-3">
          <button type="button" data-invest-type="simple"   class="invest-type-btn text-[9px] font-black py-1.5 rounded-md bg-emerald-600 text-white transition uppercase tracking-widest">Simple Interest</button>
          <button type="button" data-invest-type="compound" class="invest-type-btn text-[9px] font-black py-1.5 rounded-md text-gray-500 hover:text-gray-700 transition uppercase tracking-widest">Compound Interest</button>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Principal (₹)</label>
            <input id="invest-principal" type="number" value="100000" class="${inputCls}" />
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Annual Rate (%)</label>
            <input id="invest-rate" type="number" value="12" step="0.1" class="${inputCls}" />
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Time (years)</label>
            <input id="invest-time" type="number" value="5" step="0.5" class="${inputCls}" />
          </div>
          <div id="invest-freq-wrap">
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Compounding</label>
            <select id="invest-freq" class="${selectCls}">
              <option value="1">Annually</option>
              <option value="2">Semi-Annually</option>
              <option value="4">Quarterly</option>
              <option value="12" selected>Monthly</option>
              <option value="365">Daily</option>
            </select>
          </div>
        </div>
        <button type="button" id="invest-calc" class="w-full bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition mb-3">Calculate Returns</button>
        <div id="invest-summary" class="hidden grid grid-cols-3 gap-2 mb-3">
          <div class="bg-gray-50 rounded-lg p-2 text-center border border-gray-200">
            <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest">Principal</div>
            <div id="invest-r-principal" class="text-sm font-black text-gray-800 font-mono mt-0.5">—</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-2 text-center border border-emerald-900/30">
            <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest">Interest Earned</div>
            <div id="invest-r-interest" class="text-sm font-black text-emerald-400 font-mono mt-0.5">—</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-2 text-center border border-gray-200">
            <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest">Maturity Amount</div>
            <div id="invest-r-total" class="text-sm font-black text-indigo-400 font-mono mt-0.5">—</div>
          </div>
        </div>
        <!-- CAGR bar -->
        <div id="invest-cagr-wrap" class="hidden bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 mb-3 flex justify-between items-center">
          <span class="text-[7px] font-black text-gray-600 uppercase tracking-widest">Effective Annual Return</span>
          <span id="invest-cagr" class="text-sm font-black text-emerald-400 font-mono">—</span>
        </div>
        <div id="invest-table-wrap" class="hidden">
          <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest mb-1.5">Year-by-Year Breakdown</div>
          <div class="overflow-x-auto rounded-lg border border-gray-200">
            <table class="w-full text-[9px]">
              <thead class="bg-gray-100">
                <tr class="text-gray-600 font-black uppercase tracking-widest">
                  <th class="px-2 py-1.5 text-left">Yr</th>
                  <th class="px-2 py-1.5 text-right">Opening</th>
                  <th class="px-2 py-1.5 text-right">Interest</th>
                  <th class="px-2 py-1.5 text-right">Closing</th>
                  <th class="px-2 py-1.5 text-right">Growth</th>
                </tr>
              </thead>
              <tbody id="invest-table-body" class="divide-y divide-gray-200"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- SIP Calculator -->
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-teal-700 mb-3">SIP Calculator (Monthly Investment)</div>
        <div class="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Monthly SIP (₹)</label>
            <input id="sip-amount" type="number" value="5000" class="${inputCls.replace('emerald', 'teal')}" />
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Rate (% / yr)</label>
            <input id="sip-rate" type="number" value="12" step="0.5" class="${inputCls.replace('emerald', 'teal')}" />
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Duration (yrs)</label>
            <input id="sip-years" type="number" value="10" class="${inputCls.replace('emerald', 'teal')}" />
          </div>
        </div>
        <div id="sip-results" class="grid grid-cols-3 gap-2 text-center">
          <div class="bg-gray-50 rounded-lg p-2 border border-gray-200">
            <div class="text-[7px] font-black text-gray-600 uppercase">Invested</div>
            <div id="sip-r-invested" class="text-sm font-black text-gray-800 font-mono mt-0.5">—</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-2 border border-teal-900/30">
            <div class="text-[7px] font-black text-gray-600 uppercase">Gains</div>
            <div id="sip-r-gains" class="text-sm font-black text-teal-400 font-mono mt-0.5">—</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-2 border border-gray-200">
            <div class="text-[7px] font-black text-gray-600 uppercase">Corpus</div>
            <div id="sip-r-corpus" class="text-sm font-black text-indigo-400 font-mono mt-0.5">—</div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderCurrencyPanel() {
  const cOptions = CURRENCIES.map(c => `<option value="${c}">${c}</option>`).join('');
  return `
    <div data-panel="currency" class="hidden h-full flex flex-col overflow-hidden bg-gray-50">
      <div class="p-4 space-y-3 overflow-y-auto flex-1 bg-gray-50">
        <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
          <div class="flex justify-between items-center mb-3">
            <div class="text-[8px] font-black uppercase tracking-widest text-amber-400">Live Currency Converter</div>
            <div class="flex items-center gap-2">
              <span id="currency-status" class="text-[7px] text-gray-400 font-mono italic">Not loaded</span>
              <button type="button" id="currency-refresh" class="text-[7px] font-black uppercase text-amber-500 hover:text-amber-300 tracking-widest border border-amber-800/40 px-2 py-0.5 rounded transition">↻ Refresh</button>
            </div>
          </div>
          <div class="grid grid-cols-11 gap-2 items-end mb-3">
            <div class="col-span-3">
              <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Amount</label>
              <input id="currency-amount" type="number" value="1" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-amber-500 transition" />
            </div>
            <div class="col-span-4">
              <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">From Currency</label>
              <select id="currency-from" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs outline-none focus:border-amber-500 transition">
                ${CURRENCIES.map(c => `<option value="${c}" ${c === 'USD' ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="col-span-1 flex items-end pb-0.5">
              <button type="button" id="currency-swap" class="w-full text-gray-400 hover:text-amber-400 text-lg font-black transition text-center">⇄</button>
            </div>
            <div class="col-span-3">
              <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">To Currency</label>
              <select id="currency-to" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs outline-none focus:border-amber-500 transition">
                ${CURRENCIES.map(c => `<option value="${c}" ${c === 'INR' ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
          </div>
          <!-- Main result -->
          <div class="bg-amber-50 rounded-xl p-3 border border-amber-200 mb-3">
            <div id="currency-main-result" class="text-3xl font-black text-gray-800 font-mono text-center">—</div>
            <div id="currency-main-label" class="text-[8px] text-gray-400 font-mono text-center mt-1">—</div>
          </div>
          <!-- All currency grid -->
          <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest mb-2">All Rates from <span id="currency-base-label">USD</span></div>
          <div class="grid grid-cols-4 gap-1.5">
            ${CURRENCIES.map(c => `
              <div class="bg-gray-50 rounded-lg p-1.5 border border-gray-200">
                <div class="text-[7px] font-black text-gray-500">${c}</div>
                <div id="currency-all-${c}" class="text-[10px] font-black text-gray-800 font-mono">—</div>
              </div>
            `).join('')}
          </div>
          <div id="currency-footer" class="text-[7px] text-gray-500 font-mono text-center mt-2 italic">Powered by Frankfurter · Open Exchange Rates</div>
        </div>
      </div>
    </div>`;
}

function renderUnitsPanel() {
  const catIds = Object.keys(UNIT_DEFS);
  return `
    <div data-panel="units" class="hidden h-full overflow-y-auto p-4 bg-gray-50">
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-teal-700 mb-3">Unit Converter</div>
        <div class="flex flex-wrap gap-1 mb-3">
          ${catIds.map((cat, i) => `
            <button type="button" data-unit-cat="${cat}" class="unit-cat-btn text-[7px] font-black uppercase tracking-widest px-2 py-1 rounded-md border transition ${i === 0 ? 'bg-teal-700 text-white border-teal-700' : 'bg-gray-100 text-gray-600 border-gray-200 hover:text-gray-800'}">${UNIT_DEFS[cat].label}</button>
          `).join('')}
        </div>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">From</label>
            <select id="unit-from" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs outline-none focus:border-teal-500 transition mb-2"></select>
            <input id="unit-value-in" type="number" value="1" step="any" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-teal-500 transition" />
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">To</label>
            <select id="unit-to" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs outline-none focus:border-teal-500 transition mb-2"></select>
            <div id="unit-result" class="bg-teal-50 border border-teal-200 rounded-lg px-2 py-1.5 text-teal-700 font-black font-mono text-xl text-right">—</div>
          </div>
        </div>
        <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest mb-2">All Conversions</div>
        <div id="unit-all-grid" class="grid grid-cols-2 gap-1.5"></div>
      </div>
    </div>`;
}

function renderEmiPanel() {
  const inputCls = 'w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-rose-500 transition';
  return `
    <div data-panel="emi" class="hidden h-full overflow-y-auto p-4 space-y-4 bg-gray-50">
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-rose-700 mb-3">EMI / Loan Calculator</div>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Loan Amount (₹)</label>
            <input id="emi-principal" type="number" value="1000000" class="${inputCls}" />
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Annual Interest (%)</label>
            <input id="emi-rate" type="number" value="9" step="0.1" class="${inputCls}" />
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Tenure (months)</label>
            <input id="emi-tenure" type="number" value="60" class="${inputCls}" />
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Start Month</label>
            <input id="emi-start" type="month" class="${inputCls}" />
          </div>
        </div>
        <button type="button" id="emi-calc" class="w-full bg-rose-700 hover:bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition mb-3">Calculate EMI</button>

        <div id="emi-summary" class="hidden grid grid-cols-3 gap-2 mb-3">
          <div class="bg-gray-50 rounded-lg p-2 text-center border border-rose-900/30">
            <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest">Monthly EMI</div>
            <div id="emi-r-emi" class="text-lg font-black text-gray-800 font-mono mt-0.5">—</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-2 text-center border border-gray-200">
            <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest">Total Interest</div>
            <div id="emi-r-interest" class="text-lg font-black text-rose-400 font-mono mt-0.5">—</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-2 text-center border border-gray-200">
            <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest">Total Payment</div>
            <div id="emi-r-total" class="text-lg font-black text-indigo-400 font-mono mt-0.5">—</div>
          </div>
        </div>

        <!-- Split bar -->
        <div id="emi-bar-wrap" class="hidden mb-3">
          <div class="flex rounded-full overflow-hidden h-2.5 bg-gray-200 mb-1">
            <div id="emi-bar-principal" class="bg-indigo-500 h-full transition-all duration-700"></div>
            <div id="emi-bar-interest" class="bg-rose-500 h-full transition-all duration-700"></div>
          </div>
          <div class="flex justify-between">
            <div class="flex items-center gap-1"><div class="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></div><span class="text-[7px] text-gray-500 font-black uppercase">Principal <span id="emi-bar-p-pct" class="text-indigo-600"></span></span></div>
            <div class="flex items-center gap-1"><div class="w-2 h-2 rounded-full bg-rose-500 shrink-0"></div><span class="text-[7px] text-gray-500 font-black uppercase">Interest <span id="emi-bar-i-pct" class="text-rose-400"></span></span></div>
          </div>
        </div>

        <div id="emi-schedule-wrap" class="hidden">
          <div class="flex items-center justify-between mb-1.5">
            <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest">Amortization Schedule</div>
            <div id="emi-schedule-note" class="text-[7px] text-gray-400 italic font-mono"></div>
          </div>
          <div class="overflow-auto max-h-56 rounded-lg border border-gray-200">
            <table class="w-full text-[9px]">
              <thead class="sticky top-0 bg-gray-100">
                <tr class="text-gray-600 font-black uppercase tracking-widest">
                  <th class="px-2 py-1.5 text-left">#</th>
                  <th class="px-2 py-1.5 text-left">Month</th>
                  <th class="px-2 py-1.5 text-right">EMI</th>
                  <th class="px-2 py-1.5 text-right">Principal</th>
                  <th class="px-2 py-1.5 text-right">Interest</th>
                  <th class="px-2 py-1.5 text-right">Balance</th>
                </tr>
              </thead>
              <tbody id="emi-schedule-body" class="divide-y divide-gray-200"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;
}

function renderGstPanel() {
  const inputCls = 'w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-orange-500 transition';
  return `
    <div data-panel="gst" class="hidden h-full overflow-y-auto p-4 space-y-4 bg-gray-50">
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-orange-700 mb-3">GST Calculator (India)</div>
        <div class="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-lg mb-3">
          <button type="button" data-gst-mode="exclusive" class="gst-mode-btn text-[9px] font-black py-1.5 rounded-md bg-orange-600 text-white transition uppercase tracking-widest">Add GST (Exclusive)</button>
          <button type="button" data-gst-mode="inclusive" class="gst-mode-btn text-[9px] font-black py-1.5 rounded-md text-gray-500 hover:text-gray-700 transition uppercase tracking-widest">Extract GST (Inclusive)</button>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Amount (₹)</label>
            <input id="gst-amount" type="number" value="10000" class="${inputCls}" />
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">GST Rate (%)</label>
            <select id="gst-rate" class="${inputCls.replace('font-mono', '')}">
              ${[0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28].map(r => `<option value="${r}" ${r === 18 ? 'selected' : ''}>${r}%</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-lg mb-4">
          <button type="button" data-gst-tx="intra" class="gst-tx-btn text-[9px] font-black py-1.5 rounded-md bg-gray-800 text-white transition uppercase tracking-widest">Intra-State (CGST+SGST)</button>
          <button type="button" data-gst-tx="inter" class="gst-tx-btn text-[9px] font-black py-1.5 rounded-md text-gray-500 hover:text-gray-700 transition uppercase tracking-widest">Inter-State (IGST)</button>
        </div>
        <div class="space-y-2">
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
              <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest">Taxable Amount</div>
              <div id="gst-r-base" class="text-xl font-black text-gray-800 font-mono mt-1">₹0.00</div>
            </div>
            <div class="bg-gray-50 rounded-lg p-2.5 border border-orange-900/30">
              <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest">Total Tax</div>
              <div id="gst-r-total-gst" class="text-xl font-black text-orange-400 font-mono mt-1">₹0.00</div>
            </div>
          </div>
          <div id="gst-breakdown" class="grid grid-cols-2 gap-2">
            <div class="bg-gray-50 rounded-lg p-2 border border-gray-200">
              <div id="gst-tax1-label" class="text-[7px] font-black text-gray-600 uppercase tracking-widest">CGST (9%)</div>
              <div id="gst-r-tax1" class="text-base font-black text-orange-300 font-mono mt-0.5">₹0.00</div>
            </div>
            <div class="bg-gray-50 rounded-lg p-2 border border-gray-200">
              <div id="gst-tax2-label" class="text-[7px] font-black text-gray-600 uppercase tracking-widest">SGST (9%)</div>
              <div id="gst-r-tax2" class="text-base font-black text-orange-300 font-mono mt-0.5">₹0.00</div>
            </div>
          </div>
          <div class="bg-orange-900/20 rounded-lg p-3 border border-orange-800/30">
            <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest">Grand Total (Incl. GST)</div>
            <div id="gst-r-grand" class="text-3xl font-black text-gray-800 font-mono mt-1">₹0.00</div>
          </div>
        </div>
      </div>

      <!-- Batch GST Table -->
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-orange-700 mb-3">GST Slab Reference</div>
        <div class="overflow-x-auto rounded-lg border border-gray-200">
          <table class="w-full text-[9px]">
            <thead class="bg-gray-100">
              <tr class="text-gray-600 font-black uppercase tracking-widest">
                <th class="px-2 py-1.5 text-left">Rate</th>
                <th class="px-2 py-1.5 text-left">Category</th>
                <th class="px-2 py-1.5 text-left">Examples</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 text-gray-300">
              ${[
                ['0%','Exempt / Nil','Milk, eggs, fresh vegetables, salt, books, stamps'],
                ['5%','Essential Goods','Sugar, coffee, tea, coal, LPG, packed food'],
                ['12%','Standard','Butter, cheese, mobile phones, medicines'],
                ['18%','Standard+','AC, computers, CCTV, IT services, finance services'],
                ['28%','Luxury / Demerit','Cars, motorcycles, aerated drinks, tobacco, cement'],
              ].map(([r, cat, ex]) => `
                <tr class="hover:bg-gray-50">
                  <td class="px-2 py-1.5 font-black text-orange-400">${r}</td>
                  <td class="px-2 py-1.5 font-bold text-gray-300">${cat}</td>
                  <td class="px-2 py-1.5 text-gray-400">${ex}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function renderPercentPanel() {
  return `
    <div data-panel="percent" class="hidden h-full overflow-y-auto p-4 space-y-3 bg-gray-50">
      <!-- X% of Y -->
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-indigo-700 mb-2">X% of Y</div>
        <div class="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label class="text-[7px] font-black text-gray-600 uppercase tracking-wider block mb-1">Percentage (X %)</label>
            <input id="pct-of-x" type="number" value="18" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-indigo-500 transition" />
          </div>
          <div>
            <label class="text-[7px] font-black text-gray-600 uppercase tracking-wider block mb-1">of Value (Y)</label>
            <input id="pct-of-y" type="number" value="10000" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-indigo-500 transition" />
          </div>
        </div>
        <div id="pct-of-result" class="bg-gray-50 rounded-lg px-3 py-2 text-xl font-black text-indigo-400 font-mono border border-gray-200">—</div>
      </div>

      <!-- Percentage Change -->
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-emerald-700 mb-2">Percentage Change</div>
        <div class="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label class="text-[7px] font-black text-gray-600 uppercase tracking-wider block mb-1">From (Old Value)</label>
            <input id="pct-change-from" type="number" value="8000" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-emerald-500 transition" />
          </div>
          <div>
            <label class="text-[7px] font-black text-gray-600 uppercase tracking-wider block mb-1">To (New Value)</label>
            <input id="pct-change-to" type="number" value="10000" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-emerald-500 transition" />
          </div>
        </div>
        <div id="pct-change-result" class="bg-gray-50 rounded-lg px-3 py-2 text-xl font-black text-emerald-400 font-mono border border-gray-200">—</div>
      </div>

      <!-- X is what % of Y -->
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-amber-700 mb-2">X is what % of Y?</div>
        <div class="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label class="text-[7px] font-black text-gray-600 uppercase tracking-wider block mb-1">Value (X)</label>
            <input id="pct-back-x" type="number" value="1800" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-amber-500 transition" />
          </div>
          <div>
            <label class="text-[7px] font-black text-gray-600 uppercase tracking-wider block mb-1">Total (Y)</label>
            <input id="pct-back-y" type="number" value="10000" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-amber-500 transition" />
          </div>
        </div>
        <div id="pct-back-result" class="bg-gray-50 rounded-lg px-3 py-2 text-xl font-black text-amber-400 font-mono border border-gray-200">—</div>
      </div>

      <!-- Markup / Margin -->
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-rose-700 mb-2">Markup & Gross Margin</div>
        <div class="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label class="text-[7px] font-black text-gray-600 uppercase tracking-wider block mb-1">Cost Price (₹)</label>
            <input id="pct-markup-cost" type="number" value="5000" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-rose-500 transition" />
          </div>
          <div>
            <label class="text-[7px] font-black text-gray-600 uppercase tracking-wider block mb-1">Sell Price (₹)</label>
            <input id="pct-markup-sell" type="number" value="7500" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-rose-500 transition" />
          </div>
        </div>
        <div id="pct-markup-result" class="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
          <div class="grid grid-cols-2 gap-3 text-center">
            <div>
              <div class="text-[7px] font-black text-gray-600 uppercase">Markup %</div>
              <div id="pct-markup-pct" class="text-lg font-black text-rose-400 font-mono">—</div>
            </div>
            <div>
              <div class="text-[7px] font-black text-gray-600 uppercase">Gross Margin</div>
              <div id="pct-margin-pct" class="text-lg font-black text-indigo-400 font-mono">—</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Discount -->
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-violet-700 mb-2">Discount Calculator</div>
        <div class="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label class="text-[7px] font-black text-gray-600 uppercase tracking-wider block mb-1">Original Price (₹)</label>
            <input id="pct-disc-price" type="number" value="10000" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-violet-500 transition" />
          </div>
          <div>
            <label class="text-[7px] font-black text-gray-600 uppercase tracking-wider block mb-1">Discount (%)</label>
            <input id="pct-disc-pct" type="number" value="20" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-violet-500 transition" />
          </div>
        </div>
        <div class="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
          <div class="grid grid-cols-3 gap-2 text-center">
            <div>
              <div class="text-[7px] font-black text-gray-600 uppercase">Savings</div>
              <div id="pct-disc-savings" class="text-base font-black text-violet-400 font-mono">—</div>
            </div>
            <div>
              <div class="text-[7px] font-black text-gray-600 uppercase">Final Price</div>
              <div id="pct-disc-final" class="text-base font-black text-gray-800 font-mono">—</div>
            </div>
            <div>
              <div class="text-[7px] font-black text-gray-600 uppercase">You Save</div>
              <div id="pct-disc-savepct" class="text-base font-black text-emerald-400 font-mono">—</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tip / Split -->
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-sky-600 mb-2">Tip & Split Calculator</div>
        <div class="grid grid-cols-3 gap-2 mb-2">
          <div>
            <label class="text-[7px] font-black text-gray-600 uppercase tracking-wider block mb-1">Bill Amount (₹)</label>
            <input id="tip-bill" type="number" value="2400" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-sky-500 transition" />
          </div>
          <div>
            <label class="text-[7px] font-black text-gray-600 uppercase tracking-wider block mb-1">Tip (%)</label>
            <input id="tip-pct" type="number" value="10" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-sky-500 transition" />
          </div>
          <div>
            <label class="text-[7px] font-black text-gray-600 uppercase tracking-wider block mb-1">Split (people)</label>
            <input id="tip-split" type="number" value="4" min="1" class="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-sky-500 transition" />
          </div>
        </div>
        <div class="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
          <div class="grid grid-cols-3 gap-2 text-center">
            <div><div class="text-[7px] font-black text-gray-600 uppercase">Tip</div><div id="tip-r-tip" class="text-base font-black text-sky-400 font-mono">—</div></div>
            <div><div class="text-[7px] font-black text-gray-600 uppercase">Total</div><div id="tip-r-total" class="text-base font-black text-gray-800 font-mono">—</div></div>
            <div><div class="text-[7px] font-black text-gray-600 uppercase">Per Person</div><div id="tip-r-per" class="text-base font-black text-emerald-400 font-mono">—</div></div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderPnlPanel() {
  const inputCls = 'w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-800 text-xs font-mono outline-none focus:border-violet-500 transition';
  return `
    <div data-panel="pnl" class="hidden h-full overflow-y-auto p-4 space-y-4 bg-gray-50">
      <!-- Product P&L -->
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-violet-700 mb-3">Product / Trade P&L</div>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Cost Price (₹)</label>
            <input id="pnl-cost" type="number" value="5000" class="${inputCls}" />
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Sell Price (₹)</label>
            <input id="pnl-sell" type="number" value="7500" class="${inputCls}" />
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Quantity</label>
            <input id="pnl-qty" type="number" value="10" class="${inputCls}" />
          </div>
          <div>
            <label class="text-[8px] font-black text-gray-700 uppercase tracking-wider block mb-1">Other Expenses (₹)</label>
            <input id="pnl-expenses" type="number" value="0" class="${inputCls}" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div class="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
            <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest">Total Revenue</div>
            <div id="pnl-r-revenue" class="text-xl font-black text-gray-800 font-mono mt-1">—</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
            <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest">Total Cost</div>
            <div id="pnl-r-cost" class="text-xl font-black text-gray-800 font-mono mt-1">—</div>
          </div>
        </div>
        <div id="pnl-result-box" class="rounded-lg p-3 border mb-3 text-center bg-gray-50 border-gray-200">
          <div id="pnl-profit-label" class="text-[8px] font-black uppercase tracking-widest text-gray-300 mb-1">Net Profit / Loss</div>
          <div id="pnl-r-profit" class="text-4xl font-black font-mono">—</div>
          <div class="grid grid-cols-3 gap-2 mt-3">
            <div>
              <div class="text-[7px] font-black text-gray-600 uppercase">Gross Margin</div>
              <div id="pnl-r-margin" class="text-base font-black font-mono text-violet-400">—</div>
            </div>
            <div>
              <div class="text-[7px] font-black text-gray-600 uppercase">Markup</div>
              <div id="pnl-r-markup" class="text-base font-black font-mono text-indigo-400">—</div>
            </div>
            <div>
              <div class="text-[7px] font-black text-gray-600 uppercase">ROI</div>
              <div id="pnl-r-roi" class="text-base font-black font-mono text-teal-400">—</div>
            </div>
          </div>
        </div>

        <!-- Breakeven -->
        <div class="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
          <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest mb-1">Break-Even Analysis</div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[7px] font-black text-gray-600 uppercase tracking-wider block mb-1">Fixed Costs (₹)</label>
              <input id="pnl-fixed" type="number" value="20000" class="${inputCls}" />
            </div>
            <div class="flex flex-col justify-end">
              <div class="text-[7px] font-black text-gray-600 uppercase tracking-widest">Break-Even Units</div>
              <div id="pnl-r-breakeven" class="text-lg font-black text-amber-400 font-mono mt-0.5">—</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Batch P&L Table -->
      <div class="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <div class="text-[8px] font-black uppercase tracking-widest text-violet-700 mb-3">Multi-Item P&L</div>
        <div id="pnl-rows" class="space-y-1.5 mb-2">
          <div class="grid grid-cols-12 gap-1 text-[7px] font-black text-gray-600 uppercase tracking-widest">
            <div class="col-span-4 px-1 text-gray-300">Item</div>
            <div class="col-span-2 px-1">Cost</div>
            <div class="col-span-2 px-1">Sell</div>
            <div class="col-span-2 px-1">Qty</div>
            <div class="col-span-2 px-1">P&L</div>
          </div>
          ${[1, 2, 3].map(i => `
            <div class="grid grid-cols-12 gap-1">
              <input placeholder="Item ${i}" class="col-span-4 pnl-batch-item bg-white border border-gray-300 rounded px-1.5 py-1 text-gray-800 text-[9px] outline-none" />
              <input type="number" value="0" placeholder="Cost" class="col-span-2 pnl-batch-cost bg-white border border-gray-300 rounded px-1.5 py-1 text-gray-800 text-[9px] font-mono outline-none" />
              <input type="number" value="0" placeholder="Sell" class="col-span-2 pnl-batch-sell bg-white border border-gray-300 rounded px-1.5 py-1 text-gray-800 text-[9px] font-mono outline-none" />
              <input type="number" value="1"  placeholder="Qty"  class="col-span-2 pnl-batch-qty  bg-white border border-gray-300 rounded px-1.5 py-1 text-gray-800 text-[9px] font-mono outline-none" />
              <div class="pnl-batch-result col-span-2 bg-gray-50 border border-gray-200 rounded px-1.5 py-1 text-[9px] font-black font-mono text-right text-gray-500">—</div>
            </div>
          `).join('')}
        </div>
        <button type="button" id="pnl-add-row" class="text-[7px] font-black uppercase text-gray-500 hover:text-violet-600 transition tracking-widest mb-3">+ Add Row</button>
        <div class="bg-gray-50 rounded-lg p-2 border border-violet-900/30 flex justify-between items-center">
          <span class="text-[7px] font-black text-gray-600 uppercase tracking-widest">Total Net P&L</span>
          <span id="pnl-batch-total" class="text-xl font-black font-mono text-white">—</span>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function initCalc(root) {
  const input  = el(root, 'calc-input');
  const result = el(root, 'calc-result');
  const memLbl = el(root, 'calc-memory-label');
  const hist   = el(root, 'calc-history');
  const preview = el(root, 'calc-expr-preview');

  function syncMemory() {
    if (memLbl) memLbl.textContent = st().memory != null ? `M: ${fmtN(st().memory, 6)}` : '—';
  }

  function syncHistory() {
    if (!hist) return;
    if (!st().history.length) {
      hist.innerHTML = '<div class="text-[7px] font-black text-gray-400 text-center py-6 uppercase tracking-widest">No history</div>';
    } else {
      hist.innerHTML = st().history.map(item => `
        <div class="p-1.5 bg-gray-50 rounded border border-gray-200 text-[9px] font-bold cursor-pointer hover:border-indigo-800 transition" data-hist-expr="${encodeURIComponent(item.expression)}">
          <div class="text-gray-400 truncate font-mono">${item.expression}</div>
          <div class="text-gray-800 text-right font-mono font-black">${item.result}</div>
        </div>
      `).join('');
    }
  }

  function runEval() {
    const res = evalExpr(input.value);
    if (res.ok) {
      result.textContent = res.val;
      result.classList.remove('text-rose-500');
      result.classList.add('text-white');
      if (preview) preview.textContent = input.value ? `= ${res.val}` : '';
      if (input.value && input.value !== res.val) {
        st().history = [{ expression: input.value, result: res.val }, ...st().history].slice(0, 12);
        persist();
        syncHistory();
      }
    } else {
      result.textContent = 'Error';
      result.classList.remove('text-white');
      result.classList.add('text-rose-500');
      if (preview) preview.textContent = res.msg;
    }
  }

  root.addEventListener('click', async e => {
    const valBtn = e.target.closest('[data-calc-val]');
    if (valBtn) { input.value += valBtn.dataset.calcVal; input.focus(); return; }

    const histBtn = e.target.closest('[data-hist-expr]');
    if (histBtn) { input.value = decodeURIComponent(histBtn.dataset.histExpr); input.focus(); return; }

    const fn = e.target.closest('[data-calc-fn]');
    if (!fn) return;
    switch (fn.dataset.calcFn) {
      case 'clear':         input.value = ''; result.textContent = '0'; if (preview) preview.textContent = ''; break;
      case 'backspace':     input.value = input.value.slice(0, -1); break;
      case 'equals':        runEval(); break;
      case 'sqrt':          {
        const r = evalExpr(input.value);
        if (r.ok) { input.value = `Math.sqrt(${r.val})`; runEval(); }
        break;
      }
      case 'copy':          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(result.textContent); break;
      case 'clear-history': st().history = []; persist(); syncHistory(); break;
      case 'memory-mc':     st().memory = null; persist(); syncMemory(); break;
      case 'memory-mr':     input.value += String(st().memory ?? 0); break;
      case 'memory-add':    runEval(); st().memory = (st().memory ?? 0) + Number(result.textContent); persist(); syncMemory(); break;
      case 'memory-sub':    runEval(); st().memory = (st().memory ?? 0) - Number(result.textContent); persist(); syncMemory(); break;
      case 'toggle-sign':
        if (input.value.startsWith('-')) input.value = input.value.slice(1);
        else if (input.value) input.value = '-' + input.value;
        break;
    }
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); runEval(); }
  });

  syncMemory();
  syncHistory();
}

function initDate(root) {
  // Pre-fill today's date
  const todayISO = new Date().toISOString().slice(0, 10);
  ['date-diff-start', 'date-diff-end', 'date-arith-start', 'date-age-asof', 'date-work-start', 'date-work-end'].forEach(id => {
    const e = el(root, id);
    if (e && !e.value) e.value = todayISO;
  });

  const dob = el(root, 'date-age-dob');
  if (dob && !dob.value) {
    const d = new Date(); d.setFullYear(d.getFullYear() - 30);
    dob.value = d.toISOString().slice(0, 10);
  }

  // Date Difference
  el(root, 'date-diff-calc')?.addEventListener('click', () => {
    const a = new Date(el(root, 'date-diff-start').value);
    const b = new Date(el(root, 'date-diff-end').value);
    if (isNaN(a) || isNaN(b)) return;
    const diff = Math.abs(b - a);
    const days   = Math.floor(diff / 86400000);
    const weeks  = Math.floor(days / 7);
    const months = Math.abs((b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth());
    const years  = parseFloat((days / 365.25).toFixed(2));
    setText(root, 'date-diff-days', days.toLocaleString('en-IN'));
    setText(root, 'date-diff-weeks', weeks.toLocaleString('en-IN'));
    setText(root, 'date-diff-months', months.toLocaleString('en-IN'));
    setText(root, 'date-diff-years', years);
    const earlier = a < b ? a : b;
    const later   = a < b ? b : a;
    setText(root, 'date-diff-detail',
      `${earlier.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })} → ` +
      `${later.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}`
    );
    el(root, 'date-diff-result')?.classList.remove('hidden');
  });

  // Date Arithmetic
  el(root, 'date-arith-calc')?.addEventListener('click', () => {
    const base   = new Date(el(root, 'date-arith-start').value);
    const amount = parseInt(el(root, 'date-arith-amount').value, 10) || 0;
    const unit   = el(root, 'date-arith-unit').value;
    const op     = el(root, 'date-arith-op').value;
    const mult   = op === 'sub' ? -1 : 1;
    const d = new Date(base);
    if (unit === 'days')   d.setDate(d.getDate() + mult * amount);
    if (unit === 'weeks')  d.setDate(d.getDate() + mult * amount * 7);
    if (unit === 'months') d.setMonth(d.getMonth() + mult * amount);
    if (unit === 'years')  d.setFullYear(d.getFullYear() + mult * amount);
    setText(root, 'date-arith-out', d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }));
    setText(root, 'date-arith-day', d.toLocaleDateString('en-IN', { weekday: 'long' }) + ' · ' + d.toISOString().slice(0, 10));
    el(root, 'date-arith-result')?.classList.remove('hidden');
  });

  // Age Calculator
  el(root, 'date-age-calc')?.addEventListener('click', () => {
    const dob  = new Date(el(root, 'date-age-dob').value);
    const asof = new Date(el(root, 'date-age-asof').value);
    if (isNaN(dob) || isNaN(asof)) return;
    let yrs = asof.getFullYear() - dob.getFullYear();
    let mos = asof.getMonth() - dob.getMonth();
    let dys = asof.getDate() - dob.getDate();
    if (dys < 0) { mos--; dys += new Date(asof.getFullYear(), asof.getMonth(), 0).getDate(); }
    if (mos < 0) { yrs--; mos += 12; }
    const totalDays = Math.floor(Math.abs(asof - dob) / 86400000);
    setText(root, 'date-age-years', yrs);
    setText(root, 'date-age-months', mos);
    setText(root, 'date-age-days-r', dys);
    setText(root, 'date-age-detail', `${totalDays.toLocaleString('en-IN')} total days · ${Math.floor(totalDays / 7).toLocaleString('en-IN')} weeks`);
    el(root, 'date-age-result')?.classList.remove('hidden');
  });

  // Working Days
  el(root, 'date-work-calc')?.addEventListener('click', () => {
    const a = new Date(el(root, 'date-work-start').value);
    const b = new Date(el(root, 'date-work-end').value);
    if (isNaN(a) || isNaN(b)) return;
    const start = a < b ? a : b;
    const end   = a < b ? b : a;
    let working = 0, weekends = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (day === 0 || day === 6) weekends++; else working++;
      cur.setDate(cur.getDate() + 1);
    }
    const total = working + weekends;
    setText(root, 'date-work-total',   total);
    setText(root, 'date-work-working', working);
    setText(root, 'date-work-weekend', weekends);
    el(root, 'date-work-result')?.classList.remove('hidden');
  });
}

function initInvest(root) {
  let investType = 'simple';

  root.querySelectorAll('.invest-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      investType = btn.dataset.investType;
      root.querySelectorAll('.invest-type-btn').forEach(b => {
        b.classList.toggle('bg-emerald-600', b.dataset.investType === investType);
        b.classList.toggle('text-white',     b.dataset.investType === investType);
        b.classList.toggle('text-gray-400',  b.dataset.investType !== investType);
      });
      el(root, 'invest-freq-wrap')?.classList.toggle('hidden', investType === 'simple');
    });
  });

  el(root, 'invest-calc')?.addEventListener('click', () => {
    const P   = parseFloat(el(root, 'invest-principal').value) || 0;
    const r   = parseFloat(el(root, 'invest-rate').value) / 100 || 0;
    const t   = parseFloat(el(root, 'invest-time').value) || 0;
    const n   = parseInt(el(root, 'invest-freq').value, 10) || 12;
    const yrs = Math.ceil(t);
    const rows = [];

    if (investType === 'simple') {
      let bal = P;
      for (let y = 1; y <= yrs; y++) {
        const yr = Math.min(y, t);
        const interest = P * r * yr - P * r * (yr - 1);
        const closing  = P + P * r * yr;
        rows.push({ y, opening: bal, interest, closing });
        bal = closing;
      }
      const totalInterest = P * r * t;
      const total = P + totalInterest;
      setText(root, 'invest-r-principal', fmtINR(P));
      setText(root, 'invest-r-interest',  fmtINR(totalInterest));
      setText(root, 'invest-r-total',     fmtINR(total));
      setText(root, 'invest-cagr',        `${fmt2(r * 100)}% p.a.`);
    } else {
      const total = P * Math.pow(1 + r / n, n * t);
      const interest = total - P;
      const cagr  = (Math.pow(total / P, 1 / t) - 1) * 100;
      let bal = P;
      for (let y = 1; y <= yrs; y++) {
        const yr = Math.min(y, t);
        const closing  = P * Math.pow(1 + r / n, n * yr);
        const interest = closing - bal;
        rows.push({ y, opening: bal, interest, closing });
        bal = closing;
      }
      setText(root, 'invest-r-principal', fmtINR(P));
      setText(root, 'invest-r-interest',  fmtINR(interest));
      setText(root, 'invest-r-total',     fmtINR(total));
      setText(root, 'invest-cagr',        `${fmt2(cagr)}% p.a. (CAGR)`);
    }

    const tbody = el(root, 'invest-table-body');
    if (tbody) {
      tbody.innerHTML = rows.map(row => `
        <tr class="hover:bg-gray-50">
          <td class="px-2 py-1.5 font-mono text-gray-400">${row.y}</td>
          <td class="px-2 py-1.5 font-mono text-gray-300 text-right">${fmtINR(row.opening)}</td>
          <td class="px-2 py-1.5 font-mono text-emerald-400 text-right">+${fmtINR(row.interest)}</td>
          <td class="px-2 py-1.5 font-mono text-white text-right font-black">${fmtINR(row.closing)}</td>
          <td class="px-2 py-1.5 font-mono text-indigo-400 text-right">${fmt2(((row.closing / row.opening) - 1) * 100)}%</td>
        </tr>
      `).join('');
    }

    el(root, 'invest-summary')?.classList.remove('hidden');
    el(root, 'invest-cagr-wrap')?.classList.remove('hidden');
    el(root, 'invest-table-wrap')?.classList.remove('hidden');
  });

  // SIP reactive
  function calcSip() {
    const mthly = parseFloat(el(root, 'sip-amount')?.value) || 0;
    const rate  = (parseFloat(el(root, 'sip-rate')?.value) || 0) / 100 / 12;
    const n     = (parseFloat(el(root, 'sip-years')?.value) || 0) * 12;
    const corpus = rate > 0
      ? mthly * (Math.pow(1 + rate, n) - 1) / rate * (1 + rate)
      : mthly * n;
    const invested = mthly * n;
    const gains = corpus - invested;
    setText(root, 'sip-r-invested', fmtINR(invested));
    setText(root, 'sip-r-gains',    fmtINR(gains));
    setText(root, 'sip-r-corpus',   fmtINR(corpus));
  }
  ['sip-amount', 'sip-rate', 'sip-years'].forEach(id => {
    el(root, id)?.addEventListener('input', calcSip);
  });
  calcSip();
}

function initCurrency(root) {
  const state = st().currency;

  function updateDisplay() {
    const rates  = state.rates;
    const amount = parseFloat(el(root, 'currency-amount')?.value) || 1;
    const from   = el(root, 'currency-from')?.value || 'USD';
    const to     = el(root, 'currency-to')?.value || 'INR';

    if (!rates || !Object.keys(rates).length) return;

    const mainRate = getCrossRate(rates, from, to);
    if (mainRate != null) {
      setText(root, 'currency-main-result', fmtN(amount * mainRate, 4));
      setText(root, 'currency-main-label',  `1 ${from} = ${fmtN(mainRate, 4)} ${to}`);
    }

    setText(root, 'currency-base-label', from);

    CURRENCIES.forEach(cur => {
      const rateEl = el(root, `currency-all-${cur}`);
      if (!rateEl) return;
      const r = getCrossRate(rates, from, cur);
      rateEl.textContent = r != null ? fmtN(amount * r, 4) : '—';
    });
  }

  async function doFetch() {
    const statusEl = el(root, 'currency-status');
    if (statusEl) { statusEl.textContent = 'Fetching...'; statusEl.classList.remove('text-green-500', 'text-rose-500'); statusEl.classList.add('text-amber-400'); }
    const rates = await fetchRates();
    if (rates) {
      if (statusEl) { statusEl.textContent = `Updated ${state.date}`; statusEl.classList.remove('text-amber-400', 'text-rose-500'); statusEl.classList.add('text-green-500'); }
      updateDisplay();
    } else {
      if (statusEl) { statusEl.textContent = 'Failed – using cache'; statusEl.classList.remove('text-amber-400', 'text-green-500'); statusEl.classList.add('text-rose-500'); }
    }
  }

  el(root, 'currency-refresh')?.addEventListener('click', doFetch);

  el(root, 'currency-swap')?.addEventListener('click', () => {
    const fromEl = el(root, 'currency-from');
    const toEl   = el(root, 'currency-to');
    const tmp = fromEl.value;
    fromEl.value = toEl.value;
    toEl.value = tmp;
    updateDisplay();
  });

  ['currency-amount', 'currency-from', 'currency-to'].forEach(id => {
    el(root, id)?.addEventListener('input', updateDisplay);
  });

  // Auto-load if cached
  if (state.rates && Object.keys(state.rates).length) {
    const statusEl = el(root, 'currency-status');
    if (statusEl && state.date) statusEl.textContent = `Cached ${state.date}`;
    updateDisplay();
  } else {
    // Auto-fetch rates on first load
    doFetch();
  }
}

function initUnits(root) {
  let currentCat = 'length';

  function populateSelects() {
    const def   = UNIT_DEFS[currentCat];
    const units = Object.keys(def.units || def.names);
    const mkOpts = sel => units.map(u => `<option value="${u}">${def.names[u]}</option>`).join('');
    const fromSel = el(root, 'unit-from');
    const toSel   = el(root, 'unit-to');
    if (fromSel) fromSel.innerHTML = mkOpts();
    if (toSel)   { toSel.innerHTML = mkOpts(); if (units.length > 1) toSel.value = units[1]; }
  }

  function compute() {
    const fromSel = el(root, 'unit-from');
    const toSel   = el(root, 'unit-to');
    const valIn   = el(root, 'unit-value-in');
    const resEl   = el(root, 'unit-result');
    const allGrid = el(root, 'unit-all-grid');
    if (!fromSel || !toSel || !valIn) return;
    const val  = parseFloat(valIn.value) || 0;
    const from = fromSel.value;
    const to   = toSel.value;
    const res  = convertUnit(currentCat, from, to, val);
    if (resEl) resEl.textContent = isFinite(res) ? fmtN(res, 6) : '—';

    // All conversions
    if (allGrid) {
      const def   = UNIT_DEFS[currentCat];
      const units = Object.keys(def.units || def.names);
      allGrid.innerHTML = units.map(u => {
        const v = convertUnit(currentCat, from, u, val);
        return `
          <div class="bg-gray-50 rounded-lg p-1.5 border border-gray-200">
            <div class="text-[7px] font-black text-gray-400">${def.names[u]}</div>
            <div class="text-[10px] font-black text-teal-400 font-mono">${isFinite(v) ? fmtN(v, 4) : '—'}</div>
          </div>`;
      }).join('');
    }
  }

  root.querySelectorAll('.unit-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCat = btn.dataset.unitCat;
      root.querySelectorAll('.unit-cat-btn').forEach(b => {
        b.classList.toggle('bg-teal-700',   b === btn);
        b.classList.toggle('text-white',    b === btn);
        b.classList.toggle('border-teal-700', b === btn);
        b.classList.toggle('bg-gray-100',   b !== btn);
        b.classList.toggle('text-gray-500', b !== btn);
        b.classList.toggle('border-gray-200', b !== btn);
      });
      populateSelects();
      compute();
    });
  });

  ['unit-from', 'unit-to', 'unit-value-in'].forEach(id => {
    el(root, id)?.addEventListener('input', compute);
  });

  populateSelects();
  compute();
}

function initEmi(root) {
  // Set current month
  const monthInput = el(root, 'emi-start');
  if (monthInput) {
    const now = new Date();
    monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  el(root, 'emi-calc')?.addEventListener('click', () => {
    const P      = parseFloat(el(root, 'emi-principal').value) || 0;
    const annR   = parseFloat(el(root, 'emi-rate').value) / 100 || 0;
    const tenure = parseInt(el(root, 'emi-tenure').value, 10) || 0;
    const r      = annR / 12;
    const emi    = r > 0
      ? P * r * Math.pow(1 + r, tenure) / (Math.pow(1 + r, tenure) - 1)
      : P / tenure;
    const totalPay = emi * tenure;
    const totalInt = totalPay - P;
    const pPct = (P / totalPay) * 100;
    const iPct = (totalInt / totalPay) * 100;

    setText(root, 'emi-r-emi',      fmtINR(emi));
    setText(root, 'emi-r-interest', fmtINR(totalInt));
    setText(root, 'emi-r-total',    fmtINR(totalPay));

    const barP = el(root, 'emi-bar-principal');
    const barI = el(root, 'emi-bar-interest');
    if (barP) barP.style.width = pPct + '%';
    if (barI) barI.style.width = iPct + '%';
    setText(root, 'emi-bar-p-pct', fmt2(pPct) + '%');
    setText(root, 'emi-bar-i-pct', fmt2(iPct) + '%');

    // Amortization
    const startVal = el(root, 'emi-start').value || `${new Date().getFullYear()}-01`;
    const [sy, sm] = startVal.split('-').map(Number);
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let bal = P;
    const rows = [];
    for (let i = 1; i <= tenure; i++) {
      const intPart = bal * r;
      const prinPart = emi - intPart;
      bal = Math.max(0, bal - prinPart);
      const mi = (sm - 1 + i - 1) % 12;
      const yr = sy + Math.floor((sm - 1 + i - 1) / 12);
      rows.push({ i, month: `${MONTHS[mi]} ${yr}`, emi, prinPart, intPart, bal });
    }

    const tbody = el(root, 'emi-schedule-body');
    if (tbody) {
      tbody.innerHTML = rows.map(row => `
        <tr class="hover:bg-gray-50 ${row.i % 12 === 0 ? 'bg-indigo-50' : ''}">
          <td class="px-2 py-1 font-mono text-gray-500">${row.i}</td>
          <td class="px-2 py-1 font-mono text-gray-600">${row.month}</td>
          <td class="px-2 py-1 font-mono text-white text-right">${fmtINR(row.emi)}</td>
          <td class="px-2 py-1 font-mono text-indigo-400 text-right">${fmtINR(row.prinPart)}</td>
          <td class="px-2 py-1 font-mono text-rose-400 text-right">${fmtINR(row.intPart)}</td>
          <td class="px-2 py-1 font-mono text-gray-800 text-right font-black">${fmtINR(row.bal)}</td>
        </tr>
      `).join('');
    }

    setText(root, 'emi-schedule-note', `${tenure} installments`);
    el(root, 'emi-summary')?.classList.remove('hidden');
    el(root, 'emi-bar-wrap')?.classList.remove('hidden');
    el(root, 'emi-schedule-wrap')?.classList.remove('hidden');
  });
}

function initGst(root) {
  let gstMode = 'exclusive';
  let gstTx   = 'intra';

  function calcGst() {
    const amount = parseFloat(el(root, 'gst-amount')?.value) || 0;
    const rate   = parseFloat(el(root, 'gst-rate')?.value) || 0;
    let base, totalGst, tax1, tax2;

    if (gstMode === 'exclusive') {
      base = amount;
      totalGst = base * rate / 100;
    } else {
      base = amount / (1 + rate / 100);
      totalGst = amount - base;
    }

    if (gstTx === 'intra') {
      tax1 = tax2 = totalGst / 2;
      setText(root, 'gst-tax1-label', `CGST (${rate / 2}%)`);
      setText(root, 'gst-tax2-label', `SGST (${rate / 2}%)`);
    } else {
      tax1 = totalGst; tax2 = 0;
      setText(root, 'gst-tax1-label', `IGST (${rate}%)`);
      setText(root, 'gst-tax2-label', '—');
    }

    setText(root, 'gst-r-base',      fmtINR(base));
    setText(root, 'gst-r-total-gst', fmtINR(totalGst));
    setText(root, 'gst-r-tax1',      fmtINR(tax1));
    setText(root, 'gst-r-tax2',      gstTx === 'intra' ? fmtINR(tax2) : '—');
    setText(root, 'gst-r-grand',     fmtINR(base + totalGst));
  }

  root.querySelectorAll('[data-gst-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      gstMode = btn.dataset.gstMode;
      root.querySelectorAll('.gst-mode-btn').forEach(b => {
        b.classList.toggle('bg-orange-600', b.dataset.gstMode === gstMode);
        b.classList.toggle('text-white',    b.dataset.gstMode === gstMode);
        b.classList.toggle('text-gray-500', b.dataset.gstMode !== gstMode);
      });
      calcGst();
    });
  });

  root.querySelectorAll('[data-gst-tx]').forEach(btn => {
    btn.addEventListener('click', () => {
      gstTx = btn.dataset.gstTx;
      root.querySelectorAll('.gst-tx-btn').forEach(b => {
        b.classList.toggle('bg-gray-700', b.dataset.gstTx === gstTx);
        b.classList.toggle('text-white',  b.dataset.gstTx === gstTx);
        b.classList.toggle('text-gray-500', b.dataset.gstTx !== gstTx);
      });
      calcGst();
    });
  });

  ['gst-amount', 'gst-rate'].forEach(id => el(root, id)?.addEventListener('input', calcGst));
  calcGst();
}

function initPercent(root) {
  function wire(ids, fn) {
    ids.forEach(id => el(root, id)?.addEventListener('input', fn));
    fn();
  }

  wire(['pct-of-x', 'pct-of-y'], () => {
    const x = parseFloat(el(root, 'pct-of-x')?.value) || 0;
    const y = parseFloat(el(root, 'pct-of-y')?.value) || 0;
    setText(root, 'pct-of-result', `${fmtINR(x * y / 100)}  (${x}% of ${fmtN(y, 2)})`);
  });

  wire(['pct-change-from', 'pct-change-to'], () => {
    const f = parseFloat(el(root, 'pct-change-from')?.value) || 0;
    const t = parseFloat(el(root, 'pct-change-to')?.value) || 0;
    if (!f) return;
    const pct = ((t - f) / Math.abs(f)) * 100;
    const sign = pct >= 0 ? '▲' : '▼';
    const resEl = el(root, 'pct-change-result');
    if (resEl) {
      resEl.textContent = `${sign} ${fmt2(Math.abs(pct))}%  (${pct >= 0 ? '+' : ''}${fmtINR(t - f)})`;
      resEl.classList.toggle('text-emerald-400', pct >= 0);
      resEl.classList.toggle('text-rose-400', pct < 0);
    }
  });

  wire(['pct-back-x', 'pct-back-y'], () => {
    const x = parseFloat(el(root, 'pct-back-x')?.value) || 0;
    const y = parseFloat(el(root, 'pct-back-y')?.value) || 0;
    if (!y) return;
    setText(root, 'pct-back-result', `${fmt2((x / y) * 100)}%`);
  });

  wire(['pct-markup-cost', 'pct-markup-sell'], () => {
    const c = parseFloat(el(root, 'pct-markup-cost')?.value) || 0;
    const s = parseFloat(el(root, 'pct-markup-sell')?.value) || 0;
    if (!c) return;
    setText(root, 'pct-markup-pct', fmt2(((s - c) / c) * 100) + '%');
    setText(root, 'pct-margin-pct', fmt2(((s - c) / s) * 100) + '%');
  });

  wire(['pct-disc-price', 'pct-disc-pct'], () => {
    const p = parseFloat(el(root, 'pct-disc-price')?.value) || 0;
    const d = parseFloat(el(root, 'pct-disc-pct')?.value) || 0;
    const savings = p * d / 100;
    const final   = p - savings;
    setText(root, 'pct-disc-savings', fmtINR(savings));
    setText(root, 'pct-disc-final',   fmtINR(final));
    setText(root, 'pct-disc-savepct', `${fmt2(d)}% off`);
  });

  wire(['tip-bill', 'tip-pct', 'tip-split'], () => {
    const bill  = parseFloat(el(root, 'tip-bill')?.value) || 0;
    const pct   = parseFloat(el(root, 'tip-pct')?.value) || 0;
    const split = Math.max(1, parseInt(el(root, 'tip-split')?.value, 10) || 1);
    const tip   = bill * pct / 100;
    const total = bill + tip;
    setText(root, 'tip-r-tip',   fmtINR(tip));
    setText(root, 'tip-r-total', fmtINR(total));
    setText(root, 'tip-r-per',   fmtINR(total / split));
  });
}

function initPnl(root) {
  function calcMain() {
    const cost     = parseFloat(el(root, 'pnl-cost')?.value)     || 0;
    const sell     = parseFloat(el(root, 'pnl-sell')?.value)     || 0;
    const qty      = parseFloat(el(root, 'pnl-qty')?.value)      || 1;
    const expenses = parseFloat(el(root, 'pnl-expenses')?.value) || 0;
    const fixed    = parseFloat(el(root, 'pnl-fixed')?.value)    || 0;
    const revenue  = sell * qty;
    const totalCost = cost * qty + expenses;
    const profit    = revenue - totalCost;
    const margin    = sell > 0 ? ((sell - cost) / sell) * 100 : 0;
    const markup    = cost > 0 ? ((sell - cost) / cost) * 100 : 0;
    const roi       = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    const contribPerUnit = sell - cost;
    const breakeven = contribPerUnit > 0 ? Math.ceil(fixed / contribPerUnit) : 0;

    setText(root, 'pnl-r-revenue', fmtINR(revenue));
    setText(root, 'pnl-r-cost',    fmtINR(totalCost));
    setText(root, 'pnl-r-margin',  fmt2(margin) + '%');
    setText(root, 'pnl-r-markup',  fmt2(markup) + '%');
    setText(root, 'pnl-r-roi',     fmt2(roi) + '%');
    setText(root, 'pnl-r-breakeven', breakeven > 0 ? `${breakeven.toLocaleString('en-IN')} units` : '—');

    const profEl = el(root, 'pnl-r-profit');
    const boxEl  = el(root, 'pnl-result-box');
    if (profEl) {
      profEl.textContent = (profit >= 0 ? '+' : '') + fmtINR(profit);
      profEl.classList.toggle('text-emerald-400', profit >= 0);
      profEl.classList.toggle('text-rose-400',    profit < 0);
    }
    if (boxEl) {
      boxEl.classList.toggle('border-emerald-900/30', profit >= 0);
      boxEl.classList.toggle('border-rose-900/30',    profit < 0);
    }
  }

  ['pnl-cost','pnl-sell','pnl-qty','pnl-expenses','pnl-fixed'].forEach(id => {
    el(root, id)?.addEventListener('input', () => { calcMain(); calcBatch(); });
  });

  function calcBatch() {
    const rows = root.querySelectorAll('#pnl-rows > div:not(:first-child)');
    let total = 0;
    rows.forEach(row => {
      const cost = parseFloat(row.querySelector('.pnl-batch-cost')?.value) || 0;
      const sell = parseFloat(row.querySelector('.pnl-batch-sell')?.value) || 0;
      const qty  = parseFloat(row.querySelector('.pnl-batch-qty')?.value)  || 1;
      const pnl  = (sell - cost) * qty;
      total += pnl;
      const resEl = row.querySelector('.pnl-batch-result');
      if (resEl) {
        resEl.textContent = (pnl >= 0 ? '+' : '') + fmtINR(pnl);
        resEl.classList.toggle('text-emerald-400', pnl >= 0);
        resEl.classList.toggle('text-rose-400',    pnl < 0);
        resEl.classList.remove('text-gray-500');
      }
    });
    const totEl = el(root, 'pnl-batch-total');
    if (totEl) {
      totEl.textContent = (total >= 0 ? '+' : '') + fmtINR(total);
      totEl.classList.toggle('text-emerald-400', total >= 0);
      totEl.classList.toggle('text-rose-400',    total < 0);
    }
  }

  root.addEventListener('input', e => {
    if (e.target.closest('#pnl-rows')) calcBatch();
  });

  el(root, 'pnl-add-row')?.addEventListener('click', () => {
    const rowsContainer = el(root, 'pnl-rows');
    const newRow = document.createElement('div');
    newRow.className = 'grid grid-cols-12 gap-1';
    const nextI = rowsContainer.querySelectorAll('div:not(:first-child)').length + 1;
    newRow.innerHTML = `
      <input placeholder="Item ${nextI}" class="col-span-4 pnl-batch-item bg-white border border-gray-300 rounded px-1.5 py-1 text-gray-800 text-[9px] outline-none" />
      <input type="number" value="0" placeholder="Cost" class="col-span-2 pnl-batch-cost bg-white border border-gray-300 rounded px-1.5 py-1 text-gray-800 text-[9px] font-mono outline-none" />
      <input type="number" value="0" placeholder="Sell" class="col-span-2 pnl-batch-sell bg-white border border-gray-300 rounded px-1.5 py-1 text-gray-800 text-[9px] font-mono outline-none" />
      <input type="number" value="1" placeholder="Qty"  class="col-span-2 pnl-batch-qty  bg-white border border-gray-300 rounded px-1.5 py-1 text-gray-800 text-[9px] font-mono outline-none" />
      <div class="pnl-batch-result col-span-2 bg-gray-50 border border-gray-200 rounded px-1.5 py-1 text-[9px] font-black font-mono text-right text-gray-500">—</div>
    `;
    rowsContainer.insertBefore(newRow, el(root, 'pnl-add-row'));
    calcBatch();
  });

  calcMain();
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export function createCalculatorToolModal() {
  return {
    id: 'calculator',
    title: 'Enterprise Calculator Suite',
    subtitle: '9 professional-grade calculators',
    description: 'Math · Date · Investment · Forex · Units · EMI · GST · Percent · P&L',
    badge: 'Suite',

    render() {
      const sidebar = TABS.map((tab, i) => `
        <button type="button" data-tab="${tab.id}"
          class="calc-tab-btn flex flex-col items-center gap-0.5 px-1 py-2 mx-1.5 rounded-xl transition-all duration-150 ${i === 0
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
          }">
          <span class="text-lg leading-none">${tab.icon}</span>
          <span class="text-[6px] font-black uppercase tracking-tight leading-none mt-0.5 text-inherit">${tab.label}</span>
        </button>
      `).join('');

      return `
        <div class="hidden fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" data-tool-modal="calculator" role="dialog" aria-modal="true" aria-labelledby="calc-suite-title">
          <div class="absolute inset-0" data-dismiss-modal></div>
          <div class="relative bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] overflow-hidden flex flex-col">

            <!-- Header -->
            <div class="border-b border-gray-200 px-4 py-2 flex items-center justify-between bg-white shrink-0">
              <div class="flex items-center gap-2.5">
                <div class="flex gap-1">
                  <div class="w-2.5 h-2.5 rounded-full bg-rose-400"></div>
                  <div class="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                  <div class="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                </div>
                <div class="w-px h-4 bg-gray-300"></div>
                <span id="calc-suite-title" class="text-[10px] font-black text-gray-800 uppercase tracking-[0.15em]">Enterprise Calculator Suite</span>
                <span class="text-[8px] font-black text-gray-600 uppercase tracking-widest italic">9 Tools</span>
              </div>
              <button type="button" data-close-utility class="text-gray-400 hover:text-gray-700 transition p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close">✕</button>
            </div>

            <!-- Body -->
            <div class="flex flex-1 overflow-hidden min-h-0">
              <!-- Sidebar -->
              <div class="w-[4.5rem] bg-gray-50 border-r border-gray-200 flex flex-col py-2 gap-0.5 shrink-0 overflow-y-auto">
                ${sidebar}
              </div>
              <!-- Panel Area -->
              <div class="flex-1 overflow-y-auto min-w-0">
                ${renderCalcPanel()}
                ${renderDatePanel()}
                ${renderInvestPanel()}
                ${renderCurrencyPanel()}
                ${renderUnitsPanel()}
                ${renderEmiPanel()}
                ${renderGstPanel()}
                ${renderPercentPanel()}
                ${renderPnlPanel()}
              </div>
            </div>

          </div>
        </div>
      `;
    },

    init(root) {
      const panels = root.querySelectorAll('[data-panel]');
      const tabs   = root.querySelectorAll('.calc-tab-btn');

      function switchTab(id) {
        panels.forEach(p => {
          const active = p.dataset.panel === id;
          p.classList.toggle('hidden', !active);
          p.classList.toggle('flex',  active && (p.dataset.panel === 'calc' || p.dataset.panel === 'currency'));
        });
        tabs.forEach(t => {
          const active = t.dataset.tab === id;
          t.classList.toggle('bg-indigo-600',         active);
          t.classList.toggle('text-white',             active);
          t.classList.toggle('shadow-lg',              active);
          t.classList.toggle('shadow-indigo-900/40',   active);
          t.classList.toggle('text-gray-500',         !active);
          t.classList.toggle('hover:text-gray-300',   !active);
          t.classList.toggle('hover:bg-gray-100',  !active);
        });
      }

      root.addEventListener('click', e => {
        const tabBtn = e.target.closest('.calc-tab-btn');
        if (tabBtn) switchTab(tabBtn.dataset.tab);
      });

      // Initialize all calculators
      initCalc(root);
      initDate(root);
      initInvest(root);
      initCurrency(root);
      initUnits(root);
      initEmi(root);
      initGst(root);
      initPercent(root);
      initPnl(root);
    },

    onOpen(root) {
      root.querySelector('#calc-input')?.focus();
    },
  };
}