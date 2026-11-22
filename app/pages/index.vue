<script setup lang="ts">
import type { IncidentSummary } from '#shared/types/incident'

useHead({ title: 'Incidents — Mainframe Tool' })

const toast = useToast()
const { data: incidents, refresh, status } = await useFetch<IncidentSummary[]>('/api/incidents', {
  default: () => []
})

const search = ref('')

const filteredIncidents = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return incidents.value
  return incidents.value.filter(i => i.incidentNumber.toLowerCase().includes(q))
})

function statusBadge(st: IncidentSummary['status']) {
  switch (st) {
    case 'completed': return { label: 'Terminé', color: 'success' as const }
    case 'partial': return { label: 'Partiel', color: 'warning' as const }
    default: return { label: 'Échec', color: 'error' as const }
  }
}

async function deleteIncident(inc: IncidentSummary) {
  try {
    await $fetch(`/api/incidents/${inc.id}`, { method: 'DELETE' })
    toast.add({ title: `Incident ${inc.incidentNumber} supprimé`, color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Erreur lors de la suppression', color: 'error' })
  }
}
</script>

<template>
  <UDashboardPanel id="incidents-list">
    <template #header>
      <UDashboardNavbar title="Historique des Incidents">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UInput
            v-if="incidents.length > 0"
            v-model="search"
            icon="i-lucide-search"
            placeholder="Rechercher un incident..."
            class="w-56"
          />
          <UButton
            to="/incidents/new"
            icon="i-lucide-plus"
            label="Nouvel incident"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="py-12 flex justify-center">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>

      <UEmpty
        v-else-if="incidents.length === 0"
        icon="i-lucide-clipboard-list"
        title="Aucun incident traité pour le moment"
        description="Configurez vos Copybooks, Codes Chaîne et Modèles DSN dans l'espace Administration, puis lancez votre premier incident."
        :actions="[
          { label: 'Nouvel incident', icon: 'i-lucide-zap', to: '/incidents/new' },
          { label: 'Configurer les Copybooks', icon: 'i-lucide-file-code-2', color: 'neutral', variant: 'outline', to: '/admin/copybooks' }
        ]"
      />

      <div v-else class="rounded-lg border border-default overflow-hidden bg-default">
        <table class="w-full text-sm">
          <thead class="bg-elevated/60 text-muted text-left text-xs uppercase">
            <tr>
              <th class="px-4 py-3">N° Incident</th>
              <th class="px-4 py-3">Date</th>
              <th class="px-4 py-3">Fichiers</th>
              <th class="px-4 py-3">Enregistrements</th>
              <th class="px-4 py-3">CSV générés</th>
              <th class="px-4 py-3">Statut</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="inc in filteredIncidents" :key="inc.id" class="hover:bg-elevated/30">
              <td class="px-4 py-3">
                <NuxtLink
                  :to="`/incidents/${inc.id}`"
                  class="font-semibold font-mono text-primary hover:underline"
                >
                  {{ inc.incidentNumber }}
                </NuxtLink>
              </td>
              <td class="px-4 py-3 text-xs text-muted">
                {{ new Date(inc.createdAt).toLocaleString('fr-FR') }}
              </td>
              <td class="px-4 py-3 font-mono text-xs">
                {{ inc.filesCount }}
              </td>
              <td class="px-4 py-3 font-mono text-xs">
                {{ inc.totalRecords.toLocaleString('fr-FR') }}
              </td>
              <td class="px-4 py-3 font-mono text-xs">
                {{ inc.totalCsvFiles }}
              </td>
              <td class="px-4 py-3">
                <UBadge :color="statusBadge(inc.status).color" variant="subtle" size="xs">
                  {{ statusBadge(inc.status).label }}
                </UBadge>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="inline-flex items-center gap-1">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-eye"
                    label="Ouvrir"
                    :to="`/incidents/${inc.id}`"
                  />
                  <UButton
                    v-if="inc.totalCsvFiles > 0"
                    size="xs"
                    color="primary"
                    variant="ghost"
                    icon="i-lucide-archive"
                    label="ZIP"
                    :to="`/api/incidents/${inc.id}/zip`"
                    target="_blank"
                    external
                  />
                  <UButton
                    size="xs"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    @click="deleteIncident(inc)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </UDashboardPanel>
</template>
