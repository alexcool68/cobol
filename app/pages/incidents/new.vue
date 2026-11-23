<script setup lang="ts">
import type { CopybookMeta } from '#shared/types/cobol'
import type { DsnModel } from '#shared/types/config'
import type { IncidentDetail } from '#shared/types/incident'
import type { IncidentFileRowModel } from '~/components/incident/FileSourceRow.vue'

useHead({ title: 'Nouvel incident — Mainframe Tool' })

const toast = useToast()
const route = useRoute()
const router = useRouter()
const { formatNumber, getApiErrorMessage } = useFormatters()

const existingIncidentId = computed(() =>
  typeof route.query.incidentId === 'string' && route.query.incidentId.trim()
    ? route.query.incidentId.trim()
    : undefined
)

const [{ data: models }, { data: copybooks }, { data: existingIncident }] = await Promise.all([
  useFetch<DsnModel[]>('/api/admin/models', { default: () => [] }),
  useFetch<CopybookMeta[]>('/api/admin/copybooks', { default: () => [] }),
  existingIncidentId.value
    ? useFetch<IncidentDetail>(`/api/incidents/${existingIncidentId.value}`)
    : Promise.resolve({ data: ref<IncidentDetail | null>(null) })
])

const copybookMap = computed(() => new Map(copybooks.value.map(c => [c.id, c])))

const sourceMode = ref<'ftp' | 'local'>('ftp')
const incidentNumber = ref(existingIncident.value?.incidentNumber ?? '')
const running = ref(false)

const rows = ref<IncidentFileRowModel[]>(
  models.value.map(m => ({
    model: m,
    checked: false,
    dsn: m.defaultDsn,
    localFile: null
  }))
)

const selectedRows = computed(() => rows.value.filter(r => r.checked))

const canRun = computed(() => {
  if (!incidentNumber.value.trim() || selectedRows.value.length === 0) return false
  if (sourceMode.value === 'local') {
    return selectedRows.value.every(r => Boolean(r.localFile))
  }
  return selectedRows.value.every(r => Boolean(r.localFile || r.dsn.trim()))
})

function toggleAll(checked: boolean | 'indeterminate') {
  const next = checked === true
  for (const row of rows.value) {
    row.checked = next
  }
}

