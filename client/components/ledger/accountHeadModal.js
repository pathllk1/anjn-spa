import { openCreatePartyModal } from '../inventory/prs/partyCreate.js';

export function openAccountHeadModal(onAccountSaved) {
  const subModal = document.getElementById('sub-modal-backdrop');
  const subContent = document.getElementById('sub-modal-content');
  if (!subModal || !subContent) return;

  subModal.classList.remove('hidden');

  subContent.innerHTML = `
    <div class="flex flex-col h-full max-h-[85vh]">
      <!-- Header with Tabs -->
      <div class="bg-slate-900 px-6 pt-6 pb-0">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-white font-black tracking-tight text-lg">QUICK ADD ACCOUNT</h3>
          <button id="close-account-modal" class="text-slate-400 hover:text-white transition-colors text-2xl">&times;</button>
        </div>
        
        <div class="flex gap-1">
          <button id="tab-gl" class="px-6 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-t-xl bg-white text-slate-900 border-b-0">
            General Ledger
          </button>
          <button id="tab-party" class="px-6 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-t-xl bg-slate-800 text-slate-400 hover:bg-slate-700">
            Business Party
          </button>
        </div>
      </div>

      <!-- Content Area -->
      <div id="modal-body-container" class="flex-1 overflow-y-auto bg-white p-8">
        <!-- Default: GL Form -->
        <form id="gl-account-form" class="space-y-6">
          <div class="space-y-2">
            <label class="block text-xs font-black uppercase tracking-widest text-slate-400">Account Name *</label>
            <input type="text" name="account_head" required 
                   class="w-full px-4 py-3 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none transition font-bold text-slate-700" 
                   placeholder="e.g. Office Rent, Salary, Staff Welfare">
          </div>
          
          <div class="space-y-2">
            <label class="block text-xs font-black uppercase tracking-widest text-slate-400">Account Category *</label>
            <select name="account_type" required 
                    class="w-full px-4 py-3 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none transition font-bold text-slate-700">
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
              <option value="ASSET">Asset</option>
              <option value="LIABILITY">Liability</option>
              <option value="GENERAL">General Ledger</option>
            </select>
          </div>

          <div class="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
            <p class="text-[10px] font-bold text-emerald-700 leading-relaxed uppercase tracking-tight">
              Use this for generic ledger heads that don't require GST or address tracking. 
              Common for Expenses, Incomes, and internal transfers.
            </p>
          </div>

          <div class="pt-4 flex justify-end gap-3">
             <button type="button" id="cancel-account-modal" class="px-6 py-3 rounded-xl bg-slate-50 text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition">Cancel</button>
             <button type="submit" class="px-8 py-3 rounded-xl bg-emerald-600 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition">Save Account</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const close = () => subModal.classList.add('hidden');
  document.getElementById('close-account-modal').onclick = close;
  document.getElementById('cancel-account-modal').onclick = close;

  const tabGL = document.getElementById('tab-gl');
  const tabParty = document.getElementById('tab-party');
  const container = document.getElementById('modal-body-container');

  tabGL.onclick = () => {
    tabGL.className = "px-6 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-t-xl bg-white text-slate-900";
    tabParty.className = "px-6 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-t-xl bg-slate-800 text-slate-400 hover:bg-slate-700";
    openAccountHeadModal(onAccountSaved); // Simple re-render for this task
  };

  tabParty.onclick = () => {
    close();
    openCreatePartyModal({}, onAccountSaved);
  };

  document.getElementById('gl-account-form').onsubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    close();
    // Return the virtual "new account" head
    onAccountSaved({
      firm: data.account_head,
      account_head: data.account_head,
      account_type: data.account_type,
      is_gl: true
    });
  };
}
