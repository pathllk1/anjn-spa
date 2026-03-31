<script setup lang="ts">
interface Batch { batch?: string | null; qty: number; rate: number; expiry?: string | null; mrp?: number | null }
interface Stock  { item: string; uom: string; batches?: Batch[]; [key: string]: any }

const props = defineProps<{ stock: Stock | null }>()
const emit  = defineEmits<{ select: [stockWithBatch: Stock]; close: [] }>()

function pickBatch(batch: Batch) {
  if (!props.stock) return
  emit('select', { ...props.stock, batch: batch.batch, qty: batch.qty, rate: batch.rate, expiry: batch.expiry })
}
</script>

<template>
  <div v-if="stock">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-(--ui-border) flex justify-between items-center bg-(--ui-bg-elevated)">
      <div>
        <h3 class="font-bold text-sm text-(--ui-text) tracking-wide">Select Batch</h3>
        <p class="text-(--ui-text-muted) text-[10px] mt-0.5 truncate max-w-xs">{{ stock.item }}</p>
      </div>
      <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="emit('close')" />
    </div>

    <!-- Batch list -->
    <div class="p-4 space-y-2.5 max-h-96 overflow-y-auto bg-(--ui-bg-muted)">
      <div v-if="!stock.batches?.length" class="text-center text-(--ui-text-muted) py-8 italic text-sm">
        No batch information available.
      </div>
      <div v-for="(batch, idx) in stock.batches" :key="idx"
           @click="pickBatch(batch)"
           class="p-3 border border-(--ui-border) rounded-xl hover:border-primary hover:bg-(--ui-bg-elevated)
                  hover:shadow-sm cursor-pointer transition-all bg-(--ui-bg) group">
        <div class="flex justify-between items-start gap-3">
          <div class="min-w-0 flex-1">
            <div class="font-bold text-(--ui-text) group-hover:text-primary text-sm">
              {{ batch.batch || 'No Batch' }}
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-(--ui-text-muted) mt-1.5">
              <span>Qty: <strong class="text-(--ui-text)">{{ batch.qty }} {{ stock.uom }}</strong></span>
              <span>Rate: <strong class="text-(--ui-text)">₹{{ batch.rate }}</strong></span>
              <span v-if="batch.expiry">Expiry: <strong class="text-(--ui-text)">{{ batch.expiry }}</strong></span>
              <span v-if="batch.mrp">MRP: <strong class="text-(--ui-text)">₹{{ batch.mrp }}</strong></span>
            </div>
          </div>
          <div class="shrink-0 text-right">
            <div class="text-[10px] text-(--ui-text-muted) uppercase tracking-wide">Available</div>
            <div class="font-bold text-lg"
                 :class="Number(batch.qty) > 0 ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'">
              {{ batch.qty }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
