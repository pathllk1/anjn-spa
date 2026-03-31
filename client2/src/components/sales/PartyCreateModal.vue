<script setup lang="ts">
import { ref } from 'vue'

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

const emit = defineEmits<{ saved: [party: any]; close: [] }>()

const firm       = ref('')
const gstin      = ref('')
const contact    = ref('')
const state      = ref('')
const state_code = ref('')
const pan        = ref('')
const addr       = ref('')
const pin        = ref('')

const fetching = ref(false)
const saving   = ref(false)
const error    = ref('')

function getCSRF(): string {
  const name = 'csrfToken='
  for (const cookie of decodeURIComponent(document.cookie).split(';')) {
    const c = cookie.trim()
    if (c.startsWith(name)) return c.substring(name.length)
  }
  return ''
}

function onGstinInput() {
  const val = gstin.value.toUpperCase()
  gstin.value = val
  if (val.length >= 2 && /^\d{2}/.test(val)) {
    state_code.value = val.substring(0, 2)
  } else if (val.length < 2) {
    state_code.value = ''
  }
  if (val.length >= 12) pan.value = val.substring(2, 12)
}

function onStateInput() {
  if (gstin.value.length >= 2) return
  const code = INDIA_STATE_CODES[state.value.trim().toLowerCase()]
  state_code.value = code ?? ''
}

async function fetchGST() {
  const g = gstin.value.trim()
  if (!g || g.length !== 15) { error.value = 'Please enter a valid 15-character GSTIN'; return }
  error.value = ''
  fetching.value = true
  try {
    const res = await fetch('/api/inventory/sales/gst-lookup', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCSRF() },
      body: JSON.stringify({ gstin: g })
    })
    if (!res.ok) { const e = await res.json(); error.value = e.error || 'Failed'; return }
    const data = await res.json()
    if (!data.success) { error.value = data.error || 'Failed'; return }
    const d = data.data || data
    const a = d.place_of_business_principal?.address
    if (a) {
      addr.value = [a.door_num, a.building_name, a.floor_num, a.street, a.location, a.city, a.district].filter(Boolean).join(', ')
      const p = a.pin_code?.toString().trim()
      if (/^\d{6}$/.test(p)) pin.value = p
    }
    let st = d.place_of_business_principal?.address?.state || d.state_jurisdiction || ''
    if (st.includes(' - ')) st = st.split(' - ')[0].trim()
    state.value      = st
    firm.value       = d.trade_name || d.legal_name || firm.value
    state_code.value = g.substring(0, 2)
    pan.value        = g.length >= 12 ? g.substring(2, 12) : pan.value
  } catch (e: any) { error.value = e.message || 'Network error' }
  finally { fetching.value = false }
}

async function submit() {
  if (!firm.value.trim()) { error.value = 'Firm name is required'; return }
  error.value = ''
  saving.value = true
  try {
    const payload = {
      firm: firm.value, gstin: gstin.value || 'UNREGISTERED',
      contact: contact.value || null, state: state.value, supply: state.value,
      state_code: state_code.value ? state_code.value.padStart(2, '0') : null,
      pan: pan.value || null, addr: addr.value || null, pin: pin.value || null,
    }
    const res = await fetch('/api/inventory/sales/parties', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCSRF() },
      body: JSON.stringify(payload)
    })
    if (!res.ok) { const e = await res.json(); error.value = e.error || 'Failed'; return }
    const result = await res.json()
    if (!result.success) { error.value = result.error || 'Failed'; return }
    emit('saved', result.data || result)
  } catch (e: any) { error.value = e.message || 'Error creating party' }
  finally { saving.value = false }
}
</script>

<template>
  <!-- Header -->
  <div class="px-4 py-3 border-b border-(--ui-border) flex justify-between items-center bg-(--ui-bg-elevated)">
    <div>
      <h3 class="font-bold text-sm text-(--ui-text) tracking-wide uppercase">Add New Party</h3>
      <p class="text-(--ui-text-muted) text-[10px] mt-0.5">Fill in party details below</p>
    </div>
    <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="emit('close')" />
  </div>

  <!-- Form body -->
  <div class="p-5 grid grid-cols-2 gap-x-5 gap-y-3.5 overflow-y-auto max-h-[72vh] bg-(--ui-bg)">
    <UAlert v-if="error" :title="error" color="error" variant="subtle" class="col-span-2" />

    <UFormField label="Firm Name" required class="col-span-2">
      <UInput v-model="firm" placeholder="e.g. M/S Global Enterprises" />
    </UFormField>

    <UFormField label="GSTIN" class="col-span-2">
      <div class="flex gap-2">
        <UInput v-model="gstin" @input="onGstinInput" placeholder="27ABCDE1234F1Z5"
                maxlength="15" class="flex-1 font-mono uppercase" />
        <UButton label="FETCH" :loading="fetching" color="warning" size="sm"
                 class="shrink-0" @click="fetchGST" />
      </div>
      <template #hint>Click Fetch to auto-fill from GST portal</template>
    </UFormField>

    <UFormField label="Contact No">
      <UInput v-model="contact" />
    </UFormField>

    <UFormField label="State" required>
      <UInput v-model="state" @input="onStateInput" />
    </UFormField>

    <UFormField label="State Code">
      <UInput v-model="state_code" readonly maxlength="2"
              :ui="{ base: 'cursor-not-allowed' }" color="neutral" variant="subtle" />
    </UFormField>

    <UFormField label="PAN">
      <UInput v-model="pan" maxlength="10" class="uppercase font-mono" />
    </UFormField>

    <UFormField label="Address" class="col-span-2">
      <UTextarea v-model="addr" :rows="2" resize />
    </UFormField>

    <UFormField label="Pincode">
      <UInput v-model="pin" type="number" />
    </UFormField>
  </div>

  <!-- Footer -->
  <div class="px-5 py-4 border-t border-(--ui-border) bg-(--ui-bg-muted) flex justify-end gap-2">
    <UButton label="Cancel" color="neutral" variant="ghost" @click="emit('close')" />
    <UButton label="Save Party" :loading="saving" color="primary" @click="submit" />
  </div>
</template>
