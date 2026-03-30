<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api, API_BASE_URL } from '@/utils/api'
import { 
  calculateBillTotals, 
  formatCurrency, 
  getItemLineTotal, 
} from '@/utils/sales-logic'

const router = useRouter()
const route = useRoute()

// --- STATE ---
const state = reactive({
  stocks: [] as any[],
  parties: [] as any[],
  cart: [] as any[],
  selectedParty: null as any,
  selectedConsignee: null as any,
  consigneeSameAsBillTo: true,
  partyBalance: { balance: 0, balanceType: 'Credit', balanceFormatted: '₹0.00' },
  historyCache: {} as Record<string, any[]>,
  meta: {
    billNo: 'Will be generated on save',
    billDate: new Date().toISOString().split('T')[0],
    billType: 'intra-state',
    reverseCharge: false,
    referenceNo: '',
    vehicleNo: '',
    dispatchThrough: '',
    narration: '',
    firmGstin: null as string | null,
  },
  otherCharges: [] as any[],
  currentFirmName: 'Your Company Name',
  gstEnabled: true,
  firmLocations: [] as any[],
  activeFirmLocation: null as any,
  isEditMode: false,
  isReturnMode: false,
  editBillId: null as string | null,
  returnFromBillId: null as string | null,
  currentBill: null as any,
  loading: true,
  saving: false,
})

// --- MODAL STATES ---
const modals = reactive({
  stock: { show: false, search: '' },
  party: { show: false, search: '', creating: false },
  charges: { show: false },
  batch: { show: false, stock: null as any },
  history: { show: false, stock: null as any, data: [] as any[], loading: false },
  createStock: { show: false, saving: false, data: { item: '', batch: '', pno: '', oem: '', hsn: '', qty: 0, uom: 'NOS', rate: 0, grate: '18', mrp: '', expiryDate: '' } },
  createParty: { show: false, saving: false, data: { firm: '', gstin: '', contact: '', state: '', state_code: '', pan: '', addr: '', pin: '' } },
  saveConfirm: { show: false, billId: '', billNo: '' }
})

// --- COMPUTED ---
const totals = computed(() => {
  return calculateBillTotals({
    cart: state.cart,
    otherCharges: state.otherCharges,
    gstEnabled: state.gstEnabled,
    billType: state.meta.billType as any,
    reverseCharge: state.meta.reverseCharge,
    isReturnMode: state.isReturnMode
  })
})

const filteredStocks = computed(() => {
  if (!modals.stock.search) return state.stocks
  const s = modals.stock.search.toLowerCase()
  return state.stocks.filter(it => 
    it.item.toLowerCase().includes(s) || 
    (it.oem && it.oem.toLowerCase().includes(s)) ||
    (it.hsn && it.hsn.toLowerCase().includes(s))
  )
})

const filteredParties = computed(() => {
  if (!modals.party.search) return state.parties
  const s = modals.party.search.toLowerCase()
  return state.parties.filter(p => 
    p.firm.toLowerCase().includes(s) || 
    (p.gstin && p.gstin.toLowerCase().includes(s))
  )
})

// --- INITIALIZATION ---
async function init() {
  state.loading = true
  
  const editId = route.query.edit as string || sessionStorage.getItem('editBillId')
  const returnId = route.query.returnFrom as string || sessionStorage.getItem('returnFromBillId')
  
  if (returnId) {
    state.isReturnMode = true
    state.returnFromBillId = returnId
    sessionStorage.removeItem('returnFromBillId')
  } else if (editId) {
    state.isEditMode = true
    state.editBillId = editId
    sessionStorage.removeItem('editBillId')
  }

  try {
    await Promise.all([fetchFirmData(), fetchInitialData()])
    
    if (state.isEditMode && state.editBillId) {
      await loadBill(state.editBillId)
    } else if (state.isReturnMode && state.returnFromBillId) {
      await loadBillForReturn(state.returnFromBillId)
    }
  } catch (err) {
    console.error('Init failed', err)
  } finally {
    state.loading = false
  }
}

async function fetchFirmData() {
  const data = await api.get('/inventory/sales/current-firm')
  if (data?.success && data.data) {
    state.currentFirmName = data.data.name
    state.firmLocations = data.data.locations || []
    state.activeFirmLocation = state.firmLocations.find((l: any) => l.is_default) || state.firmLocations[0] || null
    if (state.activeFirmLocation) state.meta.firmGstin = state.activeFirmLocation.gst_number
  }
}

async function fetchInitialData() {
  const [stocksRes, partiesRes, gstRes] = await Promise.all([
    api.get('/inventory/sales/stocks'),
    api.get('/inventory/sales/parties'),
    api.get('/settings/system-config/gst-status')
  ])
  
  state.stocks = stocksRes?.success ? stocksRes.data : (Array.isArray(stocksRes) ? stocksRes : [])
  state.parties = partiesRes?.success ? partiesRes.data : (Array.isArray(partiesRes) ? partiesRes : [])
  state.gstEnabled = gstRes?.success ? (gstRes.data?.gst_enabled !== false) : true
  
  if (!state.isEditMode && !state.isReturnMode) {
    const nextBill = await api.get('/inventory/sales/next-bill-number')
    if (nextBill?.success) state.meta.billNo = nextBill.nextBillNumber
  }
}

