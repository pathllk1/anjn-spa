/**
 * LAYOUT RENDERER MODULE
 * Handles main UI layout rendering and component display
 */

// FIX: Removed unused import `getHistoryCacheKey`
// FIX: Static import instead of dynamic `await import('./utils.js')` inside renderPartyCard
import { formatCurrency, getPartyId, escHtml, populateConsigneeFromBillTo, getItemEffectiveQty, getItemDisplayQty, getItemLineTotal, isServiceItem, shouldShowItemQty, calculateBillTotals } from './utils.js';
import { renderOtherChargesList } from './otherChargesManager.js';

export function renderItemsList(state) {
    if (state.cart.length === 0) {
        return `
        <div class="absolute inset-0 flex flex-col items-center justify-center text-gray-300 select-none pointer-events-none">
            <svg class="w-16 h-16 mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            <p class="text-sm font-medium text-gray-400">Your cart is empty</p>
            <p class="text-xs text-gray-400 mt-1">
                Quick Actions:
                <kbd class="font-mono bg-gray-100 px-1 rounded border border-gray-300">F2</kbd> Add Items &nbsp;|&nbsp;
                <kbd class="font-mono bg-gray-100 px-1 rounded border border-gray-300">F3</kbd> Select Party &nbsp;|&nbsp;
                <kbd class="font-mono bg-gray-100 px-1 rounded border border-gray-300">F4</kbd> Other Charges
            </p>
        </div>`;
    }

    // FIX: escHtml applied to all user/API data in template strings
    return state.cart.map((item, index) => {
        const isService = isServiceItem(item);
        const rowTotal  = getItemLineTotal(item);
        const qtyValue  = getItemDisplayQty(item);
        return `
        <div class="flex items-center border-b border-gray-100 text-xs text-gray-700 hover:bg-blue-50 transition-colors min-h-10 group bg-white">
            <div class="p-2 w-10 text-center text-gray-400 font-mono">${index + 1}</div>
            <div class="p-2 flex-1 font-medium truncate flex flex-col justify-center">
                ${isService
                    ? `<input type="text" data-idx="${index}" data-field="item"
                       value="${escHtml(item.item || '')}"
                       class="w-full text-xs bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 font-medium text-gray-800"
                       placeholder="Service description">`
                    : `<span class="text-gray-800">${escHtml(item.item)}</span>`}
                <span class="text-[10px] text-gray-400 font-normal">${isService ? 'Service Line' : `Batch: ${escHtml(item.batch || '-')} | OEM: ${escHtml(item.oem || '-')}`}</span>
            </div>
            <div class="p-2 w-20 text-gray-500 border-l border-transparent group-hover:border-blue-100">
                ${isService
                    ? `<input type="text" data-idx="${index}" data-field="hsn"
                       value="${escHtml(item.hsn || '')}"
                       class="w-full text-xs bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 text-gray-500"
                       placeholder="SAC">`
                    : escHtml(item.hsn)}
            </div>

            <div class="p-1 w-16 border-l border-transparent group-hover:border-blue-100">
                <input type="number" min="0" step="0.01" data-idx="${index}" data-field="qty"
                       value="${qtyValue === '' ? '' : Number(qtyValue)}"
                       class="tbl-input w-full text-right bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 font-semibold text-blue-700">
            </div>

            <div class="p-2 w-12 text-center text-gray-500 text-[10px] border-l border-transparent group-hover:border-blue-100">
                ${isService
                    ? `<input type="text" data-idx="${index}" data-field="uom"
                       value="${escHtml(item.uom || '')}"
                       class="w-full text-[10px] text-center bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1"
                       placeholder="${shouldShowItemQty(item) ? 'UOM' : ''}">`
                    : escHtml(item.uom)}
            </div>

            <div class="p-1 w-24 border-l border-transparent group-hover:border-blue-100">
                <input type="number" min="0" step="0.01" data-idx="${index}" data-field="rate"
                       value="${Number(item.rate)}"
                       class="tbl-input w-full text-right bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1">
            </div>

            <div class="p-1 w-16 border-l border-transparent group-hover:border-blue-100">
                <input type="number" min="0" max="100" step="0.01" data-idx="${index}" data-field="disc"
                       value="${Number(item.disc || 0)}"
                       class="tbl-input w-full text-right bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 placeholder-gray-300" placeholder="0">
            </div>

            <div class="p-1 w-16 border-l border-transparent group-hover:border-blue-100">
                ${isService
                    ? `<input type="number" min="0" max="100" step="0.01" data-idx="${index}" data-field="grate"
                       value="${Number(item.grate || 0)}"
                       class="tbl-input w-full text-right bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 text-gray-600">`
                    : `<div class="p-1 text-right text-gray-600">${escHtml(String(item.grate))}%</div>`}
            </div>
            <div class="p-2 w-28 text-right font-bold text-gray-800 row-total border-l border-transparent group-hover:border-blue-100 bg-gray-50/50 group-hover:bg-transparent tabular-nums">${formatCurrency(rowTotal)}</div>

            <div class="p-2 w-10 text-center border-l border-transparent group-hover:border-blue-100">
                <button data-idx="${index}" class="btn-remove text-gray-300 hover:text-red-500 transition-colors font-bold text-lg leading-none">&times;</button>
            </div>
        </div>
        <div class="flex items-start border-b border-gray-100 text-xs text-gray-700 group bg-white pl-20 pr-2 py-1">
            <div class="flex-1 text-[10px] text-gray-500 uppercase tracking-wide pt-1">Item Narration</div>
            <div class="flex-1 p-1 border-l border-transparent group-hover:border-blue-100">
                <textarea data-idx="${index}" data-field="narration"
                       class="w-full text-xs bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 min-h-12 resize-y"
                       placeholder="Add narration for this item">${escHtml(item.narration || '')}</textarea>
            </div>
        </div>`;
    }).map((rowHtml, index) => {
        const item = state.cart[index];
        if (!isServiceItem(item)) return rowHtml;
        return `${rowHtml}
        <div class="flex items-center border-b border-gray-100 text-xs text-gray-700 group bg-white pl-20 pr-2 py-1">
            <div class="flex-1 text-[10px] text-gray-500 uppercase tracking-wide">Service Cost</div>
            <div class="w-36 p-1 border-l border-transparent group-hover:border-blue-100">
                <input type="number" min="0" step="0.01" data-idx="${index}" data-field="costRate"
                       value="${Number(item.costRate || 0)}"
                       class="tbl-input w-full text-right bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 text-amber-700 font-semibold"
                       placeholder="0.00">
            </div>
            <div class="flex-1 text-[10px] text-gray-400 pl-3">Optional per-unit cost for service COGS posting</div>
        </div>`;
    }).join('');
}

