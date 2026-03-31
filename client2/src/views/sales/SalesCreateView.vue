<script setup lang="ts">
/**
 * SalesCreateView.vue
 * Full Vue rewrite of the vanilla JS sales system (index.js + layoutRenderer.js + stateManager.js).
 * Supports: create / edit / return (credit note) modes.
 * Components: StockModal, PartyModal, BatchModal, HistoryModal, ChargesModal,
 *             PartyCreateModal, StockCrudModal
 */
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import StockModal       from '@/components/sales/StockModal.vue'
import PartyModal       from '@/components/sales/PartyModal.vue'
import BatchModal       from '@/components/sales/BatchModal.vue'
import HistoryModal     from '@/components/sales/HistoryModal.vue'
import ChargesModal     from '@/components/sales/ChargesModal.vue'
import PartyCreateModal from '@/components/sales/PartyCreateModal.vue'
import StockCrudModal   from '@/components/sales/StockCrudModal.vue'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Batch      { batch?: string|null; qty: number; rate: number; expiry?: string|null; mrp?: number|null }
interface Stock      { id?: string; _id?: string; item: string; batch?: string|null; batches?: Batch[]
                       oem?: string; hsn?: string; pno?: string; qty: number; uom: string; rate: number; grate: number }
interface Party      { _id?: string; id?: string; firm: string; gstin: string; state?: string; addr?: string
                       state_code?: string; pin?: string; contact?: string }
interface Consignee  { name: string; address: string; gstin: string; state: string; pin: string
                       contact: string; deliveryInstructions: string }
interface OtherCharge { name: string; type: string; hsnSac: string; amount: number; gstRate: number; gstAmount?: number }
interface CartItem   { stockId: string|null; itemType: 'GOODS'|'SERVICE'; item: string; narration: string
                       batch: string|null; oem: string; hsn: string; qty: number; showQty: boolean
                       uom: string; rate: number; grate: number; disc: number; costRate?: number
                       returnQty?: number }
interface FirmLocation { gst_number?: string; state?: string; state_code?: string; is_default?: boolean }
interface BillMeta   { billNo: string; billDate: string; billType: string; reverseCharge: boolean
                       referenceNo: string; vehicleNo: string; dispatchThrough: string; narration: string }

// ─── Router ───────────────────────────────────────────────────────────────────
const router = useRouter()
const route  = useRoute()

// ─── Mode detection ───────────────────────────────────────────────────────────
const editBillId   = ref<string|null>(null)
const returnBillId = ref<string|null>(null)
const isEditMode   = ref(false)
const isReturnMode = ref(false)
const currentBill  = ref<any>(null)

// ─── Core data state ──────────────────────────────────────────────────────────
const stocks               = ref<Stock[]>([])
const parties              = ref<Party[]>([])
const cart                 = ref<CartItem[]>([])
const selectedParty        = ref<Party|null>(null)
const selectedConsignee    = ref<Consignee|null>(null)
const consigneeSameAsBillTo = ref(true)
const historyCache         = ref<Record<string, any>>({})
const otherCharges         = ref<OtherCharge[]>([])
const gstEnabled           = ref(true)
const firmLocations        = ref<FirmLocation[]>([])
const activeFirmLocation   = ref<FirmLocation|null>(null)
const currentFirmName      = ref('Your Company Name')
const partyBalance         = ref<{ balance: number; balanceType: string; balanceFormatted: string } | null>(null)

const meta = reactive<BillMeta>({
  billNo: '', billDate: new Date().toISOString().split('T')[0],
  billType: 'intra-state', reverseCharge: false,
  referenceNo: '', vehicleNo: '', dispatchThrough: '', narration: '',
})

// ─── UI / loading state ───────────────────────────────────────────────────────
const appLoading   = ref(true)
const appError     = ref('')
const saveLoading  = ref(false)
const savedBillId  = ref<string|null>(null)
const savedBillNo  = ref('')

// ─── Modal visibility ─────────────────────────────────────────────────────────
const showStockModal       = ref(false)
const showPartyModal       = ref(false)
const showBatchModal       = ref(false)
const showHistoryModal     = ref(false)
const showChargesModal     = ref(false)
const showPartyCreateModal = ref(false)
const showStockCrudModal   = ref(false)
const showSaveConfirmModal = ref(false)

// Modal data
const batchModalStock   = ref<Stock|null>(null)
const historyModalStock = ref<Stock|null>(null)
const stockCrudMode     = ref<'create'|'edit'>('create')
const editingStock      = ref<Stock|null>(null)

// ─── Computed: totals ─────────────────────────────────────────────────────────

function getItemEffectiveQty(item: CartItem): number {
  const qty = Number(item.qty)
  if (Number.isFinite(qty) && qty > 0) return qty
  return item.itemType === 'SERVICE' ? 1 : 0
}
function getItemLineTotal(item: CartItem): number {
  const qty  = getItemEffectiveQty(item)
  const rate = Number(item.rate) || 0
  const disc = Number(item.disc) || 0
  return qty * rate * (1 - disc / 100)
}

const totals = computed(() => {
  const effectiveCart = isReturnMode.value
    ? cart.value.map(i => ({ ...i, qty: i.returnQty || 0 }))
    : cart.value

  let itemTaxableTotal = 0, totalTaxAmount = 0, otherChargesTotal = 0, otherChargesGstTotal = 0

  effectiveCart.forEach(item => {
    const lv = getItemLineTotal(item)
    itemTaxableTotal += lv
    if (gstEnabled.value) totalTaxAmount += lv * ((Number(item.grate) || 0) / 100)
  })
  otherCharges.value.forEach(c => {
    const amt = Number(c.amount) || 0
    otherChargesTotal += amt
    if (gstEnabled.value) otherChargesGstTotal += amt * ((Number(c.gstRate) || 0) / 100)
  })

  let cgst = 0, sgst = 0, igst = 0
  const rc = meta.reverseCharge && gstEnabled.value
  if (gstEnabled.value && meta.billType === 'intra-state') {
    cgst = rc ? 0 : (totalTaxAmount / 2) + (otherChargesGstTotal / 2)
    sgst = rc ? 0 : (totalTaxAmount / 2) + (otherChargesGstTotal / 2)
  } else if (gstEnabled.value) {
    igst = rc ? 0 : totalTaxAmount + otherChargesGstTotal
  }

  const grossBeforeRound = itemTaxableTotal + otherChargesTotal
    + (gstEnabled.value && !meta.reverseCharge ? totalTaxAmount + otherChargesGstTotal : 0)
  const ntot = Math.round(grossBeforeRound)
  const rof  = ntot - grossBeforeRound

  return { itemTaxableTotal, totalTaxAmount, otherChargesTotal, cgst, sgst, igst, grossBeforeRound, ntot, rof }
})

