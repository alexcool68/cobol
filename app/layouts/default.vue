<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { FtpConfigPublic } from '#shared/types/config'

const { data: ftpConfig } = await useFetch<FtpConfigPublic>('/api/admin/ftp', {
  key: 'sidebar-ftp-status'
})

const isFtpConfigured = computed(() => Boolean(ftpConfig.value?.host && ftpConfig.value?.user))

const metierItems: NavigationMenuItem[] = [
  {
    label: 'Métier',
    type: 'label'
  },
  {
    label: 'Incidents',
    icon: 'i-lucide-clipboard-list',
    to: '/'
  },
  {
    label: 'Nouvel incident',
    icon: 'i-lucide-zap',
    to: '/incidents/new'
  }
]

const adminItems: NavigationMenuItem[] = [
  {
    label: 'Administration',
    type: 'label'
  },
  {
    label: 'Copybooks',
    icon: 'i-lucide-file-code-2',
    to: '/admin/copybooks'
  },
  {
    label: 'Codes Chaîne',
    icon: 'i-lucide-git-branch',
    to: '/admin/chains'
  },
  {
    label: 'Modèles DSN',
    icon: 'i-lucide-database',
    to: '/admin/models'
  },
  {
    label: 'Connexion FTP',
    icon: 'i-lucide-server',
    to: '/admin/ftp'
  }
]
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="main-sidebar"
      collapsible
      resizable
      :min-size="14"
      :default-size="16"
      :max-size="22"
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex items-center gap-2.5 px-1 py-0.5 min-w-0">
          <div class="flex items-center justify-center size-8 rounded-lg bg-primary text-inverted shrink-0">
            <UIcon name="i-lucide-cpu" class="size-4.5" />
          </div>
          <div v-if="!collapsed" class="flex flex-col min-w-0">
            <span class="font-semibold text-sm text-highlighted truncate">Mainframe Tool</span>
            <span class="text-xs text-muted truncate">z/OS • COBOL • CSV</span>
          </div>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="metierItems"
          orientation="vertical"
          tooltip
        />

        <USeparator class="my-2" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="adminItems"
          orientation="vertical"
          tooltip
        />
      </template>

      <template #footer="{ collapsed }">
        <div class="flex items-center justify-between w-full gap-2">
          <NuxtLink
            v-if="!collapsed"
            to="/admin/ftp"
            class="flex items-center gap-2 text-xs text-muted hover:text-highlighted transition-colors truncate"
          >
            <span
              class="size-2 rounded-full shrink-0"
              :class="isFtpConfigured ? 'bg-green-500' : 'bg-neutral-400'"
            />
            <span class="truncate">{{ isFtpConfigured ? `FTP : ${ftpConfig?.host}` : 'FTP non configuré' }}</span>
          </NuxtLink>
          <UColorModeButton size="sm" />
        </div>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
