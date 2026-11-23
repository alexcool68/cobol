<script setup lang="ts">
import type { ChainGroupSummary, IncidentDetail, IncidentFileResult } from '#shared/types/incident'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { formatBytes, formatDateTime, formatNumber, getApiErrorMessage } = useFormatters()
const incidentId = computed(() => String(route.params.id))

const { data: incident, error, refresh } = await useFetch<IncidentDetail>(() => `/api/incidents/${incidentId.value}`)

useHead({
  title: () => incident.value ? `Incident ${incident.value.incidentNumber} — Mainframe Tool` : 'Incident'
})

const activeFileIndex = ref(0)
const selectedGroupKey = ref<string | null>(null)
const previewRows = ref<Record<string, string>[]>([])
const previewLoading = ref(false)
const rerunning = ref(false)
const deletingFile = ref(false)
const deletingIncident = ref(false)

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
})

watch(activeGroup, (grp) => {
  loadPreview(grp)
}, { immediate: true })

async function rerunViaFtp() {
  if (!incident.value || !activeFile.value) return
  rerunning.value = true
  try {
    const updated = await $fetch<IncidentDetail>(
      `/api/incidents/${incident.value.id}/files/${activeFileIndex.value}/rerun`,
      { method: 'POST', body: { dsn: activeFile.value.dsnUsed } }
    )
    incident.value = updated
    selectedGroupKey.value = updated.files[activeFileIndex.value]?.groups[0]?.key ?? null
    await loadPreview(activeGroup.value)
    toast.add({
      title: 'Traitement relancé (FTP)',
      description: `Fichier ${activeFile.value.dsnUsed} reconverti avec la configuration actuelle.`,
      color: updated.files[activeFileIndex.value]?.status === 'success' ? 'success' : 'error'
    })
  } catch (err: unknown) {
    toast.add({
      title: 'Erreur lors de la relance',
      description: getApiErrorMessage(err, 'Impossible de relancer le traitement.'),
      color: 'error'
    })
  } finally {
    rerunning.value = false
  }
}

async function replaceWithLocalFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !incident.value || !activeFile.value) return

  rerunning.value = true
  try {
    const formData = new FormData()
    formData.append('dsn', activeFile.value.dsnUsed || file.name)
    formData.append('file', file, file.name)

    const updated = await $fetch<IncidentDetail>(
      `/api/incidents/${incident.value.id}/files/${activeFileIndex.value}/rerun`,
      { method: 'POST', body: formData }
    )
    incident.value = updated
    selectedGroupKey.value = updated.files[activeFileIndex.value]?.groups[0]?.key ?? null
    await loadPreview(activeGroup.value)
    toast.add({
      title: 'Traitement remplacé',
      description: `Fichier local "${file.name}" converti avec succès.`,
      color: updated.files[activeFileIndex.value]?.status === 'success' ? 'success' : 'error'
    })
  } catch (err: unknown) {
    toast.add({
      title: 'Erreur lors de la conversion',
      description: getApiErrorMessage(err, 'Impossible de remplacer le fichier.'),
      color: 'error'
    })
  } finally {
    rerunning.value = false
  }
}

async function deleteActiveFile() {
  if (!incident.value || !activeFile.value) return
  deletingFile.value = true
  const dsnName = activeFile.value.dsnUsed
  try {
    const updated = await $fetch<IncidentDetail>(
      `/api/incidents/${incident.value.id}/files/${activeFileIndex.value}`,
      { method: 'DELETE' }
    )
    incident.value = updated
    if (activeFileIndex.value >= updated.files.length) {
      activeFileIndex.value = Math.max(0, updated.files.length - 1)
    }
    selectedGroupKey.value = updated.files[activeFileIndex.value]?.groups[0]?.key ?? null
    await loadPreview(activeGroup.value)
    toast.add({ title: `Traitement "${dsnName}" supprimé`, color: 'success' })
  } catch {
    toast.add({ title: 'Erreur lors de la suppression', color: 'error' })
    await refresh()
  } finally {
    deletingFile.value = false
  }
}

