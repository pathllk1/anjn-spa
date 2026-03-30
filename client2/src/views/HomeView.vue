<script setup lang="ts">
const features = [
  {
    title: 'Modern UI',
    description: 'Powered by Nuxt UI and Tailwind CSS for a sleek, responsive experience.',
    icon: 'i-heroicons-computer-desktop'
  },
  {
    title: 'Vite Speed',
    description: 'Lightning fast development and builds with Vite 7.',
    icon: 'i-heroicons-bolt'
  },
  {
    title: 'Type Safe',
    description: 'Fully written in TypeScript for robust and maintainable code.',
    icon: 'i-heroicons-shield-check'
  }
]
</script>

<template>
  <div class="py-12 sm:py-24">
    <UContainer>
      <div class="text-center">
        <h1 class="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
          Welcome to <span class="text-primary-500">Standalone Vue</span>
        </h1>
        <p class="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          A high-performance Vue 3 application integrated with Nuxt UI v4 components.
        </p>
        <div class="mt-10 flex items-center justify-center gap-x-6">
          <UButton size="xl" label="Get Started" trailing-icon="i-heroicons-arrow-right" to="/about" />
          <UButton size="xl" variant="ghost" label="Learn more" color="neutral" />
        </div>
      </div>

      <div class="mt-20 grid grid-cols-1 gap-12 sm:grid-cols-3">
        <UCard v-for="feature in features" :key="feature.title" class="text-center">
          <template #header>
            <div class="flex justify-center">
              <div class="rounded-lg bg-primary-50 dark:bg-primary-900/20 p-3">
                <UIcon :name="feature.icon" class="h-8 w-8 text-primary-600 dark:text-primary-400" />
              </div>
            </div>
          </template>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">{{ feature.title }}</h3>
          <p class="mt-4 text-gray-600 dark:text-gray-400">{{ feature.description }}</p>
        </UCard>
      </div>
    </UContainer>
  </div>
</template>
