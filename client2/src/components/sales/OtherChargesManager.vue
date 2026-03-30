<script setup lang="ts">
import { ref, watch } from 'vue'

interface OtherCharge {
  label: string;
  amount: number;
  grate: number;
  taxable: boolean;
}

const props = defineProps({
  modelValue: {
    type: Array as () => OtherCharge[],
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])

const charges = ref<OtherCharge[]>([...props.modelValue])

const newCharge = ref<OtherCharge>({
  label: '',
  amount: 0,
  grate: 18,
  taxable: true
})

function addCharge() {
  if (!newCharge.value.label || newCharge.value.amount <= 0) return
  
  charges.value.push({ ...newCharge.value })
  emit('update:modelValue', [...charges.value])
  
  // Reset
  newCharge.value = {
    label: '',
    amount: 0,
    grate: 18,
    taxable: true
  }
}

function removeCharge(index: number) {
  charges.value.splice(index, 1)
  emit('update:modelValue', [...charges.value])
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)
}

watch(charges, (newVal) => {
  emit('update:modelValue', newVal)
}, { deep: true })
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
      <UFormField label="Charge Label" class="sm:col-span-1">
        <UInput v-model="newCharge.label" placeholder="Freight, Labor, etc." />
      </UFormField>
      <UFormField label="Amount">
        <UInput type="number" v-model="newCharge.amount" step="0.01" />
      </UFormField>
      <UFormField label="Tax %">
        <UInput type="number" v-model="newCharge.grate" step="0.01" />
      </UFormField>
      <div class="flex gap-2 items-center h-10">
        <UCheckbox v-model="newCharge.taxable" label="Taxable" />
        <UButton
          icon="i-heroicons-plus"
          color="neutral"
          variant="outline"
          size="sm"
          @click="addCharge"
        />
      </div>
    </div>

    <div v-if="charges.length > 0" class="border border-(--ui-border) rounded-md divide-y divide-(--ui-border)">
      <div v-for="(charge, index) in charges" :key="index" class="flex justify-between items-center p-3 text-sm">
        <div class="flex flex-col">
          <span class="font-medium">{{ charge.label }}</span>
          <span class="text-xs text-(--ui-text-muted)">
            Tax: {{ charge.taxable ? charge.grate + '%' : 'Exempt' }}
          </span>
        </div>
        <div class="flex items-center gap-4">
          <span class="font-bold">{{ formatCurrency(charge.amount) }}</span>
          <UButton
            icon="i-heroicons-x-mark"
            color="error"
            variant="ghost"
            size="xs"
            @click="removeCharge(index)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
