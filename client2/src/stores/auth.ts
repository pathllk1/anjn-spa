import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/utils/api'

interface User {
  id: string
  username: string
  email: string
  fullname: string
  role: string
  firm_id: string | null
  firm_name: string | null
  firm_code: string | null
  last_login: string | null
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  const isLoggedIn = computed(() => !!user.value)

  async function fetchUser() {
    loading.value = true
    try {
      console.log('[AUTH] Fetching current user...');
      const response = await api.get('/auth/me')
      if (response.success) {
        console.log('[AUTH] User fetched successfully:', response.user.username);
        user.value = response.user
      } else {
        console.warn('[AUTH] Fetch user failed:', response.message);
        user.value = null
      }
    } catch (err) {
      console.error('[AUTH] Error fetching user:', err);
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await api.post('/auth/logout', {})
    } finally {
      user.value = null
    }
  }

  function setUser(userData: User | null) {
    user.value = userData
  }

  return {
    user,
    loading,
    error,
    isLoggedIn,
    fetchUser,
    logout,
    setUser
  }
})