async function loadBill(id: string) {
  const res = await api.get(`/inventory/sales/bills/${id}`)
  if (res?.success) {
    const bill = res.data
    state.currentBill = bill
    state.meta = {
      billNo: bill.bno,
      billDate: bill.bdate,
      billType: bill.bill_subtype?.toLowerCase() || ((bill.cgst || bill.sgst) ? 'intra-state' : 'inter-state'),
      reverseCharge: !!bill.reverse_charge,
      referenceNo: bill.order_no || '',
      vehicleNo: bill.vehicle_no || '',
      dispatchThrough: bill.dispatch_through || '',
      narration: bill.narration || '',
      firmGstin: bill.firm_gstin
    }
    
    if (bill.firm_gstin) {
      state.activeFirmLocation = state.firmLocations.find((l: any) => l.gst_number === bill.firm_gstin) || state.activeFirmLocation
    }

    if (bill.party_id) {
      state.selectedParty = state.parties.find(p => (p._id || p.id) === bill.party_id) || {
        _id: bill.party_id, firm: bill.supply, gstin: bill.gstin, state: bill.state, addr: bill.addr
      }
    }
    
    state.consigneeSameAsBillTo = !(bill.consignee_name || bill.consignee_address)
    state.selectedConsignee = {
      name: bill.consignee_name || '',
      address: bill.consignee_address || '',
      gstin: bill.consignee_gstin || '',
      state: bill.consignee_state || '',
      pin: bill.consignee_pin || '',
      contact: '',
      deliveryInstructions: ''
    }

    state.cart = (bill.items || []).map((it: any) => ({
      stockId: it.stock_id,
      itemType: it.item_type || (it.stock_id ? 'GOODS' : 'SERVICE'),
      item: it.item,
      narration: it.item_narration || '',
      batch: it.batch || '',
      oem: it.oem || '',
      hsn: it.hsn,
      qty: parseFloat(it.qty),
      rate: parseFloat(it.rate),
      costRate: parseFloat(it.cost_rate) || 0,
      grate: parseFloat(it.grate) || 0,
      disc: parseFloat(it.disc) || 0,
      uom: it.uom || ''
    }))

    state.otherCharges = (bill.otherCharges || []).map((oc: any) => ({
      label: oc.name || oc.type,
      amount: parseFloat(oc.amount),
      gstRate: parseFloat(oc.gstRate) || 0
    }))
  }
}

async function loadBillForReturn(id: string) {
  await loadBill(id)
  state.isReturnMode = true
  state.meta.billNo = 'CN-AUTO'
  state.cart = state.cart.map(it => ({ ...it, returnQty: 0 }))
}

async function fetchPartyBalance(partyId: string) {
  try {
    const data = await api.get(`/inventory/sales/party-balance/${partyId}`)
    if (data?.success) {
      const bal = data.data?.balance || 0
      const balanceType = data.data?.balance_type || (bal >= 0 ? 'Debit' : 'Credit')
      const outstanding = data.data?.outstanding ?? Math.abs(bal)
      state.partyBalance = {
        balance: bal,
        balanceType,
        balanceFormatted: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(outstanding)
      }
    }
  } catch (e) {
    console.error('Balance fetch failed', e)
  }
}

// --- ACTIONS ---
function addItem(stock: any) {
  if (stock.batch || (stock.batches && stock.batches.length > 0)) {
    modals.batch.stock = stock
    modals.batch.show = true
  } else {
    state.cart.push({
      stockId: stock._id,
      itemType: 'GOODS',
      item: stock.item,
      hsn: stock.hsn,
      qty: 1,
      uom: stock.uom || 'PCS',
      rate: stock.rate,
      grate: stock.grate || 0,
      disc: stock.disc || 0,
      batch: '',
      oem: stock.oem || '',
      narration: ''
    })
    modals.stock.show = false
  }
}

function selectBatch(batch: any) {
  state.cart.push({
    stockId: modals.batch.stock._id,
    itemType: 'GOODS',
    item: modals.batch.stock.item,
    hsn: modals.batch.stock.hsn,
    qty: 1,
    uom: modals.batch.stock.uom || 'PCS',
    rate: batch.rate || modals.batch.stock.rate,
    grate: modals.batch.stock.grate || 0,
    disc: modals.batch.stock.disc || 0,
    batch: batch.batch,
    oem: modals.batch.stock.oem || '',
    narration: ''
  })
  modals.batch.show = false
  modals.stock.show = false
}

function addService() {
  state.cart.push({
    itemType: 'SERVICE',
    item: '',
    hsn: '',
    qty: 1,
    uom: '',
    rate: 0,
    grate: 0,
    disc: 0,
    costRate: 0,
    narration: '',
    showQty: true
  })
}

function removeCartItem(idx: number) {
  state.cart.splice(idx, 1)
}

function autoSetBillType() {
  if (!state.selectedParty || !state.activeFirmLocation) return
  const firmCode = state.activeFirmLocation.state_code || state.activeFirmLocation.gst_number?.substring(0, 2)
  const partyCode = state.selectedParty.state_code || state.selectedParty.gstin?.substring(0, 2)
  if (firmCode && partyCode) {
    state.meta.billType = firmCode === partyCode ? 'intra-state' : 'inter-state'
  }
}

function syncConsignee() {
  if (state.consigneeSameAsBillTo && state.selectedParty) {
    state.selectedConsignee = {
      name: state.selectedParty.firm,
      address: state.selectedParty.addr,
      gstin: state.selectedParty.gstin,
      state: state.selectedParty.state,
      pin: state.selectedParty.pin || '',
      contact: state.selectedParty.contact || '',
      deliveryInstructions: ''
    }
  }
}

async function saveInvoice() {
  if (state.cart.length === 0) return alert('Cart is empty')
  if (!state.selectedParty) return alert('Select a party')
  
  if (state.isReturnMode) {
    if (!state.cart.some(it => (it.returnQty || 0) > 0)) return alert('Enter return quantities')
    if (!confirm('Confirm Credit Note creation?')) return
  } else if (state.isEditMode) {
    if (!confirm('Confirm Bill update?')) return
  }

  state.saving = true
  try {
    let payload: any
    let endpoint = '/inventory/sales/bills'
    let method = 'POST' as any

    if (state.isReturnMode) {
      endpoint = '/inventory/sales/create-credit-note'
      payload = {
        originalBillId: state.returnFromBillId,
        returnCart: state.cart.filter(it => (it.returnQty || 0) > 0).map(it => ({
          stockId: it.stockId,
          returnQty: it.returnQty,
          rate: it.rate,
          grate: it.grate,
          disc: it.disc,
          item: it.item,
          gstRate: it.grate
        })),
        narration: state.meta.narration
      }
    } else {
      payload = {
        meta: { ...state.meta, firmGstin: state.activeFirmLocation?.gst_number },
        party: state.selectedParty._id || state.selectedParty.id,
        cart: state.cart,
        otherCharges: state.otherCharges,
        consignee: state.selectedConsignee
      }
      if (state.isEditMode) {
        endpoint = `/inventory/sales/bills/${state.editBillId}`
        method = 'PUT' as any
      }
    }

    const res = await api.request(endpoint, { method, body: JSON.stringify(payload) })
    if (res?.success) {
      modals.saveConfirm.billId = res.id
      modals.saveConfirm.billNo = res.billNo || state.meta.billNo
      modals.saveConfirm.show = true
    } else {
      alert(res?.error || 'Save failed')
    }
  } catch (err: any) {
    alert('Error: ' + err.message)
  } finally {
    state.saving = false
  }
}

