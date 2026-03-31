<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Batch { batch?: string | null; qty: number; rate: number; expiry?: string | null; mrp?: number | null }
interface Stock {
  id?: string; _id?: string; item?: string; batch?: string; batches?: Batch[]
  pno?: string; oem?: string; hsn?: string; qty?: number; uom?: string
  rate?: number; grate?: number; mrp?: number; expiryDate?: string
}

const props = defineProps<{ mode: 'create' | 'edit'; stock?: Stock | null }>()
const emit  = defineEmits<{ saved: []; close: [] }>()

const UOM_OPTIONS    = ['NOS','PCS','SET','BOX','MTR','KGS']
const GST_OPTIONS    = [18, 12, 5, 28, 0]

const saving         = ref(false)
const selectedBatchIdx = ref(-1)

// Form state
const form = ref({
  item: '', batch: '', pno: '', oem: '', hsn: '',
  qty: '', uom: 'NOS', rate: '', grate: '18', mrp: '', expiryDate: ''
})

// Populate form when editing
watch(() => props.stock, (s) => {
  if (props.mode !== 'edit' || !s) return
  const batchVal = Array.isArray(s.batches) && s.batches.length > 0
    ? (s.batches[0]?.batch || '') : (s.batch || '')
  form.value = {
    item: s.item || '', batch: batchVal, pno: s.pno || '', oem: s.oem || '',
    hsn: s.hsn || '', qty: String(s.qty ?? ''), uom: s.uom || 'NOS',
    rate: String(s.rate ?? ''), grate: String(s.grate ?? '18'),
    mrp: s.mrp ? String(s.mrp) : '', expiryDate: s.expiryDate ? String(s.expiryDate).split('T')[0] : ''
  }
}, { immediate: true })

const isMultiBatch = computed(() =>
  props.mode === 'edit' && Array.isArray(props.stock?.batches) && (props.stock?.batches?.length ?? 0) > 1
)

function selectBatch(idx: number) {
  if (!props.stock?.batches) return
  selectedBatchIdx.value = idx
  const b = props.stock.batches[idx]
  form.value.batch      = b.batch      || ''
  form.value.qty        = String(b.qty ?? '')
  form.value.rate       = String(b.rate ?? '')
  form.value.mrp        = b.mrp ? String(b.mrp) : ''
  form.value.expiryDate = b.expiry ? String(b.expiry).split('T')[0] : ''
}

function getCSRF(): string {
  const name = 'csrfToken='
  for (const cookie of decodeURIComponent(document.cookie).split(';')) {
    const c = cookie.trim()
    if (c.startsWith(name)) return c.substring(name.length)
  }
  return ''
}

async function submit() {
  if (!form.value.item.trim()) { alert('Item description is required'); return }
  if (!form.value.hsn.trim())  { alert('HSN code is required'); return }
  if (!form.value.qty || isNaN(Number(form.value.qty)))  { alert('Valid quantity required'); return }
  if (!form.value.rate || isNaN(Number(form.value.rate))) { alert('Valid rate required'); return }

  saving.value = true

  try {
    const payload: any = {
      item:  form.value.item.trim(),
      pno:   form.value.pno.trim() || null,
      oem:   form.value.oem.trim() || null,
      hsn:   form.value.hsn.trim(),
      qty:   parseFloat(form.value.qty),
      uom:   form.value.uom,
      rate:  parseFloat(form.value.rate),
      grate: parseFloat(form.value.grate),
      total: (parseFloat(form.value.qty) * parseFloat(form.value.rate)).toFixed(2),
    }

    // Batch packaging
    if (props.mode === 'create') {
      if (form.value.batch || form.value.expiryDate || form.value.mrp) {
        payload.batches = JSON.stringify([{
          batch:  form.value.batch  || null,
          qty:    parseFloat(form.value.qty),
          rate:   parseFloat(form.value.rate),
          expiry: form.value.expiryDate || null,
          mrp:    form.value.mrp ? parseFloat(form.value.mrp) : null,
        }])
      }
      payload.created_at = new Date().toISOString()
    } else if (props.mode === 'edit' && props.stock) {
      const s = props.stock
      if (Array.isArray(s.batches) && s.batches.length > 0) {
        let updated = JSON.parse(JSON.stringify(s.batches))
        let tgt = selectedBatchIdx.value >= 0 ? selectedBatchIdx.value
                  : updated.findIndex((b: Batch) => b.batch === (form.value.batch || null))
        if (tgt === -1) tgt = 0
        updated[tgt] = { ...updated[tgt], qty: parseFloat(form.value.qty), rate: parseFloat(form.value.rate),
          expiry: form.value.expiryDate || null, mrp: form.value.mrp ? parseFloat(form.value.mrp) : null }
        payload.batches = JSON.stringify(updated)
      } else if (form.value.batch || form.value.expiryDate || form.value.mrp) {
        payload.batches = JSON.stringify([{
          batch: form.value.batch || null, qty: parseFloat(form.value.qty),
          rate: parseFloat(form.value.rate), expiry: form.value.expiryDate || null,
          mrp: form.value.mrp ? parseFloat(form.value.mrp) : null
        }])
      }
      payload.updated_at = new Date().toISOString()
    }

    const stockId = props.stock ? (props.stock.id || props.stock._id) : null
    const url    = props.mode === 'edit' ? `/api/inventory/sales/stocks/${stockId}` : '/api/inventory/sales/stocks'
    const method = props.mode === 'edit' ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCSRF() },
      body: JSON.stringify(payload)
    })

    if (!res.ok) { const e = await res.json(); alert(e.error || 'Failed'); return }
    const result = await res.json()
    if (!result.success) { alert(result.error || 'Failed'); return }

    emit('saved')
  } finally { saving.value = false }
}
</script>

