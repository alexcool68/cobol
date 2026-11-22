<script setup lang="ts">
import type { ChainGroupSummary, IncidentDetail, IncidentFileResult } from '#shared/types/incident'

const route = useRoute()
const incidentId = computed(() => String(route.params.id))

const { data: incident, error } = await useFetch<IncidentDetail>(() => `/api/incidents/${incidentId.value}`)

useHead({
  title: () => incident.value ? `Incident ${incident.value.incidentNumber} — Mainframe Tool` : 'Incident'
})

const activeFileIndex = ref(0)
const selectedGroupKey = ref<string | null>(null)
const previewRows = ref<Record<string, string>[]>([])
const previewLoading = ref(false)
const searchRow = ref('')

const activeFile = computed<IncidentFileResult | undefined>(() =>
  incident.value?.files[activeFileIndex.value]
)

const activeGroup = computed<ChainGroupSummary | undefined>(() => {
  if (!activeFile.value) return undefined
  if (!selectedGroupKey.value) return activeFile.value.groups[0]
  return activeFile.value.groups.find(g => g.key === selectedGroupKey.value) ?? activeFile.value.groups[0]
})

async function loadPreview(group: ChainGroupSummary | undefined) {
  if (!group || !incident.value) {
    previewRows.value = []
    return
  }
  previewLoading.value = true
  try {
    previewRows.value = await $fetch<Record<string, string>[]>(
      `/api/incidents/${incident.value.id}/preview/${encodeURIComponent(group.csvFileName)}`
    )
  } catch {
    previewRows.value = []
  } finally {
    previewLoading.value = false
  }
}

watch(activeFileIndex, () => {
  selectedGroupKey.value = activeFile.value?.groups[0]?.key ?? null
  searchRow.value = ''
})

watch(activeGroup, (grp) => {
  loadPreview(grp)
}, { immediate: true })