const totalQty = computed(() =>
  (isReturnMode.value
    ? cart.value.map(i => ({ ...i, qty: i.returnQty || 0 }))
    : cart.value
  ).reduce((sum, item) => {
    if (item.itemType === 'SERVICE' && !item.showQty) return sum
    return sum + (Number(item.qty) || 0)
  }, 0).toFixed(2)
)

const intraState = computed(() => meta.billType === 'intra-state')

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n || 0)
}
function getCSRF(): string {
  const name = 'csrfToken='
  for (const cookie of decodeURIComponent(document.cookie).split(';')) {
    const c = cookie.trim()
    if (c.startsWith(name)) return c.substring(name.length)
  }
  return ''
}
async function fetchWithCSRF(url: string, opts: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': getCSRF(),
    ...(opts.headers as Record<string, string>),
  }
  return fetch(url, { credentials: 'same-origin', ...opts, headers })
}

// ─── INDIA_STATE_CODES (needed for bill type detection) ───────────────────────
const INDIA_STATE_CODES: Record<string, string> = {
  'jammu and kashmir':'01','j&k':'01','himachal pradesh':'02','punjab':'03','chandigarh':'04',
  'uttarakhand':'05','haryana':'06','delhi':'07','new delhi':'07','rajasthan':'08',
  'uttar pradesh':'09','up':'09','bihar':'10','sikkim':'11','arunachal pradesh':'12',
  'nagaland':'13','manipur':'14','mizoram':'15','tripura':'16','meghalaya':'17','assam':'18',
  'west bengal':'19','wb':'19','jharkhand':'20','odisha':'21','chhattisgarh':'22',
  'madhya pradesh':'23','mp':'23','gujarat':'24','daman and diu':'25','dadra and nagar haveli':'26',
  'maharashtra':'27','andhra pradesh':'28','ap':'28','karnataka':'29','goa':'30',
  'lakshadweep':'31','kerala':'32','tamil nadu':'33','tn':'33','puducherry':'34',
  'andaman and nicobar islands':'35','telangana':'36','ts':'36','andhra pradesh (new)':'37',
  'ladakh':'38','other territory':'97',
}

