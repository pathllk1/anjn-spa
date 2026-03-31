<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Batch { batch?: string | null; qty: number; rate: number; expiry?: string | null; mrp?: number | null }
interface Stock  {
  id?: string; _id?: string; item?: string; batch?: string; batches?: Batch[]
  pno?: string; oem?: string; hsn?: string; qty?: number; uom?: string
  rate?: number; grate?: number; mrp?: number; expiryDate?: string
}

const props = defineProps<{ mode: 'create' | 'edit'; stock?: Stock | null }>()
const emit  = defineEmits<{ saved: []; close: [] }>()

const UOM_OPTIONS = ['NOS','PCS','SET','BOX','MTR','KGS'].map(v => ({ label: v, value: v }))
const GST_OPTIONS = [18, 12, 5, 28, 0].map(g => ({ label: `${g}%`, value: String(g) }))

const saving           = ref(false)
const error            = ref('')
const selectedBatchIdx = ref(-1)

const item       = ref('')
const batch      = ref('')
const pno        = ref('')
const oem        = ref('')
const hsn        = ref('')
const qty        = ref<number | undefined>(undefined)
const uom        = ref('NOS')
const rate       = ref<number | undefined>(undefined)
const grate      = ref('18')
const mrp        = ref<number | undefined>(undefined)
const expiryDate = ref('')

const isMultiBatch = computed(() =>
  props.mode === 'edit' && Array.isArray(props.stock?.batches) && (props.stock?.batches?.length ?? 0) > 1
)

watch(() => props.stock, (s) => {
  if (props.mode !== 'edit' || !s) return
  const batchVal = Array.isArray(s.batches) && s.batches.length > 0
    ? (s.batches[0]?.batch || '') : (s.batch || '')
  item.value       = s.item       || ''
  batch.value      = batchVal
  pno.value        = s.pno        || ''
  oem.value        = s.oem        || ''
  hsn.value        = s.hsn        || ''
  qty.value        = s.qty        !== undefined ? Number(s.qty) : undefined
  uom.value        = s.uom        || 'NOS'
  rate.value       = s.rate       !== undefined ? Number(s.rate) : undefined
  grate.value      = String(s.grate ?? '18')
  mrp.value        = s.mrp        !== undefined ? Number(s.mrp) : undefined
  expiryDate.value = s.expiryDate ? String(s.expiryDate).split('T')[0] : ''
}, { immediate: true })

function selectBatch(idx: number) {
  if (!props.stock?.batches) return
  selectedBatchIdx.value = idx
  const b = props.stock.batches[idx]
  batch.value      = b.batch      || ''
  qty.value        = Number(b.qty)
  rate.value       = Number(b.rate)
  mrp.value        = b.mrp        ? Number(b.mrp) : undefined
  expiryDate.value = b.expiry ? String(b.expiry).split('T')[0] : ''
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
  error.value = ''
  if (!item.value.trim())              { error.value = 'Item description is required'; return }
  if (!hsn.value.trim())               { error.value = 'HSN code is required'; return }
  if (qty.value === undefined)         { error.value = 'Quantity is required'; return }
  if (rate.value === undefined)        { error.value = 'Rate is required'; return }

  saving.value = true
  try {
    const payload: any = {
      item:  item.value.trim(),
      pno:   pno.value.trim()  || null,
      oem:   oem.value.trim()  || null,
      hsn:   hsn.value.trim(),
      qty:   qty.value,
      uom:   uom.value,
      rate:  rate.value,
      grate: parseFloat(grate.value),
      total: (qty.value * rate.value).toFixed(2),
    }

    if (props.mode === 'create') {
      if (batch.value || expiryDate.value || mrp.value) {
        payload.batches = JSON.stringify([{
          batch: batch.value || null, qty: qty.value, rate: rate.value,
          expiry: expiryDate.value || null, mrp: mrp.value ?? null,
        }])
      }
      payload.created_at = new Date().toISOString()
    } else if (props.mode === 'edit' && props.stock) {
      const s = props.stock
      if (Array.isArray(s.batches) && s.batches.length > 0) {
        const updated = JSON.parse(JSON.stringify(s.batches))
        let tgt = selectedBatchIdx.value >= 0 ? selectedBatchIdx.value
                  : updated.findIndex((b: Batch) => b.batch === (batch.value || null))
        if (tgt === -1) tgt = 0
        updated[tgt] = { ...updated[tgt], qty: qty.value, rate: rate.value,
          expiry: expiryDate.value || null, mrp: mrp.value ?? null }
        payload.batches = JSON.stringify(updated)
      } else if (batch.value || expiryDate.value || mrp.value) {
        payload.batches = JSON.stringify([{
          batch: batch.value || null, qty: qty.value, rate: rate.value,
          expiry: expiryDate.value || null, mrp: mrp.value ?? null,
        }])
      }
      payload.updated_at = new Date().toISOString()
    }

    const stockId = props.stock ? (props.stock.id || props.stock._id) : null
    const url     = props.mode === 'edit' ? `/api/inventory/sales/stocks/${stockId}` : '/api/inventory/sales/stocks'
    const method  = props.mode === 'edit' ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCSRF() },
      body: JSON.stringify(payload)
    })
    if (!res.ok) { const e = await res.json(); error.value = e.error || 'Failed'; return }
    const result = await res.json()
    if (!result.success) { error.value = result.error || 'Failed'; return }
    emit('saved')
  } catch (e: any) { error.value = e.message || 'An error occurred' }
  finally { saving.value = false }
}
</script>

