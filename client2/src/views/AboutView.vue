<template>
  <div class="py-12 sm:py-24">
    <UContainer>
      <UCard>
        <template #header>
          <h1 class="text-2xl font-bold">About Standalone Vue</h1>
        </template>
        
        <div class="space-y-4">
          <p class="text-gray-600 dark:text-gray-400">
            This project is a demonstration of using Nuxt UI components in a pure Vue 3 application.
          </p>
          
          <div class="flex gap-4">
            <UBadge label="Vue 3" color="success" variant="subtle" />
            <UBadge label="Nuxt UI v4" color="primary" variant="subtle" />
            <UBadge label="Tailwind CSS" color="info" variant="subtle" />
          </div>
          
          <UAlert
            title="Standalone Mode"
            description="You are currently running in standalone Vue mode, without the Nuxt framework."
            icon="i-heroicons-information-circle"
            color="info"
            variant="soft"
          />
        </div>

        <template #footer>
          <UButton label="Back to Home" icon="i-heroicons-home" to="/" variant="link" />
        </template>
      </UCard>
    </UContainer>
  </div>
</template>