function autoSetBillType() {
  const firmCode  = activeFirmLocation.value?.state_code || activeFirmLocation.value?.gst_number?.substring(0, 2)
  const p = selectedParty.value
  const partyCode = p?.state_code ||
    (p?.gstin && p.gstin !== 'UNREGISTERED' ? p.gstin.substring(0, 2) : null) ||
    (p?.state ? INDIA_STATE_CODES[p.state.trim().toLowerCase()] ?? null : null)
  if (!firmCode || !partyCode) return
  meta.billType = firmCode === partyCode ? 'intra-state' : 'inter-state'
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadStocks() {
  const res = await fetch('/api/inventory/sales/stocks', { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
  if (res.ok) { const d = await res.json(); stocks.value = d.success && Array.isArray(d.data) ? d.data : [] }
}

async function loadParties() {
  const res = await fetch('/api/inventory/sales/parties', { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
  if (res.ok) { const d = await res.json(); parties.value = d.success && Array.isArray(d.data) ? d.data : [] }
}

async function loadFirmData() {
  const res = await fetch('/api/inventory/sales/current-firm', { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
  if (!res.ok) return
  const d = await res.json()
  if (!d.success) return
  if (d.data?.name) currentFirmName.value = d.data.name
  if (Array.isArray(d.data?.locations)) {
    firmLocations.value     = d.data.locations
    activeFirmLocation.value = d.data.locations.find((l: FirmLocation) => l.is_default) || d.data.locations[0] || null
  }
}

async function loadNextBillNo() {
  const res = await fetch('/api/inventory/sales/next-bill-number', { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
  if (res.ok) { const d = await res.json(); if (d.success && d.nextBillNumber) meta.billNo = d.nextBillNumber }
  else meta.billNo = 'Will be generated on save'
}

async function loadGstStatus() {
  try {
    const res = await fetch('/api/settings/system-config/gst-status', { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
    if (res.ok) { const d = await res.json(); gstEnabled.value = d.success ? (d.data?.gst_enabled !== false) : true }
  } catch { gstEnabled.value = true }
}

async function loadBillForEdit(billId: string) {
  const res = await fetch(`/api/inventory/sales/bills/${billId}`, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const d = await res.json()
  if (!d.success) throw new Error(d.error || 'Failed to load bill')
  const bill = d.data
  currentBill.value = bill

  meta.billNo          = bill.bno
  meta.billDate        = bill.bdate
  meta.billType        = bill.bill_subtype ? bill.bill_subtype.toLowerCase() : ((bill.cgst || bill.sgst) ? 'intra-state' : 'inter-state')
  meta.reverseCharge   = Boolean(bill.reverse_charge)
  meta.referenceNo     = bill.order_no         || ''
  meta.vehicleNo       = bill.vehicle_no       || ''
  meta.dispatchThrough = bill.dispatch_through || ''
  meta.narration       = bill.narration        || ''

  if (bill.party_id) {
    selectedParty.value = { id: bill.party_id, firm: bill.supply || '', gstin: bill.gstin || '',
      state: bill.state || '', addr: bill.addr || '', pin: bill.pin || null, state_code: bill.state_code || null }
  }

  if (bill.firm_gstin && firmLocations.value.length > 0) {
    const m = firmLocations.value.find((l: FirmLocation) => l.gst_number === bill.firm_gstin)
    if (m) activeFirmLocation.value = m
  }

  if (bill.consignee_name || bill.consignee_address) {
    selectedConsignee.value = { name: bill.consignee_name || '', address: bill.consignee_address || '',
      gstin: bill.consignee_gstin || '', state: bill.consignee_state || '', pin: bill.consignee_pin || '',
      contact: '', deliveryInstructions: '' }
    consigneeSameAsBillTo.value = false
  } else {
    consigneeSameAsBillTo.value = true
  }

  cart.value = (bill.items || []).map((item: any) => {
    const itemType = item.item_type || (item.stock_id ? 'GOODS' : 'SERVICE')
    const parsedQty = parseFloat(item.qty)
    return {
      stockId: item.stock_id, itemType,
      item: item.item, narration: item.item_narration || '',
      batch: item.batch || null, oem: item.oem || '', hsn: item.hsn,
      qty: Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : (itemType === 'SERVICE' ? 1 : 0),
      showQty: item.show_qty !== false, uom: item.uom || (item.stock_id ? 'PCS' : ''),
      rate: parseFloat(item.rate) || 0, costRate: parseFloat(item.cost_rate) || 0,
      grate: parseFloat(item.grate) || 0, disc: parseFloat(item.disc) || 0,
    }
  })
  otherCharges.value = (bill.otherCharges || []).map((c: any) => ({
    name: c.name || c.type || 'Other Charge', type: c.type || 'other', hsnSac: c.hsnSac || '',
    amount: parseFloat(c.amount) || 0, gstRate: parseFloat(c.gstRate) || 0,
  }))
}

async function loadPartyBalance() {
  if (!selectedParty.value) { partyBalance.value = null; return }
  const id = selectedParty.value._id || selectedParty.value.id
  try {
    const res = await fetch(`/api/inventory/sales/party-balance/${id}`, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
    if (!res.ok) return
    const d = await res.json()
    if (!d.success) return
    const bal = d.data?.balance || 0
    const balType = d.data?.balance_type || (bal >= 0 ? 'Debit' : 'Credit')
    const outstanding = d.data?.outstanding ?? Math.abs(bal)
    partyBalance.value = {
      balance: bal, balanceType: balType,
      balanceFormatted: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(outstanding)
    }
  } catch { partyBalance.value = null }
}

// ─── Consignee sync ───────────────────────────────────────────────────────────

function syncConsigneeFromBillTo() {
  if (!selectedParty.value || !consigneeSameAsBillTo.value) return
  selectedConsignee.value = {
    name: selectedParty.value.firm, address: selectedParty.value.addr || '',
    gstin: selectedParty.value.gstin, state: selectedParty.value.state || '',
    pin: selectedParty.value.pin || '', contact: selectedParty.value.contact || '',
    deliveryInstructions: '',
  }
}

function onConsigneeSameToggle(v: boolean) {
  consigneeSameAsBillTo.value = v
  if (v) syncConsigneeFromBillTo()
}

// ─── Cart operations ──────────────────────────────────────────────────────────

function addToCart(stock: Stock) {
  const existing = cart.value.find(i => i.stockId === (stock.id || stock._id) && i.batch === stock.batch && i.itemType !== 'SERVICE')
  if (existing) { existing.qty += 1; existing.showQty = true }
  else cart.value.push({
    stockId: stock.id || stock._id || null, itemType: 'GOODS',
    item: stock.item, narration: '', batch: stock.batch || null,
    oem: stock.oem || '', hsn: stock.hsn || '', qty: 1, showQty: true,
    uom: stock.uom, rate: parseFloat(String(stock.rate)) || 0,
    grate: parseFloat(String(stock.grate)) || 0, disc: 0,
  })
}

function addService() {
  cart.value.push({
    stockId: null, itemType: 'SERVICE', item: '', narration: '',
    batch: null, oem: '', hsn: '', qty: 1, showQty: false, uom: '',
    rate: 0, grate: 18, disc: 0, costRate: 0,
  })
}

function removeCartItem(idx: number) { cart.value.splice(idx, 1) }

function updateCartField(idx: number, field: keyof CartItem, value: any) {
  const item = cart.value[idx]
  if (!item) return
  if (field === 'item' || field === 'hsn' || field === 'uom' || field === 'narration') {
    ;(item as any)[field] = value; return
  }
  if (field === 'qty') {
    if (item.itemType === 'SERVICE') {
      if (!value || value === '') { item.qty = 1; item.showQty = false; return }
      const p = parseFloat(value)
      if (!Number.isFinite(p) || p <= 0) { item.qty = 1; item.showQty = false; return }
      item.qty = p; item.showQty = true; return
    }
    let p = parseFloat(value)
    if (!Number.isFinite(p) || p < 0) p = 0
    item.qty = p; item.showQty = true; return
  }
  if (field === 'returnQty') {
    let p = parseFloat(value)
    if (!Number.isFinite(p) || p < 0) p = 0
    item.returnQty = p; return
  }
  let val = parseFloat(value)
  if (isNaN(val) || val < 0) val = 0
  ;(item as any)[field] = val
}

function calcRowTotal(item: CartItem): number {
  const qty = isReturnMode.value ? (item.returnQty || 0) : getItemEffectiveQty(item)
  return qty * (item.rate || 0) * (1 - (item.disc || 0) / 100)
}

function clearAll() {
  if (!confirm('Clear current invoice details?')) return
  cart.value = []; selectedParty.value = null; otherCharges.value = []
  selectedConsignee.value = null; consigneeSameAsBillTo.value = true; partyBalance.value = null
  historyCache.value = {}
  meta.billNo = ''; meta.referenceNo = ''; meta.vehicleNo = ''; meta.narration = ''
  meta.reverseCharge = false; meta.billType = 'intra-state'
  meta.billDate = new Date().toISOString().split('T')[0]
  loadNextBillNo()
}

// ─── Charge operations ────────────────────────────────────────────────────────

function addCharge(charge: OtherCharge) {
  otherCharges.value.push({
    ...charge,
    gstAmount: gstEnabled.value ? (charge.amount * charge.gstRate) / 100 : 0,
  })
}
function removeCharge(idx: number) { otherCharges.value.splice(idx, 1) }

// ─── Party selection ──────────────────────────────────────────────────────────

async function onPartySelected(party: Party) {
  selectedParty.value = party
  historyCache.value  = {}
  autoSetBillType()
  syncConsigneeFromBillTo()
  showPartyModal.value = false
  await loadPartyBalance()
}

async function onPartyCreated(party: Party) {
  parties.value.push(party)
  showPartyCreateModal.value = false
  await onPartySelected(party)
  showPartyModal.value = false
}

// ─── Stock modal callbacks ────────────────────────────────────────────────────

function onStockSelect(stock: Stock, showBatch: boolean) {
  showStockModal.value = false
  if (showBatch) {
    batchModalStock.value = stock
    showBatchModal.value  = true
  } else {
    addToCart(stock)
  }
}

function onBatchSelected(stockWithBatch: Stock) {
  showBatchModal.value = false
  addToCart(stockWithBatch)
}

function openCreateStock() {
  showStockModal.value = false
  stockCrudMode.value  = 'create'
  editingStock.value   = null
  showStockCrudModal.value = true
}

function openEditStock(stock: Stock) {
  editingStock.value   = stock
  stockCrudMode.value  = 'edit'
  showStockCrudModal.value = true
}

async function onStockSaved() {
  showStockCrudModal.value = false
  await loadStocks()
  if (stockCrudMode.value === 'create') showStockModal.value = true
}

function onViewHistory(stock: Stock) {
  historyModalStock.value = stock
  showHistoryModal.value  = true
}

function onHistoryCacheUpdate(key: string, data: any[]) {
  historyCache.value[key] = data
}

// ─── Save ─────────────────────────────────────────────────────────────────────

async function saveBill() {
  if (cart.value.length === 0) { alert('Cannot save an empty invoice. Please add items.'); return }
  if (!selectedParty.value)   { alert('Please select a party before saving.'); return }

  if (isReturnMode.value) {
    const hasReturn = cart.value.some(i => (i.returnQty || 0) > 0)
    if (!hasReturn) { alert('Please enter return quantities for at least one item.'); return }
    if (!confirm('⚠️ Create Credit Note Confirmation\n\nThis will:\n• Restore items back to stock\n• Reverse sales revenue and tax liability\n• Reduce party balance\n\nContinue?')) return
  } else if (isEditMode.value) {
    if (!confirm('⚠️ Edit Bill Confirmation\n\nEditing this bill will:\n• Update stock quantities\n• Recalculate GST and totals\n• Update accounting ledger entries\n\nThis action cannot be undone. Continue?')) return
  }

  saveLoading.value = true

  try {
    let response: Response

    if (isReturnMode.value) {
      const returnData = {
        originalBillId: returnBillId.value,
        returnCart: cart.value
          .filter(i => (i.returnQty || 0) > 0)
          .map(i => ({ stockId: i.stockId, returnQty: i.returnQty, rate: i.rate, grate: i.grate, disc: i.disc, item: i.item, gstRate: i.grate })),
        narration: meta.narration,
      }
      response = await fetchWithCSRF('/api/inventory/sales/create-credit-note', { method: 'POST', body: JSON.stringify(returnData) })
    } else {
      const billData = {
        meta: { ...meta, firmGstin: activeFirmLocation.value?.gst_number || null },
        party: selectedParty.value._id || selectedParty.value.id,
        cart:  cart.value, otherCharges: otherCharges.value, consignee: selectedConsignee.value,
      }
      const method = isEditMode.value ? 'PUT' : 'POST'
      const url    = isEditMode.value ? `/api/inventory/sales/bills/${editBillId.value}` : '/api/inventory/sales/bills'
      response = await fetchWithCSRF(url, { method, body: JSON.stringify(billData) })
    }

    if (!response.ok) {
      const err = await response.json()
      alert(err.error || `Failed (${response.status})`)
      return
    }
    const result = await response.json()
    if (!result.success) { alert(result.error || 'Failed to save bill'); return }

    savedBillId.value = result.id
    savedBillNo.value = result.billNo
    showSaveConfirmModal.value = true

  } catch (err: any) {
    alert('Error saving: ' + err.message)
  } finally {
    saveLoading.value = false
  }
}

function handleAfterSave() {
  showSaveConfirmModal.value = false
  if (isEditMode.value || isReturnMode.value) {
    router.push('/inventory/reports')
  } else {
    cart.value = []; otherCharges.value = []
    selectedParty.value = null; selectedConsignee.value = null
    partyBalance.value = null; historyCache.value = {}
    consigneeSameAsBillTo.value = true
    loadNextBillNo()
  }
}

async function downloadFile(type: 'pdf'|'excel') {
  if (!savedBillId.value) return
  const urlMap = { pdf: `/api/inventory/sales/bills/${savedBillId.value}/pdf`, excel: `/api/inventory/sales/bills/${savedBillId.value}/excel` }
  const nameMap = { pdf: `Invoice_${savedBillNo.value}.pdf`, excel: `Invoice_${savedBillNo.value}.xlsx` }
  const res = await fetch(urlMap[type], { method: 'GET', credentials: 'same-origin' })
  if (!res.ok) { alert('Download failed'); return }
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = nameMap[type]; a.style.display = 'none'
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  handleAfterSave()
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'F2') { e.preventDefault(); showStockModal.value = true }
  else if (e.key === 'F3') { e.preventDefault(); showPartyModal.value = true }
  else if (e.key === 'F4') { e.preventDefault(); showChargesModal.value = true }
  else if (e.key === 'F8') { e.preventDefault(); saveBill() }
  else if (e.key === 'F9') { e.preventDefault(); clearAll() }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  document.addEventListener('keydown', onKeydown)
  try {
    // Detect mode
    const qEdit   = route.query.edit   as string || sessionStorage.getItem('editBillId')   || null
    const qReturn = route.query.returnFrom as string || sessionStorage.getItem('returnFromBillId') || null
    const validId = (s: string|null) => s && /^[a-f\d]{24}$/i.test(s)

    if (validId(qReturn)) {
      returnBillId.value = qReturn!; isReturnMode.value = true
    } else if (validId(qEdit)) {
      editBillId.value = qEdit!; isEditMode.value = true
    }

    // Parallel bootstrap loads
    await Promise.all([loadFirmData(), loadGstStatus(), loadStocks(), loadParties()])

    if (isReturnMode.value || isEditMode.value) {
      const bid = (isReturnMode.value ? returnBillId : editBillId).value!
      await loadBillForEdit(bid)
      if (isReturnMode.value) {
        sessionStorage.removeItem('returnFromBillId')
        // Rebuild cart as return items
        const origItems = currentBill.value?.items || []
        cart.value = origItems.map((item: any) => ({
          stockId: item.stock_id, itemType: item.item_type || 'GOODS',
          item: item.item, narration: item.item_narration || '',
          batch: item.batch || null, oem: item.oem || '', hsn: item.hsn,
          qty: parseFloat(item.qty) || 0, showQty: item.show_qty !== false,
          uom: item.uom || 'PCS', rate: parseFloat(item.rate) || 0,
          grate: parseFloat(item.grate) || 0, disc: parseFloat(item.disc) || 0,
          returnQty: 0,
        }))
      } else {
        sessionStorage.removeItem('editBillId')
      }
      await loadPartyBalance()
    } else {
      await loadNextBillNo()
      if (selectedParty.value) await loadPartyBalance()
    }

    appError.value = ''
  } catch (err: any) {
    appError.value = err.message || 'Failed to load system'
  } finally {
    appLoading.value = false
  }
})
onUnmounted(() => document.removeEventListener('keydown', onKeydown))

// ─── Bill type badge ──────────────────────────────────────────────────────────
const billTypeBadgeClass = computed(() =>
  meta.billType === 'intra-state'
    ? 'bg-green-100 text-green-800 border-green-200'
    : 'bg-orange-100 text-orange-800 border-orange-200'
)
const billTypeLabel = computed(() =>
  meta.billType === 'intra-state' ? 'Local' : 'Out of State'
)
</script>

<template>
  <!-- ── Loading / Error states ─────────────────────────────────────────── -->
  <div v-if="appLoading" class="flex items-center justify-center h-64 text-gray-400">
    <div class="flex flex-col items-center gap-3">
      <div class="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
      <span class="text-sm">Loading sales system…</span>
    </div>
  </div>

  <div v-else-if="appError" class="p-8 text-center text-red-600 border border-red-200 bg-red-50 rounded m-4">
    <h3 class="font-bold text-lg mb-2">System Error</h3>
    <p class="mb-4">{{ appError }}</p>
    <button @click="$router.push('/inventory/sls')" class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 mr-2">← Back</button>
    <button @click="location.reload()" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Reload</button>
  </div>

  <template v-else>
    <!-- ── Main container ─────────────────────────────────────────────────── -->
    <div class="h-[calc(100vh-140px)] flex flex-col bg-gray-50 text-slate-800 font-sans text-sm border rounded-lg shadow-sm overflow-hidden"
         :class="isReturnMode ? 'border-amber-300' : 'border-gray-300'">

      <!-- Return banner -->
      <div v-if="isReturnMode && currentBill"
           class="bg-amber-100 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
        <div class="flex items-center gap-2 text-amber-800 font-medium text-xs">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3"/>
          </svg>
          Returning items from Bill <strong class="ml-1">#{{ currentBill.bno }}</strong>
          <span class="text-amber-600 ml-1">(dated {{ currentBill.bdate }})</span>
        </div>
        <button @click="$router.push('/inventory/sls')" class="text-xs text-amber-700 hover:underline">Cancel Return</button>
      </div>

      <!-- ── Header bar ──────────────────────────────────────────────────── -->
      <div class="border-b p-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-sm z-20"
           :class="isReturnMode ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'">
        <div class="flex flex-col sm:flex-row flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <h1 class="text-lg font-bold text-gray-800">
              {{ isReturnMode ? 'Credit Note (Sales Return)' : 'Sales Invoice' }}
            </h1>
            <span v-if="isEditMode"   class="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full border border-orange-200">EDIT MODE</span>
            <span v-if="isReturnMode" class="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full border border-amber-200">RETURN MODE</span>
          </div>

          <!-- Bill No -->
          <div class="flex flex-col">
            <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Bill No</label>
            <input :value="isReturnMode ? 'CN-AUTO' : meta.billNo" readonly
                   class="border border-gray-300 rounded px-2 py-1 text-xs font-bold w-32 bg-gray-100 text-slate-500 cursor-not-allowed">
          </div>

          <!-- Date -->
          <div class="flex flex-col">
            <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Date</label>
            <input type="date" v-model="meta.billDate"
                   class="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-slate-700">
          </div>

          <!-- Multi-GSTIN selector -->
          <div v-if="firmLocations.length > 1" class="flex flex-col">
            <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Billing from GSTIN</label>
            <select :value="activeFirmLocation?.gst_number || ''"
                    @change="e => { activeFirmLocation = firmLocations.find(l => l.gst_number === (e.target as HTMLSelectElement).value) || null; autoSetBillType() }"
                    class="border border-orange-300 bg-orange-50 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-orange-400 outline-none text-slate-700 font-medium">
              <option v-for="l in firmLocations" :key="l.gst_number || ''" :value="l.gst_number || ''">
                {{ l.gst_number || 'No GSTIN' }} — {{ l.state || l.state_code || '' }}{{ l.is_default ? ' (Default)' : '' }}
              </option>
            </select>
          </div>

          <!-- Bill type -->
          <div class="flex flex-col">
            <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Transaction Type</label>
            <select v-model="meta.billType"
                    class="border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none text-slate-700 font-medium">
              <option value="intra-state">Intra-State (CGST + SGST)</option>
              <option value="inter-state">Inter-State (IGST)</option>
            </select>
          </div>

          <!-- Reverse charge + GST badge -->
          <div class="flex items-center gap-2 pt-4">
            <label class="flex items-center cursor-pointer">
              <input type="checkbox" v-model="meta.reverseCharge" class="form-checkbox h-4 w-4 text-blue-600 rounded">
              <span class="ml-2 text-[10px] uppercase text-gray-500 font-bold tracking-wider whitespace-nowrap">Reverse Charge</span>
            </label>
            <div class="text-[10px] font-bold px-2 py-1 rounded"
                 :class="gstEnabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'">
              GST: {{ gstEnabled ? 'ON' : 'OFF' }}
            </div>
          </div>
        </div>

        <!-- Header action buttons -->
        <div class="flex flex-wrap gap-2">
          <button @click="showChargesModal = true"
                  class="px-3 py-1.5 text-xs text-blue-600 border border-blue-200 bg-blue-50 rounded hover:bg-blue-100 transition-colors whitespace-nowrap">Other Charges</button>
          <template v-if="!isReturnMode">
            <button @click="showStockModal = true"
                    class="px-3 py-1.5 text-xs text-indigo-600 border border-indigo-200 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors whitespace-nowrap">Add Items (F2)</button>
            <button @click="addService"
                    class="px-3 py-1.5 text-xs text-emerald-700 border border-emerald-200 bg-emerald-50 rounded hover:bg-emerald-100 transition-colors whitespace-nowrap">Add Service</button>
          </template>
          <button @click="clearAll"
                  class="px-3 py-1.5 text-xs text-red-600 border border-red-200 bg-red-50 rounded hover:bg-red-100 transition-colors whitespace-nowrap">Reset</button>
          <button @click="saveBill" :disabled="saveLoading"
                  class="px-4 py-1.5 bg-slate-800 text-white text-xs rounded hover:bg-slate-900 shadow font-medium flex items-center gap-2 transition-colors whitespace-nowrap disabled:opacity-60">
            <span v-if="!saveLoading">💾 {{ isReturnMode ? 'Save Credit Note' : (isEditMode ? 'Update Bill' : 'Save Invoice') }}</span>
            <span v-else class="flex items-center gap-2">
              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Saving…
            </span>
          </button>
        </div>
      </div>

      <!-- ── Main content area ───────────────────────────────────────────── -->
      <div class="flex-1 overflow-hidden flex flex-col md:flex-row">

        <!-- ── Left sidebar ────────────────────────────────────────────── -->
        <div class="w-full md:w-64 bg-slate-50 border-r border-gray-200 flex flex-col overflow-y-auto z-10">

          <!-- Party card -->
          <div class="p-3 border-b border-gray-200 bg-white">
            <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Bill To</label>

            <!-- No party selected -->
            <button v-if="!selectedParty" @click="showPartyModal = true"
                    class="mt-1 w-full py-6 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2 group">
              <span class="text-2xl font-light group-hover:scale-110 transition-transform">+</span>
              <span class="text-xs font-semibold uppercase tracking-wide">Select Party (F3)</span>
            </button>

            <!-- Party selected -->
            <div v-else class="mt-1 bg-blue-50 p-3 rounded border border-blue-200 shadow-sm">
              <div class="flex justify-between items-start">
                <h3 class="font-bold text-sm text-blue-900 truncate flex-1" :title="selectedParty.firm">{{ selectedParty.firm }}</h3>
                <button v-if="!isReturnMode" @click="showPartyModal = true"
                        class="text-[10px] text-blue-600 hover:text-blue-800 font-bold bg-white p-1.5 rounded shadow-sm border border-gray-200 hover:border-blue-300 ml-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
              </div>
              <p class="text-[11px] text-gray-600 truncate mt-1">{{ selectedParty.addr || '' }}</p>
              <div class="flex items-center gap-2 mt-2 flex-wrap">
                <span class="bg-blue-100 text-blue-800 text-[10px] font-mono px-2 py-0.5 rounded border border-blue-200">
                  GST: {{ selectedParty.gstin }}
                </span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded border" :class="billTypeBadgeClass">{{ billTypeLabel }}</span>
              </div>
              <div v-if="partyBalance" class="mt-2">
                <span class="text-[10px] font-mono px-2 py-0.5 rounded border"
                      :class="partyBalance.balance >= 0 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'">
                  BAL: {{ partyBalance.balanceType }} {{ partyBalance.balanceFormatted }}
                </span>
              </div>
            </div>
          </div>

          <!-- Consignee -->
          <div class="p-3 border-b border-gray-200 bg-white mt-3">
            <div class="flex justify-between items-center mb-2">
              <label class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Consignee</label>
              <label class="flex items-center cursor-pointer text-[10px] text-blue-600 font-medium">
                <input type="checkbox" :checked="consigneeSameAsBillTo" @change="onConsigneeSameToggle(($event.target as HTMLInputElement).checked)"
                       class="form-checkbox h-3 w-3 text-blue-600 rounded mr-1">
                Same as Bill To
              </label>
            </div>
            <div class="space-y-2">
              <div v-for="[id, label, placeholder] in [
                ['c-name',   'Consignee Name *', 'Enter consignee name'],
                ['c-addr',   'Address *',        'Delivery address'],
                ['c-gstin',  'GSTIN',            '27ABCDE1234F1Z5'],
                ['c-state',  'State *',          'State'],
                ['c-pin',    'PIN Code',         '6-digit PIN'],
                ['c-contact','Contact',          'Phone/Email'],
                ['c-dinstr', 'Delivery Notes',   'Special instructions'],
              ]" :key="id">
                <div>
                  <label class="text-[10px] text-gray-500 font-bold mb-1 block">{{ label }}</label>
                  <component :is="id === 'c-addr' || id === 'c-dinstr' ? 'textarea' : 'input'"
                             :class="id === 'c-addr' || id === 'c-dinstr' ? 'w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none h-12 resize-none' : 'w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none'"
                             :value="id === 'c-name' ? selectedConsignee?.name : id === 'c-addr' ? selectedConsignee?.address : id === 'c-gstin' ? selectedConsignee?.gstin : id === 'c-state' ? selectedConsignee?.state : id === 'c-pin' ? selectedConsignee?.pin : id === 'c-contact' ? selectedConsignee?.contact : selectedConsignee?.deliveryInstructions"
                             :placeholder="placeholder"
                             @input="e => {
                               if (!selectedConsignee) selectedConsignee = { name:'',address:'',gstin:'',state:'',pin:'',contact:'',deliveryInstructions:'' }
                               const v = (e.target as HTMLInputElement).value
                               if (id === 'c-name')   selectedConsignee!.name = v
                               else if (id === 'c-addr')   selectedConsignee!.address = v
                               else if (id === 'c-gstin')  selectedConsignee!.gstin = v
                               else if (id === 'c-state')  selectedConsignee!.state = v
                               else if (id === 'c-pin')    selectedConsignee!.pin = v
                               else if (id === 'c-contact') selectedConsignee!.contact = v
                               else selectedConsignee!.deliveryInstructions = v
                             }">
                  </component>
                </div>
              </div>
            </div>
          </div>

          <!-- Meta fields -->
          <div class="p-3 space-y-3">
            <div>
              <label class="text-[10px] text-gray-500 font-bold">Reference / PO No</label>
              <input v-model="meta.referenceNo" type="text"
                     class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="e.g. PO-2025-001">
            </div>
            <div>
              <label class="text-[10px] text-gray-500 font-bold">Vehicle No</label>
              <input v-model="meta.vehicleNo" type="text"
                     class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none" placeholder="e.g. KA01AB1234">
            </div>
            <div>
              <label class="text-[10px] text-gray-500 font-bold">Narration</label>
              <textarea v-model="meta.narration"
                        class="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none h-20 resize-none" placeholder="Additional notes…"></textarea>
            </div>
          </div>
        </div>

        <!-- ── Items table ─────────────────────────────────────────────── -->
        <div class="flex-1 bg-white flex flex-col relative min-w-0">

          <!-- Column header -->
          <div class="bg-gray-100 border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase tracking-wider flex pr-2 shrink-0">
            <div class="p-2 w-10 text-center">#</div>
            <div class="p-2 flex-1">Item Description</div>
            <div class="p-2 w-20">HSN</div>
            <template v-if="isReturnMode">
              <div class="p-2 w-16 text-right">Orig Qty</div>
              <div class="p-2 w-16 text-right">Ret Qty</div>
            </template>
            <template v-else>
              <div class="p-2 w-16 text-right">Qty</div>
            </template>
            <div class="p-2 w-12 text-center">Unit</div>
            <div class="p-2 w-24 text-right">Rate</div>
            <div class="p-2 w-16 text-right">Disc %</div>
            <div class="p-2 w-16 text-right">Tax %</div>
            <div class="p-2 w-28 text-right">Total</div>
            <div class="p-2 w-10 text-center"></div>
          </div>

          <!-- Cart rows -->
          <div class="flex-1 overflow-y-auto relative">
            <!-- Empty state -->
            <div v-if="cart.length === 0"
                 class="absolute inset-0 flex flex-col items-center justify-center text-gray-300 select-none pointer-events-none">
              <svg class="w-16 h-16 mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
              <p class="text-sm font-medium text-gray-400">Cart is empty</p>
              <p class="text-xs text-gray-400 mt-1">
                <kbd class="font-mono bg-gray-100 px-1 rounded border border-gray-300">F2</kbd> Add Items &nbsp;|&nbsp;
                <kbd class="font-mono bg-gray-100 px-1 rounded border border-gray-300">F3</kbd> Party &nbsp;|&nbsp;
                <kbd class="font-mono bg-gray-100 px-1 rounded border border-gray-300">F4</kbd> Charges
              </p>
            </div>

            <!-- Item rows -->
            <template v-for="(item, idx) in cart" :key="idx">
              <div class="flex items-center border-b border-gray-100 text-xs text-gray-700 hover:bg-blue-50 transition-colors min-h-10 group bg-white"
                   :class="[isReturnMode ? 'bg-amber-50/20' : '', item.itemType === 'SERVICE' ? 'bg-emerald-50/10' : '']">
                <div class="p-2 w-10 text-center text-gray-400 font-mono">{{ idx + 1 }}</div>

                <!-- Item name -->
                <div class="p-2 flex-1 font-medium truncate flex flex-col justify-center">
                  <input v-if="item.itemType === 'SERVICE'" type="text" :value="item.item"
                         @input="updateCartField(idx, 'item', ($event.target as HTMLInputElement).value)"
                         :readonly="isReturnMode"
                         class="w-full text-xs bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 font-medium text-gray-800"
                         placeholder="Service description">
                  <span v-else class="text-gray-800">{{ item.item }}</span>
                  <span class="text-[10px] text-gray-400 font-normal">
                    {{ item.itemType === 'SERVICE' ? 'Service Line' : `Batch: ${item.batch || '-'} | OEM: ${item.oem || '-'}` }}
                  </span>
                </div>

                <!-- HSN -->
                <div class="p-2 w-20 text-gray-500">
                  <input v-if="item.itemType === 'SERVICE'" type="text" :value="item.hsn"
                         @input="updateCartField(idx, 'hsn', ($event.target as HTMLInputElement).value)"
                         :readonly="isReturnMode"
                         class="w-full text-xs bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 text-gray-500"
                         placeholder="SAC">
                  <span v-else>{{ item.hsn }}</span>
                </div>

                <!-- Qty (return mode: orig + ret qty) -->
                <template v-if="isReturnMode">
                  <div class="p-2 w-16 text-right text-gray-400 font-medium">{{ item.qty }}</div>
                  <div class="p-1 w-16">
                    <input type="number" :value="item.returnQty || 0" :min="0" :max="item.qty" step="0.01"
                           @input="updateCartField(idx, 'returnQty', ($event.target as HTMLInputElement).value)"
                           class="w-full text-right bg-amber-50 border-b border-amber-200 focus:bg-white focus:border-amber-500 outline-none px-1 font-bold text-amber-700 rounded text-xs">
                  </div>
                </template>
                <template v-else>
                  <div class="p-1 w-16">
                    <input type="number" min="0" step="0.01"
                           :value="item.showQty === false ? '' : item.qty"
                           @input="updateCartField(idx, 'qty', ($event.target as HTMLInputElement).value)"
                           class="w-full text-right bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 font-semibold text-blue-700 text-xs">
                  </div>
                </template>

                <!-- UOM -->
                <div class="p-2 w-12 text-center text-gray-500 text-[10px]">
                  <input v-if="item.itemType === 'SERVICE'" type="text" :value="item.uom"
                         @input="updateCartField(idx, 'uom', ($event.target as HTMLInputElement).value)"
                         :readonly="isReturnMode"
                         class="w-full text-[10px] text-center bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1"
                         placeholder="UOM">
                  <span v-else>{{ item.uom }}</span>
                </div>

                <!-- Rate -->
                <div class="p-1 w-24">
                  <input type="number" min="0" step="0.01" :value="item.rate" :readonly="isReturnMode"
                         @input="updateCartField(idx, 'rate', ($event.target as HTMLInputElement).value)"
                         class="w-full text-right bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 text-xs">
                </div>

                <!-- Disc -->
                <div class="p-1 w-16">
                  <input type="number" min="0" max="100" step="0.01" :value="item.disc || 0" :readonly="isReturnMode"
                         @input="updateCartField(idx, 'disc', ($event.target as HTMLInputElement).value)"
                         class="w-full text-right bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 placeholder-gray-300 text-xs" placeholder="0">
                </div>

                <!-- GST % -->
                <div class="p-1 w-16">
                  <input v-if="item.itemType === 'SERVICE'" type="number" min="0" max="100" step="0.01" :value="item.grate || 0" :readonly="isReturnMode"
                         @input="updateCartField(idx, 'grate', ($event.target as HTMLInputElement).value)"
                         class="w-full text-right bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 text-gray-600 text-xs">
                  <div v-else class="p-1 text-right text-gray-600 text-xs">{{ item.grate }}%</div>
                </div>

                <!-- Row total -->
                <div class="p-2 w-28 text-right font-bold text-gray-800 bg-gray-50/50 group-hover:bg-transparent tabular-nums text-xs">
                  {{ fmt(calcRowTotal(item)) }}
                </div>

                <!-- Remove -->
                <div class="p-2 w-10 text-center">
                  <button v-if="!isReturnMode" @click="removeCartItem(idx)"
                          class="text-gray-300 hover:text-red-500 transition-colors font-bold text-lg leading-none">&times;</button>
                </div>
              </div>

              <!-- Narration row -->
              <div class="flex items-start border-b border-gray-100 text-xs text-gray-700 group bg-white pl-20 pr-2 py-1">
                <div class="flex-1 text-[10px] text-gray-500 uppercase tracking-wide pt-1">Item Narration</div>
                <div class="flex-1 p-1">
                  <textarea :value="item.narration || ''"
                            @input="updateCartField(idx, 'narration', ($event.target as HTMLTextAreaElement).value)"
                            class="w-full text-xs bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 min-h-8 resize-y"
                            placeholder="Add narration for this item"></textarea>
                </div>
              </div>

              <!-- Service cost row -->
              <div v-if="item.itemType === 'SERVICE'"
                   class="flex items-center border-b border-gray-100 text-xs text-gray-700 group bg-white pl-20 pr-2 py-1">
                <div class="flex-1 text-[10px] text-gray-500 uppercase tracking-wide">Service Cost</div>
                <div class="w-36 p-1">
                  <input type="number" min="0" step="0.01" :value="item.costRate || 0" :readonly="isReturnMode"
                         @input="updateCartField(idx, 'costRate', ($event.target as HTMLInputElement).value)"
                         class="w-full text-right bg-transparent border-b border-transparent focus:bg-white focus:border-blue-500 outline-none px-1 text-amber-700 font-semibold text-xs" placeholder="0.00">
                </div>
                <div class="flex-1 text-[10px] text-gray-400 pl-3">Optional per-unit cost for COGS posting</div>
              </div>
            </template>
          </div>

          <!-- Add items button bar -->
          <div class="p-2 border-t border-dashed border-gray-200 bg-gray-50 shrink-0">
            <button @click="showStockModal = true"
                    class="w-full py-2 border border-dashed border-blue-300 text-blue-600 rounded hover:bg-blue-50 text-xs font-bold transition-colors uppercase tracking-wide">
              + Add Items (F2) &nbsp;|&nbsp; Select Party (F3) &nbsp;|&nbsp; Charges (F4) &nbsp;|&nbsp; Save (F8) &nbsp;|&nbsp; Reset (F9)
            </button>
          </div>

          <!-- ── Totals footer ──────────────────────────────────────────── -->
          <div class="bg-slate-50 border-t border-slate-300 p-4 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div class="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
              <div class="text-[11px] text-gray-400 space-y-1">
                <div class="flex gap-4">
                  <span>Total Items: <b class="text-gray-600">{{ cart.length }}</b></span>
                  <span>{{ isReturnMode ? 'Ret Qty' : 'Total Qty' }}: <b :class="isReturnMode ? 'text-amber-700' : 'text-gray-600'">{{ totalQty }}</b></span>
                </div>
                <div v-if="meta.reverseCharge" class="text-red-600 font-bold">REVERSE CHARGE APPLIES</div>
                <div class="text-gray-400 italic mt-2">* Rates inclusive of discounts before tax</div>
              </div>

              <div class="flex gap-6 text-xs">
                <div class="text-right space-y-1.5 text-gray-500 font-medium">
                  <div class="mb-2 text-[10px] uppercase font-bold tracking-wider text-gray-400">{{ isReturnMode ? 'Return Totals' : 'Invoice Totals' }}</div>
                  <div>Taxable Value</div>
                  <template v-if="intraState">
                    <div>CGST Output</div>
                    <div>SGST Output</div>
                  </template>
                  <template v-else>
                    <div>IGST Output</div>
                  </template>
                  <div v-if="otherCharges.length">Other Charges</div>
                  <div>Round Off</div>
                  <div class="pt-2 mt-2 border-t border-gray-200 font-bold text-gray-700">Net Total</div>
                </div>
                <div class="text-right space-y-1.5 font-mono font-bold text-gray-800">
                  <div class="mb-2 h-4"></div>
                  <div class="tabular-nums">{{ fmt(totals.itemTaxableTotal) }}</div>
                  <template v-if="intraState">
                    <div class="text-gray-600 tabular-nums">{{ fmt(totals.cgst) }}</div>
                    <div class="text-gray-600 tabular-nums">{{ fmt(totals.sgst) }}</div>
                  </template>
                  <template v-else>
                    <div class="text-gray-600 tabular-nums">{{ fmt(totals.igst) }}</div>
                  </template>
                  <div v-if="otherCharges.length" class="text-gray-600 tabular-nums">{{ fmt(totals.otherChargesTotal) }}</div>
                  <div class="text-gray-600 tabular-nums">{{ fmt(totals.rof) }}</div>
                  <div class="pt-2 mt-2 border-t border-gray-200 font-bold text-lg leading-none tabular-nums"
                       :class="isReturnMode ? 'text-amber-700' : 'text-blue-700'">
                    {{ fmt(totals.ntot) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════
         MODALS
    ══════════════════════════════════════════════════════════════════════ -->

    <!-- Stock modal -->
    <Teleport to="body">
      <div v-if="showStockModal"
           class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center backdrop-blur-sm"
           @click.self="showStockModal = false">
        <div class="bg-white rounded shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
          <StockModal :stocks="stocks"
                      @select="onStockSelect"
                      @create="openCreateStock"
                      @edit="openEditStock"
                      @history="onViewHistory"
                      @close="showStockModal = false" />
        </div>
      </div>
    </Teleport>

    <!-- Party modal -->
    <Teleport to="body">
      <div v-if="showPartyModal"
           class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center backdrop-blur-sm"
           @click.self="showPartyModal = false">
        <div class="bg-white rounded shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <PartyModal :parties="parties"
                      @select="onPartySelected"
                      @create="() => { showPartyModal = false; showPartyCreateModal = true }"
                      @close="showPartyModal = false" />
        </div>
      </div>
    </Teleport>

    <!-- Batch modal (sub-modal) -->
    <Teleport to="body">
      <div v-if="showBatchModal && batchModalStock"
           class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm"
           @click.self="showBatchModal = false">
        <div class="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-300">
          <BatchModal :stock="batchModalStock"
                      @select="onBatchSelected"
                      @close="showBatchModal = false" />
        </div>
      </div>
    </Teleport>

    <!-- History modal -->
    <Teleport to="body">
      <div v-if="showHistoryModal && historyModalStock"
           class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center backdrop-blur-sm"
           @click.self="showHistoryModal = false">
        <div class="bg-white rounded shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
          <HistoryModal :stock="historyModalStock"
                        :party="selectedParty"
                        :history-cache="historyCache"
                        @cache-update="onHistoryCacheUpdate"
                        @close="showHistoryModal = false" />
        </div>
      </div>
    </Teleport>

    <!-- Charges modal -->
    <Teleport to="body">
      <div v-if="showChargesModal"
           class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center backdrop-blur-sm"
           @click.self="showChargesModal = false">
        <div class="bg-white rounded shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
          <ChargesModal :charges="otherCharges"
                        @add="addCharge"
                        @remove="removeCharge"
                        @save="() => {}"
                        @close="showChargesModal = false" />
        </div>
      </div>
    </Teleport>

    <!-- Party create sub-modal -->
    <Teleport to="body">
      <div v-if="showPartyCreateModal"
           class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm"
           @click.self="showPartyCreateModal = false">
        <div class="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-300">
          <PartyCreateModal @saved="onPartyCreated" @close="showPartyCreateModal = false" />
        </div>
      </div>
    </Teleport>

    <!-- Stock CRUD sub-modal -->
    <Teleport to="body">
      <div v-if="showStockCrudModal"
           class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm"
           @click.self="showStockCrudModal = false">
        <div class="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-300">
          <StockCrudModal :mode="stockCrudMode"
                          :stock="editingStock"
                          @saved="onStockSaved"
                          @close="showStockCrudModal = false" />
        </div>
      </div>
    </Teleport>

    <!-- Save Confirmation modal -->
    <Teleport to="body">
      <div v-if="showSaveConfirmModal"
           class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
          <div class="bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-5 text-white text-center">
            <div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h3 class="text-base font-bold tracking-wide">
              {{ isReturnMode ? 'Credit Note Created!' : (isEditMode ? 'Bill Updated!' : 'Invoice Saved!') }}
            </h3>
            <p class="text-green-100 text-sm mt-1">Bill No: <span class="font-bold text-white">{{ savedBillNo }}</span></p>
          </div>
          <div class="p-5 flex flex-col gap-2">
            <button @click="downloadFile('pdf')"
                    class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow transition-colors flex items-center justify-center gap-2">
              📄 Download PDF
            </button>
            <button @click="downloadFile('excel')"
                    class="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow transition-colors flex items-center justify-center gap-2">
              📊 Download Excel
            </button>
            <button @click="handleAfterSave"
                    class="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </template>
</template>
