<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { api } from '@/utils/api'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'party-selected'])

const parties = ref<any[]>([])
const loading = ref(true)
const selectedId = ref(props.modelValue)

async function fetchParties() {
  loading.value = true
  try {
    const response = await api.get('/inventory/sales/parties')
    if (response && response.success && Array.isArray(response.data)) {
      parties.value = response.data
    } else if (Array.isArray(response)) {
      parties.value = response
    } else {
      parties.value = []
    }
  } catch (error) {
    console.error('[PARTY_SELECTOR] Failed to fetch parties', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchParties()
})

// In Nuxt UI 4, USelectMenu often works best with objects or explicit value-attribute
const items = computed(() => {
  return parties.value.map(p => ({
    label: p.firm,
    description: p.gstin || 'Unregistered',
    value: p._id,
    original: p
  }))
})

// Watch for internal changes to emit to parent
watch(selectedId, (newId) => {
  emit('update:modelValue', newId)
  const item = items.value.find(i => i.value === newId)
  if (item) {
    emit('party-selected', item.original)
  }
})

// Watch for external changes
watch(() => props.modelValue, (newVal) => {
  if (newVal !== selectedId.value) {
    selectedId.value = newVal
  }
})
</script>

<template>
  <UFormField label="Bill To (Party)" name="party">
    <USelectMenu
      v-model="selectedId"
      :items="items"
      :loading="loading"
      value-attribute="value"
      placeholder="Search customers..."
      class="w-full"
    />
  </UFormField>
</template>