const filteredPreviewRows = computed(() => {
  const q = searchRow.value.trim().toLowerCase()
  if (!q) return previewRows.value
  return previewRows.value.filter(row =>
    Object.values(row).some(val => String(val).toLowerCase().includes(q))
  )
})

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`
}
</script>

<template>
  <UDashboardPanel id="incident-detail">
    <template #header>
      <UDashboardNavbar :title="incident ? `Incident ${incident.incidentNumber}` : 'Incident'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-left"
            label="Historique"
            to="/"
          />
          <UButton
            v-if="incident && incident.totalCsvFiles > 0"
            icon="i-lucide-archive"
            label="Tout télécharger (ZIP)"
            :to="`/api/incidents/${incident.id}/zip`"
            target="_blank"
            external
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="error || !incident"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        title="Incident introuvable"
        description="Cet incident n'existe pas ou a été supprimé."
      />

      <div v-else class="space-y-6">
        <!-- Bandeau KPI -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <UCard :ui="{ body: 'p-4' }">
            <div class="text-xs text-muted">Date de traitement</div>
            <div class="text-sm font-semibold text-highlighted mt-1">
              {{ new Date(incident.createdAt).toLocaleString('fr-FR') }}
            </div>
          </UCard>
          <UCard :ui="{ body: 'p-4' }">
            <div class="text-xs text-muted">Fichiers DSN traités</div>
            <div class="text-xl font-bold font-mono text-highlighted mt-1">
              {{ incident.filesCount }}
            </div>
          </UCard>
          <UCard :ui="{ body: 'p-4' }">
            <div class="text-xs text-muted">Total enregistrements</div>
            <div class="text-xl font-bold font-mono text-highlighted mt-1">
              {{ incident.totalRecords.toLocaleString('fr-FR') }}
            </div>
          </UCard>
          <UCard :ui="{ body: 'p-4' }">
            <div class="text-xs text-muted">Fichiers CSV générés</div>
            <div class="text-xl font-bold font-mono text-primary mt-1">
              {{ incident.totalCsvFiles }}
            </div>
          </UCard>
        </div>

        <!-- Sélecteur d'onglets par fichier DSN -->
        <div class="flex flex-wrap gap-2 border-b border-default pb-3">
          <UButton
            v-for="(file, idx) in incident.files"
            :key="`${file.modelId}-${idx}`"
            :color="activeFileIndex === idx ? 'primary' : 'neutral'"
            :variant="activeFileIndex === idx ? 'solid' : 'outline'"
            size="sm"
            @click="activeFileIndex = idx"
          >
            <span class="font-mono">{{ file.dsnUsed }}</span>
            <UBadge
              :color="file.status === 'success' ? 'success' : 'error'"
              variant="subtle"
              size="xs"
              class="ml-1.5"
            >
              {{ file.status === 'success' ? `${file.totalRecords} l.` : 'Erreur' }}
            </UBadge>
          </UButton>
        </div>

        <!-- Détail du fichier sélectionné -->
        <template v-if="activeFile">
          <div class="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>Modèle : <strong class="text-highlighted">{{ activeFile.modelName }}</strong></span>
            <span>•</span>
            <span>Copybook : <strong class="font-mono text-highlighted">{{ activeFile.copybookName }}</strong></span>
            <span>•</span>
            <span>LRECL : <strong class="font-mono text-highlighted">{{ activeFile.lrecl }} o</strong></span>
            <span>•</span>
            <span>Taille : <strong class="font-mono text-highlighted">{{ formatBytes(activeFile.fileSizeBytes) }}</strong></span>
            <span>•</span>
            <UBadge color="neutral" variant="soft" size="xs">
              {{ activeFile.source === 'ftp' ? 'FTP Binaire' : 'Fichier local' }}
            </UBadge>
          </div>

          <UAlert
            v-if="activeFile.status === 'error'"
            color="error"
            variant="subtle"
            icon="i-lucide-x-circle"
            title="Erreur lors de l'import ou du découpage"
            :description="activeFile.errorMessage"
          />

          <UEmpty
            v-else-if="activeFile.groups.length === 0"
            icon="i-lucide-inbox"
            title="Fichier vide"
            description="Aucun enregistrement trouvé dans ce fichier."
          />

          <template v-else>
            <!-- Cartes par Code Chaîne / TYP-ENR -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <div
                v-for="group in activeFile.groups"
                :key="group.key"
                class="rounded-lg border p-3.5 transition-all cursor-pointer"
                :class="[
                  activeGroup?.key === group.key
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-default bg-default hover:bg-elevated/40'
                ]"
                @click="selectedGroupKey = group.key"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <UBadge
                      :color="group.isRejected ? 'error' : 'primary'"
                      variant="subtle"
                      class="font-mono font-semibold"
                    >
                      {{ group.codeChaine }}
                    </UBadge>
                    <UBadge
                      v-if="group.typEnr"
                      color="secondary"
                      variant="soft"
                      size="xs"
                      class="font-mono"
                    >
                      TYP {{ group.typEnr }}
                    </UBadge>
                  </div>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-download"
                    label="CSV"
                    :to="`/api/incidents/${incident.id}/csv/${encodeURIComponent(group.csvFileName)}`"
                    target="_blank"
                    external
                    @click.stop
                  />
                </div>

                <div v-if="group.label" class="text-xs text-muted mt-2 truncate">
                  {{ group.label }}
                </div>

                <div class="mt-2 flex items-baseline justify-between">
                  <span class="text-lg font-bold font-mono text-highlighted">
                    {{ group.recordCount.toLocaleString('fr-FR') }}
                  </span>
                  <span class="text-xs text-muted">
                    {{ group.recordCount > 1 ? 'lignes' : 'ligne' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Tableau de prévisualisation -->
            <UCard v-if="activeGroup" :ui="{ body: 'p-0' }">
              <template #header>
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 class="font-semibold text-sm text-highlighted flex items-center gap-2">
                      <span>Aperçu :</span>
                      <span class="font-mono text-primary">{{ activeGroup.csvFileName }}</span>
                    </h3>
                    <p class="text-xs text-muted mt-0.5">
                      Affichage des {{ Math.min(previewRows.length, 200) }} premières lignes sur {{ activeGroup.recordCount.toLocaleString('fr-FR') }}.
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <UInput
                      v-model="searchRow"
                      icon="i-lucide-search"
                      placeholder="Filtrer dans l'aperçu..."
                      size="sm"
                      class="w-56"
                    />
                    <UButton
                      size="sm"
                      icon="i-lucide-file-spreadsheet"
                      label="Télécharger CSV"
                      :to="`/api/incidents/${incident.id}/csv/${encodeURIComponent(activeGroup.csvFileName)}`"
                      target="_blank"
                      external
                    />
                  </div>
                </div>
              </template>

              <div v-if="previewLoading" class="py-12 flex justify-center">
                <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
              </div>

              <div v-else class="overflow-x-auto max-h-[55vh]">
                <table class="w-full text-xs whitespace-nowrap">
                  <thead class="bg-elevated/70 text-muted text-left sticky top-0 z-10 border-b border-default">
                    <tr>
                      <th class="px-3 py-2 font-mono text-muted">#</th>
                      <th
                        v-for="col in activeGroup.columns"
                        :key="col"
                        class="px-3 py-2 font-mono font-semibold"
                      >
                        {{ col }}
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-default font-mono">
                    <tr v-for="(row, rIdx) in filteredPreviewRows" :key="rIdx" class="hover:bg-elevated/30">
                      <td class="px-3 py-1.5 text-muted">{{ rIdx + 1 }}</td>
                      <td
                        v-for="col in activeGroup.columns"
                        :key="col"
                        class="px-3 py-1.5 text-highlighted"
                      >
                        {{ row[col] ?? '' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </UCard>
          </template>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
