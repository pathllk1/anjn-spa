<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const isDark = ref(false)

const items = computed(() => {
  const baseItems = [
    [{
      label: 'Home',
      icon: 'i-heroicons-home',
      to: '/'
    }, {
      label: 'About',
      icon: 'i-heroicons-information-circle',
      to: '/about'
    }]
  ]

  if (auth.isLoggedIn) {
    baseItems[0].push({
      label: 'Sales',
      icon: 'i-heroicons-banknotes',
      to: '/sales'
    })
    baseItems[0].push({
      label: 'Profile',
      icon: 'i-heroicons-user',
      to: '/profile'
    })
  }

  return baseItems
})

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}

function toggleColorMode() {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('color-mode', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('color-mode', 'light')
  }
}

onMounted(() => {
  auth.fetchUser()
  
  // Initialize color mode
  const savedMode = localStorage.getItem('color-mode')
  if (savedMode === 'dark' || (!savedMode && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  } else {
    isDark.value = false
    document.documentElement.classList.remove('dark')
  }
})
</script>

<template>
  <UApp>
    <div class="min-h-screen flex flex-col bg-(--ui-bg) w-full transition-colors duration-200">
      <header class="border-b border-(--ui-border) sticky top-0 z-50 bg-(--ui-bg)/75 backdrop-blur w-full">
        <UContainer class="max-w-none px-4 md:px-8">
          <div class="flex h-16 items-center justify-between gap-4">
            <div class="flex items-center gap-4">
              <img alt="Vue logo" class="h-8 w-8" src="@/assets/logo.svg" />
              <span class="font-bold text-xl hidden sm:inline-block">Node SPA</span>
            </div>

            <UNavigationMenu :items="items" class="hidden md:flex flex-1" />

            <div class="flex items-center gap-2">
              <UButton
                :icon="isDark ? 'i-heroicons-moon' : 'i-heroicons-sun'"
                color="neutral"
                variant="ghost"
                @click="toggleColorMode"
              />
              
              <UButton
                icon="i-heroicons-magnifying-glass"
                color="neutral"
                variant="ghost"
              />
              
              <template v-if="auth.isLoggedIn">
                <UDropdownMenu :items="[[{ label: 'Profile', to: '/profile' }, { label: 'Logout', icon: 'i-heroicons-arrow-left-on-rectangle', color: 'error', onSelect: handleLogout }]]">
                  <UButton
                    :label="auth.user?.fullname || auth.user?.username"
                    variant="ghost"
                    icon="i-heroicons-user-circle"
                  />
                </UDropdownMenu>
              </template>
              <template v-else>
                <UButton
                  label="Login"
                  color="primary"
                  variant="solid"
                  to="/login"
                />
              </template>
            </div>
          </div>
        </UContainer>
      </header>

      <main class="flex-1 w-full">
        <div class="w-full px-4 py-8 md:px-8">
          <RouterView />
        </div>
      </main>

      <footer class="border-t border-(--ui-border) py-6 w-full">
        <UContainer class="max-w-none px-4 md:px-8">
          <p class="text-sm text-(--ui-text-muted) text-center">
            &copy; 2026 Node SPA. All rights reserved.
          </p>
        </UContainer>
      </footer>
    </div>
  </UApp>
</template>

<style>
/* Nuxt UI 4 (v3) uses CSS variables for theming */
:root {
  --ui-bg: white;
  --ui-text: #111827;
  --ui-text-muted: #6b7280;
  --ui-border: #e5e7eb;
}

html.dark {
  --ui-bg: #030712;
  --ui-text: #f9fafb;
  --ui-text-muted: #9ca3af;
  --ui-border: #1f2937;
}

body {
  margin: 0;
  width: 100%;
  overflow-x: hidden;
  font-family: Inter, sans-serif;
  color: var(--ui-text);
  background-color: var(--ui-bg);
}
</style>
