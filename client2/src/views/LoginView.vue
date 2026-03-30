<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  username: '',
  password: '',
  remember: false
})

const loading = ref(false)
const error = ref('')

async function onSubmit() {
  loading.value = true
  error.value = ''
  
  try {
    const response = await api.post('/auth/login', {
      username: form.username,
      password: form.password,
      device_id: window.navigator.userAgent // Simple device ID for now
    })
    
    if (response.success) {
      // Store user info in Pinia auth store
      auth.setUser(response.user)
      // Now redirect to profile
      router.push('/profile')
    } else {
      error.value = response.error || 'Login failed'
    }
  } catch (err: any) {
    error.value = err.message || 'An error occurred during login'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-[60vh]">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold">Welcome Back</h1>
          <p class="text-sm text-(--ui-text-muted)">Login to your account</p>
        </div>
      </template>

      <UAlert
        v-if="error"
        :title="error"
        color="error"
        variant="subtle"
        icon="i-heroicons-exclamation-triangle"
        class="mb-4"
      />

      <form @submit.prevent="onSubmit" class="space-y-4">
        <UFormField label="Username or Email" name="username">
          <UInput
            v-model="form.username"
            placeholder="john@example.com"
            icon="i-heroicons-envelope"
            autocomplete="username"
            required
            class="w-full"
          />
        </UFormField>

        <UFormField label="Password" name="password">
          <UInput
            v-model="form.password"
            type="password"
            placeholder="••••••••"
            icon="i-heroicons-lock-closed"
            autocomplete="current-password"
            required
            class="w-full"
          />
        </UFormField>

        <div class="flex items-center justify-between">
          <UCheckbox v-model="form.remember" label="Remember me" />
          <ULink to="/forgot-password" class="text-sm text-primary font-medium">
            Forgot password?
          </ULink>
        </div>

        <UButton
          type="submit"
          label="Sign In"
          :loading="loading"
          block
          color="primary"
          size="lg"
        />
      </form>

      <template #footer>
        <p class="text-center text-sm text-(--ui-text-muted)">
          Don't have an account?
          <ULink to="/register" class="text-primary font-medium">Register</ULink>
        </p>
      </template>
    </UCard>
  </div>
</template>
