import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { fetchWithCSRF } from '../utils/api.js';

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    console.error('Toast container not found!');
    return;
  }

  const toast = document.createElement('div');
  const typeClasses = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  };
  
  toast.className = `flex items-center p-4 mb-4 text-white ${typeClasses[type]} rounded-lg shadow-lg transform transition-all duration-300 ease-in-out`;
  toast.innerHTML = `
    <div class="ml-3 text-sm font-medium">${escapeHtml(message)}</div>
    <button type="button" class="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex h-8 w-8" aria-label="Close">
      <span class="sr-only">Close</span>
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
    </button>
  `;
  
  toast.querySelector('button').addEventListener('click', () => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  });
  
  toastContainer.appendChild(toast);

  setTimeout(() => {
    if(toast.parentElement){
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
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
    <div id="toast-container" class="fixed top-5 right-5 z-50"></div>
    <div class="bg-gray-50 min-h-screen p-4 sm:p-6 lg:p-8">
      <div class="max-w-7xl mx-auto">
        <header class="mb-8">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
              <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">Party Hub</h1>
              <p class="mt-1 text-sm text-gray-600">Centralized management for all your suppliers and customers.</p>
            </div>
            <button id="btn-create-new-party" class="mt-4 sm:mt-0 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-150 ease-in-out flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
              New Party
            </button>
          </div>
        </header>

        <div class="mb-6 bg-white p-4 rounded-xl shadow-md">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="sm:col-span-2">
              <label for="party-search-input" class="sr-only">Search</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg class="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"></path></svg>
                </div>
                <input type="text" id="party-search-input" placeholder="Search by name, GSTIN, or PAN..." 
                       class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
              </div>
            </div>
            <div>
              <label for="party-type-filter" class="sr-only">Filter by type</label>
              <select id="party-type-filter" class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                <option value="">All Party Types</option>
                <option value="single">Single GSTIN</option>
                <option value="multi">Multi-GSTIN</option>
                <option value="unregistered">Unregistered</option>
              </select>
            </div>
          </div>
        </div>

        <div id="parties-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <!-- Loading state -->
          <div class="p-8 text-center text-gray-500 col-span-full">
             <div class="inline-flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                   <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="text-lg font-medium text-gray-700">Loading Parties...</span>
             </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <div id="edit-party-modal-backdrop" class="hidden fixed inset-0 bg-black bg-opacity-60 z-40 transition-opacity"></div>
    <div id="edit-party-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 transition-transform transform scale-95">
      <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div id="edit-party-modal-content"></div>
      </div>
    </div>

    <div id="delete-confirm-modal-backdrop" class="hidden fixed inset-0 bg-black bg-opacity-60 z-40 transition-opacity"></div>
    <div id="delete-confirm-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 transition-transform transform scale-95">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div id="delete-confirm-modal-content"></div>
      </div>
    </div>

    <div id="sub-modal-backdrop" class="fixed inset-0 bg-black/60 hidden z-50 flex items-center justify-center backdrop-blur-sm transition-opacity">
      <div id="sub-modal-content" class="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-300 animate-scale-in"></div>
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
        container.innerHTML = `<div class="p-8 text-center text-red-600 col-span-full">${escapeHtml(err.message)}</div>`;
      }
    }
  }

  function filterAndRenderParties() {
    const searchTerm = document.getElementById('party-search-input')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('party-type-filter')?.value || '';

    let filtered = allParties.filter(party => {
      const matchesSearch = !searchTerm || 
        party.firm.toLowerCase().includes(searchTerm) || 
        (party.gstin && party.gstin.toLowerCase().includes(searchTerm)) ||
        (party.pan && party.pan.toLowerCase().includes(searchTerm));
      
      const isMultiGst = Array.isArray(party.gstLocations) && party.gstLocations.length > 0;
      const isUnregistered = !party.gstin && !isMultiGst;

      const matchesType = !typeFilter || 
        (typeFilter === 'multi' && isMultiGst) || 
        (typeFilter === 'single' && !isMultiGst && !isUnregistered) ||
        (typeFilter === 'unregistered' && isUnregistered);

      return matchesSearch && matchesType;
    });

    renderPartyList(filtered);
  }

  function renderPartyList(parties) {
    const container = document.getElementById('parties-container');
    if (!container) return;

    if (parties.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-16 px-4">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No parties found</h3>
          <p class="mt-1 text-sm text-gray-500">Get started by creating a new party.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = parties.map(party => {
      const isMultiGst = Array.isArray(party.gstLocations) && party.gstLocations.length > 0;
      const isUnregistered = !party.gstin && !isMultiGst;

      let gstinDisplay;
      if (isMultiGst) {
        gstinDisplay = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Multi-GST (${party.gstLocations.length})</span>`;
      } else if (isUnregistered) {
        gstinDisplay = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Unregistered</span>`;
      } else {
        gstinDisplay = `<span class="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">${escapeHtml(party.gstin)}</span>`;
      }

      return `
        <div class="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 ease-in-out overflow-hidden transform hover:-translate-y-1">
          <div class="p-5">
            <div class="flex justify-between items-start">
              <h3 class="font-bold text-lg text-gray-800 truncate pr-4" title="${escapeHtml(party.firm)}">${escapeHtml(party.firm)}</h3>
              ${gstinDisplay}
            </div>
            <p class="text-sm text-gray-500 mt-2 truncate" title="${escapeHtml(party.addr || '')}">${escapeHtml(party.addr || 'No address provided')}</p>
            <div class="mt-4 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <span class="text-xs text-gray-600">${escapeHtml(party.state || 'N/A')}</span>
              </div>
              ${party.pan ? `<span class="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded-md">${escapeHtml(party.pan)}</span>` : ''}
            </div>
          </div>
          <div class="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
            <button class="btn-edit-party text-sm font-medium text-indigo-600 hover:text-indigo-900 transition-colors" data-party-id="${party._id}">Edit</button>
            <button class="btn-delete-party text-sm font-medium text-red-600 hover:text-red-900 transition-colors" data-party-id="${party._id}">Delete</button>
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

import { openCreatePartyModal as openCreateModal } from '../components/inventory/sls/partyCreate.js';

function openCreatePartyModal() {
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
  
  content.classList.add('flex', 'flex-col', 'max-h-[90vh]');

  content.innerHTML = `
    <header class="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-3 flex justify-between items-center border-b border-indigo-100 rounded-t-lg flex-shrink-0">
      <div>
        <h3 class="font-bold text-base text-gray-900">Edit Party</h3>
        <p class="text-xs text-gray-500">Update details for ${escapeHtml(party.firm)}</p>
      </div>
      <button id="close-edit-modal" class="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none">&times;</button>
    </header>

    <form id="edit-party-form" class="flex-1 overflow-y-auto p-5">
      <!-- PRIMARY DETAILS SECTION -->
      <div class="space-y-3">
        <div>
          <label for="edit-party-firm" class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Firm Name *</label>
          <input type="text" name="firm" id="edit-party-firm" value="${escapeHtml(party.firm)}" required
                 class="mt-1.5 block w-full border border-gray-200 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition bg-white">
        </div>

        <div>
          <label for="edit-party-gstin" class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Primary GSTIN</label>
          <div class="mt-1.5 flex gap-1 rounded-lg overflow-hidden shadow-sm">
            <input type="text" name="gstin" id="edit-party-gstin" value="${escapeHtml(party.gstin || '')}" maxlength="15"
                   class="flex-1 block w-full border border-gray-200 py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition font-mono uppercase bg-white"
                   placeholder="27ABCDE1234F1Z5">
            <button type="button" id="btn-fetch-gst-edit"
                    class="px-3 py-2 border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 focus:ring-2 focus:ring-indigo-500 transition">
              Fetch
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="edit-party-contact" class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Contact</label>
            <input type="text" name="contact" id="edit-party-contact" value="${escapeHtml(party.contact || '')}"
                   class="mt-1.5 block w-full border border-gray-200 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition bg-white">
          </div>
          <div>
            <label for="edit-party-pan" class="text-xs font-semibold text-gray-700 uppercase tracking-wide">PAN</label>
            <input type="text" name="pan" id="edit-party-pan" value="${escapeHtml(party.pan || '')}" maxlength="10"
                   class="mt-1.5 block w-full border border-gray-200 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition font-mono uppercase bg-white">
          </div>
        </div>

        <div>
          <label for="edit-party-addr" class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Address</label>
          <textarea name="addr" id="edit-party-addr" rows="2" class="mt-1.5 block w-full border border-gray-200 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition resize-none bg-white">${escapeHtml(party.addr || '')}</textarea>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2">
            <label for="edit-party-state" class="text-xs font-semibold text-gray-700 uppercase tracking-wide">State *</label>
            <input type="text" name="state" id="edit-party-state" value="${escapeHtml(party.state || '')}" required
                   class="mt-1.5 block w-full border border-gray-200 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition bg-white">
          </div>
          <div>
            <label for="edit-party-pin" class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Pincode</label>
            <input type="text" name="pin" id="edit-party-pin" value="${escapeHtml(party.pin || '')}"
                   class="mt-1.5 block w-full border border-gray-200 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition bg-white">
          </div>
        </div>

        <input type="hidden" name="state_code" id="edit-party-state-code" value="${escapeHtml(party.state_code || '')}">
      </div>

      <!-- GST LOCATIONS SECTION -->
      <div class="pt-4 mt-4 border-t border-gray-200">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-xs font-semibold text-gray-900 uppercase tracking-wide">Additional GST Locations</h4>
          <button type="button" id="btn-add-gst-location"
                  class="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition">
            + Add
          </button>
        </div>
        <div id="gst-locations-container" class="space-y-3"></div>
      </div>
    </form>

    <footer class="bg-gray-50 px-5 py-3 flex justify-end gap-2 border-t border-gray-200 rounded-b-lg flex-shrink-0">
      <button type="button" id="cancel-edit-party"
              class="py-2 px-3 border border-gray-300 rounded-lg shadow-sm text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition">
        Cancel
      </button>
      <button type="submit" form="edit-party-form"
              class="py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition">
        Save Changes
      </button>
    </footer>
  `;

  modal.classList.remove('hidden');
  modal.classList.add('scale-100');
  backdrop.classList.remove('hidden');
  backdrop.classList.add('opacity-100');


  const closeModal = () => {
    modal.classList.remove('scale-100');
    backdrop.classList.remove('opacity-100');
    setTimeout(() => {
        modal.classList.add('hidden');
        backdrop.classList.add('hidden');
    }, 150);
  };

  document.getElementById('close-edit-modal')?.addEventListener('click', closeModal);
  document.getElementById('cancel-edit-party')?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);

  document.getElementById('btn-fetch-gst-edit')?.addEventListener('click', (e) => {
    e.preventDefault();
    fetchPartyByGSTEdit(e.currentTarget);
  });

  const gstinInput = document.getElementById('edit-party-gstin');
  const stateCodeInput = document.getElementById('edit-party-state-code');

  gstinInput?.addEventListener('input', (e) => {
    const val = e.target.value.toUpperCase();
    e.target.value = val;
    if (val.length >= 2 && /^\d{2}/.test(val)) {
      stateCodeInput.value = val.substring(0, 2);
    } else if (val.length < 2) {
      stateCodeInput.value = '';
    }
  });


  // Multi-GSTIN Location Management
  let gstLocations = isMultiGst ? JSON.parse(JSON.stringify(party.gstLocations)).map(loc => ({
    ...loc,
    pin: loc.pin || loc.pincode || '', // Normalize field name for backward compatibility
  })) : [];

  const renderGstLocations = () => {
    const container = document.getElementById('gst-locations-container');
    if (!container) return;

    if (gstLocations.length === 0) {
      container.innerHTML = '<p class="text-xs text-gray-500 italic text-center py-2">No additional GST locations.</p>';
      return;
    }

    container.innerHTML = gstLocations.map((loc, idx) => `
      <div class="border border-indigo-100 rounded-lg p-3 bg-gradient-to-br from-indigo-50 to-blue-50 relative hover:border-indigo-200 transition">
        <button type="button" class="btn-remove-location absolute top-2 right-2 text-gray-400 hover:text-red-500 text-lg transition" data-loc-idx="${idx}">&times;</button>
        
        <div class="space-y-2.5">
          <!-- GSTIN with Fetch -->
          <div>
            <label class="text-xs font-semibold text-gray-700 uppercase tracking-wide">GSTIN</label>
            <div class="mt-1 flex gap-1 rounded-lg overflow-hidden shadow-sm">
              <input type="text" value="${escapeHtml(loc.gstin || '')}" maxlength="15" 
                     class="flex-1 block w-full border border-gray-200 py-2 px-3 text-xs font-mono uppercase focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition bg-white rounded-l-lg"
                     data-loc-idx="${idx}" data-loc-field="gstin">
              <button type="button" class="btn-fetch-location px-3 py-2 border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-indigo-100 hover:text-indigo-600 focus:ring-2 focus:ring-indigo-500 transition rounded-r-lg" data-loc-idx="${idx}">
                Fetch
              </button>
            </div>
          </div>

          <!-- State & Pincode -->
          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="text-xs font-semibold text-gray-700 uppercase tracking-wide">State</label>
              <input type="text" value="${escapeHtml(loc.state || '')}" 
                     class="mt-1 w-full border border-gray-200 rounded-lg py-2 px-3 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition bg-white"
                     data-loc-idx="${idx}" data-loc-field="state">
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Pincode</label>
              <input type="text" value="${escapeHtml(loc.pin || '')}" 
                     class="mt-1 w-full border border-gray-200 rounded-lg py-2 px-3 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition bg-white"
                     data-loc-idx="${idx}" data-loc-field="pin">
            </div>
          </div>

          <!-- Address -->
          <div>
            <label class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Address</label>
            <input type="text" value="${escapeHtml(loc.address || '')}" 
                   class="mt-1 w-full border border-gray-200 rounded-lg py-2 px-3 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition bg-white"
                   data-loc-idx="${idx}" data-loc-field="address">
          </div>

          <!-- Primary Checkbox -->
          <div class="flex items-center gap-2 pt-1">
            <input type="checkbox" ${loc.is_primary ? 'checked' : ''} 
                   class="location-primary-checkbox w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                   data-loc-idx="${idx}">
            <label class="text-xs font-medium text-gray-700 cursor-pointer">Set as Primary Location</label>
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-loc-field]').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.locIdx);
        const field = e.target.dataset.locField;
        gstLocations[idx][field] = e.target.value;
      });
    });

    container.querySelectorAll('.btn-fetch-location').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const idx = parseInt(e.target.dataset.locIdx);
        const gstinInput = container.querySelector(`input[data-loc-idx="${idx}"][data-loc-field="gstin"]`);
        const gstin = gstinInput.value.trim().toUpperCase();
        
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
            return;
          }
          
          const gstData = await response.json();
          if (!gstData.success) {
            showToast(gstData.error || 'Failed to fetch GST details', 'error');
            return;
          }

          const data = gstData.data || gstData;
          gstLocations[idx].state = data.place_of_business_principal?.address?.state 
                                  || data.state_jurisdiction || '';
          gstLocations[idx].address = [
            data.place_of_business_principal?.address?.door_num,
            data.place_of_business_principal?.address?.building_name,
            data.place_of_business_principal?.address?.floor_num,
            data.place_of_business_principal?.address?.street,
            data.place_of_business_principal?.address?.location,
            data.place_of_business_principal?.address?.city,
            data.place_of_business_principal?.address?.district
          ].filter(p => p && String(p).trim()).join(', ') || '';
          
          const pinCode = data.place_of_business_principal?.address?.pin_code || '';
          gstLocations[idx].pin = /^\d{6}$/.test(String(pinCode).trim()) ? pinCode : '';
          
          renderGstLocations();
          btn.innerHTML = '✔';
          setTimeout(() => { btn.innerHTML = originalText; }, 1500);
          showToast('GST details fetched successfully!', 'success');
        } catch (err) {
          console.error('Error fetching GST data:', err);
          showToast('Failed to fetch details. ' + (err.message || 'Server error'), 'error');
          btn.innerHTML = originalText;
        } finally {
          btn.disabled = false;
        }
      });
    });

    container.querySelectorAll('.location-primary-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.locIdx);
        gstLocations.forEach((loc, i) => {
          loc.is_primary = (i === idx) ? e.target.checked : false;
        });
        renderGstLocations(); // Re-render to ensure only one checkbox is checked
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
      gstin: '', state: '', address: '', is_primary: false,
    });
    renderGstLocations();
  });

  renderGstLocations();

  document.getElementById('edit-party-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    data.supply = data.state;
    data.gstLocations = gstLocations;

    try {
      const response = await fetchWithCSRF(`/api/inventory/sales/parties/${party._id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error(await response.text());
      
      showToast('Party updated successfully!', 'success');
      closeModal();
      await onSave();
    } catch (err) {
      console.error('Update Error:', err);
      showToast('Failed to update party. ' + err.message, 'error');
    }
  });
}

async function openDeleteConfirmModal(party, onDelete) {
  const modal = document.getElementById('delete-confirm-modal');
  const backdrop = document.getElementById('delete-confirm-modal-backdrop');
  const content = document.getElementById('delete-confirm-modal-content');

  if (!modal || !backdrop || !content) return;

  content.innerHTML = `
    <div class="p-6 text-center">
      <svg class="mx-auto h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
      <h3 class="mt-5 text-lg font-medium text-gray-900">Delete Party?</h3>
      <div class="mt-2 text-sm text-gray-500">
        <p>Are you sure you want to delete <strong>${escapeHtml(party.firm)}</strong>?</p>
        <p>This action is irreversible.</p>
      </div>
    </div>
    <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-2xl">
      <button id="confirm-delete" type="button" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm transition">
        Delete
      </button>
      <button id="cancel-delete" type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm transition">
        Cancel
      </button>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.classList.add('scale-100');
  backdrop.classList.remove('hidden');
  backdrop.classList.add('opacity-100');

  const closeModal = () => {
    modal.classList.remove('scale-100');
    backdrop.classList.remove('opacity-100');
    setTimeout(() => {
        modal.classList.add('hidden');
        backdrop.classList.add('hidden');
    }, 150);
  };

  document.getElementById('cancel-delete')?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);

  document.getElementById('confirm-delete')?.addEventListener('click', async () => {
    try {
      const response = await fetchWithCSRF(`/api/inventory/sales/parties/${party._id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      
      showToast('Party deleted successfully.', 'success');
      closeModal();
      await onDelete();
    } catch (err) {
      showToast('Error deleting party: ' + err.message, 'error');
    }
  });
}
