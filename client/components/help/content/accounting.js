export const content = `
<div class="space-y-8 text-gray-700">
  <!-- Header -->
  <div class="border-b border-gray-200 pb-6">
    <div class="flex items-center gap-3 mb-2">
      <div class="p-2 bg-indigo-600 rounded-lg text-white shadow-lg">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
      </div>
      <h3 class="text-3xl font-black text-gray-900 tracking-tight">Accounting & Financials</h3>
    </div>
    <p class="text-sm leading-relaxed text-gray-500 max-w-3xl">
      A comprehensive financial operating system built on <strong>pure double-entry bookkeeping</strong> principles. 
      It handles the entire lifecycle from transaction capture and automated module posting to complex financial statement derivation.
    </p>
  </div>

  <!-- 1. The Ledger Architecture -->
  <section>
    <div class="flex items-center gap-2 mb-4">
      <span class="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase rounded tracking-widest">Architecture</span>
      <h4 class="text-xl font-bold text-gray-900">Double-Entry Foundation</h4>
    </div>
    <p class="text-xs text-gray-600 mb-4 leading-relaxed">
      Every transaction in the system creates at least two ledger entries—a <strong>Debit</strong> and a <strong>Credit</strong>. 
      This ensures the fundamental accounting equation (<em>Assets = Liabilities + Equity</em>) is maintained in real-time.
    </p>
    <div class="grid md:grid-cols-3 gap-4">
      <div class="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
        <h5 class="text-[10px] font-black text-indigo-600 uppercase mb-2">Account Heads</h5>
        <p class="text-[11px] text-gray-500 leading-relaxed">Specific named buckets (e.g., "HDFC Bank", "ACME Corp", "Rent Expense") where balances accumulate.</p>
      </div>
      <div class="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
        <h5 class="text-[10px] font-black text-indigo-600 uppercase mb-2">Account Types</h5>
        <p class="text-[11px] text-gray-500 leading-relaxed">Categorizations (ASSET, LIABILITY, INCOME, EXPENSE) that determine how the head behaves in financial reports.</p>
      </div>
      <div class="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
        <h5 class="text-[10px] font-black text-indigo-600 uppercase mb-2">Voucher Groups</h5>
        <p class="text-[11px] text-gray-500 leading-relaxed">Atomic IDs that link related debits and credits, ensuring a transaction can never be "half-saved".</p>
      </div>
    </div>
  </section>

  <!-- 2. Automated Posting Logic -->
  <section class="bg-slate-50 rounded-[24px] p-6 border border-slate-200">
    <h4 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
      <svg class="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>
      Automated Integration Flows
    </h4>
    <div class="space-y-4">
      <!-- Sales Posting -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="flex justify-between items-start mb-2">
          <span class="font-black text-xs text-slate-800">Sales Module Posting (SLS)</span>
          <span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Real-time</span>
        </div>
        <div class="grid grid-cols-2 gap-4 text-[11px]">
          <div class="space-y-1">
            <p class="text-blue-600 font-bold">Debit (+)</p>
            <p class="text-gray-500">Party Account (Total Invoice Value)</p>
          </div>
          <div class="space-y-1">
            <p class="text-rose-600 font-bold">Credit (-)</p>
            <p class="text-gray-500">Sales A/c (Base Value)<br>GST Output A/cs (Tax Value)</p>
          </div>
        </div>
      </div>
      <!-- Purchase Posting -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="flex justify-between items-start mb-2">
          <span class="font-black text-xs text-slate-800">Purchase Module Posting (PUR)</span>
          <span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Real-time</span>
        </div>
        <div class="grid grid-cols-2 gap-4 text-[11px]">
          <div class="space-y-1">
            <p class="text-blue-600 font-bold">Debit (+)</p>
            <p class="text-gray-500">Purchase A/c (Base Value)<br>GST Input A/cs (Tax Value)</p>
          </div>
          <div class="space-y-1">
            <p class="text-rose-600 font-bold">Credit (-)</p>
            <p class="text-gray-500">Supplier A/c (Total Bill Value)</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 3. Manual Voucher Management -->
  <section>
    <h4 class="text-lg font-bold text-gray-900 mb-4">Operational Vouchers</h4>
    <div class="grid sm:grid-cols-2 gap-4">
      <!-- Receipt/Payment -->
      <div class="p-5 border border-gray-200 rounded-2xl hover:border-indigo-300 transition-colors">
        <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
        </div>
        <h5 class="font-black text-sm text-gray-800 mb-2">Cash & Bank (RCP/PAY)</h5>
        <p class="text-xs text-gray-500 leading-relaxed">Used for direct monetary movements. <strong>Receipts</strong> capture incoming funds (Dr Bank/Cash), and <strong>Payments</strong> capture outgoing expenses or party settlements (Cr Bank/Cash).</p>
      </div>
      <!-- Journal Entries -->
      <div class="p-5 border border-gray-200 rounded-2xl hover:border-violet-300 transition-colors">
        <div class="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center mb-3">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </div>
        <h5 class="font-black text-sm text-gray-800 mb-2">Journals (JRN)</h5>
        <p class="text-xs text-gray-500 leading-relaxed">The "Swiss Army Knife" of accounting. Used for adjustments, multi-ledger splits, depreciation, and closing entries where no actual cash is moved.</p>
      </div>
    </div>
  </section>

  <!-- 4. Financial Statements & Analysis -->
  <section class="space-y-6">
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h4 class="font-black text-sm uppercase tracking-widest text-gray-900">Advanced Reporting Engine</h4>
      </div>
      <div class="p-6 space-y-6">
        <!-- P&L Logic -->
        <div class="flex gap-4">
          <div class="shrink-0 text-indigo-600 font-black text-lg">P&L</div>
          <div class="space-y-2">
            <p class="font-bold text-sm text-gray-900">Profit & Loss Calculation Logic</p>
            <ul class="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li><strong>Gross Profit:</strong> Derived by mapping accounts marked as <code>INCOME</code> vs <code>COGS</code>.</li>
              <li><strong>Operating Margin:</strong> Calculated by aggregating <code>EXPENSE</code> type accounts.</li>
              <li><strong>Net Profit:</strong> Final surplus/deficit after non-operating income and general adjustments.</li>
            </ul>
          </div>
        </div>
        <!-- Trial Balance -->
        <div class="flex gap-4">
          <div class="shrink-0 text-emerald-600 font-black text-lg">T/B</div>
          <div class="space-y-2">
            <p class="font-bold text-sm text-gray-900">Real-time Trial Balance Validation</p>
            <p class="text-xs text-gray-600 leading-relaxed">
              The system scans every account head and aggregates their <strong>Net Dr</strong> or <strong>Net Cr</strong> position. 
              A balanced Trial Balance is the ultimate proof of transactional integrity.
            </p>
          </div>
        </div>
        <!-- Balance Sheet -->
        <div class="flex gap-4">
          <div class="shrink-0 text-amber-600 font-black text-lg">B/S</div>
          <div class="space-y-2">
            <p class="font-bold text-sm text-gray-900">Balance Sheet Derivation</p>
            <p class="text-xs text-gray-600 leading-relaxed">
              Dynamically groups <code>ASSET</code> and <code>LIABILITY</code> accounts. 
              The Current Period's Net Profit is automatically injected into the Equity/Capital section to maintain the balance.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 5. Advanced Audit & Compliance -->
  <section class="bg-indigo-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
    <div class="absolute -right-10 -bottom-10 opacity-10">
      <svg class="w-64 h-64" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2H7a1 1 0 100-2h.01zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>
    </div>
    <div class="relative z-10">
      <h4 class="font-black text-xs uppercase tracking-[0.3em] text-indigo-300 mb-6">Expert Integrity Controls</h4>
      <div class="grid md:grid-cols-2 gap-8">
        <div>
          <h5 class="font-bold text-sm mb-2 text-white">Full Transaction Reversals</h5>
          <p class="text-[11px] text-indigo-100/70 leading-relaxed">
            The system forbids "ghost deletions". Modifying a posted bill triggers a <strong>Contra-Entry</strong> flow, 
            ensuring the original audit trail remains intact for tax inspections and internal reviews.
          </p>
        </div>
        <div>
          <h5 class="font-bold text-sm mb-2 text-white">Sequential Integrity</h5>
          <p class="text-[11px] text-indigo-100/70 leading-relaxed">
            Every voucher belongs to a strict <strong>Voucher Sequence</strong>. The system prevents backdated 
            entries from creating numbering gaps, ensuring compliance with standard accounting practices.
          </p>
        </div>
        <div>
          <h5 class="font-bold text-sm mb-2 text-white">Ledger Drilling</h5>
          <p class="text-[11px] text-indigo-100/70 leading-relaxed">
            From the high-level P&L or Trial Balance, users can "drill down" directly into the <strong>General Ledger</strong> 
            of any account head to see the constituent transactions and original vouchers.
          </p>
        </div>
        <div>
          <h5 class="font-bold text-sm mb-2 text-white">Opening Balance Control</h5>
          <p class="text-[11px] text-indigo-100/70 leading-relaxed">
            Supports precise migration from legacy systems via <strong>Opening Balance Vouchers</strong>, 
            establishing the ground truth for all subsequent financial years.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- Help Footer -->
  <div class="text-center pb-4">
    <p class="text-[10px] text-gray-400 font-medium italic">
      Professional Accounting Note: All taxes (CGST, SGST, IGST) are tracked in dedicated ledger heads under 'Duties & Taxes' for easy GSTR-3B reconciliation.
    </p>
  </div>
</div>
`;
