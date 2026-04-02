import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { fetchWithCSRF } from '../utils/api.js';

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

function showToast(message, type = 'info') {
  // Simple toast notification
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 px-4 py-2 rounded-lg text-white text-sm font-bold z-50 ${
    type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500'
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function formatPowerfulGSTINAddress(partyData) {
  if (!partyData?.place_of_business_principal) return '';
  const addr = partyData.place_of_business_principal.address;
  if (!addr) return '';
  return [addr.door_num, addr.building_name, addr.floor_num,
          addr.street, addr.location, addr.city, addr.district]
      .filter(p => p && String(p).trim())
      .join(', ');
}

function extractPowerfulGSTINPinCode(partyData) {
  if (!partyData?.place_of_business_principal) return '';
  const addr = partyData.place_of_business_principal.address;
  if (!addr?.pin_code) return '';
  const pinStr = addr.pin_code.toString().trim();
  return /^\d{6}$/.test(pinStr) ? pinStr : '';
}

function populatePartyFromGSTData(partyData, gstin) {
  const displayName = partyData.trade_name || partyData.legal_name || '';
  if (!displayName) {
    showToast('No valid company name found in API response.', 'error');
    return;
  }

  const address   = formatPowerfulGSTINAddress(partyData) || '';
  const pinCode   = extractPowerfulGSTINPinCode(partyData) || '';
  let   stateName = partyData.place_of_business_principal?.address?.state
                 || partyData.state_jurisdiction
                 || '';
  stateName = String(stateName).trim();
  if (stateName.includes(' - ')) stateName = stateName.split(' - ')[0].trim();

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('edit-party-firm',  displayName);
  set('edit-party-addr',  address);
  set('edit-party-state', stateName);
  set('edit-party-pin',   pinCode);
  if (gstin?.length >= 2)  set('edit-party-state-code', gstin.substring(0, 2));
  if (gstin?.length >= 12) set('edit-party-pan',         gstin.substring(2, 12));
}

async function fetchPartyByGSTEdit(buttonElement) {
  const gstinInput = document.getElementById('edit-party-gstin');
  const gstin      = gstinInput?.value?.trim();

  if (!gstin || gstin.length !== 15) {
    showToast('Please enter a valid 15-character GSTIN', 'error');
    return;
  }

  const originalText       = buttonElement.innerHTML;
  buttonElement.innerHTML  = '⏳';
  buttonElement.disabled   = true;

  try {
    const response = await fetchWithCSRF('/api/inventory/sales/gst-lookup', {
      method: 'POST',
      body:   JSON.stringify({ gstin }),
    });

    if (!response.ok) {
      const error = await response.json();
      showToast(error.error || `Failed (${response.status})`, 'error');
      return;
    }

    const data = await response.json();
    if (!data.success) {
      showToast(data.error || 'Failed to fetch GST details', 'error');
      return;
    }

    populatePartyFromGSTData(data.data || data, gstin);
    buttonElement.innerHTML = '✔';
    setTimeout(() => { buttonElement.innerHTML = originalText; }, 1500);

  } catch (error) {
    console.error('GST Lookup Error:', error);
    showToast('Failed to fetch details. ' + (error.message || 'Server error'), 'error');
    buttonElement.innerHTML = originalText;
  } finally {
    buttonElement.disabled = false;
  }
}

export async function renderInventorySuppliers(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const content = `
    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Manage Parties</h1>
          <p class="text-gray-600 mt-1">View, edit, and manage all your suppliers and customers</p>
        </div>
        <button id="btn-create-new-party" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          New Party
        </button>
      </div>

      <div class="bg-white rounded-lg shadow">
        <div class="p-4 border-b border-gray-200 flex gap-3">
          <input type="text" id="party-search-input" placeholder="Search by name or GSTIN..." 
                 class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none">
          <select id="party-type-filter" class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none">
            <option value="">All Types</option>
            <option value="single">Single GSTIN</option>
            <option value="multi">Multi-GSTIN</option>
          </select>
        </div>

        <div id="parties-container" class="divide-y divide-gray-200">
          <div class="p-8 text-center text-gray-500">
            <div class="inline-block p-3 bg-gray-100 rounded-full mb-3">
              <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <p>Loading parties...</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Party Modal -->
    <div id="edit-party-modal-backdrop" class="hidden fixed inset-0 bg-black bg-opacity-50 z-40"></div>
    <div id="edit-party-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div id="edit-party-modal-content"></div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div id="delete-confirm-modal-backdrop" class="hidden fixed inset-0 bg-black bg-opacity-50 z-40"></div>
    <div id="delete-confirm-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-sm w-full">
        <div id="delete-confirm-modal-content"></div>
      </div>
    </div>
  `;

  renderLayout(content, router);
  await initPartyManagement();
}

async function initPartyManagement() {
  let allParties = [];

  await loadParties();

  document.getElementById('btn-create-new-party')?.addEventListener('click', () => {
    openCreatePartyModal();
  });

  document.getElementById('party-search-input')?.addEventListener('input', () => {
    filterAndRenderParties();
  });

  document.getElementById('party-type-filter')?.addEventListener('change', () => {
    filterAndRenderParties();
  });

  async function loadParties() {
    try {
      const response = await fetchWithCSRF('/api/inventory/sales/parties', { method: 'GET' });
      if (!response.ok) throw new Error('Failed to load parties');
      const data = await response.json();
      allParties = Array.isArray(data) ? data : (data.data || []);
      filterAndRenderParties();
    } catch (err) {
      console.error('Error loading parties:', err);
      const container = document.getElementById('parties-container');
      if (container) {
        container.innerHTML = `<div class="p-8 text-center text-red-600">Failed to load parties: ${err.message}</div>`;
      }
    }
  }

  function filterAndRenderParties() {
    const searchTerm = document.getElementById('party-search-input')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('party-type-filter')?.value || '';

    let filtered = allParties.filter(party => {
      const matchesSearch = !searchTerm || 
        party.firm.toLowerCase().includes(searchTerm) || 
        (party.gstin && party.gstin.toLowerCase().includes(searchTerm));
      
      const isMultiGst = Array.isArray(party.gstLocations) && party.gstLocations.length > 0;
      const matchesType = !typeFilter || 
        (typeFilter === 'multi' && isMultiGst) || 
        (typeFilter === 'single' && !isMultiGst);

      return matchesSearch && matchesType;
    });

    renderPartyList(filtered);
  }

  function renderPartyList(parties) {
    const container = document.getElementById('parties-container');
    if (!container) return;

    if (parties.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-gray-500">
          <svg class="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
          </svg>
          <p class="text-lg font-medium">No parties found</p>
          <p class="text-sm mt-1">Create a new party to get started</p>
        </div>
      `;
      return;
    }

    container.innerHTML = parties.map(party => {
      const isMultiGst = Array.isArray(party.gstLocations) && party.gstLocations.length > 0;
      const gstinDisplay = isMultiGst 
        ? `<span class="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded border border-blue-200">Multi-GST (${party.gstLocations.length})</span>`
        : `<span class="bg-gray-100 text-gray-700 text-xs font-mono px-2 py-1 rounded border border-gray-200">${party.gstin || 'UNREGISTERED'}</span>`;

      return `
        <div class="p-4 hover:bg-gray-50 transition flex justify-between items-start">
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-gray-900 truncate">${escapeHtml(party.firm)}</h3>
            <div class="flex items-center gap-2 mt-2 flex-wrap">
              ${gstinDisplay}
              ${party.state ? `<span class="text-xs text-gray-600">${escapeHtml(party.state)}</span>` : ''}
            </div>
            ${party.addr ? `<p class="text-xs text-gray-500 mt-2 truncate">${escapeHtml(party.addr)}</p>` : ''}
            ${isMultiGst ? `<p class="text-xs text-gray-500 mt-1">GSTINs: ${party.gstLocations.map(l => l.gstin).join(', ')}</p>` : ''}
          </div>
          <div class="flex gap-2 ml-4 flex-shrink-0">
            <button class="btn-edit-party px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-bold rounded transition" data-party-id="${party._id}">
              Edit
            </button>
            <button class="btn-delete-party px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded transition" data-party-id="${party._id}">
              Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-edit-party').forEach(btn => {
      btn.addEventListener('click', () => {
        const partyId = btn.dataset.partyId;
        const party = allParties.find(p => p._id === partyId);
        if (party) openEditPartyModal(party, loadParties);
      });
    });

    container.querySelectorAll('.btn-delete-party').forEach(btn => {
      btn.addEventListener('click', () => {
        const partyId = btn.dataset.partyId;
        const party = allParties.find(p => p._id === partyId);
        if (party) openDeleteConfirmModal(party, loadParties);
      });
    });
  }
}

function openCreatePartyModal() {
  const { openCreatePartyModal: openCreateModal } = require('../components/inventory/sls/partyCreate.js');
  openCreateModal({}, async () => {
    location.reload();
  });
}

async function openEditPartyModal(party, onSave) {
  const modal = document.getElementById('edit-party-modal');
  const backdrop = document.getElementById('edit-party-modal-backdrop');
  const content = document.getElementById('edit-party-modal-content');

  if (!modal || !backdrop || !content) return;

  const isMultiGst = Array.isArray(party.gstLocations) && party.gstLocations.length > 0;

  content.innerHTML = `
    <div class="bg-gradient-to-r from-slate-800 to-slate-700 p-4 flex justify-between items-center text-white">
      <div>
        <h3 class="font-bold text-sm tracking-wide">EDIT PARTY</h3>
        <p class="text-slate-400 text-[10px] mt-0.5">Update party details and GST locations</p>
      </div>
      <button id="close-edit-modal" class="hover:text-red-300 text-xl transition-colors w-7 h-7 flex items-center justify-center">&times;</button>
    </div>

    <form id="edit-party-form" class="p-5 grid grid-cols-2 gap-x-5 gap-y-3.5 overflow-y-auto max-h-[calc(90vh-120px)]">
      <div class="col-span-2">
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Firm Name *</label>
        <input type="text" name="firm" value="${escapeHtml(party.firm)}" required
               class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
               id="edit-party-firm">
      </div>

      <div class="col-span-2">
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Primary GSTIN</label>
        <div class="flex gap-2">
          <input type="text" name="gstin" value="${escapeHtml(party.gstin || '')}" maxlength="15"
                 class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none font-mono uppercase"
                 id="edit-party-gstin">
          <button type="button" id="btn-fetch-gst-edit"
                  class="shrink-0 bg-orange-500 hover:bg-orange-600 text-white px-3 rounded-lg text-xs font-bold shadow transition-colors min-w-[60px]">
            FETCH
          </button>
        </div>
        <p class="text-[10px] text-gray-400 mt-1">Click Fetch to auto-fill details from GST portal</p>
      </div>

      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Contact No</label>
        <input type="text" name="contact" value="${escapeHtml(party.contact || '')}"
               class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
               id="edit-party-contact">
      </div>

      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">State *</label>
        <input type="text" name="state" value="${escapeHtml(party.state || '')}" required
               class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
               id="edit-party-state">
      </div>

      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">State Code</label>
        <input type="text" name="state_code" value="${escapeHtml(party.state_code || '')}" maxlength="2" readonly
               class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 outline-none text-gray-400 cursor-not-allowed"
               id="edit-party-state-code">
      </div>

      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">PAN</label>
        <input type="text" name="pan" value="${escapeHtml(party.pan || '')}" maxlength="10"
               class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none uppercase font-mono"
               id="edit-party-pan">
      </div>

      <div class="col-span-2">
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Address</label>
        <textarea name="addr" rows="2" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none resize-none"
                  id="edit-party-addr">${escapeHtml(party.addr || '')}</textarea>
      </div>

      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Pincode</label>
        <input type="text" name="pin" value="${escapeHtml(party.pin || '')}"
               class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
               id="edit-party-pin">
      </div>

      <div class="col-span-2 pt-4 border-t border-gray-100">
        <div class="flex items-center justify-between mb-3">
          <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wide">GST Locations (Multi-GSTIN)</label>
          <button type="button" id="btn-add-gst-location" class="text-xs bg-green-500 hover:bg-green-600 text-white px-2.5 py-1 rounded font-bold transition-colors">
            + Add Location
          </button>
        </div>
        <div id="gst-locations-container" class="space-y-3 mb-4 max-h-48 overflow-y-auto"></div>
      </div>

      <div class="col-span-2 pt-4 border-t border-gray-100 flex justify-end gap-2 mt-1">
        <button type="button" id="cancel-edit-party" class="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-100 rounded-lg transition-colors">
          Cancel
        </button>
        <button type="submit" class="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors">
          Save Changes
        </button>
      </div>
    </form>
  `;

  modal.classList.remove('hidden');
  backdrop.classList.remove('hidden');

  const closeBtn = document.getElementById('close-edit-modal');
  const cancelBtn = document.getElementById('cancel-edit-party');
  const form = document.getElementById('edit-party-form');
  const gstinInput = document.getElementById('edit-party-gstin');
  const stateCodeInput = document.getElementById('edit-party-state-code');
  const stateInput = document.getElementById('edit-party-state');

  const closeModal = () => {
    modal.classList.add('hidden');
    backdrop.classList.add('hidden');
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);

  // GST Fetch Button Handler
  const fetchGstBtn = document.getElementById('btn-fetch-gst-edit');
  fetchGstBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    fetchPartyByGSTEdit(fetchGstBtn);
  });

  // Auto-detect State Code from GSTIN
  gstinInput?.addEventListener('input', (e) => {
    const val = e.target.value.toUpperCase();
    e.target.value = val;
    if (val.length >= 2 && /^\d{2}/.test(val)) {
      stateCodeInput.value = val.substring(0, 2);
    } else if (val.length < 2) {
      stateCodeInput.value = '';
    }
  });

  stateInput?.addEventListener('input', (e) => {
    const gstinVal = gstinInput?.value.trim() || '';
    if (gstinVal.length >= 2) return;
    const stateCodeMap = {
      'andhra pradesh': '28', 'arunachal pradesh': '12', 'assam': '18', 'bihar': '10',
      'chhattisgarh': '22', 'goa': '30', 'gujarat': '24', 'haryana': '06', 'himachal pradesh': '02',
      'jharkhand': '20', 'karnataka': '29', 'kerala': '32', 'madhya pradesh': '23', 'maharashtra': '27',
      'manipur': '14', 'meghalaya': '17', 'mizoram': '15', 'nagaland': '13', 'odisha': '21',
      'puducherry': '34', 'punjab': '03', 'rajasthan': '08', 'sikkim': '11', 'tamil nadu': '33',
      'telangana': '36', 'tripura': '16', 'uttar pradesh': '09', 'uttarakhand': '05', 'west bengal': '19',
      'delhi': '07', 'ladakh': '37', 'jammu and kashmir': '01', 'lakshadweep': '31', 'andaman and nicobar': '35'
    };
    const code = stateCodeMap[e.target.value.trim().toLowerCase()];
    stateCodeInput.value = code || '';
  });

  // Multi-GSTIN Location Management
  let gstLocations = isMultiGst ? [...party.gstLocations] : [];

  const renderGstLocations = () => {
    const container = document.getElementById('gst-locations-container');
    if (!container) return;

    if (gstLocations.length === 0) {
      container.innerHTML = '<p class="text-[10px] text-gray-400 italic">No additional locations. Click "+ Add Location" to add multi-GSTIN support.</p>';
      return;
    }

    container.innerHTML = gstLocations.map((loc, idx) => `
      <div class="border border-gray-200 rounded-lg p-2.5 bg-gray-50 space-y-2">
        <div class="flex justify-between items-start gap-2">
          <div class="flex-1 grid grid-cols-2 gap-2">
            <div>
              <label class="text-[9px] font-bold text-gray-500 uppercase">GSTIN</label>
              <div class="flex gap-1">
                <input type="text" value="${escapeHtml(loc.gstin || '')}" maxlength="15"
                       class="flex-1 border border-gray-300 rounded px-2 py-1 text-xs font-mono uppercase"
                       data-loc-idx="${idx}" data-loc-field="gstin">
                <button type="button" class="btn-fetch-location-gst text-xs bg-orange-500 hover:bg-orange-600 text-white px-1.5 rounded font-bold transition-colors"
                        data-loc-idx="${idx}" title="Fetch GST details">F</button>
              </div>
            </div>
            <div>
              <label class="text-[9px] font-bold text-gray-500 uppercase">State</label>
              <input type="text" value="${escapeHtml(loc.state || '')}"
                     class="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                     data-loc-idx="${idx}" data-loc-field="state">
            </div>
          </div>
          <button type="button" class="btn-remove-location text-red-500 hover:text-red-700 font-bold text-lg leading-none" data-loc-idx="${idx}">×</button>
        </div>
        <div>
          <label class="text-[9px] font-bold text-gray-500 uppercase">Address</label>
          <input type="text" value="${escapeHtml(loc.address || '')}"
                 class="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                 data-loc-idx="${idx}" data-loc-field="address">
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="text-[9px] font-bold text-gray-500 uppercase">City</label>
            <input type="text" value="${escapeHtml(loc.city || '')}"
                   class="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                   data-loc-idx="${idx}" data-loc-field="city">
          </div>
          <div>
            <label class="text-[9px] font-bold text-gray-500 uppercase">Pincode</label>
            <input type="text" value="${escapeHtml(loc.pincode || '')}"
                   class="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                   data-loc-idx="${idx}" data-loc-field="pincode">
          </div>
          <div>
            <label class="text-[9px] font-bold text-gray-500 uppercase">Contact</label>
            <input type="text" value="${escapeHtml(loc.contact || '')}"
                   class="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                   data-loc-idx="${idx}" data-loc-field="contact">
          </div>
        </div>
        <div>
          <label class="text-[9px] font-bold text-gray-500 uppercase">PAN</label>
          <input type="text" value="${escapeHtml(loc.pan || '')}" maxlength="10"
                 class="w-full border border-gray-300 rounded px-2 py-1 text-xs uppercase font-mono"
                 data-loc-idx="${idx}" data-loc-field="pan">
        </div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" ${loc.is_primary ? 'checked' : ''} class="location-primary-checkbox"
                 data-loc-idx="${idx}">
          <span class="text-[9px] font-bold text-gray-600">Mark as Primary</span>
        </label>
      </div>
    `).join('');

    container.querySelectorAll('[data-loc-field]').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.locIdx);
        const field = e.target.dataset.locField;
        gstLocations[idx][field] = e.target.value;
      });
    });

    // Use event delegation for GST fetch buttons
    container.addEventListener('click', async (e) => {
      if (!e.target.classList.contains('btn-fetch-location-gst')) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const btn = e.target;
      const idx = parseInt(btn.dataset.locIdx);
      const gstinInput = container.querySelector(`input[data-loc-idx="${idx}"][data-loc-field="gstin"]`);
      const gstin = gstinInput?.value?.trim();

      if (!gstin || gstin.length !== 15) {
        showToast('Please enter a valid 15-character GSTIN', 'error');
        return;
      }

      const originalText = btn.innerHTML;
      btn.innerHTML = '⏳';
      btn.disabled = true;

      try {
        const response = await fetchWithCSRF('/api/inventory/sales/gst-lookup', {
          method: 'POST',
          body: JSON.stringify({ gstin }),
        });

        if (!response.ok) {
          const error = await response.json();
          showToast(error.error || `Failed (${response.status})`, 'error');
          btn.innerHTML = originalText;
          btn.disabled = false;
          return;
        }

        const data = await response.json();
        if (!data.success) {
          showToast(data.error || 'Failed to fetch GST details', 'error');
          btn.innerHTML = originalText;
          btn.disabled = false;
          return;
        }

        const partyData = data.data || data;
        const addr = partyData.place_of_business_principal?.address || {};
        const address = [addr.door_num, addr.building_name, addr.floor_num, addr.street, addr.location, addr.city, addr.district]
          .filter(p => p && String(p).trim())
          .join(', ');
        const pinCode = addr.pin_code ? String(addr.pin_code).trim() : '';
        let stateName = partyData.place_of_business_principal?.address?.state || partyData.state_jurisdiction || '';
        stateName = String(stateName).trim();
        if (stateName.includes(' - ')) stateName = stateName.split(' - ')[0].trim();

        gstLocations[idx].state = stateName;
        gstLocations[idx].address = address;
        gstLocations[idx].pincode = pinCode;
        gstLocations[idx].state_code = gstin.substring(0, 2);
        if (gstin.length >= 12) {
          gstLocations[idx].pan = gstin.substring(2, 12);
        }

        renderGstLocations();
        btn.innerHTML = '✔';
        setTimeout(() => { btn.innerHTML = originalText; }, 1500);

      } catch (error) {
        console.error('GST Lookup Error:', error);
        showToast('Failed to fetch details. ' + (error.message || 'Server error'), 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });

    container.querySelectorAll('.location-primary-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.locIdx);
        gstLocations.forEach((loc, i) => {
          loc.is_primary = (i === idx);
        });
        renderGstLocations();
      });
    });

    container.querySelectorAll('.btn-remove-location').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(e.target.dataset.locIdx);
        gstLocations.splice(idx, 1);
        renderGstLocations();
      });
    });
  };

  document.getElementById('btn-add-gst-location')?.addEventListener('click', (e) => {
    e.preventDefault();
    gstLocations.push({
      gstin: '',
      state_code: '',
      state: '',
      address: '',
      city: '',
      pincode: '',
      contact: '',
      is_primary: gstLocations.length === 0,
    });
    renderGstLocations();
  });

  renderGstLocations();

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.supply = data.state;
    data.state_code = data.state_code ? data.state_code.toString().padStart(2, '0') : null;
    data.contact = data.contact || null;
    data.addr = data.addr || null;
    data.pin = data.pin || null;
    data.pan = data.pan || null;

    if (gstLocations.length > 0) {
      data.gstLocations = gstLocations.map(loc => ({
        gstin: loc.gstin || '',
        state: loc.state || '',
        address: loc.address || '',
        city: loc.city || '',
        pincode: loc.pincode || '',
        contact: loc.contact || '',
        is_primary: loc.is_primary || false,
      }));
    }

    try {
      const response = await fetchWithCSRF(`/api/inventory/sales/parties/${party._id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to update party');
        return;
      }

      closeModal();
      await onSave();
    } catch (err) {
      alert('Error updating party: ' + err.message);
    }
  });
}

async function openDeleteConfirmModal(party, onDelete) {
  const modal = document.getElementById('delete-confirm-modal');
  const backdrop = document.getElementById('delete-confirm-modal-backdrop');
  const content = document.getElementById('delete-confirm-modal-content');

  if (!modal || !backdrop || !content) return;

  content.innerHTML = `
    <div class="p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-2">Delete Party?</h3>
      <p class="text-gray-600 mb-4">
        Are you sure you want to delete <strong>${escapeHtml(party.firm)}</strong>? This action cannot be undone.
      </p>
      <div class="flex justify-end gap-3">
        <button id="cancel-delete" class="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-100 rounded-lg transition-colors">
          Cancel
        </button>
        <button id="confirm-delete" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors">
          Delete
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  backdrop.classList.remove('hidden');

  const closeModal = () => {
    modal.classList.add('hidden');
    backdrop.classList.add('hidden');
  };

  document.getElementById('cancel-delete')?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);

  document.getElementById('confirm-delete')?.addEventListener('click', async () => {
    try {
      const response = await fetchWithCSRF(`/api/inventory/sales/parties/${party._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to delete party');
        return;
      }

      closeModal();
      await onDelete();
    } catch (err) {
      alert('Error deleting party: ' + err.message);
    }
  });
}