export function renderTotals(state) {
    const gstEnabled = state.gstEnabled !== undefined ? state.gstEnabled : true;
    const totals = calculateBillTotals({
        cart: state.cart,
        otherCharges: state.otherCharges,
        gstEnabled,
        billType: state.meta.billType,
        reverseCharge: state.meta.reverseCharge,
    });

    const totalQty = state.cart.reduce((sum, item) => {
        if (!shouldShowItemQty(item)) return sum;
        return sum + getItemEffectiveQty(item);
    }, 0).toFixed(2);

    return `
    <div class="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
        <div class="text-[11px] text-gray-400 space-y-1">
            <div class="flex gap-4">
                <span>Total Items: <b class="text-gray-600">${state.cart.length}</b></span>
                <span>Total Quantity: <b class="text-gray-600">${totalQty}</b></span>
            </div>
            ${state.meta.reverseCharge ? '<div class="text-red-600 font-bold mt-1">REVERSE CHARGE APPLIES</div>' : ''}
            <div class="text-gray-400 italic mt-2">* Rates are inclusive of discounts before tax</div>
        </div>

        <div class="flex gap-6 text-xs">
            <div class="text-right space-y-1.5 text-gray-500 font-medium">
                <div>Taxable Value</div>
                ${state.meta.billType === 'intra-state'
                    ? `<div>CGST Output</div><div>SGST Output</div>`
                    : `<div>IGST Output</div>`}
                ${state.otherCharges.length > 0 ? `<div>Other Charges</div>` : ''}
                <div>Round Off</div>
                <div class="pt-2 mt-2 border-t border-gray-200 font-bold text-gray-700">Grand Total</div>
            </div>
            <div class="text-right space-y-1.5 font-mono font-bold text-gray-800">
                <div class="tabular-nums">${formatCurrency(totals.itemTaxableTotal)}</div>
                ${state.meta.billType === 'intra-state'
                    ? `<div class="text-gray-600 tabular-nums">${formatCurrency(totals.cgst)}</div><div class="text-gray-600 tabular-nums">${formatCurrency(totals.sgst)}</div>`
                    : `<div class="text-gray-600 tabular-nums">${formatCurrency(totals.igst)}</div>`}
                ${state.otherCharges.length > 0
                    ? `<div class="text-gray-600 tabular-nums">${formatCurrency(totals.otherChargesTotal)}</div>` : ''}
                <div class="text-gray-600 tabular-nums">${formatCurrency(totals.rof)}</div>
                <div class="pt-2 mt-2 border-t border-gray-200 font-bold text-lg text-blue-700 leading-none tabular-nums">
                    ${formatCurrency(totals.ntot)}
                </div>
            </div>
        </div>
    </div>`;
}

