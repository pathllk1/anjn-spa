/**
 * PARTY CREATE COMPONENT
 * Handles party creation modal
 */

import { fetchPartyByGST } from './partyManager.js';
import { showToast }       from './toast.js';
import { fetchWithCSRF }   from '../../../utils/api.js';
import { escHtml }         from './utils.js';
import { INDIA_STATE_CODES } from './stateManager.js';

export function openCreatePartyModal(state, onPartySaved) {
    const subModal   = document.getElementById('sub-modal-backdrop');
    const subContent = document.getElementById('sub-modal-content');
    if (!subModal || !subContent) return;

    subModal.classList.remove('hidden');
    subContent.classList.add('flex', 'flex-col', 'max-h-[90vh]');

    subContent.innerHTML = `
        <header class="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-3 flex justify-between items-center border-b border-indigo-100 rounded-t-lg flex-shrink-0">
            <div>
                <h3 class="font-bold text-base text-gray-900">Add New Party</h3>
                <p class="text-xs text-gray-500">Fill in the details for the new party.</p>
            </div>
            <button id="close-sub-modal-party" class="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none">&times;</button>
        </header>

        <form id="create-party-form" class="flex-1 overflow-y-auto p-5">
            <div class="space-y-3">
                <div>
                    <label for="new-party-firm" class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Firm Name *</label>
                    <input type="text" name="firm" id="new-party-firm" required
                           class="mt-1.5 block w-full border border-gray-200 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition bg-white"
                           placeholder="e.g. M/S Global Enterprises">
                </div>

                <div>
                    <label for="new-party-gstin" class="text-xs font-semibold text-gray-700 uppercase tracking-wide">GSTIN</label>
                    <div class="mt-1.5 flex gap-1 rounded-lg overflow-hidden shadow-sm">
                        <input type="text" name="gstin" id="new-party-gstin"
                               class="flex-1 block w-full border border-gray-200 py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none font-mono uppercase transition bg-white"
                               placeholder="27ABCDE1234F1Z5" maxlength="15">
                        <button type="button" id="btn-fetch-gst"
                                class="px-3 py-2 border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 focus:ring-2 focus:ring-indigo-500 transition">
                            Fetch
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label for="new-party-contact" class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Contact</label>
                        <input type="text" name="contact" id="new-party-contact"
                               class="mt-1.5 block w-full border border-gray-200 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition bg-white">
                    </div>

                    <div>
                        <label for="new-party-pan" class="text-xs font-semibold text-gray-700 uppercase tracking-wide">PAN</label>
                        <input type="text" name="pan" id="new-party-pan"
                               class="mt-1.5 block w-full border border-gray-200 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition font-mono uppercase bg-white"
                               maxlength="10">
                    </div>
                </div>
                
                <div>
                    <label for="new-party-addr" class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Address</label>
                    <textarea name="addr" id="new-party-addr" rows="2"
                              class="mt-1.5 block w-full border border-gray-200 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition resize-none bg-white"></textarea>
                </div>
                
                <div class="grid grid-cols-3 gap-3">
                    <div class="col-span-2">
                        <label for="new-party-state" class="text-xs font-semibold text-gray-700 uppercase tracking-wide">State *</label>
                        <input type="text" name="state" id="new-party-state" required
                               class="mt-1.5 block w-full border border-gray-200 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition bg-white">
                    </div>
                    
                    <div>
                        <label for="new-party-pin" class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Pincode</label>
                        <input type="text" name="pin" id="new-party-pin"
                               class="mt-1.5 block w-full border border-gray-200 rounded-lg shadow-sm py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition bg-white">
                    </div>
                </div>
                
                <input type="hidden" name="state_code" id="new-party-state-code">
            </div>

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
            <button type="button" id="cancel-create-party"
                    class="py-2 px-3 border border-gray-300 rounded-lg shadow-sm text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition">
                Cancel
            </button>
            <button type="submit" form="create-party-form"
                    class="py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition">
                Save Party
            </button>
        </footer>
    `;

    const closeFunc = () => subModal.classList.add('hidden');
    document.getElementById('close-sub-modal-party').addEventListener('click', closeFunc);
    document.getElementById('cancel-create-party').addEventListener('click', closeFunc);

    // Auto-detect State Code + PAN from GSTIN
    document.getElementById('new-party-gstin').addEventListener('input', e => {
        const val = e.target.value.toUpperCase();
        e.target.value = val;
        if (val.length >= 2 && /^\d{2}/.test(val)) {
            document.getElementById('new-party-state-code').value = val.substring(0, 2);
        } else if (val.length < 2) {
            document.getElementById('new-party-state-code').value = '';
        }
        if (val.length >= 12) {
            document.getElementById('new-party-pan').value = val.substring(2, 12);
        }
    });

    // Auto-detect State Code from State name for unregistered parties
    document.getElementById('new-party-state').addEventListener('input', e => {
        const gstinVal = document.getElementById('new-party-gstin').value.trim();
        if (gstinVal.length >= 2) return;
        const code = INDIA_STATE_CODES[e.target.value.trim().toLowerCase()];
        document.getElementById('new-party-state-code').value = code ?? '';
    });

    document.getElementById('btn-fetch-gst').addEventListener('click', function () {
        fetchPartyByGST(this);
    });

    // Multi-GSTIN Location Management
    let gstLocations = [];

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
                      <input type="text" value="${escHtml(loc.gstin || '')}" maxlength="15" 
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
                      <input type="text" value="${escHtml(loc.state || '')}" 
                             class="mt-1 w-full border border-gray-200 rounded-lg py-2 px-3 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition bg-white"
                             data-loc-idx="${idx}" data-loc-field="state">
                    </div>
                    <div>
                      <label class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Pincode</label>
                      <input type="text" value="${escHtml(loc.pin || '')}" 
                             class="mt-1 w-full border border-gray-200 rounded-lg py-2 px-3 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition bg-white"
                             data-loc-idx="${idx}" data-loc-field="pin">
                    </div>
                  </div>

                  <!-- Address -->
                  <div>
                    <label class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Address</label>
                    <input type="text" value="${escHtml(loc.address || '')}" 
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

    document.getElementById('btn-add-gst-location').addEventListener('click', (e) => {
        e.preventDefault();
        gstLocations.push({ gstin: '', state: '', address: '', is_primary: false });
        renderGstLocations();
    });

    renderGstLocations();

    document.getElementById('create-party-form').addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data     = Object.fromEntries(formData.entries());

        data.supply     = data.state;
        data.gstin      = data.gstin   || 'UNREGISTERED';
        data.state_code = data.state_code ? data.state_code.toString().padStart(2, '0') : null;
        data.gstLocations = gstLocations;

        try {
            const response = await fetchWithCSRF('/api/inventory/sales/parties', {
                method: 'POST',
                body:   JSON.stringify(data),
            });

            if (!response.ok) throw new Error(await response.text());

            const result = await response.json();
            closeFunc();
            showToast('Party created successfully!', 'success');
            await onPartySaved(result.data || result);

        } catch (err) {
            console.error('Error creating party:', err);
            showToast('Error creating party: ' + err.message, 'error');
        }
    });
}