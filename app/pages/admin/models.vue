<script setup lang="ts">
import type { CopybookMeta } from '#shared/types/cobol'
import type { ChainRule, DsnModel } from '#shared/types/config'

useHead({ title: 'Modèles DSN — Administration' })

const toast = useToast()
const { getApiErrorMessage } = useFormatters()

const [{ data: copybooks }, { data: chains }, { data: models, refresh }] = await Promise.all([
  useFetch<CopybookMeta[]>('/api/admin/copybooks', { default: () => [] }),
  useFetch<ChainRule[]>('/api/admin/chains', { default: () => [] }),
  useFetch<DsnModel[]>('/api/admin/models', { default: () => [] })
])

const isModalOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

const form = reactive({
  name: '',
  defaultDsn: '',
  description: '',
  copybookId: '',
  lreclOverride: undefined as number | undefined,
  chainRuleIds: [] as string[]
})

const copybookMap = computed(() => new Map(copybooks.value.map(c => [c.id, c])))
const chainMap = computed(() => new Map(chains.value.map(c => [c.id, c])))

const copybookSelectItems = computed(() =>
  copybooks.value.map(c => ({ label: `${c.name} (LRECL ${c.lrecl})`, value: c.id }))
)

const availableChainsForSelectedCopybook = computed(() =>
  chains.value.filter(c => c.copybookId === form.copybookId)
)

const selectedCopybookLrecl = computed(() =>
  copybookMap.value.get(form.copybookId)?.lrecl
)

function openCreate() {
  editingId.value = null
  form.name = ''
  form.defaultDsn = ''
  form.description = ''
  form.copybookId = copybooks.value[0]?.id ?? ''
  form.lreclOverride = undefined
  form.chainRuleIds = []
  isModalOpen.value = true
}

function openEdit(model: DsnModel) {
  editingId.value = model.id
  form.name = model.name
  form.defaultDsn = model.defaultDsn
  form.description = model.description ?? ''
  form.copybookId = model.copybookId
  form.lreclOverride = model.lreclOverride
  form.chainRuleIds = [...model.chainRuleIds]
  isModalOpen.value = true
}

function toggleChainRule(ruleId: string, checked: boolean | 'indeterminate') {
  if (checked === true) {
    if (!form.chainRuleIds.includes(ruleId)) {
      form.chainRuleIds.push(ruleId)
    }
  } else {
    form.chainRuleIds = form.chainRuleIds.filter(id => id !== ruleId)
  }
}

