<script setup lang="ts">
import { ref, watch } from 'vue'

interface Stock  { id?: string; _id?: string; item: string }
interface Party  { _id?: string; id?: string; firm: string }
interface HistoryRecord { date: string; batch: string; qty: number; rate: number; total: string; refNo: string }

const props = defineProps<{ stock: Stock | null; party: Party | null; historyCache: Record<string, any> }>()
const emit  = defineEmits<{ close: []; cacheUpdate: [key: string, data: HistoryRecord[]] }>()

const loading      = ref(false)
const historyData  = ref<HistoryRecord[]>([])
const currentPage  = ref(1)
const itemsPerPage = 10

const partyId = () => props.party?._id || props.party?.id || null
const stockId = () => props.stock?.id  || props.stock?._id || null
const cacheKey = () => `${partyId()}:${stockId()}`

const totalPages   = () => Math.max(1, Math.ceil(historyData.value.length / itemsPerPage))
const pageData     = () => {
  const start = (currentPage.value - 1) * itemsPerPage
  return historyData.value.slice(start, start + itemsPerPage)
}
const pageButtons  = () => {
  const tp = totalPages()
  if (tp <= 10) return Array.from({ length: tp }, (_, i) => i + 1)
  return Array.from({ length: 5 }, (_, i) => Math.max(1, Math.min(currentPage.value - 2, tp - 4)) + i)
}

watch(() => [props.stock, props.party], async () => {
  if (!props.stock || !props.party) return
  const key = cacheKey()
  if (props.historyCache[key]) {
    historyData.value = props.historyCache[key]
    return
  }
  loading.value = true
  historyData.value = []
  currentPage.value = 1
  try {
    const response = await fetch(
      `/api/inventory/sales/party-item-history?partyId=${partyId()}&stockId=${stockId()}&limit=all`,
      { method: 'GET', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }
    )
    if (response.ok) {
      const data = await response.json()
      if (data.success && Array.isArray(data.data?.rows)) {
        const rows: HistoryRecord[] = data.data.rows.map((row: any) => ({
          date:  row.bdate ? new Date(row.bdate).toLocaleDateString('en-IN') : '-',
          batch: row.batch || '-',
          qty:   row.qty   || 0,
          rate:  row.rate  || 0,
          total: ((row.qty || 0) * (row.rate || 0)).toFixed(2),
          refNo: row.bno   || '-',
        }))
        historyData.value = rows
        emit('cacheUpdate', key, rows)
      }
    }
  } catch (err) {
    console.error('Error fetching history:', err)
  } finally {
    loading.value = false
  }
}, { immediate: true })
</script>

<template>
  <div v-if="stock && party">
    <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
      <div>
        <h3 class="font-bold text-base text-gray-800">{{ stock.item }} — History</h3>
        <p class="text-xs text-gray-500 mt-0.5">
          Party: <strong>{{ party.firm }}</strong>
          <span v-if="historyData.length" class="ml-2 bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-mono">
            {{ historyData.length }} records
          </span>
        </p>
      </div>
      <button @click="emit('close')" class="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 text-xl">&times;</button>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center p-16 text-gray-400">
      <div class="flex flex-col items-center gap-3">
        <div class="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-sm">Loading history…</span>
      </div>
    </div>

    <template v-else>
      <div class="flex-1 overflow-y-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead class="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider sticky top-0 border-b border-gray-200">
            <tr>
              <th class="p-2.5">Date</th>
              <th class="p-2.5">Batch</th>
              <th class="p-2.5 text-right">Qty</th>
              <th class="p-2.5 text-right">Rate</th>
              <th class="p-2.5 text-right">Total</th>
              <th class="p-2.5">Ref No</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-50">
            <tr v-if="historyData.length === 0">
              <td colspan="6" class="p-10 text-center text-gray-300 italic text-sm">No purchase history found</td>
            </tr>
            <tr v-for="(rec, i) in pageData()" :key="i"
                class="hover:bg-blue-50/60 transition-colors border-b border-gray-50">
              <td class="p-2.5 text-gray-600">{{ rec.date }}</td>
              <td class="p-2.5 font-mono text-gray-400 text-[11px]">{{ rec.batch }}</td>
              <td class="p-2.5 text-right tabular-nums">{{ rec.qty }}</td>
              <td class="p-2.5 text-right tabular-nums">{{ rec.rate }}</td>
              <td class="p-2.5 text-right font-semibold tabular-nums text-gray-800">{{ rec.total }}</td>
              <td class="p-2.5 text-gray-400 font-mono text-[11px]">{{ rec.refNo }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="historyData.length > itemsPerPage"
           class="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-xs">
        <span class="text-gray-500">
          Showing {{ (currentPage - 1) * itemsPerPage + 1 }}–{{ Math.min(currentPage * itemsPerPage, historyData.length) }} of {{ historyData.length }}
        </span>
        <div class="flex items-center gap-1">
          <button :disabled="currentPage === 1" @click="currentPage--"
                  class="px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">‹</button>
          <button v-for="page in pageButtons()" :key="page" @click="currentPage = page"
                  class="px-2.5 py-1 rounded border transition-colors"
                  :class="page === currentPage ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-100'">
            {{ page }}
          </button>
          <button :disabled="currentPage === totalPages()" @click="currentPage++"
                  class="px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">›</button>
        </div>
      </div>
    </template>
  </div>
</template>
