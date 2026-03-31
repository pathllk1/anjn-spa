<script setup lang="ts">
import { ref, computed } from 'vue'

interface Party {
  _id?: string; id?: string
  firm: string; gstin: string; state?: string; addr?: string
}

const props = defineProps<{ parties: Party[] }>()
const emit  = defineEmits<{ select: [party: Party]; create: []; close: [] }>()

const searchTerm = ref('')

const filtered = computed(() => {
  const t = searchTerm.value.toLowerCase()
  if (!t) return props.parties
  return props.parties.filter(p =>
    p.firm.toLowerCase().includes(t) || p.gstin.toLowerCase().includes(t)
  )
})
</script>

<template>
  <!-- Header -->
  <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-(--ui-border)">
    <h3 class="font-bold text-base text-(--ui-text) shrink-0">Select Party</h3>
    <div class="flex items-center gap-2 flex-1 justify-end">
      <UInput v-model="searchTerm" autofocus placeholder="Search firm name or GSTIN…"
              icon="i-heroicons-magnifying-glass" size="sm" class="flex-1 max-w-sm" />
      <UButton label="New Party" icon="i-heroicons-plus" color="primary" size="sm" @click="emit('create')" />
      <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="emit('close')" />
    </div>
  </div>

  <!-- Party list -->
  <div class="flex-1 overflow-y-auto p-3 grid gap-2 bg-(--ui-bg-muted)">
    <div v-if="filtered.length === 0" class="flex flex-col items-center justify-center py-12">
      <UIcon name="i-heroicons-users" class="w-10 h-10 text-(--ui-text-muted) mb-2" />
      <p class="text-sm text-(--ui-text-muted) italic">No parties found. Create a new one.</p>
    </div>

    <div v-for="party in filtered" :key="String(party._id || party.id)"
         @click="emit('select', party)"
         class="border border-(--ui-border) p-3 rounded-xl hover:border-primary hover:shadow-md cursor-pointer
                flex justify-between items-center transition-all bg-(--ui-bg) group">
      <div class="min-w-0 flex-1">
        <div class="font-bold text-primary text-sm group-hover:text-primary-600 truncate">{{ party.firm }}</div>
        <div class="flex items-center flex-wrap gap-1.5 mt-1">
          <UBadge :label="party.gstin" color="neutral" variant="subtle" size="xs" class="font-mono" />
          <span class="text-[10px] text-(--ui-text-muted)">{{ party.state || '' }}</span>
        </div>
        <div class="text-[10px] text-(--ui-text-muted) mt-1 truncate max-w-xs">{{ party.addr || '' }}</div>
      </div>
      <UBadge label="SELECT →" color="primary" variant="subtle" size="xs"
              class="shrink-0 opacity-0 group-hover:opacity-100 transition-all ml-3" />
    </div>
  </div>
</template>
