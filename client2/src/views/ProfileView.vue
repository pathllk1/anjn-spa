<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const error = ref('')

const user = computed(() => auth.user)
const loading = computed(() => auth.loading)

async function fetchProfile() {
  error.value = ''
  try {
    await auth.fetchUser()
    if (!auth.isLoggedIn && !auth.loading) {
      router.push('/login')
    }
  } catch (err: any) {
    error.value = err.message || 'An error occurred while fetching profile'
    if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
      router.push('/login')
    }
  }
}

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}

onMounted(() => {
  if (!auth.isLoggedIn) {
    fetchProfile()
  }
})

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleString()
}
</script>

<template>
  <div class="w-full space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold">Account Profile</h1>
      <UButton
        label="Logout"
        icon="i-heroicons-arrow-left-on-rectangle"
        color="error"
        variant="ghost"
        @click="handleLogout"
      />
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
    </div>

    <UAlert
      v-else-if="error"
      :title="error"
      color="error"
      variant="subtle"
      icon="i-heroicons-exclamation-circle"
    />

    <div v-else-if="user" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Sidebar / Summary -->
      <UCard class="lg:col-span-1 h-fit">
        <div class="flex flex-col items-center text-center space-y-4">
          <UAvatar
            :alt="user.fullname || user.username"
            size="xl"
            class="bg-primary text-white"
          />
          <div>
            <h2 class="text-xl font-semibold">{{ user.fullname || user.username }}</h2>
            <p class="text-sm text-(--ui-text-muted)">{{ user.role.toUpperCase() }}</p>
          </div>
          <UBadge :color="user.role === 'admin' ? 'primary' : 'neutral'" variant="subtle">
            {{ user.role }}
          </UBadge>
        </div>
      </UCard>

      <!-- Main Info -->
      <UCard class="lg:col-span-2">
        <template #header>
          <h3 class="text-lg font-medium">Personal Information</h3>
        </template>

        <div class="space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-(--ui-border) pb-4">
            <span class="text-sm font-medium text-(--ui-text-muted)">Username</span>
            <span class="text-base font-semibold">{{ user.username }}</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-(--ui-border) pb-4">
            <span class="text-sm font-medium text-(--ui-text-muted)">Email Address</span>
            <span class="text-base font-semibold">{{ user.email }}</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-(--ui-border) pb-4">
            <span class="text-sm font-medium text-(--ui-text-muted)">Full Name</span>
            <span class="text-base font-semibold">{{ user.fullname || 'N/A' }}</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-(--ui-border) pb-4">
            <span class="text-sm font-medium text-(--ui-text-muted)">Last Login</span>
            <span class="text-base font-semibold">{{ formatDate(user.last_login) }}</span>
          </div>
        </div>

        <template #footer v-if="user.firm_id">
          <div class="space-y-4">
            <h4 class="text-sm font-bold uppercase tracking-wider text-(--ui-text-muted)">Firm Details</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <span class="text-sm font-medium text-(--ui-text-muted)">Firm Name</span>
              <span class="text-base font-semibold">{{ user.firm_name }}</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <span class="text-sm font-medium text-(--ui-text-muted)">Firm Code</span>
              <span class="text-base font-semibold">{{ user.firm_code }}</span>
            </div>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
