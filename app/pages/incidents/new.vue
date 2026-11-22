<script setup lang="ts">
import type { CopybookMeta } from '#shared/types/cobol'
import type { DsnModel } from '#shared/types/config'
import type { IncidentDetail } from '#shared/types/incident'

useHead({ title: 'Nouvel incident — Mainframe Tool' })

const toast = useToast()
const router = useRouter()

const [{ data: models }, { data: copybooks }] = await Promise.all([
  useFetch<DsnModel[]>('/api/admin/models', { default: () => [] }),
  useFetch<CopybookMeta[]>('/api/admin/copybooks', { default: () => [] })
])

const copybookMap = computed(() => new Map(copybooks.value.map(c => [c.id, c])))

interface SelectableRow {
  model: DsnModel
  checked: boolean
  dsn: string
  localFile: File | null
}

const incidentNumber = ref('')
const running = ref(false)

const rows = ref<SelectableRow[]>(
  models.value.map(m => ({
    model: m,
    checked: false,
    dsn: m.defaultDsn,
    localFile: null
  }))
)

const selectedRows = computed(() => rows.value.filter(r => r.checked))

function onLocalFileSelected(row: SelectableRow, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  row.localFile = file
  if (file) {
    row.checked = true
  }
}

function clearLocalFile(row: SelectableRow) {
  row.localFile = null
}

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
      description: 'Cochez au moins un fichier DSN à importer et convertir.',
      color: 'warning'
    })
    return
  }

  running.value = true
  try {
    const formData = new FormData()
    formData.append('incidentNumber', incidentNumber.value.trim())

    const itemsPayload = selectedRows.value.map((row) => {
      const fileField = row.localFile ? `file_${row.model.id}` : undefined
      if (row.localFile && fileField) {
        formData.append(fileField, row.localFile, row.localFile.name)
      }
      return {
        modelId: row.model.id,
        dsn: row.dsn.trim().toUpperCase(),
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
      description: `${result.totalRecords.toLocaleString('fr-FR')} enregistrements convertis en ${result.totalCsvFiles} fichier(s) CSV.`,
      color: result.status === 'completed' ? 'success' : result.status === 'partial' ? 'warning' : 'error'
    })

    await router.push(`/incidents/${result.id}`)
  } catch (err: unknown) {
    const fetchErr = err as { statusMessage?: string; message?: string }
    toast.add({
      title: 'Erreur lors du traitement',
      description: fetchErr.statusMessage ?? fetchErr.message ?? 'Une erreur est survenue.',
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
        <!-- 1. Numéro d'incident -->
        <UCard>
          <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <UFormField
              label="Numéro d'incident"
              description="Sert d'identifiant dans l'historique et pour le nommage de l'archive ZIP."
              required
              class="flex-1 max-w-md"
            >
              <UInput
                v-model="incidentNumber"
                placeholder="ex: INC-2026-5891"
                size="lg"
                icon="i-lucide-hash"
                class="w-full font-mono"
              />
            </UFormField>

            <UButton
              size="lg"
              icon="i-lucide-zap"
              :label="running ? 'Import & conversion en cours...' : `Importer et Convertir (${selectedRows.length})`"
              :loading="running"
              :disabled="selectedRows.length === 0 || !incidentNumber.trim()"
              @click="runImportAndConvert"
            />
          </div>
        </UCard>

        <!-- 2. Liste des fichiers DSN -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-4">
              <div>
                <h3 class="font-semibold text-highlighted">Fichiers à récupérer</h3>
                <p class="text-xs text-muted mt-0.5">
                  Cochez les fichiers concernés et ajustez le DSN z/OS si nécessaire. Vous pouvez aussi charger un fichier binaire local pour tester sans FTP.
                </p>
              </div>
              <UCheckbox
                :model-value="selectedRows.length === rows.length && rows.length > 0"
                label="Tout cocher"
                @update:model-value="toggleAll"
              />
            </div>
          </template>

          <div class="divide-y divide-default">
            <div
              v-for="row in rows"
              :key="row.model.id"
              class="py-4 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-center gap-4"
            >
              <!-- Checkbox + Infos modèle -->
              <div class="flex items-start gap-3 lg:w-72 shrink-0">
                <UCheckbox v-model="row.checked" class="mt-0.5" />
                <div class="min-w-0">
                  <div class="font-medium text-sm text-highlighted truncate">
                    {{ row.model.name }}
                  </div>
                  <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                    <UBadge color="neutral" variant="soft" size="xs" class="font-mono">
                      {{ copybookMap.get(row.model.copybookId)?.name ?? 'Copybook' }}
                    </UBadge>
                    <UBadge color="neutral" variant="outline" size="xs" class="font-mono">
                      LRECL {{ row.model.lreclOverride ?? copybookMap.get(row.model.copybookId)?.lrecl ?? '?' }}
                    </UBadge>
                  </div>
                </div>
              </div>

              <!-- Champ DSN réel (actif uniquement si coché) -->
              <div class="flex-1 min-w-0">
                <UInput
                  v-model="row.dsn"
                  :disabled="!row.checked"
                  placeholder="DSN z/OS (ex: TEST.SPE.GJ020005)"
                  icon="i-lucide-hard-drive"
                  class="w-full font-mono uppercase"
                />
              </div>

              <!-- Source : FTP ou Fichier local -->
              <div class="flex items-center gap-2 shrink-0">
                <template v-if="row.localFile">
                  <UBadge color="info" variant="subtle" icon="i-lucide-file-up" class="max-w-44 truncate">
                    {{ row.localFile.name }}
                  </UBadge>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-x"
                    title="Revenir au mode FTP"
                    @click="clearLocalFile(row)"
                  />
                </template>
                <template v-else>
                  <UBadge
                    :color="row.checked ? 'primary' : 'neutral'"
                    variant="soft"
                    size="xs"
                    icon="i-lucide-server"
                  >
                    FTP Binaire
                  </UBadge>
                  <label class="cursor-pointer">
                    <input
                      type="file"
                      class="hidden"
                      @change="(e) => onLocalFileSelected(row, e)"
                    >
                    <span class="inline-flex items-center gap-1 text-xs text-muted hover:text-highlighted px-2 py-1 rounded border border-default hover:bg-elevated transition-colors">
                      <UIcon name="i-lucide-upload" class="size-3.5" />
                      Local
                    </span>
                  </label>
                </template>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
