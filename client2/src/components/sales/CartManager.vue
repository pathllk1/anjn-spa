<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { api } from '@/utils/api'

const props = defineProps({
  modelValue: {
    type: Array as () => any[],
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])

const cart = ref<any[]>([...props.modelValue])
const stocks = ref<any[]>([])
const loading = ref(true)

const selectedStockId = ref('')
const itemQty = ref(1)

async function fetchStocks() {
  loading.value = true
  try {
    const response = await api.get('/inventory/sales/stocks')
    if (response && response.success && Array.isArray(response.data)) {
      stocks.value = response.data
    } else if (Array.isArray(response)) {
      stocks.value = response
    } else {
      stocks.value = []
    }
  } catch (error) {
    console.error('[CART_MANAGER] Failed to fetch stocks', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchStocks()
})

const stockItems = computed(() => {
  return stocks.value.map(s => ({
    label: s.item,
    description: `Batch: ${s.batch || 'N/A'} | Qty: ${s.qty}`,
    value: s._id,
    stock: s
  }))
})

function addItem() {
  if (!selectedStockId.value) return

  const item = stockItems.value.find(s => s.value === selectedStockId.value)
  if (!item) return

  const stock = item.stock
  
  const newItem = {
    stockId: stock._id,
    item: stock.item,
    hsn: stock.hsn,
    qty: itemQty.value,
    uom: stock.uom || 'PCS',
    rate: stock.rate,
    disc: stock.disc || 0,
    grate: stock.grate || 0,
    batch: stock.batch || '',
    narration: ''
  }

  cart.value.push(newItem)
  emit('update:modelValue', [...cart.value])
  
  // Reset
  selectedStockId.value = ''
  itemQty.value = 1
}

function removeItem(index: number) {
  cart.value.splice(index, 1)
  emit('update:modelValue', [...cart.value])
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)
}

watch(cart, (newCart) => {
  emit('update:modelValue', newCart)
}, { deep: true })
</script>

<template>
  <div class="space-y-6">
    <!-- Add Item Bar -->
    <div class="flex flex-col md:flex-row gap-4 items-end bg-(--ui-bg-muted)/30 p-4 rounded-lg border border-(--ui-border)">
      <UFormField label="Select Product" class="flex-1 w-full">
        <USelectMenu
          v-model="selectedStockId"
          :items="stockItems"
          :loading="loading"
          value-attribute="value"
          placeholder="Search inventory..."
          class="w-full"
        />
      </UFormField>
      
      <UFormField label="Quantity" class="w-full md:w-32">
        <UInput type="number" v-model="itemQty" min="0.01" step="0.01" />
      </UFormField>
      
      <UButton
        icon="i-heroicons-plus"
        color="primary"
        label="Add to Bill"
        size="lg"
        @click="addItem"
        :disabled="!selectedStockId"
      />
    </div>

    <!-- Items Table -->
    <div v-if="cart.length > 0" class="overflow-x-auto border border-(--ui-border) rounded-xl">
      <table class="min-w-full divide-y divide-(--ui-border) text-sm">
        <thead class="bg-(--ui-bg-muted)/50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-(--ui-text-muted) uppercase tracking-wider">Description</th>
            <th class="px-4 py-3 text-right font-semibold text-(--ui-text-muted) uppercase tracking-wider w-24">Qty</th>
            <th class="px-4 py-3 text-right font-semibold text-(--ui-text-muted) uppercase tracking-wider w-32">Rate</th>
            <th class="px-4 py-3 text-right font-semibold text-(--ui-text-muted) uppercase tracking-wider w-20">Tax %</th>
            <th class="px-4 py-3 text-right font-semibold text-(--ui-text-muted) uppercase tracking-wider w-32">Total</th>
            <th class="px-4 py-3 text-center font-semibold text-(--ui-text-muted) uppercase tracking-wider w-16"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-(--ui-border) bg-(--ui-bg)">
          <tr v-for="(item, index) in cart" :key="index" class="hover:bg-primary/5 transition-colors">
            <td class="px-4 py-3">
              <div class="font-bold text-base">{{ item.item }}</div>
              <div class="flex gap-2 text-[10px] text-(--ui-text-muted) uppercase font-mono">
                <span>HSN: {{ item.hsn }}</span>
                <span v-if="item.batch">| Batch: {{ item.batch }}</span>
              </div>
            </td>
            <td class="px-4 py-3">
              <UInput type="number" v-model="item.qty" step="0.01" size="sm" class="text-right" variant="subtle" />
            </td>
            <td class="px-4 py-3">
              <UInput type="number" v-model="item.rate" step="0.01" size="sm" class="text-right" variant="subtle" />
            </td>
            <td class="px-4 py-3 text-right font-medium">
              {{ item.grate }}%
            </td>
            <td class="px-4 py-3 text-right font-bold text-primary">
              {{ formatCurrency(item.qty * item.rate * (1 - (item.disc || 0) / 100)) }}
            </td>
            <td class="px-4 py-3 text-center">
              <UButton
                icon="i-heroicons-trash"
                color="error"
                variant="ghost"
                size="sm"
                @click="removeItem(index)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div v-else class="flex flex-col items-center justify-center py-16 text-(--ui-text-muted) border-2 border-dashed border-(--ui-border) rounded-xl bg-(--ui-bg-muted)/10">
      <UIcon name="i-heroicons-shopping-bag" class="w-12 h-12 mb-4 opacity-20" />
      <p class="text-lg font-medium">Your invoice is empty</p>
      <p class="text-sm">Select products above to start building this bill.</p>
    </div>
  </div>
</template>