async function deleteWholeIncident() {
  if (!incident.value) return
  deletingIncident.value = true
  try {
    await $fetch(`/api/incidents/${incident.value.id}`, { method: 'DELETE' })
    toast.add({ title: `Incident ${incident.value.incidentNumber} supprimé`, color: 'success' })
    await router.push('/')
  } catch {
    toast.add({ title: 'Erreur lors de la suppression de l\'incident', color: 'error' })
  } finally {
    deletingIncident.value = false
  }
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
            v-if="incident"
            color="neutral"
            variant="outline"
            icon="i-lucide-plus"
            label="Ajouter des fichiers"
            :to="`/incidents/new?incidentId=${incident.id}`"
          />
          <UButton
            v-if="incident && incident.totalCsvFiles > 0"
            icon="i-lucide-archive"
            label="Tout télécharger (ZIP)"
            :to="`/api/incidents/${incident.id}/zip`"
            target="_blank"
            external
          />
          <UButton
            v-if="incident"
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            title="Supprimer cet incident"
            :loading="deletingIncident"
            @click="deleteWholeIncident"
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
              {{ formatDateTime(incident.createdAt) }}
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
              {{ formatNumber(incident.totalRecords) }}
            </div>
          </UCard>
          <UCard :ui="{ body: 'p-4' }">
            <div class="text-xs text-muted">Fichiers CSV générés</div>
            <div class="text-xl font-bold font-mono text-primary mt-1">
              {{ incident.totalCsvFiles }}
            </div>
          </UCard>
        </div>

        <UEmpty
          v-if="incident.files.length === 0"
          icon="i-lucide-folder-open"
          title="Aucun traitement dans cet incident"
          description="Tous les fichiers de cet incident ont été supprimés. Ajoutez un nouveau fichier pour relancer une conversion."
          :actions="[
            { label: 'Ajouter des fichiers', icon: 'i-lucide-plus', to: `/incidents/new?incidentId=${incident.id}` }
          ]"
        />

        <template v-else>
          <!-- Onglets par fichier DSN -->
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
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div class="flex flex-wrap items-center gap-3 text-xs text-muted">
                <span>Modèle : <strong class="text-highlighted">{{ activeFile.modelName }}</strong></span>
                <span>•</span>
                <span>Copybook : <strong class="font-mono text-highlighted">{{ activeFile.copybookName }}</strong></span>
                <span>•</span>
                <span>
                  LRECL : <strong class="font-mono text-highlighted">{{ activeFile.lrecl }} o</strong>
                  <UBadge v-if="activeFile.lreclAutoDetected" color="info" variant="subtle" size="xs" class="ml-1">
                    auto-détecté
                  </UBadge>
                </span>
                <span>•</span>
                <span>Taille : <strong class="font-mono text-highlighted">{{ formatBytes(activeFile.fileSizeBytes) }}</strong></span>
                <span>•</span>
                <UBadge color="neutral" variant="soft" size="xs">
                  {{ activeFile.source === 'ftp' ? 'FTP Binaire' : 'Fichier local' }}
                </UBadge>
              </div>

              <div class="flex flex-wrap items-center gap-2 shrink-0">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-refresh-cw"
                  label="Relancer FTP"
                  :loading="rerunning"
                  @click="rerunViaFtp"
                />
                <label class="cursor-pointer">
                  <input
                    type="file"
                    class="hidden"
                    :disabled="rerunning"
                    @change="replaceWithLocalFile"
                  >
                  <span class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-default bg-default hover:bg-elevated text-highlighted transition-colors">
                    <UIcon name="i-lucide-upload" class="size-3.5" />
                    Remplacer (.bin)
                  </span>
                </label>
                <UButton
                  size="xs"
                  color="error"
                  variant="soft"
                  icon="i-lucide-trash-2"
                  label="Supprimer"
                  :loading="deletingFile"
                  @click="deleteActiveFile"
                />
              </div>
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
              <IncidentChainGroupCards
                :incident-id="incident.id"
                :groups="activeFile.groups"
                :selected-key="activeGroup?.key"
                @select="(key) => selectedGroupKey = key"
              />

              <IncidentPreviewTable
                v-if="activeGroup"
                :incident-id="incident.id"
                :group="activeGroup"
                :rows="previewRows"
                :loading="previewLoading"
              />
            </template>
          </template>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