export async function renderPartyCard(state) {
    if (state.selectedParty) {
        let balanceInfo = { balance: 0, balanceType: 'Credit', balanceFormatted: '₹0.00' };
        const partyId   = getPartyId(state.selectedParty);

        try {
            const response = await fetch(`/api/inventory/sales/party-balance/${partyId}`, {
                method: 'GET', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const bal = data.data?.balance || 0;
                    const balanceType = data.data?.balance_type || (bal >= 0 ? 'Debit' : 'Credit');
                    const outstanding = data.data?.outstanding ?? Math.abs(bal);
                    balanceInfo = {
                        balance:          bal,
                        balanceType,
                        balanceFormatted: new Intl.NumberFormat('en-IN', {
                            style: 'currency', currency: 'INR',
                        }).format(outstanding),
                    };
                }
            }
        } catch (error) {
            console.error('Error fetching party balance:', error);
        }

        // FIX: static import instead of dynamic `await import('./utils.js')` —
        // populateConsigneeFromBillTo is now imported at the top of this file.
        if (state.consigneeSameAsBillTo) {
            populateConsigneeFromBillTo(state);
        }

        // FIX: escHtml applied to all party fields used in template
        const billTypeBadge = (() => {
            const bt = state.meta?.billType;
            if (bt === 'intra-state') {
                return `<span class="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded border border-green-200"
                              title="Same state — CGST + SGST applies">Local</span>`;
            }
            if (bt === 'inter-state') {
                return `<span class="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded border border-orange-200"
                              title="Different state — IGST applies">Out of State</span>`;
            }
            return ''; // bill type not yet resolved
        })();

        return `
            <div class="group bg-blue-50 p-3 rounded border border-blue-200 shadow-sm">
                <div class="flex justify-between items-start">
                    <h3 class="font-bold text-sm text-blue-900 truncate flex-1"
                        title="${escHtml(state.selectedParty.firm)}">${escHtml(state.selectedParty.firm)}</h3>
                    <button id="btn-change-party"
                            class="text-[10px] text-blue-600 hover:text-blue-800 font-bold bg-white p-1.5 rounded shadow-sm border border-gray-200 hover:border-blue-300 whitespace-nowrap ml-2"
                            title="Change Party">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                    </button>
                </div>
                <p class="text-[11px] text-gray-600 truncate mt-1">${escHtml(state.selectedParty.addr || '')}</p>
                <div class="flex items-center gap-2 mt-2">
                    <span class="bg-blue-100 text-blue-800 text-[10px] font-mono px-2 py-0.5 rounded border border-blue-200">
                        GST: ${escHtml(state.selectedParty.gstin || '')}
                    </span>
                    ${billTypeBadge}
                </div>
                <div class="flex items-center gap-2 mt-2">
                    <span class="${balanceInfo.balance >= 0 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'} text-[10px] font-mono px-2 py-0.5 rounded border">
                        BAL: ${escHtml(balanceInfo.balanceType)} ${escHtml(balanceInfo.balanceFormatted)}
                    </span>
                </div>
            </div>`;
    }

    return `
        <button id="btn-select-party"
                class="w-full py-6 border-2 border-dashed border-gray-300 rounded-lg text-gray-400
                       hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all
                       flex flex-col items-center justify-center gap-2 group">
            <span class="text-2xl group-hover:scale-110 transition-transform font-light">+</span>
            <span class="text-xs font-semibold uppercase tracking-wide">Select Party</span>
        </button>`;
}
