export const content = `
<div class="space-y-6 text-gray-700">
  <!-- Header -->
  <div class="border-b border-gray-200 pb-4">
    <h3 class="text-2xl font-black text-gray-900">Productivity Suite</h3>
    <p class="mt-2 text-sm leading-relaxed text-gray-600">
      Integrated utility tools available globally to enhance your workflow and speed up daily operations.
    </p>
  </div>

  <!-- Tools Grid -->
  <section class="grid md:grid-cols-2 gap-4">
    <div class="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h4 class="font-bold text-sm text-indigo-600 flex items-center gap-2 mb-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        Smart Notepad
      </h4>
      <p class="text-[11px] text-gray-500 leading-relaxed">
        Quickly jot down task lists, supplier notes, or temporary calculation breakdowns. 
        Notes are preserved across your session for immediate recall.
      </p>
    </div>
    <div class="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h4 class="font-bold text-sm text-indigo-600 flex items-center gap-2 mb-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
        Precision Calculator
      </h4>
      <p class="text-[11px] text-gray-500 leading-relaxed">
        A floating financial calculator designed for quick tax and interest adjustments 
        without leaving your current billing screen.
      </p>
    </div>
    <div class="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h4 class="font-bold text-sm text-indigo-600 flex items-center gap-2 mb-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        Fiscal Calendar
      </h4>
      <p class="text-[11px] text-gray-500 leading-relaxed">
        View important tax deadlines, holiday schedules, and employee wage dates 
        within an integrated calendar view.
      </p>
    </div>
    <div class="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h4 class="font-bold text-sm text-indigo-600 flex items-center gap-2 mb-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg>
        Unit Converter
      </h4>
      <p class="text-[11px] text-gray-500 leading-relaxed">
        Convert between different measurement units (e.g., Kgs to Lbs, Meters to Feet) 
        essential for accurate inventory stock-taking.
      </p>
    </div>
  </section>

  <!-- Specialized Tools -->
  <section class="p-5 bg-indigo-50 border border-indigo-200 rounded-2xl">
    <h4 class="font-bold text-sm text-indigo-900 mb-3 uppercase tracking-wide">Text Studio & Formatting</h4>
    <p class="text-xs text-indigo-800 leading-relaxed mb-4">
      An advanced utility for cleaning up copy-pasted text, stripping unwanted characters, 
      and formatting descriptions for professional PDF exports.
    </p>
    <div class="flex flex-wrap gap-2">
      <span class="px-2 py-1 bg-white border border-indigo-200 rounded text-[10px] font-bold text-indigo-700 uppercase">Trim Whitespace</span>
      <span class="px-2 py-1 bg-white border border-indigo-200 rounded text-[10px] font-bold text-indigo-700 uppercase">Case Conversion</span>
      <span class="px-2 py-1 bg-white border border-indigo-200 rounded text-[10px] font-bold text-indigo-700 uppercase">Special Char Removal</span>
    </div>
  </section>

  <!-- Contextual Tools -->
  <div class="bg-slate-900 rounded-xl p-4 text-white">
    <div class="flex items-center gap-3">
      <svg class="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>
      <div>
        <p class="text-xs font-bold">Weather Sync</p>
        <p class="text-[10px] text-slate-400">Integrated weather forecast for logistics planning and outward delivery scheduling.</p>
      </div>
    </div>
  </div>
</div>
`;
