<script setup lang="ts">
import type { CopybookDetail, CopybookMeta, ParsedCopybook } from '#shared/types/cobol'

useHead({ title: 'Copybooks — Administration' })

const toast = useToast()
const { data: copybooks, refresh, status } = await useFetch<CopybookMeta[]>('/api/admin/copybooks', {
  default: () => []
})

const isModalOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const previewLoading = ref(false)
const previewError = ref<string | null>(null)
const parsedPreview = ref<ParsedCopybook | null>(null)

const form = reactive({
  name: '',
  description: '',
  rawContent: ''
})

const SAMPLE_COPYBOOK = `000100* EXEMPLE COPYBOOK MOUVEMENTS COMPTABLES
000200 01  MVT-ENREGISTREMENT.
000300     05  CODE-CHAINE           PIC X(4).
000400     05  TYP-ENR               PIC X(1).
000500     05  NUM-CONTRAT           PIC 9(8).
000600     05  ZONE-SPECIFIQUE       PIC X(20).
000700     05  MVT-DP01-A REDEFINES ZONE-SPECIFIQUE.
000800         10  DP01-LIBELLE      PIC X(10).
000900         10  DP01-MONTANT      PIC S9(8)V99 COMP-3.
001000         10  DP01-NB-ECHEANCE  PIC S9(4) COMP.
001100         10  FILLER            PIC X(2).
001200     05  MVT-JG16 REDEFINES ZONE-SPECIFIQUE.
001300         10  JG16-MONTANT-ZON  PIC S9(8)V99.
001400         10  JG16-CODE-SIN     PIC X(10).`

function openCreate() {
  editingId.value = null
  form.name = ''
  form.description = ''
  form.rawContent = ''
  parsedPreview.value = null
  previewError.value = null
  isModalOpen.value = true
}

async function openEdit(meta: CopybookMeta) {
  try {
    const detail = await $fetch<CopybookDetail>(`/api/admin/copybooks/${meta.id}`)
    editingId.value = detail.id
    form.name = detail.name
    form.description = detail.description ?? ''
    form.rawContent = detail.rawContent
    parsedPreview.value = detail.parsed
    previewError.value = null
    isModalOpen.value = true
  } catch {
    toast.add({ title: 'Erreur', description: 'Impossible de charger ce copybook.', color: 'error' })
  }
}

function loadSample() {
  if (!form.name) form.name = 'MVTCOMPT'
  form.rawContent = SAMPLE_COPYBOOK
  runPreview()
}

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!form.name) {
    form.name = file.name.replace(/\.(cpy|cob|txt)$/i, '').toUpperCase()
  }

  const reader = new FileReader()
  reader.onload = () => {
    form.rawContent = String(reader.result ?? '')
    runPreview()
  }
  reader.readAsText(file)
}

async function runPreview() {
  if (!form.rawContent.trim()) {
    parsedPreview.value = null
    previewError.value = null
    return
  }

  previewLoading.value = true
  previewError.value = null
  try {
    parsedPreview.value = await $fetch<ParsedCopybook>('/api/admin/copybooks/preview', {
      method: 'POST',
      body: { rawContent: form.rawContent }
    })
  } catch (err: unknown) {
    parsedPreview.value = null
    const fetchErr = err as { statusMessage?: string; message?: string }
    previewError.value = fetchErr.statusMessage ?? fetchErr.message ?? 'Erreur de parsing COBOL'
  } finally {
    previewLoading.value = false
  }
}