<template>
  <!-- Header -->
  <div class="px-4 py-3 border-b border-(--ui-border) flex justify-between items-center bg-(--ui-bg-elevated)">
    <div>
      <h3 class="font-bold text-sm text-(--ui-text) uppercase tracking-wide">
        {{ mode === 'create' ? 'Create' : 'Edit' }} Stock Item
      </h3>
      <p class="text-(--ui-text-muted) text-[10px] mt-0.5 truncate max-w-[260px]">
        {{ mode === 'edit' ? stock?.item : 'Fill in item details below' }}
      </p>
    </div>
    <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="emit('close')" />
  </div>

  <!-- Form body -->
  <div class="p-5 grid grid-cols-2 gap-x-5 gap-y-3 overflow-y-auto max-h-[72vh] bg-(--ui-bg)">
    <UAlert v-if="error" :title="error" color="error" variant="subtle" class="col-span-2" />

    <UFormField label="Item Description" required class="col-span-2">
      <UInput v-model="item" placeholder="e.g. Dell Monitor 24 inch" />
    </UFormField>

    <!-- Multi-batch selector (edit only) -->
    <div v-if="isMultiBatch" class="col-span-2 space-y-2">
      <UFormField label="Select Batch to Edit">
        <USelect :options="stock?.batches?.map((b, i) => ({
                    label: `${b.batch || 'No Batch'} · Qty: ${b.qty} · Exp: ${b.expiry || 'N/A'}`,
                    value: i
                  })) || []"
                 value-attribute="value" option-attribute="label"
                 placeholder="— Select a batch to edit —"
                 @change="selectBatch" />
      </UFormField>
      <div v-if="selectedBatchIdx >= 0 && stock?.batches?.[selectedBatchIdx]"
           class="p-3 bg-(--ui-bg-muted) border border-(--ui-border) rounded-xl grid grid-cols-3 gap-2 text-xs text-(--ui-text-dimmed)">
        <div>
          <span class="text-(--ui-text-muted) uppercase text-[9px] tracking-wide block">Batch</span>
          <strong>{{ stock.batches![selectedBatchIdx].batch || 'No Batch' }}</strong>
        </div>
        <div>
          <span class="text-(--ui-text-muted) uppercase text-[9px] tracking-wide block">Qty</span>
          <strong>{{ stock.batches![selectedBatchIdx].qty }}</strong>
        </div>
        <div>
          <span class="text-(--ui-text-muted) uppercase text-[9px] tracking-wide block">Rate</span>
          <strong>₹{{ stock.batches![selectedBatchIdx].rate }}</strong>
        </div>
      </div>
    </div>

    <UFormField v-else label="Batch No">
      <UInput v-model="batch" placeholder="Optional" />
    </UFormField>

    <UFormField label="Part No (P/No)">
      <UInput v-model="pno" />
    </UFormField>

    <UFormField label="OEM / Brand">
      <UInput v-model="oem" />
    </UFormField>

    <UFormField label="HSN/SAC Code" required>
      <UInput v-model="hsn" placeholder="e.g. 8471" />
    </UFormField>

    <div class="grid grid-cols-2 gap-2">
      <UFormField :label="mode === 'create' ? 'Opening Qty' : 'Qty'" required>
        <UInput v-model="qty" type="number" step="0.01" placeholder="0.00" />
      </UFormField>
      <UFormField label="UOM" required>
        <USelect v-model="uom" :options="UOM_OPTIONS" value-attribute="value" option-attribute="label" />
      </UFormField>
    </div>

    <UFormField label="Selling Rate (₹)" required>
      <UInput v-model="rate" type="number" step="0.01"
              :leading-icon="() => '₹'" />
    </UFormField>

    <div class="grid grid-cols-2 gap-2">
      <UFormField label="GST %" required>
        <USelect v-model="grate" :options="GST_OPTIONS" value-attribute="value" option-attribute="label" />
      </UFormField>
      <UFormField label="MRP">
        <UInput v-model="mrp" type="number" step="0.01" />
      </UFormField>
    </div>

    <UFormField label="Expiry Date">
      <UInput v-model="expiryDate" type="date" />
    </UFormField>
  </div>

  <!-- Footer -->
  <div class="px-5 py-4 border-t border-(--ui-border) bg-(--ui-bg-muted) flex justify-end gap-2">
    <UButton label="Cancel" color="neutral" variant="ghost" @click="emit('close')" />
    <UButton :label="mode === 'create' ? 'Save Item' : 'Update Item'" :loading="saving"
             color="neutral" variant="solid" @click="submit" />
  </div>
</template>