function resetForm() {
  if (confirm('Clear all data?')) {
    location.reload()
  }
}

// --- SUB-MODAL ACTIONS ---
async function handleCreateStock() {
  modals.createStock.saving = true
  try {
    const data = { ...modals.createStock.data } as any
    if (data.batch || data.expiryDate || data.mrp) {
        data.batches = JSON.stringify([{
            batch:  data.batch || null,
            qty:    parseFloat(data.qty) || 0,
            rate:   parseFloat(data.rate) || 0,
            expiry: data.expiryDate || null,
            mrp:    data.mrp ? parseFloat(data.mrp) : null,
        }])
        delete data.batch; delete data.expiryDate; delete data.mrp
    }
    const res = await api.post('/inventory/sales/stocks', data)
    if (res?.success) {
      const stocksRes = await api.get('/inventory/sales/stocks')
      state.stocks = stocksRes?.success ? stocksRes.data : stocksRes
      modals.createStock.show = false
    }
  } finally {
    modals.createStock.saving = false
  }
}

async function handleCreateParty() {
  modals.createParty.saving = true
  try {
    const data = { ...modals.createParty.data } as any
    data.supply = data.state
    data.gstin = data.gstin || 'UNREGISTERED'
    const res = await api.post('/inventory/sales/parties', data)
    if (res?.success) {
      const partiesRes = await api.get('/inventory/sales/parties')
      state.parties = partiesRes?.success ? partiesRes.data : partiesRes
      state.selectedParty = res.data || res
      modals.createParty.show = false
    }
  } finally {
    modals.createParty.saving = false
  }
}

async function showHistory(stock: any) {
  if (!state.selectedParty) return alert('Select a party first')
  const partyId = state.selectedParty._id || state.selectedParty.id
  const stockId = stock._id || stock.id
  const cacheKey = `${partyId}:${stockId}`
  
  modals.history.stock = stock
  modals.history.show = true
  
  if (state.historyCache[cacheKey]) {
    modals.history.data = state.historyCache[cacheKey]
    return
  }
  
  modals.history.loading = true
  try {
    const res = await api.get(`/inventory/sales/party-item-history?partyId=${partyId}&stockId=${stockId}&limit=all`)
    if (res?.success && res.data?.rows) {
      state.historyCache[cacheKey] = res.data.rows
      modals.history.data = res.data.rows
    }
  } finally {
    modals.history.loading = false
  }
}

// --- KEYBOARD SHORTCUTS ---
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'F2') { e.preventDefault(); modals.stock.show = true }
  if (e.key === 'F3') { e.preventDefault(); modals.party.show = true }
  if (e.key === 'F4') { e.preventDefault(); modals.charges.show = true }
  if (e.key === 'F8') { e.preventDefault(); saveInvoice() }
  if (e.key === 'F9') { e.preventDefault(); resetForm() }
}

