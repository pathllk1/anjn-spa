<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

export interface OtherCharge {
  name: string; type: string; hsnSac: string
  amount: number; gstRate: number; gstAmount?: number
}

const props = defineProps<{ charges: OtherCharge[] }>()
const emit  = defineEmits<{
  add:    [charge: OtherCharge]
  remove: [index: number]
  save:   []
  close:  []
}>()

// Form state
const name    = ref('')
const type    = ref('freight')
const hsnSac  = ref('')
const amount  = ref('')
const gstRate = ref('0')

// Autocomplete
const existingCharges  = ref<any[]>([])
const chargesLoaded    = ref(false)
const showSuggestions  = ref(false)

const filteredSuggestions = computed(() => {
  const q = name.value.toLowerCase().trim()
  if (!q || !chargesLoaded.value) return []
  return existingCharges.value.filter(c =>
    c.name?.toLowerCase().includes(q) || c.type?.toLowerCase().includes(q)
  )
})

const totalCharges = computed(() =>
  props.charges.reduce((sum, c) => {
    const amt = parseFloat(String(c.amount)) || 0
    return sum + amt + (amt * (parseFloat(String(c.gstRate)) || 0)) / 100
  }, 0)
)

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n || 0)

onMounted(async () => {
  try {
    const res = await fetch('/api/inventory/sales/other-charges-types', {
      method: 'GET', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }
    })
    if (res.ok) {
      const data = await res.json()
      if (data.success) existingCharges.value = data.data || []
    }
  } catch (e) { console.warn('Could not load charge types') }
  finally { chargesLoaded.value = true }
})

function applySuggestion(c: any) {
  name.value    = c.name    || ''
  type.value    = c.type    || 'other'
  hsnSac.value  = c.hsnSac  || ''
  gstRate.value = String(c.gstRate || 0)
  showSuggestions.value = false
}

function addCharge() {
  if (!name.value.trim()) { alert('Please enter a charge name'); return }
  const amt = parseFloat(amount.value)
  if (isNaN(amt) || amt <= 0) { alert('Please enter a valid amount'); return }
  emit('add', { name: name.value.trim(), type: type.value, hsnSac: hsnSac.value.trim(), amount: amt, gstRate: parseFloat(gstRate.value) || 0 })
  name.value = ''; hsnSac.value = ''; amount.value = ''; gstRate.value = '0'
}

function chargeTotal(c: OtherCharge) {
  const amt = parseFloat(String(c.amount)) || 0
  return amt + (amt * (parseFloat(String(c.gstRate)) || 0)) / 100
}
</script>

<template>
  <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
    <div>
      <h3 class="font-bold text-base text-gray-800">Other Charges</h3>
      <p class="text-xs text-gray-400 mt-0.5">Add freight, packing, insurance, etc.</p>
    </div>
    <button @click="emit('close')" class="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 text-xl">&times;</button>
  </div>

  <div class="flex-1 overflow-y-auto p-4 bg-white space-y-4">
    <!-- Add Form -->
    <div class="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
      <div class="col-span-2 grid grid-cols-2 gap-3">
        <div class="relative">
          <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Charge Name *</label>
          <input v-model="name" type="text" autocomplete="off"
                 @input="showSuggestions = true" @blur="setTimeout(() => showSuggestions = false, 150)"
                 class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white"
                 placeholder="e.g. Freight, Packing">
          <div v-if="showSuggestions && filteredSuggestions.length"
               class="absolute z-50 bg-white border border-gray-200 rounded-xl shadow-xl mt-0.5 w-full max-h-40 overflow-y-auto">
            <div v-for="c in filteredSuggestions" :key="c.name"
                 @mousedown="applySuggestion(c)"
                 class="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0">
              <div class="text-sm font-medium text-gray-800">{{ c.name || c.type }}</div>
              <div class="text-[10px] text-gray-400">{{ c.type }} · HSN: {{ c.hsnSac || 'N/A' }} · GST {{ c.gstRate || 0 }}%</div>
            </div>
          </div>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Type</label>
          <select v-model="type" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white">
            <option value="freight">Freight</option>
            <option value="packing">Packing</option>
            <option value="insurance">Insurance</option>
            <option value="handling">Handling</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">HSN/SAC Code</label>
        <input v-model="hsnSac" type="text" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white" placeholder="e.g. 9965">
      </div>
      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Amount (₹) *</label>
        <input v-model="amount" type="number" step="0.01" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white" placeholder="0.00">
      </div>
      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">GST %</label>
        <select v-model="gstRate" class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none bg-white">
          <option value="0">0%</option>
          <option value="5">5%</option>
          <option value="12">12%</option>
          <option value="18">18%</option>
          <option value="28">28%</option>
        </select>
      </div>
      <div class="flex items-end">
        <button @click="addCharge"
                class="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-colors">
          + Add Charge
        </button>
      </div>
    </div>

    <!-- Charges list -->
    <div>
      <div class="flex justify-between items-center mb-2">
        <h4 class="font-bold text-sm text-gray-700">Charges Added</h4>
        <span class="text-xs text-gray-500">
          Total: <span class="font-bold text-blue-600">{{ formatCurrency(totalCharges) }}</span>
        </span>
      </div>
      <div class="overflow-x-auto rounded-xl border border-gray-200">
        <table class="w-full text-left border-collapse">
          <thead class="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wide border-b border-gray-200">
            <tr>
              <th class="p-2.5">Name</th><th class="p-2.5">Type</th><th class="p-2.5">HSN/SAC</th>
              <th class="p-2.5 text-right">Amount</th><th class="p-2.5 text-right">GST%</th>
              <th class="p-2.5 text-right">Total</th><th class="p-2.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody class="bg-white">
            <tr v-if="charges.length === 0">
              <td colspan="7" class="p-8 text-center text-gray-300 italic text-sm">No charges added yet</td>
            </tr>
            <tr v-for="(charge, idx) in charges" :key="idx"
                class="hover:bg-blue-50/60 transition-colors border-b border-gray-50 text-xs">
              <td class="p-2.5 font-semibold text-gray-800">{{ charge.name }}</td>
              <td class="p-2.5 text-gray-500">{{ charge.type || '-' }}</td>
              <td class="p-2.5 text-gray-400 font-mono text-[11px]">{{ charge.hsnSac || '-' }}</td>
              <td class="p-2.5 text-right font-mono tabular-nums">{{ formatCurrency(charge.amount) }}</td>
              <td class="p-2.5 text-right text-gray-500">{{ charge.gstRate }}%</td>
              <td class="p-2.5 text-right font-bold tabular-nums text-gray-800">{{ formatCurrency(chargeTotal(charge)) }}</td>
              <td class="p-2.5 text-center">
                <button @click="emit('remove', idx)"
                        class="bg-red-50 border border-red-200 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-red-100 transition-colors">
                  REMOVE
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="p-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
    <button @click="emit('close')" class="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
    <button @click="emit('save'); emit('close')"
            class="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-lg shadow-sm transition-colors">
      Save &amp; Close
    </button>
  </div>
</template>
