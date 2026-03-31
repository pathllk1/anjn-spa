<script setup lang="ts">
interface Batch { batch?: string; qty: number; rate: number; expiry?: string; mrp?: number }
interface Stock {
  item: string; uom: string; batches?: Batch[]
  [key: string]: any
}

const props = defineProps<{ stock: Stock | null }>()
const emit  = defineEmits<{
  select: [stockWithBatch: Stock]
  close:  []
}>()

function pickBatch(batch: Batch) {
  if (!props.stock) return
  emit('select', { ...props.stock, batch: batch.batch, qty: batch.qty, rate: batch.rate, expiry: batch.expiry })
}
</script>

<template>
  <div v-if="stock">
    <div class="bg-gradient-to-r from-slate-800 to-slate-700 p-4 flex justify-between items-center text-white">
      <div>
        <h3 class="font-bold text-sm tracking-wide">Select Batch</h3>
        <p class="text-slate-400 text-[10px] mt-0.5 truncate max-w-xs">{{ stock.item }}</p>
      </div>
      <button @click="emit('close')" class="hover:text-red-300 text-xl transition-colors w-7 h-7 flex items-center justify-center">&times;</button>
    </div>

    <div class="p-4 space-y-2.5 max-h-96 overflow-y-auto bg-gray-50">
      <div v-if="!stock.batches?.length" class="text-center text-gray-400 py-8 italic text-sm">No batch information available.</div>
      <div v-for="(batch, idx) in stock.batches" :key="idx"
           @click="pickBatch(batch)"
           class="p-3 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/60 hover:shadow-sm cursor-pointer transition-all bg-white group">
        <div class="flex justify-between items-start gap-3">
          <div class="min-w-0 flex-1">
            <div class="font-bold text-gray-800 group-hover:text-blue-800">{{ batch.batch || 'No Batch' }}</div>
            <div class="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-gray-500 mt-1.5">
              <span>Qty: <strong class="text-gray-700">{{ batch.qty }} {{ stock.uom }}</strong></span>
              <span>Rate: <strong class="text-gray-700">₹{{ batch.rate }}</strong></span>
              <span v-if="batch.expiry">Expiry: <strong class="text-gray-700">{{ batch.expiry }}</strong></span>
              <span v-if="batch.mrp">MRP: <strong class="text-gray-700">₹{{ batch.mrp }}</strong></span>
            </div>
          </div>
          <div class="shrink-0 text-right">
            <div class="text-[10px] text-gray-400 uppercase tracking-wide">Available</div>
            <div class="font-bold text-lg" :class="Number(batch.qty) > 0 ? 'text-emerald-600' : 'text-red-500'">{{ batch.qty }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
