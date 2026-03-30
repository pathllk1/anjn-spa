<script setup lang="ts">
import { reactive, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      name: '',
      gstin: '',
      address: '',
      state: '',
      pin: '',
      stateCode: ''
    })
  }
})

const emit = defineEmits(['update:modelValue'])

const form = reactive({ ...props.modelValue })

watch(form, (newVal) => {
  emit('update:modelValue', { ...newVal })
}, { deep: true })

watch(() => form.gstin, (newGstin) => {
  if (newGstin && newGstin.length >= 2) {
    form.stateCode = newGstin.substring(0, 2)
  }
})
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <UFormField label="Consignee Name">
      <UInput v-model="form.name" placeholder="Leave empty if same as party" />
    </UFormField>
    <UFormField label="Consignee GSTIN">
      <UInput v-model="form.gstin" placeholder="GSTIN (optional)" />
    </UFormField>
    <UFormField label="Address" class="md:col-span-2">
      <UInput v-model="form.address" placeholder="Shipping Address" />
    </UFormField>
    <UFormField label="State">
      <UInput v-model="form.state" placeholder="State Name" />
    </UFormField>
    <UFormField label="PIN Code">
      <UInput v-model="form.pin" placeholder="6-digit PIN" />
    </UFormField>
  </div>
</template>
