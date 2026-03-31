<script setup lang="ts">
import { ref, watch, computed } from 'vue'

interface Stock  { id?: string; _id?: string; item: string }
interface Party  { _id?: string; id?: string; firm: string }
interface HistoryRecord { date: string; batch: string; qty: number; rate: number; total: string; refNo: string }

const props = defineProps<{
  stock: Stock | null
  party: Party | null
  historyCache: Record<string, any>
}>()
const emit = defineEmits<{ close: []; cacheUpdate: [key: string, data: HistoryRecord[]] }>()

const loading      = ref(false)
const historyData  = ref<HistoryRecord[]>([])
const currentPage  = ref(1)
const itemsPerPage = 10

const partyId  = () => props.party?._id  || props.party?.id  || null
const stockId  = () => props.stock?.id   || props.stock?._id || null
const cacheKey = () => `${partyId()}:${stockId()}`

const totalPages = computed(() => Math.max(1, Math.ceil(historyData.value.length / itemsPerPage)))
const startIdx   = computed(() => (currentPage.value - 1) * itemsPerPage)
const pageData   = computed(() => historyData.value.slice(startIdx.value, startIdx.value + itemsPerPage))

const pageButtons = computed(() => {
  const tp = totalPages.value
  if (tp <= 10) return Array.from({ length: tp }, (_, i) => i + 1)
  return Array.from({ length: 5 }, (_, i) => Math.max(1, Math.min(currentPage.value - 2, tp - 4)) + i)
})

// UTable columns definition
const columns = [
  { key: 'date',  label: 'Date' },
  { key: 'batch', label: 'Batch' },
  { key: 'qty',   label: 'Qty',   class: 'text-right' },
  { key: 'rate',  label: 'Rate',  class: 'text-right' },
  { key: 'total', label: 'Total', class: 'text-right font-semibold' },
  { key: 'refNo', label: 'Ref No' },
]

watch(() => [props.stock, props.party], async () => {
  if (!props.stock || !props.party) return
  const key = cacheKey()
  if (props.historyCache[key]) { historyData.value = props.historyCache[key]; return }

  loading.value = true
  historyData.value = []
  currentPage.value = 1
  try {
    const res = await fetch(
      `/api/inventory/sales/party-item-history?partyId=${partyId()}&stockId=${stockId()}&limit=all`,
      { method: 'GET', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }
    )
    if (res.ok) {
      const data = await res.json()
      if (data.success && Array.isArray(data.data?.rows)) {
        const rows: HistoryRecord[] = data.data.rows.map((r: any) => ({
          date:  r.bdate ? new Date(r.bdate).toLocaleDateString('en-IN') : '-',
          batch: r.batch || '-', qty: r.qty || 0, rate: r.rate || 0,
          total: ((r.qty || 0) * (r.rate || 0)).toFixed(2), refNo: r.bno || '-',
        }))
        historyData.value = rows
        emit('cacheUpdate', key, rows)
      }
    }
  } catch (err) { console.error(err) }
  finally { loading.value = false }
}, { immediate: true })
</script>

<template>
  <div v-if="stock && party" class="flex flex-col h-full">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-(--ui-border) flex justify-between items-center bg-(--ui-bg)">
      <div>
        <h3 class="font-bold text-base text-(--ui-text)">{{ stock.item }} — History</h3>
        <div class="flex items-center gap-2 mt-0.5">
          <p class="text-xs text-(--ui-text-muted)">Party: <strong>{{ party.firm }}</strong></p>
          <UBadge v-if="historyData.length" :label="`${historyData.length} records`"
                  color="primary" variant="subtle" size="xs" class="font-mono" />
        </div>
      </div>
      <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="emit('close')" />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center p-16">
      <div class="flex flex-col items-center gap-3 text-(--ui-text-muted)">
        <div class="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span class="text-sm">Loading history…</span>
      </div>
    </div>

    <template v-else>
      <!-- Table -->
      <div class="flex-1 overflow-y-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead class="bg-(--ui-bg-muted) text-[10px] font-bold text-(--ui-text-muted) uppercase tracking-wider sticky top-0 border-b border-(--ui-border)">
            <tr>
              <th class="p-2.5">Date</th>
              <th class="p-2.5">Batch</th>
              <th class="p-2.5 text-right">Qty</th>
              <th class="p-2.5 text-right">Rate</th>
              <th class="p-2.5 text-right">Total</th>
              <th class="p-2.5">Ref No</th>
            </tr>
          </thead>
          <tbody class="bg-(--ui-bg) divide-y divide-(--ui-border)">
            <tr v-if="historyData.length === 0">
              <td colspan="6" class="p-10 text-center text-(--ui-text-muted) italic text-sm">
                No purchase history found
              </td>
            </tr>
            <tr v-for="(rec, i) in pageData" :key="i"
                class="hover:bg-(--ui-bg-elevated) transition-colors">
              <td class="p-2.5 text-(--ui-text-dimmed)">{{ rec.date }}</td>
              <td class="p-2.5 font-mono text-(--ui-text-muted) text-[11px]">{{ rec.batch }}</td>
              <td class="p-2.5 text-right tabular-nums">{{ rec.qty }}</td>
              <td class="p-2.5 text-right tabular-nums">{{ rec.rate }}</td>
              <td class="p-2.5 text-right font-semibold tabular-nums text-(--ui-text)">{{ rec.total }}</td>
              <td class="p-2.5 text-(--ui-text-muted) font-mono text-[11px]">{{ rec.refNo }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="historyData.length > itemsPerPage"
           class="px-4 py-2.5 border-t border-(--ui-border) bg-(--ui-bg-muted) flex justify-between items-center text-xs">
        <span class="text-(--ui-text-muted)">
          Showing {{ startIdx + 1 }}–{{ Math.min(currentPage * itemsPerPage, historyData.length) }} of {{ historyData.length }}
        </span>
        <div class="flex items-center gap-1">
          <UButton icon="i-heroicons-chevron-left" color="neutral" variant="outline" size="xs"
                   :disabled="currentPage === 1" @click="currentPage--" />
          <UButton v-for="page in pageButtons" :key="page" :label="String(page)" size="xs"
                   :color="page === currentPage ? 'primary' : 'neutral'"
                   :variant="page === currentPage ? 'solid' : 'outline'"
                   @click="currentPage = page" />
          <UButton icon="i-heroicons-chevron-right" color="neutral" variant="outline" size="xs"
                   :disabled="currentPage === totalPages" @click="currentPage++" />
        </div>
      </div>
    </template>
  </div>
</template>
