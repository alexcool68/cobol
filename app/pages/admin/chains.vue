<script setup lang="ts">
import type { CopybookDetail, CopybookMeta } from '#shared/types/cobol'
import type { ChainRule } from '#shared/types/config'

useHead({ title: 'Codes Chaîne — Administration' })

const toast = useToast()

const [{ data: copybooks }, { data: chains, refresh }] = await Promise.all([
  useFetch<CopybookMeta[]>('/api/admin/copybooks', { default: () => [] }),
  useFetch<ChainRule[]>('/api/admin/chains', { default: () => [] })
])

const selectedFilterCopybookId = ref<string>('ALL')
const isModalOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const activeCopybookDetail = ref<CopybookDetail | null>(null)
const useTypEnr = ref(false)

const form = reactive({
  copybookId: '',
  chainFieldName: '',
  codeChaine: '',
  typEnrFieldName: '',
  typEnrValue: '',
  redefinesBranchName: '',
  label: ''
})

const copybookNameMap = computed(() => {
  return new Map(copybooks.value.map(c => [c.id, c.name]))
})

const filterOptions = computed(() => [
  { label: 'Tous les copybooks', value: 'ALL' },
  ...copybooks.value.map(c => ({ label: c.name, value: c.id }))
])

const copybookSelectItems = computed(() =>
  copybooks.value.map(c => ({ label: `${c.name} (LRECL ${c.lrecl})`, value: c.id }))
)

const commonFieldItems = computed(() =>
  (activeCopybookDetail.value?.parsed.commonFields ?? []).map(f => ({
    label: `${f.name} (${f.pic ?? f.type}, pos ${f.offset + 1})`,
    value: f.name
  }))
)

const redefinesBranchItems = computed(() =>
  (activeCopybookDetail.value?.parsed.redefinesBranches ?? []).map(b => ({
    label: `${b.name} (${b.fields.length} champs, ${b.byteLength} octets)`,
    value: b.name
  }))
)

const filteredChains = computed(() => {
  if (selectedFilterCopybookId.value === 'ALL') return chains.value
  return chains.value.filter(c => c.copybookId === selectedFilterCopybookId.value)
})

watch(() => form.copybookId, async (newId) => {
  if (!newId) {
    activeCopybookDetail.value = null
    return
  }
  try {
    const detail = await $fetch<CopybookDetail>(`/api/admin/copybooks/${newId}`)
    activeCopybookDetail.value = detail

    // Auto-suggest chain field if creating new rule
    if (!editingId.value && !form.chainFieldName) {
      const candidate = detail.parsed.commonFields.find(f =>
        f.name.includes('CHAINE') || f.name.includes('MVT') || f.byteLength === 4
      )
      if (candidate) form.chainFieldName = candidate.name
    }
    if (!editingId.value && !form.typEnrFieldName) {
      const typCandidate = detail.parsed.commonFields.find(f => f.name.includes('TYP'))
      if (typCandidate) form.typEnrFieldName = typCandidate.name
    }
  } catch {
    activeCopybookDetail.value = null
  }
})

function openCreate() {
  editingId.value = null
  form.copybookId = copybooks.value[0]?.id ?? ''
  form.chainFieldName = ''
  form.codeChaine = ''
  form.typEnrFieldName = ''
  form.typEnrValue = ''
  form.redefinesBranchName = ''
  form.label = ''
  useTypEnr.value = false
  isModalOpen.value = true
}

function openEdit(rule: ChainRule) {
  editingId.value = rule.id
  form.copybookId = rule.copybookId
  form.chainFieldName = rule.chainFieldName
  form.codeChaine = rule.codeChaine
  form.typEnrFieldName = rule.typEnrFieldName ?? ''
  form.typEnrValue = rule.typEnrValue ?? ''
  form.redefinesBranchName = rule.redefinesBranchName
  form.label = rule.label ?? ''
  useTypEnr.value = Boolean(rule.typEnrFieldName && rule.typEnrValue)
  isModalOpen.value = true
}