onMounted(() => {
  init()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

watch(() => state.selectedParty, (party) => {
  if (party) {
    autoSetBillType()
    syncConsignee()
    fetchPartyBalance(party._id || party.id)
  }
})

watch(() => state.activeFirmLocation, () => {
  autoSetBillType()
  if (state.activeFirmLocation) state.meta.firmGstin = state.activeFirmLocation.gst_number
})

watch(() => state.consigneeSameAsBillTo, syncConsignee)

// --- HELPERS ---
function getExportUrl(id: string, type: string) {
  return `${API_BASE_URL.replace(/\/$/, '')}/inventory/sales/bills/${id}/${type}`
}

function handleAfterSave() {
  if (state.isEditMode || state.isReturnMode) {
    router.push('/sales')
  } else {
    location.reload()
  }
}
</script>

<template>
  <div class="h-[calc(100vh-100px)] flex flex-col bg-gray-50 text-slate-800 font-sans text-[11px] border rounded-lg shadow-sm overflow-hidden" v-if="!state.loading">
    
    <!-- Return Banner -->
    <div v-if="state.isReturnMode" class="bg-amber-100 border-b border-amber-200 px-4 py-1.5 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2 text-amber-800 font-bold">
        <UIcon name="i-heroicons-arrow-uturn-left" class="w-4 h-4" />
        <span>Returning items from Bill <strong class="underline">#{{ state.currentBill?.bno }}</strong></span>
      </div>
      <UButton label="Cancel Return" color="amber" variant="ghost" size="xs" @click="router.push('/sales')" />
    </div>

    <!-- Header -->
    <div class="bg-white border-b p-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-sm z-20 shrink-0">
      <div class="flex flex-wrap gap-2 items-center">
        <h1 class="text-base font-black text-gray-800 mr-2 tracking-tighter italic">{{ state.isReturnMode ? 'CREDIT NOTE' : 'TAX INVOICE' }}</h1>
        
        <div class="flex flex-col">
          <label class="text-[9px] uppercase text-gray-400 font-black tracking-widest">Bill No</label>
          <input type="text" :value="state.meta.billNo" readonly class="border border-gray-300 rounded px-2 py-0.5 w-24 bg-gray-100 text-slate-500 font-bold shadow-inner" />
        </div>

        <div class="flex flex-col">
          <label class="text-[9px] uppercase text-gray-400 font-black tracking-widest">Date</label>
          <input type="date" v-model="state.meta.billDate" class="border border-gray-300 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>

        <div v-if="state.firmLocations.length > 1" class="flex flex-col">
          <label class="text-[9px] uppercase text-gray-400 font-black tracking-widest">Billing From</label>
          <select v-model="state.activeFirmLocation" class="border border-orange-300 bg-orange-50/50 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-orange-400/20 text-orange-900 font-bold">
            <option v-for="l in state.firmLocations" :key="l.gst_number" :value="l">{{ l.gst_number }} ({{ l.state }})</option>
          </select>
        </div>

        <div class="flex flex-col">
          <label class="text-[9px] uppercase text-gray-400 font-black tracking-widest">Type</label>
          <select v-model="state.meta.billType" class="border border-gray-300 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-500/20 font-bold">
            <option value="intra-state">Intra-State (CGST+SGST)</option>
            <option value="inter-state">Inter-State (IGST)</option>
          </select>
        </div>

        <div class="flex items-center gap-2 pt-3">
          <UCheckbox v-model="state.meta.reverseCharge" label="RC" :ui="{ label: 'text-[9px] font-black uppercase text-red-500' }" />
          <div class="text-[9px] font-black px-2 py-0.5 rounded border-2" :class="state.gstEnabled ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'">
            GST: {{ state.gstEnabled ? 'ACTIVE' : 'INACTIVE' }}
          </div>
        </div>
      </div>

      <div class="flex gap-1">
        <UButton label="Charges" variant="soft" size="xs" color="blue" @click="modals.charges.show = true" />
        <template v-if="!state.isReturnMode">
          <UButton label="Add Item (F2)" variant="solid" size="xs" color="blue" @click="modals.stock.show = true" />
          <UButton label="Add Service" variant="outline" size="xs" color="emerald" @click="addService" />
        </template>
        <UButton label="Reset" variant="ghost" size="xs" color="red" @click="resetForm" />
        <UButton :label="state.saving ? 'Saving...' : 'Save (F8)'" size="xs" color="neutral" :loading="state.saving" @click="saveInvoice" />
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-hidden flex flex-col md:flex-row">
      
      <!-- Sidebar -->
      <div class="w-full md:w-60 bg-slate-50 border-r border-gray-200 flex flex-col overflow-y-auto shrink-0">
        <!-- Party Section -->
        <div class="p-3 border-b bg-white">
          <label class="text-[9px] uppercase text-gray-400 font-black tracking-widest block mb-1">Bill To</label>
          <div v-if="state.selectedParty" class="bg-blue-50/50 p-2.5 rounded-xl border-2 border-blue-100 mt-1 shadow-sm">
            <div class="flex justify-between items-start">
              <h3 class="font-black text-xs text-blue-900 truncate flex-1 uppercase tracking-tight">{{ state.selectedParty.firm }}</h3>
              <UButton icon="i-heroicons-pencil" variant="ghost" size="xs" color="blue" @click="modals.party.show = true" v-if="!state.isReturnMode" />
            </div>
            <p class="text-[10px] text-gray-500 line-clamp-2 mt-1 leading-relaxed">{{ state.selectedParty.addr }}</p>
            <div class="flex items-center gap-1 mt-2">
              <span class="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">{{ state.selectedParty.gstin }}</span>
              <span class="bg-white text-blue-600 border border-blue-100 text-[9px] px-1.5 py-0.5 rounded font-bold">{{ state.meta.billType === 'intra-state' ? 'Local' : 'Outer' }}</span>
            </div>
            <div class="mt-2.5 pt-2 border-t border-blue-200/50 flex items-center justify-between">
               <span class="text-[10px] font-black" :class="state.partyBalance.balance >= 0 ? 'text-green-600' : 'text-red-600'">
                 BAL: {{ state.partyBalance.balanceFormatted }}
               </span>
               <span class="text-[8px] font-bold text-blue-400 uppercase tracking-tighter">{{ state.partyBalance.balanceType }}</span>
            </div>
          </div>
          <UButton v-else block label="Select Party (F3)" variant="dashed" size="sm" color="neutral" class="mt-1 border-2" @click="modals.party.show = true" />
        </div>

        <!-- Consignee Section -->
        <div class="p-3 border-b bg-white">
          <div class="flex justify-between items-center mb-1.5">
            <label class="text-[9px] uppercase text-gray-400 font-black tracking-widest">Consignee</label>
            <UCheckbox v-model="state.consigneeSameAsBillTo" label="Mirror" :ui="{ label: 'text-[9px] text-blue-600 font-black uppercase' }" />
          </div>
          <div v-if="!state.consigneeSameAsBillTo" class="space-y-2">
            <input type="text" v-model="state.selectedConsignee.name" placeholder="Consignee Name" class="w-full border border-gray-200 rounded-lg px-2 py-1 text-[11px] focus:border-blue-300 outline-none" />
            <textarea v-model="state.selectedConsignee.address" placeholder="Delivery Address" class="w-full border border-gray-200 rounded-lg px-2 py-1 text-[11px] h-14 resize-none focus:border-blue-300 outline-none"></textarea>
            <div class="grid grid-cols-2 gap-1.5">
              <input type="text" v-model="state.selectedConsignee.gstin" placeholder="GSTIN" class="w-full border border-gray-200 rounded-lg px-2 py-1 text-[11px] uppercase focus:border-blue-300 outline-none" />
              <input type="text" v-model="state.selectedConsignee.state" placeholder="State" class="w-full border border-gray-200 rounded-lg px-2 py-1 text-[11px] focus:border-blue-300 outline-none" />
            </div>
          </div>
          <div v-else class="text-[10px] text-gray-400 italic bg-gray-50 p-2 rounded-lg border border-dashed text-center">Auto-populated from Party</div>
        </div>

        <!-- Meta -->
        <div class="p-3 space-y-3">
          <div>
            <label class="text-[9px] text-gray-400 font-black uppercase tracking-widest">Ref / PO Number</label>
            <input type="text" v-model="state.meta.referenceNo" class="w-full border border-gray-200 rounded-lg px-2 py-1 text-[11px] focus:border-blue-300 outline-none font-bold" />
          </div>
          <div>
            <label class="text-[9px] text-gray-400 font-black uppercase tracking-widest">Vehicle Number</label>
            <input type="text" v-model="state.meta.vehicleNo" class="w-full border border-gray-200 rounded-lg px-2 py-1 text-[11px] focus:border-blue-300 outline-none font-bold" />
          </div>
          <div>
            <label class="text-[9px] text-gray-400 font-black uppercase tracking-widest">Public Narration</label>
            <textarea v-model="state.meta.narration" class="w-full border border-gray-200 rounded-lg px-2 py-1 text-[11px] h-20 resize-none focus:border-blue-300 outline-none" placeholder="Notes for customer..."></textarea>
          </div>
        </div>
      </div>

      <!-- Items Section -->
      <div class="flex-1 bg-white flex flex-col relative min-w-0">
        <!-- Table Header -->
        <div class="bg-gray-100 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-tighter flex pr-2 shrink-0">
          <div class="p-2 w-10 text-center">#</div>
          <div class="p-2 flex-1">Item Description & Specification</div>
          <div class="p-2 w-20">HSN/SAC</div>
          <div class="p-2 w-16 text-right">{{ state.isReturnMode ? 'RET QTY' : 'QTY' }}</div>
          <div class="p-2 w-12 text-center">UNIT</div>
          <div class="p-2 w-24 text-right">RATE (₹)</div>
          <div class="p-2 w-16 text-right">DISC%</div>
          <div class="p-2 w-16 text-right">GST%</div>
          <div class="p-2 w-32 text-right">TOTAL AMOUNT</div>
          <div class="p-2 w-10"></div>
        </div>

        <!-- Table Body -->
        <div class="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div v-if="state.cart.length === 0" class="h-full flex flex-col items-center justify-center text-gray-300 gap-3">
            <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center border border-dashed border-gray-200">
                <UIcon name="i-heroicons-shopping-bag" class="w-8 h-8 opacity-50" />
            </div>
            <div class="text-center">
                <p class="text-sm font-black uppercase tracking-tight text-gray-400">Invoice Empty</p>
                <p class="text-[10px] text-gray-400 mt-1">Press <kbd class="bg-white border rounded px-1">F2</kbd> to add items from stock</p>
            </div>
          </div>

          <div v-for="(it, idx) in state.cart" :key="idx" class="flex flex-col border-b border-gray-100 hover:bg-slate-50 transition-colors">
            <div class="flex items-center min-h-10">
              <div class="p-2 w-10 text-center text-gray-400 font-black text-[10px]">{{ idx + 1 }}</div>
              
              <div class="p-2 flex-1 min-w-0">
                <input v-if="it.itemType === 'SERVICE'" v-model="it.item" class="w-full bg-transparent border-b-2 border-transparent focus:border-blue-400 outline-none font-black text-xs uppercase" placeholder="SERVICE DESCRIPTION" />
                <div v-else class="truncate">
                  <span class="font-black text-slate-800 text-xs uppercase tracking-tight">{{ it.item }}</span>
                  <div class="flex gap-2 text-[9px] font-bold text-gray-400 uppercase mt-0.5">
                    <span v-if="it.batch">BATCH: {{ it.batch }}</span>
                    <span v-if="it.oem">OEM: {{ it.oem }}</span>
                  </div>
                </div>
              </div>

              <div class="p-2 w-20">
                <input v-if="it.itemType === 'SERVICE'" v-model="it.hsn" class="w-full bg-transparent border-b-2 border-transparent focus:border-blue-400 outline-none text-center font-bold" placeholder="SAC" />
                <span v-else class="text-gray-500 font-bold block text-center">{{ it.hsn }}</span>
              </div>

              <div class="p-1 w-16">
                <input v-if="state.isReturnMode" type="number" v-model.number="it.returnQty" class="w-full text-right border-2 border-amber-300 bg-amber-50 rounded px-1.5 py-0.5 outline-none font-black text-amber-700 shadow-sm" />
                <input v-else type="number" v-model.number="it.qty" class="w-full text-right border-2 border-transparent focus:border-blue-400 focus:bg-white rounded px-1.5 py-0.5 outline-none font-black" />
              </div>

              <div class="p-2 w-12 text-center">
                <input v-if="it.itemType === 'SERVICE'" v-model="it.uom" class="w-full bg-transparent border-b-2 border-transparent focus:border-blue-400 outline-none text-center font-bold" placeholder="UOM" />
                <span v-else class="text-gray-400 font-black text-[9px] uppercase">{{ it.uom }}</span>
              </div>

              <div class="p-1 w-24">
                <input v-if="!state.isReturnMode" type="number" v-model.number="it.rate" class="w-full text-right border-2 border-transparent focus:border-blue-400 focus:bg-white rounded px-1.5 py-0.5 outline-none font-black" />
                <span v-else class="block text-right font-black text-slate-600 px-1.5">₹{{ it.rate }}</span>
              </div>

              <div class="p-1 w-16">
                <input v-if="!state.isReturnMode" type="number" v-model.number="it.disc" class="w-full text-right border-2 border-transparent focus:border-blue-400 focus:bg-white rounded px-1.5 py-0.5 outline-none font-black text-blue-600" placeholder="0" />
                <span v-else class="block text-right font-bold text-gray-400 px-1.5">{{ it.disc }}%</span>
              </div>

              <div class="p-1 w-16 text-right">
                <input v-if="it.itemType === 'SERVICE' && !state.isReturnMode" type="number" v-model.number="it.grate" class="w-full text-right border-2 border-transparent focus:border-blue-400 focus:bg-white rounded px-1.5 py-0.5 outline-none font-bold" />
                <span v-else class="block text-right font-bold text-gray-500 px-1.5">{{ it.grate }}%</span>
              </div>

              <div class="p-2 w-32 text-right font-black text-slate-900 tabular-nums text-xs">
                {{ formatCurrency(getItemLineTotal(it)) }}
              </div>

              <div class="p-1 w-10 text-center">
                <UButton icon="i-heroicons-trash" variant="ghost" color="red" size="xs" @click="removeCartItem(idx)" v-if="!state.isReturnMode" class="opacity-20 hover:opacity-100" />
              </div>
            </div>

            <!-- Item Narration Row -->
            <div class="flex items-start px-12 pb-2">
              <label class="text-[8px] uppercase text-gray-400 font-black pt-1 mr-3 shrink-0">Specification</label>
              <textarea v-model="it.narration" class="flex-1 bg-gray-50/50 rounded-lg p-1.5 outline-none text-[10px] min-h-[24px] h-6 focus:h-16 transition-all border border-transparent focus:border-blue-100 resize-none font-medium text-slate-600" placeholder="Add serial numbers, technical specs or row notes..."></textarea>
            </div>
            
            <!-- Service Cost Row -->
            <div v-if="it.itemType === 'SERVICE'" class="flex items-center px-12 pb-2">
              <label class="text-[8px] uppercase text-gray-400 font-black mr-3">INTERNAL COST</label>
              <input type="number" v-model.number="it.costRate" class="w-24 text-[11px] border-b-2 border-transparent focus:border-amber-400 outline-none text-amber-700 font-black" placeholder="0.00" />
              <span class="text-[9px] text-gray-400 ml-3 italic font-medium">Cost per unit for service profit tracking</span>
            </div>
          </div>
        </div>

        <!-- Footer Shortcuts Bar -->
        <div class="p-1.5 bg-gray-100 border-t border-dashed border-gray-300 shrink-0">
           <div class="flex justify-center gap-6 text-[9px] font-black text-gray-500 py-0.5 uppercase tracking-widest">
             <span class="flex items-center gap-1.5"><kbd class="bg-white border-2 border-gray-300 rounded-md px-1.5 py-0.5 shadow-sm text-slate-800">F2</kbd> INVENTORY</span>
             <span class="flex items-center gap-1.5"><kbd class="bg-white border-2 border-gray-300 rounded-md px-1.5 py-0.5 shadow-sm text-slate-800">F3</kbd> CUSTOMERS</span>
             <span class="flex items-center gap-1.5"><kbd class="bg-white border-2 border-gray-300 rounded-md px-1.5 py-0.5 shadow-sm text-slate-800">F4</kbd> CHARGES</span>
             <span class="flex items-center gap-1.5"><kbd class="bg-white border-2 border-gray-300 rounded-md px-1.5 py-0.5 shadow-sm text-slate-800">F8</kbd> COMMIT</span>
             <span class="flex items-center gap-1.5"><kbd class="bg-white border-2 border-gray-300 rounded-md px-1.5 py-0.5 shadow-sm text-slate-800">F9</kbd> ABORT</span>
           </div>
        </div>

        <!-- High Fidelity Totals Section -->
        <div class="bg-slate-900 text-white p-4 shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.5)]">
          <div class="flex flex-col sm:flex-row justify-between items-end gap-6">
            <div class="flex flex-col gap-2 opacity-70 text-[10px] font-bold uppercase tracking-tight">
               <div class="flex gap-6 border-b border-white/10 pb-2">
                 <span>UNIQUE ITEMS: <b class="text-white">{{ state.cart.length }}</b></span>
                 <span>TOTAL QUANTITY: <b class="text-white">{{ state.cart.reduce((s,i) => s + (state.isReturnMode ? (i.returnQty||0) : i.qty), 0) }}</b></span>
               </div>
               <div v-if="state.meta.reverseCharge" class="text-red-400 font-black animate-pulse flex items-center gap-1">
                 <UIcon name="i-heroicons-exclamation-triangle" class="w-3 h-3" />
                 REVERSE CHARGE MECHANISM APPLICABLE
               </div>
               <div class="italic opacity-50 font-normal">* All values calculated according to GST Council regulations</div>
            </div>

            <div class="flex gap-8">
               <div class="text-right space-y-1 text-slate-400 font-black uppercase tracking-wider text-[10px]">
                 <div>TAXABLE VALUE</div>
                 <div v-if="state.meta.billType === 'intra-state'">CGST OUTPUT | SGST OUTPUT</div>
                 <div v-else>IGST OUTPUT (INTEGRATED)</div>
                 <div v-if="state.otherCharges.length">OTHER CHARGES (INC. TAX)</div>
                 <div>ROUND OFF ADJUSTMENT</div>
                 <div class="text-white text-xs pt-3 mt-2 border-t-2 border-slate-700 tracking-widest font-black">NET INVOICE VALUE</div>
               </div>
               <div class="text-right space-y-1 font-mono font-black text-xs tabular-nums">
                 <div class="text-slate-200">{{ formatCurrency(totals.itemTaxableTotal) }}</div>
                 <div v-if="state.meta.billType === 'intra-state'" class="text-slate-400">{{ formatCurrency(totals.cgst) }} | {{ formatCurrency(totals.sgst) }}</div>
                 <div v-else class="text-slate-400">{{ formatCurrency(totals.igst) }}</div>
                 <div v-if="state.otherCharges.length" class="text-slate-400">{{ formatCurrency(totals.otherChargesTotal) }}</div>
                 <div class="text-slate-500">{{ formatCurrency(totals.rof) }}</div>
                 <div class="text-2xl text-blue-400 pt-2 mt-2 border-t-2 border-slate-700 font-black tracking-tighter">{{ formatCurrency(totals.ntot) }}</div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- HIGH FIDELITY MODALS -->
    
    <!-- Stock Selection Modal -->
    <UModal v-model="modals.stock.show" :ui="{ width: 'max-w-4xl' }">
      <div class="flex flex-col h-[85vh] bg-white">
        <div class="bg-slate-900 px-6 py-4 flex justify-between items-center text-white shrink-0">
          <div>
            <h2 class="font-black text-lg tracking-tighter uppercase italic">Inventory Browser</h2>
            <p class="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Select item to add to invoice</p>
          </div>
          <div class="flex gap-4">
            <UInput v-model="modals.stock.search" placeholder="Search by name, oem or hsn..." icon="i-heroicons-magnifying-glass" class="w-80" :ui="{ base: 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' }" />
            <UButton label="New Item" icon="i-heroicons-plus" color="blue" size="sm" @click="modals.createStock.show = true" />
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <table class="w-full text-[11px] border-separate border-spacing-y-1">
            <thead class="bg-slate-50 sticky top-0 z-10">
              <tr class="text-slate-400 font-black uppercase tracking-widest">
                <th class="p-3 text-left">Item Description</th>
                <th class="p-3 text-left">OEM / Part Number</th>
                <th class="p-3 text-right">Available</th>
                <th class="p-3 text-right">Unit Price</th>
                <th class="p-3 text-center">Tax</th>
                <th class="p-3 w-32"></th>
              </tr>
            </thead>
            <tbody class="divide-y-0">
              <tr v-for="s in filteredStocks" :key="s._id" class="bg-slate-50/30 hover:bg-blue-50/50 group transition-all">
                <td class="p-3">
                    <div class="font-black text-slate-800 text-xs uppercase">{{ s.item }}</div>
                    <div class="text-[9px] text-gray-400 font-bold mt-0.5">HSN: {{ s.hsn }}</div>
                </td>
                <td class="p-3">
                    <div class="font-bold text-slate-500 uppercase">{{ s.oem || '-' }}</div>
                    <div class="text-[9px] text-gray-400">{{ s.pno || '-' }}</div>
                </td>
                <td class="p-3 text-right font-black tabular-nums" :class="s.qty > 0 ? 'text-green-600' : 'text-red-500'">{{ s.qty }} {{ s.uom }}</td>
                <td class="p-3 text-right font-black text-slate-900">{{ formatCurrency(s.rate) }}</td>
                <td class="p-3 text-center font-bold text-gray-400">{{ s.grate }}%</td>
                <td class="p-3 flex justify-end gap-1">
                  <UButton label="History" size="xs" color="neutral" variant="ghost" @click.stop="showHistory(s)" />
                  <UButton label="Add Item" size="xs" color="blue" @click.stop="addItem(s)" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </UModal>

    <!-- Create Stock Modal (Sub-Modal) -->
    <UModal v-model="modals.createStock.show" :ui="{ width: 'max-w-xl' }">
      <div class="bg-white">
        <div class="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex justify-between items-center text-white">
          <h3 class="font-black uppercase tracking-widest text-sm">Create New Inventory Item</h3>
          <UButton icon="i-heroicons-x-mark" variant="ghost" color="neutral" @click="modals.createStock.show = false" />
        </div>
        <form @submit.prevent="handleCreateStock" class="p-6 grid grid-cols-2 gap-4">
          <div class="col-span-2">
            <UFormField label="Item Description *">
              <UInput v-model="modals.createStock.data.item" required class="uppercase" />
            </UFormField>
          </div>
          <UFormField label="Part Number (P/No)">
            <UInput v-model="modals.createStock.data.pno" />
          </UFormField>
          <UFormField label="OEM / Brand">
            <UInput v-model="modals.createStock.data.oem" />
          </UFormField>
          <UFormField label="HSN/SAC Code *">
            <UInput v-model="modals.createStock.data.hsn" required />
          </UFormField>
          <div class="grid grid-cols-2 gap-2">
            <UFormField label="Opening Qty *">
              <UInput v-model.number="modals.createStock.data.qty" type="number" step="0.01" required />
            </UFormField>
            <UFormField label="UOM *">
              <USelect v-model="modals.createStock.data.uom" :options="['NOS','PCS','SET','BOX','MTR','KGS']" />
            </UFormField>
          </div>
          <UFormField label="Selling Rate (₹) *">
            <UInput v-model.number="modals.createStock.data.rate" type="number" step="0.01" required />
          </UFormField>
          <UFormField label="GST % *">
            <USelect v-model="modals.createStock.data.grate" :options="['18','12','5','28','0']" />
          </UFormField>
          <div class="col-span-2 pt-4 flex justify-end gap-2">
            <UButton label="Cancel" variant="ghost" color="neutral" @click="modals.createStock.show = false" />
            <UButton type="submit" label="Save Item" color="blue" :loading="modals.createStock.saving" />
          </div>
        </form>
      </div>
    </UModal>

    <!-- History Modal -->
    <UModal v-model="modals.history.show" :ui="{ width: 'max-w-3xl' }">
      <div class="flex flex-col h-[70vh] bg-white">
        <div class="bg-slate-900 px-6 py-4 text-white shrink-0">
          <div class="flex justify-between items-start">
             <div>
                <h3 class="font-black uppercase italic tracking-tighter text-base">{{ modals.history.stock?.item }} — Purchase History</h3>
                <p class="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-0.5">Customer: {{ state.selectedParty?.firm }}</p>
             </div>
             <UButton icon="i-heroicons-x-mark" variant="ghost" color="neutral" @click="modals.history.show = false" />
          </div>
        </div>
        <div class="flex-1 overflow-y-auto custom-scrollbar">
          <div v-if="modals.history.loading" class="h-full flex flex-col items-center justify-center gap-2">
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-blue-500" />
            <span class="text-[10px] font-black text-gray-400 uppercase">Fetching Ledger Data...</span>
          </div>
          <table v-else class="w-full text-[11px]">
            <thead class="bg-slate-50 sticky top-0 z-10 text-slate-400 font-black uppercase tracking-widest border-b">
              <tr>
                <th class="p-4 text-left">Date</th>
                <th class="p-4 text-left">Batch</th>
                <th class="p-4 text-right">Quantity</th>
                <th class="p-4 text-right">Rate</th>
                <th class="p-4 text-right">Total</th>
                <th class="p-4 text-center">Reference</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="h in modals.history.data" :key="h._id" class="hover:bg-slate-50 transition-colors">
                <td class="p-4 font-bold">{{ new Date(h.bdate).toLocaleDateString() }}</td>
                <td class="p-4 font-mono text-gray-400">{{ h.batch || '-' }}</td>
                <td class="p-4 text-right font-black">{{ h.qty }}</td>
                <td class="p-4 text-right font-black">{{ formatCurrency(h.rate) }}</td>
                <td class="p-4 text-right font-black text-blue-600">{{ formatCurrency(h.qty * h.rate) }}</td>
                <td class="p-4 text-center font-mono text-[9px] text-gray-400 uppercase">{{ h.bno }}</td>
              </tr>
              <tr v-if="modals.history.data.length === 0">
                <td colspan="6" class="p-20 text-center text-gray-400 font-black uppercase tracking-widest italic">No prior transaction records found</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </UModal>

    <!-- Party Selection Modal -->
    <UModal v-model="modals.party.show" :ui="{ width: 'max-w-4xl' }">
      <div class="flex flex-col h-[85vh] bg-white">
        <div class="bg-slate-900 px-6 py-4 flex justify-between items-center text-white shrink-0">
          <div>
            <h2 class="font-black text-lg tracking-tighter uppercase italic">Customer Ledger</h2>
            <p class="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Select party for billing</p>
          </div>
          <div class="flex gap-4">
            <UInput v-model="modals.party.search" placeholder="Search by firm name, gstin or state..." icon="i-heroicons-magnifying-glass" class="w-80" :ui="{ base: 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' }" />
            <UButton label="New Party" icon="i-heroicons-user-plus" color="blue" size="sm" @click="modals.createParty.show = true" />
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <table class="w-full text-[11px] border-separate border-spacing-y-1">
            <thead class="bg-slate-50 sticky top-0 z-10">
              <tr class="text-slate-400 font-black uppercase tracking-widest">
                <th class="p-3 text-left">Firm Name / Legal Entity</th>
                <th class="p-3 text-left">GSTIN Identification</th>
                <th class="p-3 text-left">Location</th>
                <th class="p-3 text-right">Contact</th>
                <th class="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody class="divide-y-0">
              <tr v-for="p in filteredParties" :key="p._id" class="bg-slate-50/30 hover:bg-blue-50/50 group transition-all cursor-pointer" @click="state.selectedParty = p; modals.party.show = false">
                <td class="p-3">
                    <div class="font-black text-slate-800 text-xs uppercase">{{ p.firm }}</div>
                    <div class="text-[9px] text-gray-400 font-bold mt-0.5">{{ p.addr }}</div>
                </td>
                <td class="p-3 font-mono font-black text-blue-600">{{ p.gstin }}</td>
                <td class="p-3">
                    <div class="font-bold text-slate-500 uppercase">{{ p.state }}</div>
                    <div class="text-[9px] text-gray-400">State Code: {{ p.state_code }}</div>
                </td>
                <td class="p-3 text-right font-bold text-slate-400">{{ p.contact || '-' }}</td>
                <td class="p-3"><UButton icon="i-heroicons-chevron-right" size="xs" color="blue" variant="ghost" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </UModal>

    <!-- Create Party Modal -->
    <UModal v-model="modals.createParty.show" :ui="{ width: 'max-w-xl' }">
      <div class="bg-white">
        <div class="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex justify-between items-center text-white">
          <h3 class="font-black uppercase tracking-widest text-sm">Register New Party</h3>
          <UButton icon="i-heroicons-x-mark" variant="ghost" color="neutral" @click="modals.createParty.show = false" />
        </div>
        <form @submit.prevent="handleCreateParty" class="p-6 grid grid-cols-2 gap-4">
          <div class="col-span-2">
            <UFormField label="Firm Name *">
              <UInput v-model="modals.createParty.data.firm" required class="uppercase" />
            </UFormField>
          </div>
          <div class="col-span-2">
            <UFormField label="GSTIN Identification">
              <UInput v-model="modals.createParty.data.gstin" class="uppercase font-mono" maxlength="15" />
            </UFormField>
          </div>
          <UFormField label="Contact Number">
            <UInput v-model="modals.createParty.data.contact" />
          </UFormField>
          <UFormField label="State Name *">
            <UInput v-model="modals.createParty.data.state" required />
          </UFormField>
          <div class="col-span-2">
            <UFormField label="Registered Address">
              <UTextarea v-model="modals.createParty.data.addr" :rows="2" />
            </UFormField>
          </div>
          <div class="col-span-2 pt-4 flex justify-end gap-2">
            <UButton label="Cancel" variant="ghost" color="neutral" @click="modals.createParty.show = false" />
            <UButton type="submit" label="Register Party" color="blue" :loading="modals.createParty.saving" />
          </div>
        </form>
      </div>
    </UModal>

    <!-- Batch Selection Modal -->
    <UModal v-model="modals.batch.show" :ui="{ width: 'max-w-md' }">
      <div class="bg-slate-900 p-4 text-white flex justify-between items-center shrink-0">
        <div>
          <h3 class="font-black uppercase tracking-tighter italic">Select Inventory Batch</h3>
          <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{{ modals.batch.stock?.item }}</p>
        </div>
        <UButton icon="i-heroicons-x-mark" variant="ghost" color="neutral" @click="modals.batch.show = false" />
      </div>
      <div class="p-4 bg-gray-50 max-h-[60vh] overflow-y-auto space-y-2 custom-scrollbar">
        <div v-for="(b, idx) in modals.batch.stock?.batches" :key="idx" 
             class="p-4 bg-white border-2 border-gray-100 rounded-2xl hover:border-blue-500 hover:shadow-lg cursor-pointer transition-all group"
             @click="selectBatch(b)">
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <div class="font-black text-slate-800 text-sm group-hover:text-blue-600 transition-colors uppercase">{{ b.batch || 'STANDARD BATCH' }}</div>
              <div class="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-gray-500 mt-2">
                <span>AVAIL: <b class="text-slate-700">{{ b.qty }}</b></span>
                <span>RATE: <b class="text-slate-700">₹{{ b.rate }}</b></span>
                <span v-if="b.expiry">EXP: <b class="text-red-500">{{ b.expiry }}</b></span>
              </div>
            </div>
            <div class="text-right">
              <div class="text-[9px] text-gray-400 font-black uppercase tracking-widest">In Stock</div>
              <div class="font-black text-xl" :class="b.qty > 0 ? 'text-green-600' : 'text-red-500'">{{ b.qty }}</div>
            </div>
          </div>
        </div>
        <div v-if="!modals.batch.stock?.batches?.length" class="text-center py-12 italic text-gray-400 font-black uppercase tracking-widest">
          No active batches found for this item
        </div>
      </div>
    </UModal>

    <!-- Save Confirmation Modal -->
    <UModal v-model="modals.saveConfirm.show" prevent-close>
      <div class="p-8 text-center bg-white">
        <div class="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-green-100 shadow-sm animate-bounce">
          <UIcon name="i-heroicons-check" class="w-10 h-10" />
        </div>
        <h2 class="text-2xl font-black tracking-tighter text-slate-900 uppercase italic">Transaction Committed!</h2>
        <p class="text-sm text-gray-500 mt-2 font-bold">The invoice has been successfully posted to the ledger.</p>
        <div class="bg-slate-50 rounded-xl p-4 my-6 border-2 border-dashed border-slate-200">
            <span class="text-[10px] text-slate-400 font-black uppercase tracking-widest block">Reference Bill Number</span>
            <span class="text-2xl font-black text-slate-800 tracking-tighter">{{ modals.saveConfirm.billNo }}</span>
        </div>
        
        <div class="grid grid-cols-1 gap-3">
          <UButton label="Download PDF Invoice" color="blue" block size="lg" :to="getExportUrl(modals.saveConfirm.billId, 'pdf')" target="_blank" icon="i-heroicons-document-arrow-down" class="font-black" />
          <UButton label="Export to Excel" color="emerald" block size="lg" :to="getExportUrl(modals.saveConfirm.billId, 'excel')" target="_blank" icon="i-heroicons-table-cells" class="font-black" />
          <UButton label="Initiate New Billing" variant="ghost" color="neutral" block @click="handleAfterSave" class="font-bold text-gray-400 uppercase tracking-widest" />
        </div>
      </div>
    </UModal>

  </div>
  
  <div v-else class="h-full flex flex-col items-center justify-center bg-gray-50">
    <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    <p class="text-[10px] text-blue-500 font-black uppercase tracking-[0.2em] mt-6 animate-pulse">Initializing Sales System Components...</p>
  </div>
</template>

<style scoped>
@reference "../../assets/main.css";

:deep(.u-input) {
  @apply text-[11px] h-8 rounded-lg;
}
:deep(.u-select) {
  @apply text-[11px] h-8 rounded-lg;
}
:deep(.u-textarea) {
  @apply text-[11px] rounded-lg;
}
:deep(.u-button) {
  @apply font-black tracking-tight rounded-lg;
}
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  @apply bg-transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  @apply bg-slate-200 rounded-full hover:bg-slate-300;
}
</style>
