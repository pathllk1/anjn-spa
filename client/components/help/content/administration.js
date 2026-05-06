export const content = `
<div class="space-y-6 text-gray-700">
  <!-- Header -->
  <div class="border-b border-gray-200 pb-4">
    <h3 class="text-2xl font-black text-gray-900">System Administration</h3>
    <p class="mt-2 text-sm leading-relaxed text-gray-600">
      The <strong>Super Admin</strong> portal is the central command center for multi-firm management, 
      user access controls, and core system diagnostics.
    </p>
  </div>

  <!-- Management Modules -->
  <section>
    <div class="grid md:grid-cols-2 gap-4">
      <div class="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div class="flex items-center gap-3 mb-3">
          <div class="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          </div>
          <h4 class="font-bold text-sm text-gray-900">Firm Management</h4>
        </div>
        <p class="text-[11px] text-gray-600 leading-relaxed">
          Create and configure multiple business entities. Each firm maintains its own 
          <strong>GSTIN locations</strong>, <strong>bank accounts</strong>, and <strong>financial periods</strong>.
        </p>
      </div>
      <div class="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div class="flex items-center gap-3 mb-3">
          <div class="p-2 bg-teal-100 text-teal-600 rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 01-9-3.75M13.714 8.644a4 4 0 11-7.428 0m3.714 2.422V10m0 0v1.5m0-1.5h1.5m-1.5 0h-1.5"/></svg>
          </div>
          <h4 class="font-bold text-sm text-gray-900">User Governance</h4>
        </div>
        <p class="text-[11px] text-gray-600 leading-relaxed">
          Manage user lifecycles including approvals, role assignments (Admin, User), 
          and cross-firm accessibility permissions.
        </p>
      </div>
    </div>
  </section>

  <!-- Special Tools -->
  <section class="bg-slate-900 rounded-2xl p-6 text-white overflow-hidden relative">
    <div class="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
      <svg class="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3 2a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 4a1 1 0 100 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
    </div>
    <h4 class="font-black text-xs uppercase tracking-[0.2em] text-slate-400 mb-4">Diagnostics & DB Controls</h4>
    <div class="space-y-4">
      <div class="border-l-2 border-indigo-500 pl-4">
        <h5 class="text-xs font-bold text-indigo-400">Database Browser</h5>
        <p class="text-[10px] text-slate-400 mt-1">Direct read-only access to MongoDB collections for verifying data integrity and troubleshooting synchronization issues.</p>
      </div>
      <div class="border-l-2 border-teal-500 pl-4">
        <h5 class="text-xs font-bold text-teal-400">Firm Assignment Matrix</h5>
        <p class="text-[10px] text-slate-400 mt-1">A visual grid to link users to multiple firms. Crucial for accountants or managers overseeing multiple business units.</p>
      </div>
      <div class="border-l-2 border-rose-500 pl-4">
        <h5 class="text-xs font-bold text-rose-400">Password Recovery</h5>
        <p class="text-[10px] text-slate-400 mt-1">Force-update user passwords in emergency scenarios or during first-time system onboarding.</p>
      </div>
    </div>
  </section>

  <!-- Security Audit -->
  <section>
    <div class="p-4 bg-gray-50 rounded-xl border border-gray-200">
      <h4 class="text-sm font-bold text-gray-900 mb-2">Audit Logs & Signals</h4>
      <p class="text-[11px] text-gray-600 leading-relaxed">
        The system tracks key administrative actions including firm creation, user role changes, 
        and database modifications. Real-time counters show active vs pending user status.
      </p>
    </div>
  </section>
</div>
`;
