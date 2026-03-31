<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

export interface OtherCharge {
  name: string; type: string; hsnSac: string
  amount: number; gstRate: number; gstAmount?: number
}

const props = defineProps<{ charges: OtherCharge[] }>()
const emit  = defineEmits<{ add: [charge: OtherCharge]; remove: [index: number]; save: []; close: [] }>()

const name    = ref('')
const type    = ref('freight')
const hsnSac  = ref('')
const amount  = ref<number | undefined>(undefined)
const gstRate = ref('0')

const existingCharges = ref<any[]>([])
const chargesLoaded   = ref(false)
const showSuggestions = ref(false)

const typeOptions = [
  { label: 'Freight',   value: 'freight'   },
  { label: 'Packing',   value: 'packing'   },
  { label: 'Insurance', value: 'insurance' },
  { label: 'Handling',  value: 'handling'  },
  { label: 'Other',     value: 'other'     },
]
const gstOptions = [
  { label: '0%',  value: '0'  },
  { label: '5%',  value: '5'  },
  { label: '12%', value: '12' },
  { label: '18%', value: '18' },
  { label: '28%', value: '28' },
]

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n || 0)

const totalCharges = computed(() =>
  props.charges.reduce((sum, c) => {
    const amt = parseFloat(String(c.amount)) || 0
    return sum + amt + (amt * (parseFloat(String(c.gstRate)) || 0)) / 100
  }, 0)
)

const filteredSuggestions = computed(() => {
  const q = name.value.toLowerCase().trim()
  if (!q || !chargesLoaded.value) return []
  return existingCharges.value.filter(c =>
    c.name?.toLowerCase().includes(q) || c.type?.toLowerCase().includes(q)
  )
})

onMounted(async () => {
  try {
    const res = await fetch('/api/inventory/sales/other-charges-types', {
      method: 'GET', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }
    })
    if (res.ok) { const d = await res.json(); if (d.success) existingCharges.value = d.data || [] }
  } catch { /* non-critical */ }
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
  if (!name.value.trim()) return
  const amt = parseFloat(String(amount.value))
  if (isNaN(amt) || amt <= 0) return
  emit('add', { name: name.value.trim(), type: type.value, hsnSac: hsnSac.value.trim(), amount: amt, gstRate: parseFloat(gstRate.value) || 0 })
  name.value = ''; hsnSac.value = ''; amount.value = undefined; gstRate.value = '0'
}

function chargeTotal(c: OtherCharge): number {
  const amt = parseFloat(String(c.amount)) || 0
  return amt + (amt * (parseFloat(String(c.gstRate)) || 0)) / 100
}
</script>

