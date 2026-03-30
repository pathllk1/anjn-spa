<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, API_BASE_URL } from '@/utils/api'

const router = useRouter()
const bills = ref<any[]>([])
const loading = ref(true)
const error = ref('')

const columns = [
  { accessorKey: 'bno', header: 'Bill No' },
  { accessorKey: 'bdate', header: 'Date' },
  { accessorKey: 'supply', header: 'Party' },
  { accessorKey: 'gtot', header: 'Taxable' },
  { accessorKey: 'ntot', header: 'Net Amount' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'actions', header: 'Actions' }
]

async function fetchBills() {
  loading.value = true
  error.value = ''
  try {
    console.log('[SALES] Fetching bills...');
    const data = await api.get('/inventory/sales/bills')
    console.log('[SALES] Received data:', data);
    
    if (Array.isArray(data)) {
      bills.value = data
    } else if (data && data.success && Array.isArray(data.data)) {
      bills.value = data.data
    } else if (data && Array.isArray(data.bills)) {
      bills.value = data.bills
    } else {
      console.warn('[SALES] Unexpected data format:', data);
      bills.value = []
    }
    console.log('[SALES] Bills assigned to state:', bills.value.length);
  } catch (err: any) {
    console.error('[SALES] Fetch error:', err);
    error.value = err.message || 'Failed to fetch sales bills'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchBills()
})

function createNewBill() {
  router.push('/sales/create')
}

function formatCurrency(amount: any) {
  const val = typeof amount === 'number' ? amount : parseFloat(amount || 0)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(val)
}

function getExportUrl(id: string, type: 'pdf' | 'excel') {
  return `${API_BASE_URL.replace(/\/$/, '')}/inventory/sales/bills/${id}/${type}`
}

async function cancelBill(id: string) {
  if (!confirm('Are you sure you want to cancel this bill? This action cannot be undone.')) return
  
  try {
    await api.put(`/inventory/sales/bills/${id}/cancel`, {
      cancellation_reason: 'Cancelled from Vue App'
    })
    fetchBills()
  } catch (err: any) {
    alert('Failed to cancel bill: ' + err.message)
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Sales Dashboard</h1>
        <p class="text-sm text-(--ui-text-muted)">View and manage your tax invoices.</p>
      </div>
      <div class="flex gap-2">
        <UButton
          label="Export All (Excel)"
          icon="i-heroicons-table-cells"
          color="neutral"
          variant="outline"
          :to="`${API_BASE_URL.replace(/\/$/, '')}/inventory/sales/bills/export`"
          target="_blank"
        />
        <UButton
          label="Create Invoice"
          icon="i-heroicons-plus"
          color="primary"
          @click="createNewBill"
        />
      </div>
    </div>

    <UCard :ui="{ body: 'p-0' }">
      <UAlert
        v-if="error"
        :title="error"
        color="error"
        variant="subtle"
        class="m-4"
      />

      <!-- Nuxt UI 4 Table uses :data instead of :rows -->
      <UTable :data="bills" :columns="columns" :loading="loading" class="w-full">
        <!-- Slot syntax in Nuxt UI 4: #columnName-cell -->
        <template #gtot-cell="{ row }">
          <span class="text-xs text-(--ui-text-muted)">{{ formatCurrency(row.original.gtot) }}</span>
        </template>
        
        <template #ntot-cell="{ row }">
          <span class="font-bold text-primary">{{ formatCurrency(row.original.ntot) }}</span>
        </template>

        <template #status-cell="{ row }">
          <UBadge
            :color="row.original.status === 'ACTIVE' ? 'success' : 'error'"
            variant="subtle"
            size="sm"
          >
            {{ row.original.status }}
          </UBadge>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex items-center gap-1">
            <UTooltip text="Download PDF">
              <UButton
                icon="i-heroicons-document-arrow-down"
                color="neutral"
                variant="ghost"
                size="sm"
                :to="getExportUrl(row.original._id, 'pdf')"
                target="_blank"
              />
            </UTooltip>
            <UTooltip text="Download Excel">
              <UButton
                icon="i-heroicons-table-cells"
                color="neutral"
                variant="ghost"
                size="sm"
                :to="getExportUrl(row.original._id, 'excel')"
                target="_blank"
              />
            </UTooltip>
            <UDropdownMenu :items="[[{ label: 'Edit', icon: 'i-heroicons-pencil-square', disabled: row.original.status !== 'ACTIVE' }, { label: 'Return (Credit Note)', icon: 'i-heroicons-arrow-uturn-left', disabled: row.original.status !== 'ACTIVE' }], [{ label: 'Cancel Bill', icon: 'i-heroicons-trash', color: 'error', onSelect: () => cancelBill(row.original._id), disabled: row.original.status !== 'ACTIVE' }]]">
              <UButton
                icon="i-heroicons-ellipsis-horizontal"
                color="neutral"
                variant="ghost"
                size="sm"
              />
            </UDropdownMenu>
          </div>
        </template>
      </UTable>
      
      <div v-if="!loading && bills.length === 0" class="p-12 text-center text-(--ui-text-muted)">
        <UIcon name="i-heroicons-document-magnifying-glass" class="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p>No sales invoices found.</p>
      </div>
    </UCard>
  </div>
</template>