async function saveCopybook() {
  if (!form.name.trim() || !form.rawContent.trim()) {
    toast.add({ title: 'Champs requis', description: 'Veuillez saisir un nom et le contenu du copybook.', color: 'warning' })
    return
  }

  saving.value = true
  try {
    if (editingId.value) {
      await $fetch(`/api/admin/copybooks/${editingId.value}`, {
        method: 'PUT',
        body: {
          name: form.name,
          description: form.description,
          rawContent: form.rawContent
        }
      })
      toast.add({ title: 'Copybook mis à jour', color: 'success' })
    } else {
      await $fetch('/api/admin/copybooks', {
        method: 'POST',
        body: {
          name: form.name,
          description: form.description,
          rawContent: form.rawContent
        }
      })
      toast.add({ title: 'Copybook enregistré', color: 'success' })
    }
    isModalOpen.value = false
    await refresh()
  } catch (err: unknown) {
    const fetchErr = err as { statusMessage?: string; message?: string }
    toast.add({
      title: 'Erreur',
      description: fetchErr.statusMessage ?? fetchErr.message ?? 'Impossible d\'enregistrer le copybook.',
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

async function deleteCopybook(meta: CopybookMeta) {
  try {
    await $fetch(`/api/admin/copybooks/${meta.id}`, { method: 'DELETE' })
    toast.add({ title: `Copybook "${meta.name}" supprimé`, color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Erreur lors de la suppression', color: 'error' })
  }
}

function fieldTypeBadgeColor(type: string) {
  switch (type) {
    case 'PACKED_DECIMAL': return 'warning'
    case 'BINARY': return 'info'
    case 'ZONED_DECIMAL': return 'success'
    default: return 'neutral'
  }
}
</script>

<template>
  <UDashboardPanel id="admin-copybooks">
    <template #header>
      <UDashboardNavbar title="Copybooks COBOL">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-plus"
            label="Importer un Copybook"
            @click="openCreate"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="py-12 flex justify-center">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>

      <UEmpty
        v-else-if="copybooks.length === 0"
        icon="i-lucide-file-code-2"
        title="Aucun copybook enregistré"
        description="Importez vos fichiers .cpy ou collez vos structures COBOL pour calculer automatiquement le LRECL et détecter les zones REDEFINES."
        :actions="[{ label: 'Importer un Copybook', icon: 'i-lucide-plus', onClick: openCreate }]"
      />

      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <UCard v-for="cb in copybooks" :key="cb.id">
          <template #header>
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <h3 class="font-semibold text-highlighted truncate font-mono">
                  {{ cb.name }}
                </h3>
                <p v-if="cb.description" class="text-xs text-muted mt-0.5 line-clamp-2">
                  {{ cb.description }}
                </p>
              </div>
              <UBadge color="primary" variant="subtle" class="shrink-0 font-mono">
                LRECL {{ cb.lrecl }}
              </UBadge>
            </div>
          </template>

          <div class="flex flex-wrap gap-2 text-xs">
            <UBadge color="neutral" variant="soft" icon="i-lucide-columns-3">
              {{ cb.commonFieldsCount }} champs communs
            </UBadge>
            <UBadge color="secondary" variant="soft" icon="i-lucide-git-branch">
              {{ cb.redefinesCount }} REDEFINES
            </UBadge>
          </div>

          <template #footer>
            <div class="flex items-center justify-between">
              <span class="text-xs text-muted">
                MAJ {{ new Date(cb.updatedAt).toLocaleDateString('fr-FR') }}
              </span>
              <div class="flex items-center gap-1">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-pencil"
                  label="Inspecter / Éditer"
                  @click="openEdit(cb)"
                />
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  @click="deleteCopybook(cb)"
                />
              </div>
            </div>
          </template>
        </UCard>
      </div>

      <!-- Modal Création / Édition + Inspecteur COBOL -->
      <UModal
        v-model:open="isModalOpen"
        :title="editingId ? `Éditer le copybook ${form.name}` : 'Importer un Copybook COBOL'"
        :ui="{ content: 'sm:max-w-5xl' }"
      >
        <template #body>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Colonne gauche : Saisie / Import -->
            <div class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <UFormField label="Nom du Copybook" required>
                  <UInput v-model="form.name" placeholder="ex: MVTCOMPT" class="w-full font-mono" />
                </UFormField>
                <UFormField label="Description">
                  <UInput v-model="form.description" placeholder="Mouvements comptables..." class="w-full" />
                </UFormField>
              </div>

              <div class="flex items-center justify-between gap-2">
                <label class="text-sm font-medium text-highlighted">Code source COBOL (.cpy)</label>
                <div class="flex items-center gap-2">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="subtle"
                    icon="i-lucide-sparkles"
                    label="Charger un exemple"
                    @click="loadSample"
                  />
                  <label class="cursor-pointer">
                    <input
                      type="file"
                      accept=".cpy,.cob,.txt"
                      class="hidden"
                      @change="handleFileUpload"
                    >
                    <span class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-default hover:bg-elevated transition-colors">
                      <UIcon name="i-lucide-upload" class="size-3.5" />
                      Fichier .cpy
                    </span>
                  </label>
                </div>
              </div>

              <UTextarea
                v-model="form.rawContent"
                :rows="14"
                placeholder="Collez ici votre copybook COBOL (01 ..., 05 ..., REDEFINES ..., COMP-3)..."
                class="w-full font-mono text-xs"
              />

              <div class="flex justify-end">
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-scan-search"
                  label="Analyser la structure"
                  :loading="previewLoading"
                  @click="runPreview"
                />
              </div>
            </div>

            <!-- Colonne droite : Inspecteur en direct -->
            <div class="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-highlighted">Inspecteur de structure</span>
                <UBadge v-if="parsedPreview" color="primary" variant="solid" class="font-mono">
                  LRECL = {{ parsedPreview.lrecl }} octets
                </UBadge>
              </div>

              <UAlert
                v-if="previewError"
                color="error"
                variant="subtle"
                icon="i-lucide-alert-circle"
                title="Erreur d'analyse"
                :description="previewError"
              />

              <div
                v-else-if="!parsedPreview"
                class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted"
              >
                Collez votre copybook puis cliquez sur <strong>Analyser la structure</strong> pour vérifier le LRECL, les offsets et les blocs REDEFINES.
              </div>

              <template v-else>
                <UAlert
                  v-for="(warn, idx) in parsedPreview.warnings"
                  :key="idx"
                  color="warning"
                  variant="subtle"
                  icon="i-lucide-triangle-alert"
                  :description="warn"
                />

                <!-- Champs communs -->
                <div class="space-y-2">
                  <h4 class="text-xs font-semibold uppercase tracking-wider text-muted">
                    Tronc commun ({{ parsedPreview.commonFields.length }} champs)
                  </h4>
                  <div class="rounded-lg border border-default overflow-hidden">
                    <table class="w-full text-xs">
                      <thead class="bg-elevated/60 text-muted text-left">
                        <tr>
                          <th class="px-2.5 py-1.5">Champ</th>
                          <th class="px-2.5 py-1.5">Pos.</th>
                          <th class="px-2.5 py-1.5">Octets</th>
                          <th class="px-2.5 py-1.5">PIC / Type</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-default font-mono">
                        <tr v-for="f in parsedPreview.commonFields" :key="`${f.offset}-${f.name}`">
                          <td class="px-2.5 py-1.5 font-medium text-highlighted">{{ f.name }}</td>
                          <td class="px-2.5 py-1.5 text-muted">{{ f.offset + 1 }}–{{ f.offset + f.byteLength }}</td>
                          <td class="px-2.5 py-1.5">{{ f.byteLength }}</td>
                          <td class="px-2.5 py-1.5">
                            <UBadge :color="fieldTypeBadgeColor(f.type)" variant="subtle" size="xs">
                              {{ f.pic }} {{ f.usage !== 'DISPLAY' ? f.usage : '' }}
                            </UBadge>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Branches REDEFINES -->
                <div class="space-y-2">
                  <h4 class="text-xs font-semibold uppercase tracking-wider text-muted">
                    Branches REDEFINES ({{ parsedPreview.redefinesBranches.length }})
                  </h4>
                  <div v-if="parsedPreview.redefinesBranches.length === 0" class="text-xs text-muted italic">
                    Aucun REDEFINES détecté dans ce copybook.
                  </div>
                  <div
                    v-for="branch in parsedPreview.redefinesBranches"
                    :key="branch.name"
                    class="rounded-lg border border-default overflow-hidden"
                  >
                    <div class="px-3 py-2 bg-elevated/60 flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2 font-mono text-xs">
                        <UIcon name="i-lucide-git-branch" class="size-3.5 text-primary" />
                        <span class="font-semibold text-highlighted">{{ branch.name }}</span>
                        <span class="text-muted">REDEFINES {{ branch.redefines }}</span>
                      </div>
                      <span class="text-xs text-muted font-mono">
                        pos {{ branch.offset + 1 }} ({{ branch.byteLength }} o)
                      </span>
                    </div>
                    <table class="w-full text-xs">
                      <tbody class="divide-y divide-default font-mono">
                        <tr v-for="f in branch.fields" :key="`${f.offset}-${f.name}`">
                          <td class="px-2.5 py-1.5 text-highlighted">{{ f.name }}</td>
                          <td class="px-2.5 py-1.5 text-muted">{{ f.offset + 1 }}–{{ f.offset + f.byteLength }}</td>
                          <td class="px-2.5 py-1.5">{{ f.byteLength }} o</td>
                          <td class="px-2.5 py-1.5">
                            <UBadge :color="fieldTypeBadgeColor(f.type)" variant="subtle" size="xs">
                              {{ f.pic }} {{ f.usage !== 'DISPLAY' ? f.usage : '' }}
                            </UBadge>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </template>

        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" label="Annuler" @click="isModalOpen = false" />
            <UButton
              icon="i-lucide-save"
              :label="editingId ? 'Mettre à jour' : 'Enregistrer'"
              :loading="saving"
              @click="saveCopybook"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
