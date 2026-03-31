<script setup lang="ts">
/**
 * SalesCreateView.vue
 * Full Vue 3 + Nuxt UI rewrite of the vanilla JS sales system.
 * Modes: create | edit | return (credit note)
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
interface Batch       { batch?: string|null; qty: number; rate: number; expiry?: string|null; mrp?: number|null }
interface Stock       { id?: string; _id?: string; item: string; batch?: string|null; batches?: Batch[]
                        oem?: string; hsn?: string; pno?: string; qty: number; uom: string; rate: number; grate: number }
interface Party       { _id?: string; id?: string; firm: string; gstin: string; state?: string; addr?: string
                        state_code?: string; pin?: string; contact?: string }
interface Consignee   { name: string; address: string; gstin: string; state: string
                        pin: string; contact: string; deliveryInstructions: string }
interface OtherCharge { name: string; type: string; hsnSac: string; amount: number; gstRate: number; gstAmount?: number }
interface CartItem    { stockId: string|null; itemType: 'GOODS'|'SERVICE'; item: string; narration: string
                        batch: string|null; oem: string; hsn: string; qty: number; showQty: boolean
                        uom: string; rate: number; grate: number; disc: number; costRate?: number; returnQty?: number }
interface FirmLocation{ gst_number?: string; state?: string; state_code?: string; is_default?: boolean }
interface BillMeta    { billNo: string; billDate: string; billType: string; reverseCharge: boolean
                        referenceNo: string; vehicleNo: string; dispatchThrough: string; narration: string }

// ─── Router / Route ───────────────────────────────────────────────────────────
const router = useRouter()
const route  = useRoute()

// ─── Mode ─────────────────────────────────────────────────────────────────────
const editBillId   = ref<string|null>(null)
const returnBillId = ref<string|null>(null)
const isEditMode   = ref(false)
const isReturnMode = ref(false)
const currentBill  = ref<any>(null)

// ─── Data state ───────────────────────────────────────────────────────────────
const stocks              = ref<Stock[]>([])
const parties             = ref<Party[]>([])
const cart                = ref<CartItem[]>([])
const selectedParty       = ref<Party|null>(null)
const selectedConsignee   = ref<Consignee|null>(null)
const consigneeSameAsBillTo = ref(true)
const historyCache        = ref<Record<string, any>>({})
const otherCharges        = ref<OtherCharge[]>([])
const gstEnabled          = ref(true)
const firmLocations       = ref<FirmLocation[]>([])
const activeFirmLocation  = ref<FirmLocation|null>(null)
const partyBalance        = ref<{ balance: number; balanceType: string; balanceFormatted: string }|null>(null)

const meta = reactive<BillMeta>({
  billNo: '', billDate: new Date().toISOString().split('T')[0],
  billType: 'intra-state', reverseCharge: false,
  referenceNo: '', vehicleNo: '', dispatchThrough: '', narration: '',
})

// ─── UI state ─────────────────────────────────────────────────────────────────
const appLoading  = ref(true)
const appError    = ref('')
const saveLoading = ref(false)
const savedBillId = ref<string|null>(null)
const savedBillNo = ref('')

// Modal open states
const showStockModal        = ref(false)
const showPartyModal        = ref(false)
const showBatchModal        = ref(false)
const showHistoryModal      = ref(false)
const showChargesModal      = ref(false)
const showPartyCreateModal  = ref(false)
const showStockCrudModal    = ref(false)
const showSaveConfirmModal  = ref(false)

// Modal data refs
const batchModalStock   = ref<Stock|null>(null)
const historyModalStock = ref<Stock|null>(null)
const stockCrudMode     = ref<'create'|'edit'>('create')
const editingStock      = ref<Stock|null>(null)

// ─── INDIA_STATE_CODES ────────────────────────────────────────────────────────
const INDIA_STATE_CODES: Record<string, string> = {
  'jammu and kashmir':'01','j&k':'01','himachal pradesh':'02','punjab':'03','chandigarh':'04',
  'uttarakhand':'05','haryana':'06','delhi':'07','new delhi':'07','rajasthan':'08',
  'uttar pradesh':'09','up':'09','bihar':'10','sikkim':'11','arunachal pradesh':'12',
  'nagaland':'13','manipur':'14','mizoram':'15','tripura':'16','meghalaya':'17','assam':'18',
  'west bengal':'19','wb':'19','jharkhand':'20','odisha':'21','chhattisgarh':'22',
  'madhya pradesh':'23','mp':'23','gujarat':'24','daman and diu':'25','dadra and nagar haveli':'26',
  'maharashtra':'27','andhra pradesh':'28','ap':'28','karnataka':'29','goa':'30',
  'lakshadweep':'31','kerala':'32','tamil nadu':'33','tn':'33','puducherry':'34',
  'andaman and nicobar islands':'35','telangana':'36','ts':'36',
  'andhra pradesh (new)':'37','ladakh':'38','other territory':'97',
}

// ─── Computed: totals ─────────────────────────────────────────────────────────
function getItemEffectiveQty(item: CartItem) {
  const qty = Number(item.qty)
  if (Number.isFinite(qty) && qty > 0) return qty
  return item.itemType === 'SERVICE' ? 1 : 0
}
function getItemLineTotal(item: CartItem) {
  return getItemEffectiveQty(item) * (Number(item.rate) || 0) * (1 - (Number(item.disc) || 0) / 100)
}

const totals = computed(() => {
  const effectiveCart = isReturnMode.value
    ? cart.value.map(i => ({ ...i, qty: i.returnQty || 0 }))
    : cart.value

  let itemTaxable = 0, taxAmount = 0, chargesTotal = 0, chargesGst = 0

  effectiveCart.forEach(i => {
    const lv = getItemLineTotal(i)
    itemTaxable += lv
    if (gstEnabled.value) taxAmount += lv * ((Number(i.grate) || 0) / 100)
  })
  otherCharges.value.forEach(c => {
    const amt = Number(c.amount) || 0
    chargesTotal += amt
    if (gstEnabled.value) chargesGst += amt * ((Number(c.gstRate) || 0) / 100)
  })

  const rc = meta.reverseCharge && gstEnabled.value
  let cgst = 0, sgst = 0, igst = 0
  if (gstEnabled.value && meta.billType === 'intra-state') {
    cgst = rc ? 0 : (taxAmount / 2) + (chargesGst / 2)
    sgst = rc ? 0 : (taxAmount / 2) + (chargesGst / 2)
  } else if (gstEnabled.value) {
    igst = rc ? 0 : taxAmount + chargesGst
  }

  const gross = itemTaxable + chargesTotal
    + (gstEnabled.value && !meta.reverseCharge ? taxAmount + chargesGst : 0)
  const ntot = Math.round(gross)
  return { itemTaxable, taxAmount, chargesTotal, cgst, sgst, igst, gross, ntot, rof: ntot - gross }
})

const totalQty = computed(() =>
  (isReturnMode.value ? cart.value.map(i => ({ ...i, qty: i.returnQty || 0 })) : cart.value)
    .reduce((s, i) => (i.itemType === 'SERVICE' && !i.showQty ? s : s + (Number(i.qty) || 0)), 0)
    .toFixed(2)
)
const intraState = computed(() => meta.billType === 'intra-state')

// ─── Utilities ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n || 0)

function getCSRF(): string {
  const name = 'csrfToken='
  for (const c of decodeURIComponent(document.cookie).split(';')) {
    const t = c.trim()
    if (t.startsWith(name)) return t.substring(name.length)
  }
  return ''
}
async function fetchWithCSRF(url: string, opts: RequestInit = {}) {
  return fetch(url, {
    credentials: 'same-origin', ...opts,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCSRF(), ...(opts.headers as any) },
  })
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

// ─── Data loaders ─────────────────────────────────────────────────────────────
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
async function loadPartyBalance() {
  if (!selectedParty.value) { partyBalance.value = null; return }
  const id = selectedParty.value._id || selectedParty.value.id
  try {
    const res = await fetch(`/api/inventory/sales/party-balance/${id}`, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
    if (!res.ok) return
    const d = await res.json()
    if (!d.success) return
    const bal = d.data?.balance || 0
    partyBalance.value = {
      balance: bal, balanceType: d.data?.balance_type || (bal >= 0 ? 'Debit' : 'Credit'),
      balanceFormatted: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(d.data?.outstanding ?? Math.abs(bal))
    }
  } catch { partyBalance.value = null }
}

async function loadBillForEdit(billId: string) {
  const res = await fetch(`/api/inventory/sales/bills/${billId}`, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const d = await res.json()
  if (!d.success) throw new Error(d.error || 'Failed to load bill')
  const bill = d.data
  currentBill.value = bill

  meta.billNo = bill.bno; meta.billDate = bill.bdate
  meta.billType = bill.bill_subtype?.toLowerCase() ?? ((bill.cgst || bill.sgst) ? 'intra-state' : 'inter-state')
  meta.reverseCharge = Boolean(bill.reverse_charge); meta.referenceNo = bill.order_no || ''
  meta.vehicleNo = bill.vehicle_no || ''; meta.dispatchThrough = bill.dispatch_through || ''; meta.narration = bill.narration || ''

  if (bill.party_id) selectedParty.value = { id: bill.party_id, firm: bill.supply || '', gstin: bill.gstin || '',
    state: bill.state || '', addr: bill.addr || '', pin: bill.pin || null, state_code: bill.state_code || null }

  if (bill.firm_gstin && firmLocations.value.length > 0) {
    const m = firmLocations.value.find((l: FirmLocation) => l.gst_number === bill.firm_gstin)
    if (m) activeFirmLocation.value = m
  }

  if (bill.consignee_name || bill.consignee_address) {
    selectedConsignee.value = { name: bill.consignee_name || '', address: bill.consignee_address || '',
      gstin: bill.consignee_gstin || '', state: bill.consignee_state || '', pin: bill.consignee_pin || '',
      contact: '', deliveryInstructions: '' }
    consigneeSameAsBillTo.value = false
  } else { consigneeSameAsBillTo.value = true }

  cart.value = (bill.items || []).map((item: any) => {
    const itemType = item.item_type || (item.stock_id ? 'GOODS' : 'SERVICE')
    const parsedQty = parseFloat(item.qty)
    return { stockId: item.stock_id, itemType, item: item.item, narration: item.item_narration || '',
      batch: item.batch || null, oem: item.oem || '', hsn: item.hsn,
      qty: Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : (itemType === 'SERVICE' ? 1 : 0),
      showQty: item.show_qty !== false, uom: item.uom || (item.stock_id ? 'PCS' : ''),
      rate: parseFloat(item.rate) || 0, costRate: parseFloat(item.cost_rate) || 0,
      grate: parseFloat(item.grate) || 0, disc: parseFloat(item.disc) || 0 }
  })
  otherCharges.value = (bill.otherCharges || []).map((c: any) => ({
    name: c.name || c.type || 'Other Charge', type: c.type || 'other', hsnSac: c.hsnSac || '',
    amount: parseFloat(c.amount) || 0, gstRate: parseFloat(c.gstRate) || 0,
  }))
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

// ─── Cart ─────────────────────────────────────────────────────────────────────
function addToCart(stock: Stock) {
  const existing = cart.value.find(i => i.stockId === (stock.id || stock._id) && i.batch === stock.batch && i.itemType !== 'SERVICE')
  if (existing) { existing.qty += 1; existing.showQty = true }
  else cart.value.push({
    stockId: stock.id || stock._id || null, itemType: 'GOODS', item: stock.item, narration: '',
    batch: stock.batch || null, oem: stock.oem || '', hsn: stock.hsn || '', qty: 1, showQty: true,
    uom: stock.uom, rate: parseFloat(String(stock.rate)) || 0, grate: parseFloat(String(stock.grate)) || 0, disc: 0,
  })
}
function addService() {
  cart.value.push({ stockId: null, itemType: 'SERVICE', item: '', narration: '',
    batch: null, oem: '', hsn: '', qty: 1, showQty: false, uom: '', rate: 0, grate: 18, disc: 0, costRate: 0 })
}
function removeCartItem(idx: number) { cart.value.splice(idx, 1) }
function updateCartField(idx: number, field: string, value: any) {
  const item = cart.value[idx]
  if (!item) return
  if (['item','hsn','uom','narration'].includes(field)) { (item as any)[field] = value; return }
  if (field === 'qty') {
    if (item.itemType === 'SERVICE') {
      if (!value) { item.qty = 1; item.showQty = false; return }
      const p = parseFloat(value)
      item.qty = Number.isFinite(p) && p > 0 ? p : 1
      item.showQty = Number.isFinite(p) && p > 0
      return
    }
    let p = parseFloat(value)
    if (!Number.isFinite(p) || p < 0) p = 0
    item.qty = p; item.showQty = true; return
  }
  if (field === 'returnQty') { let p = parseFloat(value); item.returnQty = Number.isFinite(p) && p >= 0 ? p : 0; return }
  let val = parseFloat(value)
  ;(item as any)[field] = isNaN(val) || val < 0 ? 0 : val
}
function calcRowTotal(item: CartItem) {
  const q = isReturnMode.value ? (item.returnQty || 0) : getItemEffectiveQty(item)
  return q * (item.rate || 0) * (1 - (item.disc || 0) / 100)
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

// ─── Party ────────────────────────────────────────────────────────────────────
async function onPartySelected(party: Party) {
  selectedParty.value = party; historyCache.value = {}
  autoSetBillType(); syncConsigneeFromBillTo()
  showPartyModal.value = false
  await loadPartyBalance()
}
async function onPartyCreated(party: Party) {
  parties.value.push(party)
  showPartyCreateModal.value = false
  await onPartySelected(party)
}

// ─── Stock modal callbacks ────────────────────────────────────────────────────
function onStockSelect(stock: Stock, showBatch: boolean) {
  showStockModal.value = false
  if (showBatch) { batchModalStock.value = stock; showBatchModal.value = true }
  else addToCart(stock)
}
function onBatchSelected(stockWithBatch: Stock) {
  showBatchModal.value = false; addToCart(stockWithBatch)
}
function openCreateStock() {
  showStockModal.value = false; stockCrudMode.value = 'create'; editingStock.value = null
  showStockCrudModal.value = true
}
function openEditStock(stock: Stock) {
  editingStock.value = stock; stockCrudMode.value = 'edit'; showStockCrudModal.value = true
}
async function onStockSaved() {
  showStockCrudModal.value = false
  await loadStocks()
  if (stockCrudMode.value === 'create') showStockModal.value = true
}
function onViewHistory(stock: Stock) {
  historyModalStock.value = stock; showHistoryModal.value = true
}
function onHistoryCacheUpdate(key: string, data: any[]) {
  historyCache.value[key] = data
}

// ─── Save ─────────────────────────────────────────────────────────────────────
async function saveBill() {
  if (cart.value.length === 0)    { alert('Cannot save an empty invoice.'); return }
  if (!selectedParty.value)       { alert('Please select a party before saving.'); return }
  if (isReturnMode.value && !cart.value.some(i => (i.returnQty || 0) > 0)) {
    alert('Please enter return quantities for at least one item.'); return
  }
  if (isEditMode.value && !confirm('⚠️ Edit Bill: This will update stock quantities, GST totals and ledger entries. Continue?')) return
  if (isReturnMode.value && !confirm('⚠️ Credit Note: This will restore stock and reverse ledger entries. Continue?')) return

  saveLoading.value = true
  try {
    let response: Response
    if (isReturnMode.value) {
      response = await fetchWithCSRF('/api/inventory/sales/create-credit-note', {
        method: 'POST',
        body: JSON.stringify({
          originalBillId: returnBillId.value,
          returnCart: cart.value.filter(i => (i.returnQty || 0) > 0)
            .map(i => ({ stockId: i.stockId, returnQty: i.returnQty, rate: i.rate, grate: i.grate, disc: i.disc, item: i.item, gstRate: i.grate })),
          narration: meta.narration,
        })
      })
    } else {
      const method = isEditMode.value ? 'PUT' : 'POST'
      const url    = isEditMode.value ? `/api/inventory/sales/bills/${editBillId.value}` : '/api/inventory/sales/bills'
      response = await fetchWithCSRF(url, {
        method,
        body: JSON.stringify({
          meta: { ...meta, firmGstin: activeFirmLocation.value?.gst_number || null },
          party: selectedParty.value._id || selectedParty.value.id,
          cart: cart.value, otherCharges: otherCharges.value, consignee: selectedConsignee.value,
        })
      })
    }

    if (!response.ok) { const e = await response.json(); alert(e.error || `Failed (${response.status})`); return }
    const result = await response.json()
    if (!result.success) { alert(result.error || 'Failed to save bill'); return }

    savedBillId.value = result.id
    savedBillNo.value = result.billNo
    showSaveConfirmModal.value = true
  } catch (err: any) { alert('Error saving: ' + err.message) }
  finally { saveLoading.value = false }
}

function handleAfterSave() {
  showSaveConfirmModal.value = false
  if (isEditMode.value || isReturnMode.value) {
    router.push('/inventory/reports')
  } else {
    cart.value = []; otherCharges.value = []; selectedParty.value = null
    selectedConsignee.value = null; partyBalance.value = null; historyCache.value = {}
    consigneeSameAsBillTo.value = true
    loadNextBillNo()
  }
}

async function downloadFile(type: 'pdf' | 'excel') {
  if (!savedBillId.value) return
  const urls  = { pdf: `/api/inventory/sales/bills/${savedBillId.value}/pdf`, excel: `/api/inventory/sales/bills/${savedBillId.value}/excel` }
  const names = { pdf: `Invoice_${savedBillNo.value}.pdf`, excel: `Invoice_${savedBillNo.value}.xlsx` }
  const res = await fetch(urls[type], { method: 'GET', credentials: 'same-origin' })
  if (!res.ok) { alert('Download failed'); return }
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: names[type], style: 'display:none' })
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  handleAfterSave()
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'F2') { e.preventDefault(); showStockModal.value  = true }
  else if (e.key === 'F3') { e.preventDefault(); showPartyModal.value  = true }
  else if (e.key === 'F4') { e.preventDefault(); showChargesModal.value = true }
  else if (e.key === 'F8') { e.preventDefault(); saveBill() }
  else if (e.key === 'F9') { e.preventDefault(); clearAll() }
}

// ─── Mount ────────────────────────────────────────────────────────────────────
onMounted(async () => {
  document.addEventListener('keydown', onKeydown)
  try {
    const qEdit   = route.query.edit       as string || sessionStorage.getItem('editBillId')       || null
    const qReturn = route.query.returnFrom as string || sessionStorage.getItem('returnFromBillId') || null
    const validId = (s: string|null) => s && /^[a-f\d]{24}$/i.test(s)
    if (validId(qReturn)) { returnBillId.value = qReturn!; isReturnMode.value = true }
    else if (validId(qEdit)) { editBillId.value = qEdit!; isEditMode.value = true }

    await Promise.all([loadFirmData(), loadGstStatus(), loadStocks(), loadParties()])

    if (isReturnMode.value || isEditMode.value) {
      const bid = (isReturnMode.value ? returnBillId : editBillId).value!
      await loadBillForEdit(bid)
      if (isReturnMode.value) {
        sessionStorage.removeItem('returnFromBillId')
        const origItems = currentBill.value?.items || []
        cart.value = origItems.map((it: any) => ({
          stockId: it.stock_id, itemType: it.item_type || 'GOODS', item: it.item,
          narration: it.item_narration || '', batch: it.batch || null, oem: it.oem || '',
          hsn: it.hsn, qty: parseFloat(it.qty) || 0, showQty: it.show_qty !== false,
          uom: it.uom || 'PCS', rate: parseFloat(it.rate) || 0, grate: parseFloat(it.grate) || 0,
          disc: parseFloat(it.disc) || 0, returnQty: 0,
        }))
      } else { sessionStorage.removeItem('editBillId') }
      await loadPartyBalance()
    } else {
      await loadNextBillNo()
    }
  } catch (err: any) { appError.value = err.message || 'Failed to load system' }
  finally { appLoading.value = false }
})
onUnmounted(() => document.removeEventListener('keydown', onKeydown))

// Bill type/party badge config
const billTypeOpts = [
  { label: 'Intra-State (CGST + SGST)', value: 'intra-state' },
  { label: 'Inter-State (IGST)',         value: 'inter-state' },
]
const firmGstinOpts = computed(() =>
  firmLocations.value.map(l => ({
    label: `${l.gst_number || 'No GSTIN'} — ${l.state || l.state_code || ''}${l.is_default ? ' (Default)' : ''}`,
    value: l.gst_number || '',
  }))
)
const activeFirmGstin = computed({
  get: () => activeFirmLocation.value?.gst_number || '',
  set: (v) => { activeFirmLocation.value = firmLocations.value.find(l => l.gst_number === v) || null; autoSetBillType() }
})

// Consignee model helpers (flat v-models for the form)
function getConsigneeField(f: keyof Consignee) { return selectedConsignee.value?.[f] ?? '' }
function setConsigneeField(f: keyof Consignee, v: string) {
  if (!selectedConsignee.value) selectedConsignee.value = { name:'', address:'', gstin:'', state:'', pin:'', contact:'', deliveryInstructions:'' }
  ;(selectedConsignee.value as any)[f] = v
}
</script>

<template>
  <!-- Loading -->
  <div v-if="appLoading" class="flex items-center justify-center h-64 text-(--ui-text-muted)">
    <div class="flex flex-col items-center gap-3">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <span class="text-sm">Loading sales system…</span>
    </div>
  </div>

  <!-- Error -->
  <div v-else-if="appError" class="p-8 m-4">
    <UAlert :title="appError" color="error" variant="subtle" class="mb-4" />
    <div class="flex gap-2">
      <UButton label="← Back" color="neutral" @click="$router.push('/inventory/sls')" />
      <UButton label="Reload" color="error" @click="location.reload()" />
    </div>
  </div>

  <template v-else>
    <!-- ══════════════════════════════════════════════════════════════════════
         MAIN LAYOUT
    ══════════════════════════════════════════════════════════════════════════ -->
    <div class="h-[calc(100vh-140px)] flex flex-col bg-(--ui-bg-muted) text-(--ui-text) text-sm border rounded-lg shadow-sm overflow-hidden"
         :class="isReturnMode ? 'border-warning-300' : 'border-(--ui-border)'">

      <!-- Return banner -->
      <div v-if="isReturnMode && currentBill"
           class="bg-warning-50 dark:bg-warning-900/20 border-b border-warning-200 px-4 py-2 flex items-center justify-between">
        <div class="flex items-center gap-2 text-warning-800 dark:text-warning-300 font-medium text-xs">
          <UIcon name="i-heroicons-arrow-uturn-left" class="w-4 h-4" />
          Returning items from Bill <strong class="ml-1">#{{ currentBill.bno }}</strong>
          <span class="text-warning-600 ml-1">(dated {{ currentBill.bdate }})</span>
        </div>
        <UButton label="Cancel Return" color="warning" variant="ghost" size="xs"
                 @click="$router.push('/inventory/sls')" />
      </div>

      <!-- ── Header bar ──────────────────────────────────────────────────── -->
      <div class="border-b p-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 z-20 bg-(--ui-bg)"
           :class="isReturnMode ? 'border-warning-200' : 'border-(--ui-border)'">
        <div class="flex flex-col sm:flex-row flex-wrap gap-2">
          <!-- Title + mode badges -->
          <div class="flex items-center gap-2">
            <h1 class="text-lg font-bold text-(--ui-text)">
              {{ isReturnMode ? 'Credit Note (Sales Return)' : 'Sales Invoice' }}
            </h1>
            <UBadge v-if="isEditMode"   label="EDIT MODE"   color="warning" variant="subtle" />
            <UBadge v-if="isReturnMode" label="RETURN MODE" color="warning" variant="soft" />
          </div>

          <!-- Bill No -->
          <div class="flex flex-col gap-0.5">
            <span class="text-[10px] uppercase text-(--ui-text-muted) font-bold tracking-wider">Bill No</span>
            <UInput :model-value="isReturnMode ? 'CN-AUTO' : meta.billNo" readonly size="sm"
                    :ui="{ base: 'w-32 cursor-not-allowed' }" color="neutral" variant="subtle" />
          </div>

          <!-- Date -->
          <div class="flex flex-col gap-0.5">
            <span class="text-[10px] uppercase text-(--ui-text-muted) font-bold tracking-wider">Date</span>
            <UInput v-model="meta.billDate" type="date" size="sm" />
          </div>

          <!-- Multi-GSTIN selector -->
          <div v-if="firmLocations.length > 1" class="flex flex-col gap-0.5">
            <span class="text-[10px] uppercase text-(--ui-text-muted) font-bold tracking-wider">Billing from GSTIN</span>
            <USelect v-model="activeFirmGstin" :items="firmGstinOpts"
                     value-key="value" label-key="label" size="sm"
                     :ui="{ base: 'border-warning-300 bg-warning-50 dark:bg-warning-900/20' }" />
          </div>

          <!-- Bill type -->
          <div class="flex flex-col gap-0.5">
            <span class="text-[10px] uppercase text-(--ui-text-muted) font-bold tracking-wider">Transaction Type</span>
            <USelect v-model="meta.billType" :items="billTypeOpts"
                     value-key="value" label-key="label" size="sm" />
          </div>

          <!-- Reverse charge + GST badge -->
          <div class="flex items-center gap-3 pt-4">
            <UCheckbox v-model="meta.reverseCharge" label="Reverse Charge"
                       :ui="{ label: 'text-[10px] uppercase font-bold tracking-wider text-(--ui-text-muted) whitespace-nowrap' }" />
            <UBadge :label="`GST: ${gstEnabled ? 'ON' : 'OFF'}`"
                    :color="gstEnabled ? 'success' : 'error'" variant="subtle" />
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex flex-wrap gap-2">
          <UButton label="Other Charges" icon="i-heroicons-plus-circle"
                   color="primary" variant="soft" size="sm"
                   @click="showChargesModal = true" />
          <template v-if="!isReturnMode">
            <UButton label="Add Items (F2)" icon="i-heroicons-archive-box"
                     color="indigo" variant="soft" size="sm"
                     @click="showStockModal = true" />
            <UButton label="Add Service" icon="i-heroicons-wrench-screwdriver"
                     color="success" variant="soft" size="sm"
                     @click="addService" />
          </template>
          <UButton label="Reset" icon="i-heroicons-trash"
                   color="error" variant="soft" size="sm"
                   @click="clearAll" />
          <UButton :label="isReturnMode ? 'Save Credit Note' : (isEditMode ? 'Update Bill' : 'Save Invoice')"
                   icon="i-heroicons-document-check"
                   color="neutral" variant="solid" size="sm"
                   :loading="saveLoading"
                   @click="saveBill" />
        </div>
      </div>

      <!-- ── Main content ────────────────────────────────────────────────── -->
      <div class="flex-1 overflow-hidden flex flex-col md:flex-row">

        <!-- Sidebar -->
        <div class="w-full md:w-64 border-r border-(--ui-border) flex flex-col overflow-y-auto z-10 bg-(--ui-bg)">

          <!-- Party card -->
          <div class="p-3 border-b border-(--ui-border)">
            <p class="text-[10px] uppercase text-(--ui-text-muted) font-bold tracking-wider mb-1">Bill To</p>

            <!-- No party -->
            <UButton v-if="!selectedParty" block variant="outline" color="neutral"
                     icon="i-heroicons-user-plus" label="Select Party (F3)"
                     class="py-5 border-dashed" @click="showPartyModal = true" />

            <!-- Party selected -->
            <div v-else class="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
              <div class="flex justify-between items-start gap-1">
                <p class="font-bold text-sm text-primary truncate flex-1" :title="selectedParty.firm">
                  {{ selectedParty.firm }}
                </p>
                <UButton v-if="!isReturnMode" icon="i-heroicons-pencil-square"
                         color="neutral" variant="ghost" size="xs"
                         @click="showPartyModal = true" />
              </div>
              <p class="text-[11px] text-(--ui-text-muted) truncate">{{ selectedParty.addr || '' }}</p>
              <div class="flex flex-wrap gap-1">
                <UBadge :label="`GST: ${selectedParty.gstin}`" color="primary" variant="subtle"
                        size="xs" class="font-mono" />
                <UBadge :label="intraState ? 'Local' : 'Out of State'"
                        :color="intraState ? 'success' : 'warning'" variant="subtle" size="xs" />
              </div>
              <div v-if="partyBalance">
                <UBadge :label="`BAL: ${partyBalance.balanceType} ${partyBalance.balanceFormatted}`"
                        :color="partyBalance.balance >= 0 ? 'success' : 'error'"
                        variant="subtle" size="xs" class="font-mono" />
              </div>
            </div>
          </div>

          <!-- Consignee -->
          <div class="p-3 border-b border-(--ui-border) space-y-2">
            <div class="flex justify-between items-center">
              <p class="text-[10px] uppercase text-(--ui-text-muted) font-bold tracking-wider">Consignee</p>
              <UCheckbox :model-value="consigneeSameAsBillTo" label="Same as Bill To"
                         :ui="{ label: 'text-[10px] text-primary font-medium' }"
                         @update:model-value="onConsigneeSameToggle" />
            </div>
            <UFormField label="Name">
              <UInput :model-value="getConsigneeField('name')" size="sm" placeholder="Consignee name"
                      class="w-full"
                      @update:model-value="setConsigneeField('name', $event)" />
            </UFormField>
            <UFormField label="Address">
              <UTextarea :model-value="getConsigneeField('address')" :rows="2" size="sm" placeholder="Delivery address"
                         class="w-full"
                         @update:model-value="setConsigneeField('address', $event)" />
            </UFormField>
            <div class="grid grid-cols-2 gap-2">
              <UFormField label="GSTIN">
                <UInput :model-value="getConsigneeField('gstin')" size="sm" placeholder="GSTIN" maxlength="15"
                        class="uppercase w-full" @update:model-value="setConsigneeField('gstin', $event)" />
              </UFormField>
              <UFormField label="State">
                <UInput :model-value="getConsigneeField('state')" size="sm"
                        class="w-full"
                        @update:model-value="setConsigneeField('state', $event)" />
              </UFormField>
            </div>
            <UFormField label="PIN">
              <UInput :model-value="getConsigneeField('pin')" size="sm" maxlength="6"
                      class="w-full"
                      @update:model-value="setConsigneeField('pin', $event)" />
            </UFormField>
            <UFormField label="Contact">
              <UInput :model-value="getConsigneeField('contact')" size="sm"
                      class="w-full"
                      @update:model-value="setConsigneeField('contact', $event)" />
            </UFormField>
            <UFormField label="Delivery Notes">
              <UTextarea :model-value="getConsigneeField('deliveryInstructions')" :rows="2" size="sm"
                         placeholder="Special instructions"
                         class="w-full"
                         @update:model-value="setConsigneeField('deliveryInstructions', $event)" />
            </UFormField>
          </div>

          <!-- Meta fields -->
          <div class="p-3 space-y-2">
            <UFormField label="Reference / PO No">
              <UInput v-model="meta.referenceNo" size="sm" placeholder="e.g. PO-2025-001" class="w-full" />
            </UFormField>
            <UFormField label="Vehicle No">
              <UInput v-model="meta.vehicleNo" size="sm" placeholder="e.g. KA01AB1234" class="w-full" />
            </UFormField>
            <UFormField label="Narration">
              <UTextarea v-model="meta.narration" :rows="3" size="sm" placeholder="Additional notes…" class="w-full" />
            </UFormField>
          </div>
        </div>

        <!-- ── Items table ─────────────────────────────────────────────── -->
        <div class="flex-1 bg-(--ui-bg) flex flex-col relative min-w-0">

          <!-- Column headers -->
          <div class="bg-(--ui-bg-muted) border-b border-(--ui-border) text-[11px] font-bold text-(--ui-text-muted) uppercase tracking-wider flex pr-2 shrink-0">
            <div class="p-2 w-10 text-center">#</div>
            <div class="p-2 flex-1">Item</div>
            <div class="p-2 w-20">HSN</div>
            <template v-if="isReturnMode">
              <div class="p-2 w-16 text-right">Orig</div>
              <div class="p-2 w-16 text-right">Ret</div>
            </template>
            <div v-else class="p-2 w-16 text-right">Qty</div>
            <div class="p-2 w-12 text-center">UOM</div>
            <div class="p-2 w-24 text-right">Rate</div>
            <div class="p-2 w-16 text-right">Disc%</div>
            <div class="p-2 w-16 text-right">GST%</div>
            <div class="p-2 w-28 text-right">Total</div>
            <div class="p-2 w-10"></div>
          </div>

          <!-- Cart rows -->
          <div class="flex-1 overflow-y-auto relative">
            <!-- Empty state -->
            <div v-if="cart.length === 0"
                 class="absolute inset-0 flex flex-col items-center justify-center text-(--ui-text-muted) select-none pointer-events-none">
              <UIcon name="i-heroicons-shopping-cart" class="w-16 h-16 text-(--ui-bg-accented) mb-3" />
              <p class="text-sm font-medium">Cart is empty</p>
              <p class="text-xs mt-1">
                <kbd class="font-mono bg-(--ui-bg-muted) px-1 rounded border border-(--ui-border)">F2</kbd> Items &nbsp;|&nbsp;
                <kbd class="font-mono bg-(--ui-bg-muted) px-1 rounded border border-(--ui-border)">F3</kbd> Party &nbsp;|&nbsp;
                <kbd class="font-mono bg-(--ui-bg-muted) px-1 rounded border border-(--ui-border)">F4</kbd> Charges
              </p>
            </div>

            <template v-for="(item, idx) in cart" :key="idx">
              <!-- Main row -->
              <div class="flex items-center border-b border-(--ui-border) text-xs hover:bg-(--ui-bg-elevated) transition-colors min-h-10 group"
                   :class="[isReturnMode ? 'bg-warning-50/20 dark:bg-warning-900/10' : 'bg-(--ui-bg)', item.itemType === 'SERVICE' ? 'bg-success-50/10 dark:bg-success-900/5' : '']">
                <div class="p-2 w-10 text-center text-(--ui-text-muted) font-mono">{{ idx + 1 }}</div>

                <!-- Name -->
                <div class="p-2 flex-1 min-w-0 flex flex-col justify-center">
                  <UInput v-if="item.itemType === 'SERVICE'"
                          :model-value="item.item" size="xs" variant="none"
                          placeholder="Service description" :readonly="isReturnMode"
                          class="font-medium"
                          @update:model-value="updateCartField(idx, 'item', $event)" />
                  <span v-else class="font-semibold text-(--ui-text) truncate">{{ item.item }}</span>
                  <span class="text-[10px] text-(--ui-text-muted) font-normal">
                    {{ item.itemType === 'SERVICE' ? 'Service Line' : `Batch: ${item.batch || '-'} | OEM: ${item.oem || '-'}` }}
                  </span>
                </div>

                <!-- HSN -->
                <div class="p-2 w-20">
                  <UInput v-if="item.itemType === 'SERVICE'"
                          :model-value="item.hsn" size="xs" variant="none" placeholder="SAC"
                          :readonly="isReturnMode"
                          @update:model-value="updateCartField(idx, 'hsn', $event)" />
                  <span v-else class="text-(--ui-text-muted)">{{ item.hsn }}</span>
                </div>

                <!-- Qty (return: orig + return) -->
                <template v-if="isReturnMode">
                  <div class="p-2 w-16 text-right text-(--ui-text-muted) font-medium">{{ item.qty }}</div>
                  <div class="p-1 w-16">
                    <UInput :model-value="item.returnQty || 0" type="number" :min="0" :max="item.qty" step="0.01"
                            size="xs" variant="none"
                            :ui="{ base: 'text-right font-bold text-warning-600 dark:text-warning-400' }"
                            @update:model-value="updateCartField(idx, 'returnQty', $event)" />
                  </div>
                </template>
                <div v-else class="p-1 w-16">
                  <UInput :model-value="item.showQty === false ? '' : item.qty"
                          type="number" min="0" step="0.01" size="xs" variant="none"
                          :ui="{ base: 'text-right font-semibold text-primary' }"
                          @update:model-value="updateCartField(idx, 'qty', $event)" />
                </div>

                <!-- UOM -->
                <div class="p-2 w-12 text-center">
                  <UInput v-if="item.itemType === 'SERVICE'"
                          :model-value="item.uom" size="xs" variant="none"
                          :ui="{ base: 'text-center text-[10px]' }" :readonly="isReturnMode"
                          @update:model-value="updateCartField(idx, 'uom', $event)" />
                  <span v-else class="text-(--ui-text-muted) text-[10px]">{{ item.uom }}</span>
                </div>

                <!-- Rate -->
                <div class="p-1 w-24">
                  <UInput :model-value="item.rate" type="number" min="0" step="0.01"
                          size="xs" variant="none" :readonly="isReturnMode"
                          :ui="{ base: 'text-right' }"
                          @update:model-value="updateCartField(idx, 'rate', $event)" />
                </div>

                <!-- Disc -->
                <div class="p-1 w-16">
                  <UInput :model-value="item.disc || 0" type="number" min="0" max="100" step="0.01"
                          size="xs" variant="none" placeholder="0" :readonly="isReturnMode"
                          :ui="{ base: 'text-right' }"
                          @update:model-value="updateCartField(idx, 'disc', $event)" />
                </div>

                <!-- GST% -->
                <div class="p-1 w-16">
                  <UInput v-if="item.itemType === 'SERVICE'"
                          :model-value="item.grate || 0" type="number" min="0" max="100" step="0.01"
                          size="xs" variant="none" :readonly="isReturnMode"
                          :ui="{ base: 'text-right text-(--ui-text-dimmed)' }"
                          @update:model-value="updateCartField(idx, 'grate', $event)" />
                  <span v-else class="p-1 text-right text-(--ui-text-dimmed) block">{{ item.grate }}%</span>
                </div>

                <!-- Total -->
                <div class="p-2 w-28 text-right font-bold text-(--ui-text) tabular-nums text-xs bg-(--ui-bg-muted)/50">
                  {{ fmt(calcRowTotal(item)) }}
                </div>

                <!-- Remove -->
                <div class="p-2 w-10 text-center">
                  <UButton v-if="!isReturnMode" icon="i-heroicons-x-mark" color="error"
                           variant="ghost" size="xs"
                           @click="removeCartItem(idx)" />
                </div>
              </div>

              <!-- Narration row -->
              <div class="flex items-start border-b border-(--ui-border) group bg-(--ui-bg) pl-20 pr-2 py-1">
                <div class="w-28 text-[10px] text-(--ui-text-muted) uppercase tracking-wide pt-1 shrink-0">Narration</div>
                <UTextarea :model-value="item.narration || ''" :rows="1" size="xs" variant="none"
                           placeholder="Add narration for this item" class="flex-1 w-full"
                           @update:model-value="updateCartField(idx, 'narration', $event)" />
              </div>

              <!-- Service cost row -->
              <div v-if="item.itemType === 'SERVICE'"
                   class="flex items-center border-b border-(--ui-border) bg-(--ui-bg) pl-20 pr-2 py-1">
                <div class="w-28 text-[10px] text-(--ui-text-muted) uppercase tracking-wide shrink-0">Service Cost</div>
                <div class="w-36">
                  <UInput :model-value="item.costRate || 0" type="number" min="0" step="0.01"
                          size="xs" variant="none" placeholder="0.00" :readonly="isReturnMode"
                          :ui="{ base: 'text-right font-semibold text-warning-600' }"
                          @update:model-value="updateCartField(idx, 'costRate', $event)" />
                </div>
                <span class="text-[10px] text-(--ui-text-muted) pl-3">Optional per-unit cost for COGS posting</span>
              </div>
            </template>
          </div>

          <!-- Bottom add bar -->
          <div class="p-2 border-t border-dashed border-(--ui-border) bg-(--ui-bg-muted) shrink-0">
            <UButton label="+ Add Items (F2)  |  Select Party (F3)  |  Charges (F4)  |  Save (F8)  |  Reset (F9)"
                     color="primary" variant="ghost" block size="sm"
                     class="border border-dashed border-primary/40 uppercase tracking-wide text-xs"
                     @click="showStockModal = true" />
          </div>

          <!-- ── Totals footer ────────────────────────────────────────── -->
          <div class="bg-(--ui-bg-muted) border-t border-(--ui-border) p-4 shrink-0">
            <div class="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
              <!-- Left: counts -->
              <div class="text-[11px] text-(--ui-text-muted) space-y-1">
                <div class="flex gap-4">
                  <span>Total Items: <b class="text-(--ui-text)">{{ cart.length }}</b></span>
                  <span>{{ isReturnMode ? 'Ret Qty' : 'Total Qty' }}: 
                    <b :class="isReturnMode ? 'text-warning-600 dark:text-warning-400' : 'text-(--ui-text)'">{{ totalQty }}</b>
                  </span>
                </div>
                <UBadge v-if="meta.reverseCharge" label="REVERSE CHARGE APPLIES" color="error" variant="soft" />
                <p class="italic mt-2">* Rates inclusive of discounts before tax</p>
              </div>

              <!-- Right: totals grid -->
              <div class="flex gap-6 text-xs">
                <div class="text-right space-y-1.5 text-(--ui-text-muted) font-medium">
                  <div class="mb-2 text-[10px] uppercase font-bold tracking-wider text-(--ui-text-muted)">
                    {{ isReturnMode ? 'Return Totals' : 'Invoice Totals' }}
                  </div>
                  <div>Taxable Value</div>
                  <template v-if="intraState">
                    <div>CGST Output</div>
                    <div>SGST Output</div>
                  </template>
                  <div v-else>IGST Output</div>
                  <div v-if="otherCharges.length">Other Charges</div>
                  <div>Round Off</div>
                  <USeparator class="my-1" />
                  <div class="font-bold text-(--ui-text)">Net Total</div>
                </div>
                <div class="text-right space-y-1.5 font-mono font-bold text-(--ui-text)">
                  <div class="mb-2 h-4"></div>
                  <div class="tabular-nums">{{ fmt(totals.itemTaxable) }}</div>
                  <template v-if="intraState">
                    <div class="text-(--ui-text-dimmed) tabular-nums">{{ fmt(totals.cgst) }}</div>
                    <div class="text-(--ui-text-dimmed) tabular-nums">{{ fmt(totals.sgst) }}</div>
                  </template>
                  <div v-else class="text-(--ui-text-dimmed) tabular-nums">{{ fmt(totals.igst) }}</div>
                  <div v-if="otherCharges.length" class="text-(--ui-text-dimmed) tabular-nums">
                    {{ fmt(totals.chargesTotal) }}
                  </div>
                  <div class="text-(--ui-text-dimmed) tabular-nums">{{ fmt(totals.rof) }}</div>
                  <USeparator class="my-1" />
                  <div class="text-xl leading-none tabular-nums"
                       :class="isReturnMode ? 'text-warning-600 dark:text-warning-400' : 'text-primary'">
                    {{ fmt(totals.ntot) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════
         MODALS  (UModal handles backdrop, ESC, focus-trap)
    ══════════════════════════════════════════════════════════════════════════ -->

    <!-- Stock modal -->
    <UModal v-model:open="showStockModal"
            :ui="{ content: 'sm:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden z-[100]', overlay: 'z-[100]' }"
            :close="false">
      <template #content>
        <StockModal :stocks="stocks"
                    @select="onStockSelect" @create="openCreateStock"
                    @edit="openEditStock"   @history="onViewHistory"
                    @close="showStockModal = false" />
      </template>
    </UModal>

    <!-- Party modal -->
    <UModal v-model:open="showPartyModal"
            :ui="{ content: 'sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden z-[100]', overlay: 'z-[100]' }"
            :close="false">
      <template #content>
        <PartyModal :parties="parties"
                    @select="onPartySelected"
                    @create="() => { showPartyModal = false; showPartyCreateModal = true }"
                    @close="showPartyModal = false" />
      </template>
    </UModal>

    <!-- Batch modal -->
    <UModal v-model:open="showBatchModal"
            :ui="{ content: 'sm:max-w-xl overflow-hidden' }"
            :close="false">
      <template #content>
        <BatchModal :stock="batchModalStock"
                    @select="onBatchSelected"
                    @close="showBatchModal = false" />
      </template>
    </UModal>

    <!-- History modal -->
    <UModal v-model:open="showHistoryModal"
            :ui="{ content: 'sm:max-w-3xl max-h-[80vh] flex flex-col overflow-hidden' }"
            :close="false">
      <template #content>
        <HistoryModal :stock="historyModalStock"
                      :party="selectedParty"
                      :history-cache="historyCache"
                      @cache-update="onHistoryCacheUpdate"
                      @close="showHistoryModal = false" />
      </template>
    </UModal>

    <!-- Charges modal -->
    <UModal v-model:open="showChargesModal"
            :ui="{ content: 'sm:max-w-3xl max-h-[85vh] flex flex-col overflow-hidden' }"
            :close="false">
      <template #content>
        <ChargesModal :charges="otherCharges"
                      @add="otherCharges.push({ ...$event, gstAmount: gstEnabled ? ($event.amount * $event.gstRate) / 100 : 0 })"
                      @remove="otherCharges.splice($event, 1)"
                      @save="() => {}"
                      @close="showChargesModal = false" />
      </template>
    </UModal>

    <!-- Party create modal -->
    <UModal v-model:open="showPartyCreateModal"
            :ui="{ content: 'sm:max-w-xl overflow-hidden' }"
            :close="false">
      <template #content>
        <PartyCreateModal @saved="onPartyCreated" @close="showPartyCreateModal = false" />
      </template>
    </UModal>

    <!-- Stock CRUD modal -->
    <UModal v-model:open="showStockCrudModal"
            :ui="{ content: 'sm:max-w-xl overflow-hidden' }"
            :close="false">
      <template #content>
        <StockCrudModal :mode="stockCrudMode" :stock="editingStock"
                        @saved="onStockSaved" @close="showStockCrudModal = false" />
      </template>
    </UModal>

    <!-- Save confirmation modal -->
    <UModal v-model:open="showSaveConfirmModal"
            :ui="{ content: 'sm:max-w-sm overflow-hidden' }"
            :close="false">
      <template #content>
        <div class="bg-gradient-to-br from-success-600 to-emerald-500 px-6 py-6 text-white text-center">
          <div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <UIcon name="i-heroicons-check-circle" class="w-7 h-7" />
          </div>
          <h3 class="text-base font-bold tracking-wide">
            {{ isReturnMode ? 'Credit Note Created!' : (isEditMode ? 'Bill Updated!' : 'Invoice Saved!') }}
          </h3>
          <p class="text-success-100 text-sm mt-1">
            Bill No: <span class="font-bold text-white">{{ savedBillNo }}</span>
          </p>
        </div>
        <div class="p-5 flex flex-col gap-2 bg-(--ui-bg)">
          <UButton label="Download PDF" icon="i-heroicons-document-arrow-down"
                   color="primary" block @click="downloadFile('pdf')" />
          <UButton label="Download Excel" icon="i-heroicons-table-cells"
                   color="success" block @click="downloadFile('excel')" />
          <UButton label="Close" color="neutral" variant="soft" block @click="handleAfterSave" />
        </div>
      </template>
    </UModal>
  </template>
</template>
