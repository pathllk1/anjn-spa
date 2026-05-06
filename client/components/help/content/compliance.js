export const content = `
<div class="space-y-6 text-gray-700">
  <!-- Header -->
  <div class="border-b border-gray-200 pb-4">
    <h3 class="text-2xl font-black text-gray-900">Tax Compliance & GSTR-1</h3>
    <p class="mt-2 text-sm leading-relaxed text-gray-600">
      Comprehensive GST reporting engine designed for 2024-2025 compliance. 
      Automates data aggregation across all 15 GSTR-1 tables.
    </p>
  </div>

  <!-- GSTR-1 Breakdown -->
  <section>
    <h4 class="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
      <span class="w-1.5 h-6 bg-blue-600 rounded-full"></span>
      GSTR-1 Table Coverage
    </h4>
    <div class="grid md:grid-cols-2 gap-4">
      <div class="bg-blue-50 p-4 rounded-xl border border-blue-200">
        <h5 class="font-bold text-blue-900 text-sm mb-1 uppercase tracking-wide">4A. B2B Invoices</h5>
        <p class="text-[11px] text-blue-800 leading-relaxed">Automatic capture of invoices issued to registered GSTIN holders, categorized by Place of Supply (POS).</p>
      </div>
      <div class="bg-blue-50 p-4 rounded-xl border border-blue-200">
        <h5 class="font-bold text-blue-900 text-sm mb-1 uppercase tracking-wide">5 & 7. B2C Supplies</h5>
        <p class="text-[11px] text-blue-800 leading-relaxed">Consolidated reporting for Large (B2CL) and Small (B2CS) supplies to unregistered persons.</p>
      </div>
      <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h5 class="font-bold text-slate-900 text-sm mb-1 uppercase tracking-wide">12. HSN Summary</h5>
        <p class="text-[11px] text-slate-800 leading-relaxed">Automated aggregation of item-wise HSN/SAC codes with quantity and taxable value summaries.</p>
      </div>
      <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h5 class="font-bold text-slate-900 text-sm mb-1 uppercase tracking-wide">13. Document Issued</h5>
        <p class="text-[11px] text-slate-800 leading-relaxed">Tracking of document number sequences (from/to) and cancellation counts for the filing period.</p>
      </div>
    </div>
  </section>

  <!-- Export & Validation -->
  <section class="bg-white rounded-xl border border-emerald-100 overflow-hidden shadow-sm">
    <div class="bg-emerald-600 px-4 py-3 text-white flex justify-between items-center">
      <h4 class="font-black text-sm uppercase tracking-[0.15em]">Validation & Government Portals</h4>
    </div>
    <div class="p-4 space-y-4">
      <div class="flex gap-4">
        <div class="shrink-0 w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-xs">A</div>
        <div>
          <p class="font-bold text-sm text-gray-900">Data Validation Engine</p>
          <p class="text-xs text-gray-600 leading-relaxed">Checks for missing GSTINs, invalid HSN formats, and tax calculation mismatches before you export.</p>
        </div>
      </div>
      <div class="flex gap-4">
        <div class="shrink-0 w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-xs">B</div>
        <div>
          <p class="font-bold text-sm text-gray-900">Multi-Format Export</p>
          <p class="text-xs text-gray-600 leading-relaxed">Download reports in <strong>JSON</strong> (for Offline Tool), <strong>Excel</strong> (for Audit), or <strong>CSV</strong> (for fast analysis).</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Returns & Adjustments -->
  <section>
    <h4 class="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
      <span class="w-1.5 h-6 bg-amber-500 rounded-full"></span>
      Amendments & Credit/Debit Notes
    </h4>
    <div class="p-4 bg-amber-50 rounded-xl border border-amber-200">
      <p class="text-xs text-amber-900 leading-relaxed">
        The compliance engine automatically tracks <strong>9B. Credit/Debit Notes</strong> issued against original invoices. 
        Amendment tables are populated if a previously filed document is modified in the current period.
      </p>
    </div>
  </section>

  <!-- Technical Note -->
  <div class="bg-gray-900 rounded-2xl p-5 text-white shadow-lg">
    <h5 class="font-black text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-2">Place of Supply (POS) Logic</h5>
    <p class="text-[11px] leading-relaxed text-gray-300">
      The system auto-determines POS based on the Party's state code. For Inter-state transactions, IGST is applied. 
      For Intra-state (Local) transactions, the tax is split into CGST and SGST.
    </p>
  </div>
</div>
`;