<template>
  <!-- Header -->
  <div class="px-4 py-3 border-b border-(--ui-border) flex justify-between items-center bg-(--ui-bg)">
    <div>
      <h3 class="font-bold text-base text-(--ui-text)">Other Charges</h3>
      <p class="text-xs text-(--ui-text-muted) mt-0.5">Add freight, packing, insurance, etc.</p>
    </div>
    <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="emit('close')" />
  </div>

  <!-- Body -->
  <div class="flex-1 overflow-y-auto p-4 space-y-4 bg-(--ui-bg)">

    <!-- Add form -->
    <div class="p-4 bg-(--ui-bg-muted) rounded-xl border border-(--ui-border) space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <!-- Charge name with autocomplete -->
        <div class="relative">
          <UFormField label="Charge Name" required>
            <UInput v-model="name" placeholder="e.g. Freight, Packing" autocomplete="off"
                    class="w-full"
                    @input="showSuggestions = true" @blur="setTimeout(() => showSuggestions = false, 150)" />
          </UFormField>
          <div v-if="showSuggestions && filteredSuggestions.length"
               class="absolute z-50 bg-(--ui-bg) border border-(--ui-border) rounded-xl shadow-xl mt-0.5 w-full max-h-40 overflow-y-auto top-full left-0">
            <div v-for="c in filteredSuggestions" :key="c.name"
                 @mousedown="applySuggestion(c)"
                 class="px-3 py-2 hover:bg-(--ui-bg-elevated) cursor-pointer border-b border-(--ui-border) last:border-0">
              <div class="text-sm font-medium text-(--ui-text)">{{ c.name || c.type }}</div>
              <div class="text-[10px] text-(--ui-text-muted)">{{ c.type }} · HSN: {{ c.hsnSac || 'N/A' }} · GST {{ c.gstRate || 0 }}%</div>
            </div>
          </div>
        </div>

        <UFormField label="Type">
          <USelect v-model="type" :items="typeOptions" value-key="value" label-key="label" class="w-full" />
        </UFormField>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <UFormField label="HSN/SAC Code">
          <UInput v-model="hsnSac" placeholder="e.g. 9965" class="w-full" />
        </UFormField>
        <UFormField label="Amount (₹)" required>
          <UInput v-model="amount" type="number" step="0.01" placeholder="0.00" class="w-full" />
        </UFormField>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <UFormField label="GST %">
          <USelect v-model="gstRate" :items="gstOptions" value-key="value" label-key="label" class="w-full" />
        </UFormField>
        <div class="flex items-end">
          <UButton label="+ Add Charge" color="primary" block @click="addCharge" />
        </div>
      </div>
    </div>

    <!-- Charges list -->
    <div>
      <div class="flex justify-between items-center mb-2">
        <h4 class="font-bold text-sm text-(--ui-text)">Charges Added</h4>
        <span class="text-xs text-(--ui-text-muted)">
          Total: <span class="font-bold text-primary">{{ fmt(totalCharges) }}</span>
        </span>
      </div>

      <div class="overflow-x-auto rounded-xl border border-(--ui-border)">
        <table class="w-full text-left border-collapse">
          <thead class="bg-(--ui-bg-muted) text-[10px] font-bold text-(--ui-text-muted) uppercase tracking-wide border-b border-(--ui-border)">
            <tr>
              <th class="p-2.5">Name</th>
              <th class="p-2.5">Type</th>
              <th class="p-2.5">HSN/SAC</th>
              <th class="p-2.5 text-right">Amount</th>
              <th class="p-2.5 text-right">GST%</th>
              <th class="p-2.5 text-right">Total</th>
              <th class="p-2.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody class="bg-(--ui-bg) text-xs divide-y divide-(--ui-border)">
            <tr v-if="charges.length === 0">
              <td colspan="7" class="p-8 text-center text-(--ui-text-muted) italic text-sm">No charges added yet</td>
            </tr>
            <tr v-for="(charge, idx) in charges" :key="idx"
                class="hover:bg-(--ui-bg-elevated) transition-colors">
              <td class="p-2.5 font-semibold text-(--ui-text)">{{ charge.name }}</td>
              <td class="p-2.5 text-(--ui-text-muted)">{{ charge.type || '-' }}</td>
              <td class="p-2.5 text-(--ui-text-muted) font-mono text-[11px]">{{ charge.hsnSac || '-' }}</td>
              <td class="p-2.5 text-right font-mono tabular-nums">{{ fmt(charge.amount) }}</td>
              <td class="p-2.5 text-right text-(--ui-text-muted)">{{ charge.gstRate }}%</td>
              <td class="p-2.5 text-right font-bold tabular-nums text-(--ui-text)">{{ fmt(chargeTotal(charge)) }}</td>
              <td class="p-2.5 text-center">
                <UButton label="Remove" color="error" variant="soft" size="xs" @click="emit('remove', idx)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="px-4 py-3 border-t border-(--ui-border) bg-(--ui-bg-muted) flex justify-end gap-2">
    <UButton label="Cancel" color="neutral" variant="ghost" @click="emit('close')" />
    <UButton label="Save & Close" color="neutral" variant="solid"
             @click="emit('save'); emit('close')" />
  </div>
</template>
