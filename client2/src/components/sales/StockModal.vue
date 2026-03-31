<script setup lang="ts">
import { ref, computed } from 'vue'

interface Batch { batch?: string; qty: number; rate: number; expiry?: string; mrp?: number }
interface Stock {
  id?: string; _id?: string; item: string; batch?: string; batches?: Batch[]
  oem?: string; hsn?: string; pno?: string; qty: number; uom: string
  rate: number; grate: number
}

const props = defineProps<{ stocks: Stock[] }>()
const emit = defineEmits<{
  select:  [stock: Stock, showBatch: boolean]
  create:  []
  edit:    [stock: Stock]
  history: [stock: Stock]
  close:   []
}>()

const searchTerm = ref('')

const filtered = computed(() => {
  const t = searchTerm.value.toLowerCase()
  if (!t) return props.stocks
  return props.stocks.filter(s =>
    s.item?.toLowerCase().includes(t) ||
    s.batch?.toLowerCase().includes(t) ||
    s.oem?.toLowerCase().includes(t) ||
    s.hsn?.toLowerCase().includes(t) ||
    s.batches?.some(b => b.batch?.toLowerCase().includes(t) || b.expiry?.toLowerCase().includes(t))
  )
})

function handleSelect(stock: Stock) {
  if (Array.isArray(stock.batches) && stock.batches.length > 1) {
    emit('select', stock, true)
  } else if (Array.isArray(stock.batches) && stock.batches.length === 1) {
    const b = stock.batches[0]
    emit('select', { ...stock, batch: b.batch, qty: b.qty, rate: b.rate }, false)
  } else {
    emit('select', stock, false)
  }
}
</script>

<template>
  <div class="p-3 border-b border-gray-200 bg-white flex justify-between items-center gap-3">
    <h3 class="font-bold text-sm text-gray-800 shrink-0 uppercase tracking-wide">Item Selection</h3>
    <div class="flex items-center gap-2 flex-1 justify-end">
      <div class="relative flex-1 max-w-sm">
        <input v-model="searchTerm" type="text" autofocus
               placeholder="Search item, batch, OEM, HSN…"
               class="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none shadow-sm">
        <svg class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
      </div>
      <button @click="emit('create')"
              class="shrink-0 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        New Item
      </button>
      <button @click="emit('close')"
              class="shrink-0 text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-xl leading-none">&times;</button>
    </div>
  </div>

  <div class="flex-1 overflow-y-auto">
    <table class="w-full text-left border-collapse">
      <thead class="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider sticky top-0 border-b border-gray-200 z-10">
        <tr>
          <th class="p-2.5">Item Description</th>
          <th class="p-2.5">Batch / Batches</th>
          <th class="p-2.5">OEM</th>
          <th class="p-2.5 text-right">Available</th>
          <th class="p-2.5 text-right">Rate</th>
          <th class="p-2.5 text-right">GST%</th>
          <th class="p-2.5 text-center">Actions</th>
        </tr>
      </thead>
      <tbody class="text-xs divide-y divide-gray-100 bg-white">
        <tr v-if="filtered.length === 0">
          <td colspan="7" class="p-12 text-center text-gray-300 italic text-sm">No items match your search.</td>
        </tr>
        <tr v-for="stock in filtered" :key="String(stock.id || stock._id)"
            class="hover:bg-blue-50/40 transition-colors group">
          <td class="p-2.5 font-semibold text-blue-900 max-w-[200px]">
            <div class="truncate" :title="stock.item">{{ stock.item }}</div>
            <div v-if="stock.pno" class="text-[10px] text-gray-400 font-normal font-mono">{{ stock.pno }}</div>
          </td>
          <td class="p-2.5">
            <span v-if="!stock.batches?.length" class="text-gray-400">—</span>
            <span v-else-if="stock.batches.length === 1" class="font-mono">{{ stock.batches[0].batch || 'No Batch' }}</span>
            <span v-else class="bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded text-[10px] font-mono">
              {{ stock.batches.length }} batches
            </span>
          </td>
          <td class="p-2.5 text-gray-400 text-[11px]">{{ stock.oem || '—' }}</td>
          <td class="p-2.5 text-right font-bold tabular-nums" :class="Number(stock.qty) > 0 ? 'text-emerald-600' : 'text-red-500'">
            {{ stock.qty }} <span class="font-normal text-[10px]">{{ stock.uom }}</span>
          </td>
          <td class="p-2.5 text-right font-mono tabular-nums text-gray-700">{{ stock.rate }}</td>
          <td class="p-2.5 text-right text-gray-500">{{ stock.grate }}%</td>
          <td class="p-2.5">
            <div class="flex items-center justify-center gap-1">
              <button @click="emit('edit', stock)"
                      class="px-2 py-1 border border-gray-200 text-gray-600 rounded text-[10px] font-bold hover:bg-gray-100 transition-colors">EDIT</button>
              <button @click="emit('history', stock)"
                      class="px-2 py-1 border border-amber-200 text-amber-700 rounded text-[10px] font-bold hover:bg-amber-50 transition-colors">HIST</button>
              <button @click="handleSelect(stock)"
                      class="px-2.5 py-1 border border-blue-200 bg-blue-50 text-blue-700 rounded text-[10px] font-bold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors">ADD +</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
