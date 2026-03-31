<script setup lang="ts">
import { ref, computed } from 'vue'

interface Batch { batch?: string; qty: number; rate: number; expiry?: string; mrp?: number }
interface Stock {
  id?: string; _id?: string; item: string; batch?: string; batches?: Batch[]
  oem?: string; hsn?: string; pno?: string; qty: number; uom: string; rate: number; grate: number
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
    s.oem?.toLowerCase().includes(t)  ||
    s.hsn?.toLowerCase().includes(t)  ||
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
  <!-- Modal header -->
  <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-(--ui-border)">
    <h3 class="font-bold text-sm text-(--ui-text) uppercase tracking-wide shrink-0">Item Selection</h3>
    <div class="flex items-center gap-2 flex-1 justify-end">
      <UInput v-model="searchTerm" autofocus placeholder="Search item, batch, OEM, HSN…"
              icon="i-heroicons-magnifying-glass" size="sm" class="flex-1 max-w-sm" />
      <UButton label="New Item" icon="i-heroicons-plus" color="success" size="sm" @click="emit('create')" />
      <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="emit('close')" />
    </div>
  </div>

  <!-- Table -->
  <div class="flex-1 overflow-y-auto">
    <table class="w-full text-left border-collapse">
      <thead class="bg-(--ui-bg-muted) text-[10px] font-bold text-(--ui-text-muted) uppercase tracking-wider sticky top-0 border-b border-(--ui-border) z-10">
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
      <tbody class="text-xs divide-y divide-(--ui-border) bg-(--ui-bg)">
        <tr v-if="filtered.length === 0">
          <td colspan="7" class="p-12 text-center text-(--ui-text-muted) italic text-sm">
            No items match your search.
          </td>
        </tr>
        <tr v-for="stock in filtered" :key="String(stock.id || stock._id)"
            class="hover:bg-(--ui-bg-elevated) transition-colors group">
          <td class="p-2.5 font-semibold text-(--ui-text) max-w-[200px]">
            <div class="truncate" :title="stock.item">{{ stock.item }}</div>
            <div v-if="stock.pno" class="text-[10px] text-(--ui-text-muted) font-normal font-mono">{{ stock.pno }}</div>
          </td>
          <td class="p-2.5">
            <span v-if="!stock.batches?.length" class="text-(--ui-text-muted)">—</span>
            <span v-else-if="stock.batches.length === 1" class="font-mono text-(--ui-text-dimmed) text-[11px]">
              {{ stock.batches[0].batch || 'No Batch' }}
            </span>
            <UBadge v-else :label="`${stock.batches.length} batches`" color="primary" variant="subtle" size="sm" />
          </td>
          <td class="p-2.5 text-(--ui-text-muted) text-[11px]">{{ stock.oem || '—' }}</td>
          <td class="p-2.5 text-right font-bold tabular-nums text-xs"
              :class="Number(stock.qty) > 0 ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'">
            {{ stock.qty }}
            <span class="font-normal text-[10px] text-(--ui-text-muted)">{{ stock.uom }}</span>
          </td>
          <td class="p-2.5 text-right font-mono tabular-nums text-(--ui-text-dimmed) text-xs">{{ stock.rate }}</td>
          <td class="p-2.5 text-right text-(--ui-text-muted) text-xs">{{ stock.grate }}%</td>
          <td class="p-2.5">
            <div class="flex items-center justify-center gap-1">
              <UButton label="EDIT" color="neutral" variant="outline" size="xs"
                       @click="emit('edit', stock)" />
              <UButton label="HIST" color="warning" variant="outline" size="xs"
                       @click="emit('history', stock)" />
              <UButton label="ADD +" color="primary" variant="soft" size="xs"
                       @click="handleSelect(stock)" />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