async function saveModel() {
  if (!form.name.trim() || !form.defaultDsn.trim() || !form.copybookId) {
    toast.add({ title: 'Champs requis', description: 'Veuillez renseigner le nom, le DSN par défaut et le Copybook.', color: 'warning' })
    return
  }

  saving.value = true
  const payload = {
    name: form.name,
    defaultDsn: form.defaultDsn.toUpperCase(),
    description: form.description || undefined,
    copybookId: form.copybookId,
    lreclOverride: form.lreclOverride ? Number(form.lreclOverride) : null,
    chainRuleIds: form.chainRuleIds
  }

  try {
    if (editingId.value) {
      await $fetch(`/api/admin/models/${editingId.value}`, { method: 'PUT', body: payload })
      toast.add({ title: 'Modèle DSN mis à jour', color: 'success' })
    } else {
      await $fetch('/api/admin/models', { method: 'POST', body: payload })
      toast.add({ title: 'Modèle DSN enregistré', color: 'success' })
    }
    isModalOpen.value = false
    await refresh()
  } catch (err: unknown) {
    toast.add({
      title: 'Erreur',
      description: getApiErrorMessage(err, 'Impossible d\'enregistrer le modèle.'),
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

async function deleteModel(model: DsnModel) {
  try {
    await $fetch(`/api/admin/models/${model.id}`, { method: 'DELETE' })
    toast.add({ title: `Modèle "${model.name}" supprimé`, color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Erreur lors de la suppression', color: 'error' })
  }
}
</script>

<template>
  <UDashboardPanel id="admin-models">
    <template #header>
      <UDashboardNavbar title="Modèles de Fichiers DSN">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-plus"
            label="Nouveau Modèle DSN"
            :disabled="copybooks.length === 0"
            @click="openCreate"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UEmpty
        v-if="copybooks.length === 0"
        icon="i-lucide-file-code-2"
        title="Importez d'abord un Copybook"
        description="Chaque modèle de fichier DSN doit être rattaché à un Copybook."
        :actions="[{ label: 'Aller aux Copybooks', icon: 'i-lucide-arrow-right', to: '/admin/copybooks' }]"
      />

      <UEmpty
        v-else-if="models.length === 0"
        icon="i-lucide-database"
        title="Aucun modèle DSN configuré"
        description="Déclarez vos fichiers types (ex: TEST.SPE.GJ020005) pour pouvoir les cocher rapidement lors de vos incidents."
        :actions="[{ label: 'Créer un Modèle DSN', icon: 'i-lucide-plus', onClick: openCreate }]"
      />

      <div v-else class="rounded-lg border border-default overflow-hidden bg-default">
        <table class="w-full text-sm">
          <thead class="bg-elevated/60 text-muted text-left text-xs uppercase">
            <tr>
              <th class="px-4 py-3">Nom / DSN par défaut</th>
              <th class="px-4 py-3">Copybook</th>
              <th class="px-4 py-3">LRECL</th>
              <th class="px-4 py-3">Codes Chaîne associés</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="model in models" :key="model.id" class="hover:bg-elevated/30">
              <td class="px-4 py-3">
                <div class="font-medium text-highlighted">{{ model.name }}</div>
                <div class="font-mono text-xs text-muted">{{ model.defaultDsn }}</div>
              </td>
              <td class="px-4 py-3 font-mono text-xs">
                {{ copybookMap.get(model.copybookId)?.name ?? model.copybookId }}
              </td>
              <td class="px-4 py-3 font-mono text-xs">
                {{ model.lreclOverride ?? copybookMap.get(model.copybookId)?.lrecl ?? '—' }}
              </td>
              <td class="px-4 py-3">
                <div v-if="model.chainRuleIds.length === 0" class="text-xs text-muted italic">
                  Tous les codes du copybook
                </div>
                <div v-else class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="rid in model.chainRuleIds"
                    :key="rid"
                    color="primary"
                    variant="subtle"
                    size="xs"
                    class="font-mono"
                  >
                    {{ chainMap.get(rid)?.codeChaine }}<template v-if="chainMap.get(rid)?.typEnrValue">/{{ chainMap.get(rid)?.typEnrValue }}</template>
                  </UBadge>
                </div>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="inline-flex items-center gap-1">
                  <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" @click="openEdit(model)" />
                  <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="deleteModel(model)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal Création / Édition -->
      <UModal
        v-model:open="isModalOpen"
        :title="editingId ? 'Modifier le Modèle DSN' : 'Nouveau Modèle DSN'"
      >
        <template #body>
          <div class="space-y-4">
            <UFormField label="Nom du fichier (affichage)" required>
              <UInput
                v-model="form.name"
                placeholder="ex: GJ020005 — Mouvements comptables"
                class="w-full"
              />
            </UFormField>

            <UFormField label="DSN par défaut (z/OS)" required>
              <UInput
                v-model="form.defaultDsn"
                placeholder="ex: TEST.SPE.GJ020005"
                class="w-full font-mono uppercase"
              />
            </UFormField>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <UFormField label="Copybook" required class="sm:col-span-2">
                <USelect
                  v-model="form.copybookId"
                  :items="copybookSelectItems"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="LRECL forcé (opt.)">
                <UInput
                  v-model.number="form.lreclOverride"
                  type="number"
                  :placeholder="selectedCopybookLrecl ? String(selectedCopybookLrecl) : 'Auto'"
                  class="w-full font-mono"
                />
              </UFormField>
            </div>

            <UFormField
              label="Codes Chaîne & TYP-ENR attendus"
              hint="Laissez tout décoché pour accepter toutes les règles de ce copybook."
            >
              <div
                v-if="availableChainsForSelectedCopybook.length === 0"
                class="text-xs text-muted italic py-2"
              >
                Aucun Code Chaîne défini pour ce copybook.
              </div>
              <div v-else class="space-y-2 rounded-lg border border-default p-3 max-h-48 overflow-y-auto">
                <UCheckbox
                  v-for="rule in availableChainsForSelectedCopybook"
                  :key="rule.id"
                  :model-value="form.chainRuleIds.includes(rule.id)"
                  :label="`${rule.codeChaine}${rule.typEnrValue ? ` (TYP-ENR ${rule.typEnrValue})` : ''} → ${rule.redefinesBranchName || 'Structure plate'}${rule.label ? ` — ${rule.label}` : ''}`"
                  @update:model-value="(val) => toggleChainRule(rule.id, val)"
                />
              </div>
            </UFormField>

            <UFormField label="Description (optionnel)">
              <UInput v-model="form.description" placeholder="Chaîne d'émission quittances..." class="w-full" />
            </UFormField>
          </div>
        </template>

        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" label="Annuler" @click="isModalOpen = false" />
            <UButton icon="i-lucide-save" label="Enregistrer" :loading="saving" @click="saveModel" />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
