<script setup lang="ts">
import type { ChainGroupSummary } from '#shared/types/incident'

defineProps<{
  incidentId: string
  groups: ChainGroupSummary[]
  selectedKey: string | null | undefined
}>()

const emit = defineEmits<{
  select: [key: string]
}>()

const { formatNumber } = useFormatters()
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
    <div
      v-for="group in groups"
      :key="group.key"
      class="rounded-lg border p-3.5 transition-all cursor-pointer"
      :class="[
        selectedKey === group.key
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-default bg-default hover:bg-elevated/40'
      ]"
      @click="emit('select', group.key)"
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
          :to="`/api/incidents/${incidentId}/csv/${encodeURIComponent(group.csvFileName)}`"
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
          {{ formatNumber(group.recordCount) }}
        </span>
        <span class="text-xs text-muted">
          {{ group.recordCount > 1 ? 'lignes' : 'ligne' }}
        </span>
      </div>
    </div>
  </div>
</template>