async function saveRule() {
  const code = form.codeChaine.trim().toUpperCase()
  if (code.length !== 4) {
    toast.add({ title: 'Code Chaîne invalide', description: 'Le Code Chaîne doit comporter exactement 4 caractères (ex: DP01).', color: 'warning' })
    return
  }

  if (!form.copybookId || !form.chainFieldName || !form.redefinesBranchName) {
    toast.add({ title: 'Champs requis', description: 'Veuillez sélectionner le copybook, le champ Code Chaîne et la branche REDEFINES.', color: 'warning' })
    return
  }

  saving.value = true
  const payload = {
    copybookId: form.copybookId,
    chainFieldName: form.chainFieldName,
    codeChaine: code,
    typEnrFieldName: useTypEnr.value ? form.typEnrFieldName : undefined,
    typEnrValue: useTypEnr.value ? form.typEnrValue : undefined,
    redefinesBranchName: form.redefinesBranchName,
    label: form.label || undefined
  }

  try {
    if (editingId.value) {
      await $fetch(`/api/admin/chains/${editingId.value}`, { method: 'PUT', body: payload })
      toast.add({ title: 'Règle mise à jour', color: 'success' })
    } else {
      await $fetch('/api/admin/chains', { method: 'POST', body: payload })
      toast.add({ title: `Code Chaîne ${code} ajouté`, color: 'success' })
    }
    isModalOpen.value = false
    await refresh()
  } catch (err: unknown) {
    const fetchErr = err as { statusMessage?: string; message?: string }
    toast.add({
      title: 'Erreur',
      description: fetchErr.statusMessage ?? fetchErr.message ?? 'Impossible d\'enregistrer la règle.',
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

async function deleteRule(rule: ChainRule) {
  try {
    await $fetch(`/api/admin/chains/${rule.id}`, { method: 'DELETE' })
    toast.add({ title: `Règle ${rule.codeChaine} supprimée`, color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Erreur lors de la suppression', color: 'error' })
  }
}
</script>

<template>
  <UDashboardPanel id="admin-chains">
    <template #header>
      <UDashboardNavbar title="Codes Chaîne & TYP-ENR">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <USelect
            v-if="copybooks.length > 0"
            v-model="selectedFilterCopybookId"
            :items="filterOptions"
            class="w-52"
          />
          <UButton
            icon="i-lucide-plus"
            label="Nouveau Code Chaîne"
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
        description="Les Codes Chaîne s'associent aux branches REDEFINES de vos copybooks."
        :actions="[{ label: 'Aller aux Copybooks', icon: 'i-lucide-arrow-right', to: '/admin/copybooks' }]"
      />

      <UEmpty
        v-else-if="filteredChains.length === 0"
        icon="i-lucide-git-branch"
        title="Aucun Code Chaîne configuré"
        description="Définissez vos codes chaîne sur 4 caractères (DP01, JG16, GE00...) et associez-les aux blocs REDEFINES correspondants."
        :actions="[{ label: 'Créer un Code Chaîne', icon: 'i-lucide-plus', onClick: openCreate }]"
      />

      <div v-else class="rounded-lg border border-default overflow-hidden bg-default">
        <table class="w-full text-sm">
          <thead class="bg-elevated/60 text-muted text-left text-xs uppercase">
            <tr>
              <th class="px-4 py-3">Code Chaîne</th>
              <th class="px-4 py-3">TYP-ENR</th>
              <th class="px-4 py-3">Copybook</th>
              <th class="px-4 py-3">Branche REDEFINES</th>
              <th class="px-4 py-3">Libellé</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="rule in filteredChains" :key="rule.id" class="hover:bg-elevated/30">
              <td class="px-4 py-3">
                <UBadge color="primary" variant="subtle" class="font-mono font-semibold">
                  {{ rule.codeChaine }}
                </UBadge>
              </td>
              <td class="px-4 py-3">
                <UBadge v-if="rule.typEnrValue" color="secondary" variant="soft" class="font-mono">
                  {{ rule.typEnrValue }}
                </UBadge>
                <span v-else class="text-xs text-muted">—</span>
              </td>
              <td class="px-4 py-3 font-mono text-xs text-muted">
                {{ copybookNameMap.get(rule.copybookId) ?? rule.copybookId }}
              </td>
              <td class="px-4 py-3 font-mono text-xs text-highlighted">
                {{ rule.redefinesBranchName }}
              </td>
              <td class="px-4 py-3 text-muted">
                {{ rule.label || '—' }}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="inline-flex items-center gap-1">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-pencil"
                    @click="openEdit(rule)"
                  />
                  <UButton
                    size="xs"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    @click="deleteRule(rule)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal Création / Édition -->
      <UModal
        v-model:open="isModalOpen"
        :title="editingId ? 'Modifier le Code Chaîne' : 'Nouveau Code Chaîne'"
      >
        <template #body>
          <div class="space-y-4">
            <UFormField label="Copybook" required>
              <USelect
                v-model="form.copybookId"
                :items="copybookSelectItems"
                placeholder="Choisir un copybook..."
                class="w-full"
              />
            </UFormField>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <UFormField label="Champ COBOL Code Chaîne" required>
                <USelect
                  v-model="form.chainFieldName"
                  :items="commonFieldItems"
                  placeholder="ex: CODE-CHAINE"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Valeur Code Chaîne (4 car.)" required>
                <UInput
                  v-model="form.codeChaine"
                  maxlength="4"
                  placeholder="DP01"
                  class="w-full font-mono uppercase"
                />
              </UFormField>
            </div>

            <div class="rounded-lg border border-default p-3 space-y-3 bg-elevated/30">
              <USwitch
                v-model="useTypEnr"
                label="Filtrer aussi par TYP-ENR"
                description="Activez si ce Code Chaîne possède plusieurs types d'enregistrement."
              />

              <div v-if="useTypEnr" class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <UFormField label="Champ COBOL TYP-ENR" required>
                  <USelect
                    v-model="form.typEnrFieldName"
                    :items="commonFieldItems"
                    placeholder="ex: TYP-ENR"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Valeur TYP-ENR" required>
                  <UInput
                    v-model="form.typEnrValue"
                    placeholder="ex: A"
                    class="w-full font-mono"
                  />
                </UFormField>
              </div>
            </div>

            <UFormField label="Branche REDEFINES à appliquer" required>
              <USelect
                v-model="form.redefinesBranchName"
                :items="redefinesBranchItems"
                placeholder="Sélectionner la structure REDEFINES..."
                class="w-full"
              />
            </UFormField>

            <UFormField label="Libellé métier (optionnel)">
              <UInput
                v-model="form.label"
                placeholder="ex: Prélèvements automatiques"
                class="w-full"
              />
            </UFormField>
          </div>
        </template>

        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" label="Annuler" @click="isModalOpen = false" />
            <UButton icon="i-lucide-save" label="Enregistrer" :loading="saving" @click="saveRule" />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
