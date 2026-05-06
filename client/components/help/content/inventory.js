export const content = `
<div class="space-y-6 text-gray-700">
  <!-- Header -->
  <div class="border-b border-gray-200 pb-4">
    <h3 class="text-2xl font-black text-gray-900">Inventory & Supply Chain System</h3>
    <p class="mt-2 text-sm leading-relaxed">
      A professional-grade inventory engine featuring multi-batch tracking, automated GST resolution, 
      and deep integration with the accounting ledger for real-time financial accuracy.
    </p>
  </div>

  <!-- Core Concepts -->
  <section>
    <h4 class="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
      <span class="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
      Core Management Pillars
    </h4>
    <div class="grid md:grid-cols-2 gap-4">
      <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <h5 class="font-bold text-gray-800 text-sm mb-2 uppercase tracking-wide">Multi-Batch Tracking</h5>
        <p class="text-xs leading-relaxed text-gray-600">
          Items are not just numbers; they are tracked by individual <strong>Batches</strong>. 
          Each batch maintains its own <strong>Expiry Date</strong>, <strong>MRP</strong>, 
          and <strong>Purchase Rate</strong>. This ensures FIFO (First-In-First-Out) 
          compliance and accurate profit margin analysis.
        </p>
      </div>
      <div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <h5 class="font-bold text-gray-800 text-sm mb-2 uppercase tracking-wide">Service Items</h5>
        <p class="text-xs leading-relaxed text-gray-600">
          The system supports non-tangible <strong>Service Lines</strong> (repair, labor, consulting). 
          These use SAC codes instead of HSN and do not affect physical stock levels, 
          while still contributing to invoice totals and tax reporting.
        </p>
      </div>
    </div>
  </section>

  <!-- Process: Procurement -->
  <section class="bg-white rounded-xl border border-blue-100 overflow-hidden">
    <div class="bg-blue-600 px-4 py-3 text-white">
      <h4 class="font-black text-sm uppercase tracking-[0.15em]">Inward Supply (Purchase)</h4>
    </div>
    <div class="p-4">
      <div class="space-y-4">
        <div class="flex gap-4">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-sm">1</div>
          <div>
            <p class="font-bold text-sm text-gray-900">Supplier & Location Selection</p>
            <p class="text-xs text-gray-600">Select the supplier and their primary/secondary GSTIN location. The system auto-detects <strong>Intra-state (Local)</strong> vs <strong>Inter-state (Out of State)</strong> based on your firm's selected GSTIN.</p>
          </div>
        </div>
        <div class="flex gap-4">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-sm">2</div>
          <div>
            <p class="font-bold text-sm text-gray-900">Stock Addition & Batch Creation</p>
            <p class="text-xs text-gray-600">Add SKUs to the cart. For each item, you must specify the <strong>Batch ID</strong>. If it's a new batch, the system creates it; if existing, it increments the quantity upon posting.</p>
          </div>
        </div>
        <div class="flex gap-4">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-sm">3</div>
          <div>
            <p class="font-bold text-sm text-gray-900">Financial Vouching</p>
            <p class="text-xs text-gray-600">Submission generates a <strong>PUR</strong> voucher in the ledger. It automatically debits the Purchase/Inventory account and credits the Supplier/Cash account including calculated GST.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Process: Sales -->
  <section class="bg-white rounded-xl border border-rose-100 overflow-hidden">
    <div class="bg-rose-600 px-4 py-3 text-white">
      <h4 class="font-black text-sm uppercase tracking-[0.15em]">Outward Supply (Sales)</h4>
    </div>
    <div class="p-4">
      <div class="space-y-4">
        <div class="flex gap-4">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-black text-sm">1</div>
          <div>
            <p class="font-bold text-sm text-gray-900">Tax-Smart Customer Selection</p>
            <p class="text-xs text-gray-600">Upon selecting a customer, the system retrieves their <strong>State Code</strong>. It instantly switches the tax engine between CGST+SGST and IGST to ensure compliance with GST rules.</p>
          </div>
        </div>
        <div class="flex gap-4">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-black text-sm">2</div>
          <div>
            <p class="font-bold text-sm text-gray-900">Batch Picking & Inventory Lock</p>
            <p class="text-xs text-gray-600">Use the <strong>Batch Selection Modal</strong> to pick from available stock. The system prevents "over-selling" by validating quantities across specific batches in real-time.</p>
          </div>
        </div>
        <div class="flex gap-4">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-black text-sm">3</div>
          <div>
            <p class="font-bold text-sm text-gray-900">Sequential Invoicing</p>
            <p class="text-xs text-gray-600">Each sale generates an <strong>SLS</strong> bill with automatic sequence numbering. The system supports <strong>B2B</strong> (with GSTIN) and <strong>B2C</strong> invoices seamlessly.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Returns & Corrections -->
  <section>
    <h4 class="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
      <span class="w-1.5 h-6 bg-amber-500 rounded-full"></span>
      Returns & Financial Adjustments
    </h4>
    <div class="space-y-3">
      <div class="p-4 bg-amber-50 rounded-xl border border-amber-200">
        <div class="flex justify-between items-center mb-2">
          <span class="font-bold text-sm text-amber-900">Debit Notes (Purchase Returns)</span>
          <span class="bg-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">RETURN MODE</span>
        </div>
        <p class="text-xs text-gray-700 leading-relaxed">
          Open an existing Purchase Bill in <strong>Return Mode</strong>. Specify return quantities for specific batches. 
          The system will decrement stock and post a reversal to the ledger.
        </p>
      </div>
      <div class="p-4 bg-amber-50 rounded-xl border border-amber-200">
        <div class="flex justify-between items-center mb-2">
          <span class="font-bold text-sm text-amber-900">Credit Notes (Sales Returns)</span>
          <span class="bg-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">RETURN MODE</span>
        </div>
        <p class="text-xs text-gray-700 leading-relaxed">
          Select a Sales Invoice to process a return. This increases physical stock back into the original 
          batches and adjusts the customer's ledger balance automatically.
        </p>
      </div>
    </div>
  </section>

  <!-- Technical Features -->
  <section class="bg-slate-800 rounded-2xl p-6 text-white shadow-xl">
    <h4 class="font-black text-sm uppercase tracking-[0.2em] text-slate-400 mb-4">Advanced Features Checklist</h4>
    <ul class="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 text-xs">
      <li class="flex items-center gap-2">
        <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
        Automated Round Off (ROF) Calculation
      </li>
      <li class="flex items-center gap-2">
        <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
        Multi-Location GSTR1 Support
      </li>
      <li class="flex items-center gap-2">
        <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
        HSN/SAC Validation Engines
      </li>
      <li class="flex items-center gap-2">
        <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
        Item-wise Narration & Metadata
      </li>
      <li class="flex items-center gap-2">
        <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
        Reverse Charge (RCM) Flagging
      </li>
      <li class="flex items-center gap-2">
        <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
        PDF Export with Thermal/A4 layouts
      </li>
    </ul>
  </section>

  <!-- Help Footer -->
  <div class="bg-gray-100 rounded-lg p-3 text-[10px] text-gray-500 text-center">
    Use <kbd class="px-1 border border-gray-300 rounded bg-white">F2</kbd>, <kbd class="px-1 border border-gray-300 rounded bg-white">F3</kbd>, and <kbd class="px-1 border border-gray-300 rounded bg-white">F4</kbd> within the Purchase/Sales modules for high-speed data entry.
  </div>
</div>
`;
