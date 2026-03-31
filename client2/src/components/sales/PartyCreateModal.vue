<script setup lang="ts">
import { ref } from 'vue'

// India state → 2-digit GST code map (abbreviated, import full map in production)
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

const emit = defineEmits<{ saved: [party: any]; close: [] }>()

const form = ref({ firm:'', gstin:'', contact:'', state:'', state_code:'', pan:'', addr:'', pin:'' })
const fetching = ref(false)
const saving   = ref(false)

async function fetchGST() {
  const gstin = form.value.gstin.trim()
  if (!gstin || gstin.length !== 15) { alert('Please enter a valid 15-character GSTIN'); return }
  fetching.value = true
  try {
    const res = await fetch('/api/inventory/sales/gst-lookup', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCSRF() },
      body: JSON.stringify({ gstin })
    })
    if (!res.ok) { const e = await res.json(); alert(e.error || 'Failed'); return }
    const data = await res.json()
    if (!data.success) { alert(data.error || 'Failed'); return }
    const d = data.data || data
    const addr = d.place_of_business_principal?.address
    if (addr) {
      form.value.addr  = [addr.door_num, addr.building_name, addr.floor_num, addr.street, addr.location, addr.city, addr.district].filter(Boolean).join(', ')
      const pin = addr.pin_code?.toString().trim()
      if (/^\d{6}$/.test(pin)) form.value.pin = pin
    }
    let state = d.place_of_business_principal?.address?.state || d.state_jurisdiction || ''
    if (state.includes(' - ')) state = state.split(' - ')[0].trim()
    form.value.state      = state
    form.value.firm       = d.trade_name || d.legal_name || form.value.firm
    form.value.state_code = gstin.substring(0, 2)
    form.value.pan        = gstin.length >= 12 ? gstin.substring(2, 12) : form.value.pan
  } finally { fetching.value = false }
}

function onGstinInput() {
  const val = form.value.gstin.toUpperCase()
  form.value.gstin = val
  if (val.length >= 2 && /^\d{2}/.test(val)) {
    form.value.state_code = val.substring(0, 2)
  } else if (val.length < 2) {
    form.value.state_code = ''
  }
  if (val.length >= 12) form.value.pan = val.substring(2, 12)
}

function onStateInput() {
  if (form.value.gstin.length >= 2) return
  const code = INDIA_STATE_CODES[form.value.state.trim().toLowerCase()]
  form.value.state_code = code ?? ''
}

async function submit() {
  if (!form.value.firm.trim()) { alert('Firm name is required'); return }
  saving.value = true
  try {
    const payload = {
      ...form.value,
      supply:     form.value.state,
      gstin:      form.value.gstin || 'UNREGISTERED',
      state_code: form.value.state_code ? form.value.state_code.padStart(2, '0') : null,
      contact:    form.value.contact  || null,
      addr:       form.value.addr     || null,
      pin:        form.value.pin      || null,
      pan:        form.value.pan      || null,
    }
    const res = await fetch('/api/inventory/sales/parties', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCSRF() },
      body: JSON.stringify(payload)
    })
    if (!res.ok) { const e = await res.json(); alert(e.error || 'Failed'); return }
    const result = await res.json()
    if (!result.success) { alert(result.error || 'Failed'); return }
    emit('saved', result.data || result)
  } finally { saving.value = false }
}

function getCSRF(): string {
  const name = 'csrfToken='
  for (const cookie of decodeURIComponent(document.cookie).split(';')) {
    const c = cookie.trim()
    if (c.startsWith(name)) return c.substring(name.length)
  }
  return ''
}
</script>

<template>
  <div class="bg-gradient-to-r from-slate-800 to-slate-700 p-4 flex justify-between items-center text-white">
    <div>
      <h3 class="font-bold text-sm tracking-wide">ADD NEW PARTY</h3>
      <p class="text-slate-400 text-[10px] mt-0.5">Fill in party details below</p>
    </div>
    <button @click="emit('close')" class="hover:text-red-300 text-xl transition-colors w-7 h-7 flex items-center justify-center">&times;</button>
  </div>

  <div class="p-5 grid grid-cols-2 gap-x-5 gap-y-3.5 overflow-y-auto max-h-[72vh]">
    <div class="col-span-2">
      <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Firm Name *</label>
      <input v-model="form.firm" type="text" required
             class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none"
             placeholder="e.g. M/S Global Enterprises">
    </div>

    <div class="col-span-2">
      <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">GSTIN</label>
      <div class="flex gap-2">
        <input v-model="form.gstin" @input="onGstinInput" type="text" maxlength="15"
               class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none font-mono uppercase"
               placeholder="27ABCDE1234F1Z5">
        <button @click="fetchGST" :disabled="fetching" type="button"
                class="shrink-0 bg-orange-500 hover:bg-orange-600 text-white px-3 rounded-lg text-xs font-bold shadow transition-colors min-w-[60px] disabled:opacity-60">
          {{ fetching ? '⏳' : 'FETCH' }}
        </button>
      </div>
      <p class="text-[10px] text-gray-400 mt-1">Click Fetch to auto-fill details from GST portal</p>
    </div>

    <div>
      <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Contact No</label>
      <input v-model="form.contact" type="text" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
    </div>
    <div>
      <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">State *</label>
      <input v-model="form.state" @input="onStateInput" type="text" required
             class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
    </div>
    <div>
      <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">State Code</label>
      <input v-model="form.state_code" type="text" maxlength="2" readonly
             class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 outline-none text-gray-400 cursor-not-allowed">
    </div>
    <div>
      <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">PAN</label>
      <input v-model="form.pan" type="text" maxlength="10"
             class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none uppercase font-mono">
    </div>
    <div class="col-span-2">
      <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Address</label>
      <textarea v-model="form.addr" rows="2"
                class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none resize-none"></textarea>
    </div>
    <div>
      <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Pincode</label>
      <input v-model="form.pin" type="number"
             class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none">
    </div>

    <div class="col-span-2 pt-4 border-t border-gray-100 flex justify-end gap-2 mt-1">
      <button @click="emit('close')" type="button"
              class="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
      <button @click="submit" :disabled="saving" type="button"
              class="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors disabled:opacity-60">
        {{ saving ? 'Saving…' : 'Save Party' }}
      </button>
    </div>
  </div>
</template>
