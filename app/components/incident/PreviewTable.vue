<script setup lang="ts">
import type { ChainGroupSummary } from '#shared/types/incident'

const props = defineProps<{
  incidentId: string
  group: ChainGroupSummary
  rows: Record<string, string>[]
  loading: boolean
}>()

const { formatNumber } = useFormatters()
const search = ref('')

watch(() => props.group.csvFileName, () => {
  search.value = ''
})

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.rows
  return props.rows.filter(row =>
    Object.values(row).some(val => String(val).toLowerCase().includes(q))
  )
})
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0 overflow-hidden' }">
    <template #header>
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 class="font-semibold text-sm text-highlighted flex items-center gap-2">
            <span>Aperçu :</span>
            <span class="font-mono text-primary">{{ group.csvFileName }}</span>
          </h3>
          <p class="text-xs text-muted mt-0.5">
            Affichage des {{ Math.min(rows.length, 200) }} premières lignes sur {{ formatNumber(group.recordCount) }}.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Filtrer dans l'aperçu..."
            size="sm"
            class="w-56"
          />
          <UButton
            size="sm"
            icon="i-lucide-file-spreadsheet"
            label="Télécharger CSV"
            :to="`/api/incidents/${incidentId}/csv/${encodeURIComponent(group.csvFileName)}`"
            target="_blank"
            external
          />
        </div>
      </div>
    </template>

    <div v-if="loading" class="py-12 flex justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    </div>

    <div v-else class="overflow-auto max-h-[55vh] [scrollbar-gutter:stable]">
      <table class="min-w-max w-full text-xs whitespace-nowrap border-separate border-spacing-0">
        <thead class="text-muted text-left sticky top-0 z-20">
          <tr>
            <th class="sticky left-0 z-30 bg-elevated px-3 py-2.5 font-mono text-muted border-b border-r border-default">
              #
            </th>
            <th
              v-for="col in group.columns"
              :key="col"
              class="bg-elevated px-3 py-2.5 font-mono font-semibold border-b border-default last:pr-6"
            >
              {{ col }}
            </th>
          </tr>
        </thead>
        <tbody class="font-mono">
          <tr v-for="(row, rIdx) in filteredRows" :key="rIdx" class="group hover:bg-elevated/40">
            <td class="sticky left-0 z-10 bg-default group-hover:bg-elevated/40 px-3 py-1.5 text-muted border-b border-r border-default/60">
              {{ rIdx + 1 }}
            </td>
            <td
              v-for="col in group.columns"
              :key="col"
              class="px-3 py-1.5 text-highlighted border-b border-default/60 last:pr-6"
            >
              {{ row[col] ?? '' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UCard>
</template>