<template>
  <div class="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 flex justify-between items-center text-white">
    <div>
      <h3 class="font-bold text-sm tracking-wide uppercase">{{ mode === 'create' ? 'Create' : 'Edit' }} Stock Item</h3>
      <p class="text-slate-400 text-[10px] mt-0.5 truncate max-w-[260px]">{{ mode === 'edit' ? stock?.item : 'Fill in item details below' }}</p>
    </div>
    <button @click="emit('close')" class="hover:text-red-300 text-xl transition-colors w-7 h-7 flex items-center justify-center">&times;</button>
  </div>

  <div class="p-5 grid grid-cols-2 gap-x-5 gap-y-3 overflow-y-auto max-h-[72vh]">
    <div class="col-span-2">
      <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Item Description *</label>
      <input v-model="form.item" type="text" required
             class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none"
             placeholder="e.g. Dell Monitor 24 inch">
    </div>

    <!-- Multi-batch selector (edit mode only) -->
    <div v-if="isMultiBatch" class="col-span-2">
      <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Select Batch to Edit</label>
      <select @change="e => selectBatch(parseInt((e.target as HTMLSelectElement).value))"
              class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white mb-2">
        <option value="" disabled selected>— Select a batch to edit —</option>
        <option v-for="(b, i) in stock?.batches" :key="i" :value="i">
          {{ b.batch || 'No Batch' }} · Qty: {{ b.qty }} · Exp: {{ b.expiry || 'N/A' }}
        </option>
      </select>
      <div v-if="selectedBatchIdx >= 0 && stock?.batches?.[selectedBatchIdx]"
           class="p-3 bg-blue-50 border border-blue-100 rounded-lg grid grid-cols-3 gap-2 text-xs text-gray-600">
        <div><span class="text-gray-400 uppercase text-[9px] tracking-wide block">Batch</span><strong>{{ stock.batches![selectedBatchIdx].batch || 'No Batch' }}</strong></div>
        <div><span class="text-gray-400 uppercase text-[9px] tracking-wide block">Qty</span><strong>{{ stock.batches![selectedBatchIdx].qty }}</strong></div>
        <div><span class="text-gray-400 uppercase text-[9px] tracking-wide block">Rate</span><strong>₹{{ stock.batches![selectedBatchIdx].rate }}</strong></div>
      </div>
    </div>

    <div v-else>
      <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Batch No</label>
      <input v-model="form.batch" type="text" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none" placeholder="Optional">
    </div>

    <div>
      <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Part No (P/No)</label>
      <input v-model="form.pno" type="text" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
    </div>
    <div>
      <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">OEM / Brand</label>
      <input v-model="form.oem" type="text" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
    </div>
    <div>
      <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">HSN/SAC Code *</label>
      <input v-model="form.hsn" type="text" required class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none" placeholder="e.g. 8471">
    </div>

    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">{{ mode === 'create' ? 'Opening' : '' }} Qty *</label>
        <input v-model="form.qty" type="number" step="0.01" required class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none" placeholder="0.00">
      </div>
      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">UOM *</label>
        <select v-model="form.uom" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white">
          <option v-for="u in UOM_OPTIONS" :key="u" :value="u">{{ u }}</option>
        </select>
      </div>
    </div>

    <div>
      <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Selling Rate (₹) *</label>
      <input v-model="form.rate" type="number" step="0.01" required class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
    </div>

    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">GST % *</label>
        <select v-model="form.grate" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white">
          <option v-for="g in GST_OPTIONS" :key="g" :value="String(g)">{{ g }}%</option>
        </select>
      </div>
      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">MRP</label>
        <input v-model="form.mrp" type="number" step="0.01" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
      </div>
    </div>

    <div>
      <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Expiry Date</label>
      <input v-model="form.expiryDate" type="date" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
    </div>

    <div class="col-span-2 pt-3 border-t border-gray-100 flex justify-end gap-2 mt-1">
      <button @click="emit('close')" type="button"
              class="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
      <button @click="submit" :disabled="saving" type="button"
              class="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-60">
        <span v-if="!saving">{{ mode === 'create' ? 'Save Item' : 'Update Item' }}</span>
        <span v-else>Saving…</span>
        <div v-if="saving" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      </button>
    </div>
  </div>
</template>