async function runImportAndConvert() {
  if (!incidentNumber.value.trim()) {
    toast.add({
      title: 'Numéro d\'incident manquant',
      description: 'Veuillez saisir un numéro d\'incident (ex: INC-2026-0042).',
      color: 'warning'
    })
    return
  }

  if (selectedRows.value.length === 0) {
    toast.add({
      title: 'Aucun fichier sélectionné',
      description: sourceMode.value === 'local'
        ? 'Chargez au moins un fichier binaire à convertir.'
        : 'Cochez au moins un fichier DSN à importer et convertir.',
      color: 'warning'
    })
    return
  }

  if (sourceMode.value === 'local' && selectedRows.value.some(r => !r.localFile)) {
    toast.add({
      title: 'Fichier binaire manquant',
      description: 'Chaque modèle coché doit avoir un fichier binaire sélectionné.',
      color: 'warning'
    })
    return
  }

  running.value = true
  try {
    const formData = new FormData()
    formData.append('incidentNumber', incidentNumber.value.trim())
    if (existingIncident.value?.id) {
      formData.append('existingIncidentId', existingIncident.value.id)
    }

    const itemsPayload = selectedRows.value.map((row) => {
      const useLocal = sourceMode.value === 'local' || Boolean(row.localFile)
      const fileField = useLocal && row.localFile ? `file_${row.model.id}` : undefined
      if (useLocal && row.localFile && fileField) {
        formData.append(fileField, row.localFile, row.localFile.name)
      }
      const dsnLabel = useLocal && row.localFile
        ? (row.dsn.trim() || row.localFile.name)
        : row.dsn.trim().toUpperCase()

      return {
        modelId: row.model.id,
        dsn: dsnLabel,
        fileField
      }
    })

    formData.append('items', JSON.stringify(itemsPayload))

    const result = await $fetch<IncidentDetail>('/api/incidents/convert', {
      method: 'POST',
      body: formData
    })

    toast.add({
      title: result.status === 'completed'
        ? 'Conversion terminée !'
        : result.status === 'partial'
          ? 'Conversion partielle (voir erreurs)'
          : 'Échec de la conversion',
      description: `${formatNumber(result.totalRecords)} enregistrements convertis en ${result.totalCsvFiles} fichier(s) CSV.`,
      color: result.status === 'completed' ? 'success' : result.status === 'partial' ? 'warning' : 'error'
    })

    await router.push(`/incidents/${result.id}`)
  } catch (err: unknown) {
    toast.add({
      title: 'Erreur lors du traitement',
      description: getApiErrorMessage(err),
      color: 'error'
    })
  } finally {
    running.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="incident-new">
    <template #header>
      <UDashboardNavbar title="Nouvel Incident">
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
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UEmpty
        v-if="rows.length === 0"
        icon="i-lucide-database"
        title="Aucun modèle de fichier DSN configuré"
        description="Déclarez d'abord vos fichiers types (ex: TEST.SPE.GJ020005) dans l'espace Administration."
        :actions="[
          { label: 'Configurer les Modèles DSN', icon: 'i-lucide-arrow-right', to: '/admin/models' }
        ]"
      />

      <div v-else class="max-w-5xl space-y-6">
        <UAlert
          v-if="existingIncident"
          color="info"
          variant="subtle"
          icon="i-lucide-folder-plus"
          :title="`Ajout de fichiers à l'incident ${existingIncident.incidentNumber}`"
          description="Les nouveaux fichiers convertis seront ajoutés directement dans cet incident existant."
        />

        <!-- 1. Numéro d'incident + Choix du mode -->
        <UCard>
          <div class="space-y-5">
            <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <UFormField
                label="Numéro d'incident"
                description="Sert d'identifiant dans l'historique et pour le nommage de l'archive ZIP."
                required
                class="flex-1 max-w-md"
              >
                <UInput
                  v-model="incidentNumber"
                  :disabled="Boolean(existingIncident)"
                  placeholder="ex: INC-2026-5891"
                  size="lg"
                  icon="i-lucide-hash"
                  class="w-full font-mono"
                />
              </UFormField>

              <UButton
                size="lg"
                icon="i-lucide-zap"
                :label="running
                  ? 'Traitement en cours...'
                  : sourceMode === 'local'
                    ? `Convertir les fichiers (${selectedRows.length})`
                    : `Importer et Convertir (${selectedRows.length})`"
                :loading="running"
                :disabled="!canRun"
                @click="runImportAndConvert"
              />
            </div>

            <USeparator />

            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div class="text-sm font-medium text-highlighted">Mode de récupération des fichiers</div>
                <p class="text-xs text-muted">
                  Choisissez de rapatrier les datasets via FTP z/OS ou d'uploader directement des fichiers binaires depuis votre PC.
                </p>
              </div>
              <div class="inline-flex rounded-lg border border-default p-1 bg-elevated/40 shrink-0">
                <UButton
                  size="sm"
                  :color="sourceMode === 'ftp' ? 'primary' : 'neutral'"
                  :variant="sourceMode === 'ftp' ? 'solid' : 'ghost'"
                  icon="i-lucide-server"
                  label="FTP z/OS (Binaire)"
                  @click="sourceMode = 'ftp'"
                />
                <UButton
                  size="sm"
                  :color="sourceMode === 'local' ? 'primary' : 'neutral'"
                  :variant="sourceMode === 'local' ? 'solid' : 'ghost'"
                  icon="i-lucide-upload"
                  label="Upload fichier binaire"
                  @click="sourceMode = 'local'"
                />
              </div>
            </div>
          </div>
        </UCard>

        <!-- 2. Liste des modèles -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-4">
              <div>
                <h3 class="font-semibold text-highlighted">
                  {{ sourceMode === 'local' ? 'Fichiers binaires à convertir' : 'Fichiers DSN à récupérer via FTP' }}
                </h3>
                <p class="text-xs text-muted mt-0.5">
                  <template v-if="sourceMode === 'local'">
                    Glissez-déposez ou sélectionnez un fichier binaire EBCDIC (.bin, etc.) en face du modèle correspondant.
                  </template>
                  <template v-else>
                    Cochez les fichiers concernés et ajustez le DSN z/OS si nécessaire (vous pouvez aussi surcharger une ligne avec un fichier local).
                  </template>
                </p>
              </div>
              <UCheckbox
                v-if="sourceMode === 'ftp'"
                :model-value="selectedRows.length === rows.length && rows.length > 0"
                label="Tout cocher"
                @update:model-value="toggleAll"
              />
            </div>
          </template>

          <div class="divide-y divide-default">
            <IncidentFileSourceRow
              v-for="row in rows"
              :key="row.model.id"
              :row="row"
              :source-mode="sourceMode"
              :copybook-name="copybookMap.get(row.model.copybookId)?.name ?? 'Copybook'"
              :effective-lrecl="row.model.lreclOverride ?? copybookMap.get(row.model.copybookId)?.lrecl ?? '?'"
            />
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
