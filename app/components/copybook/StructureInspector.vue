<script setup lang="ts">
import type { ParsedCopybook } from '#shared/types/cobol'

defineProps<{
  parsed: ParsedCopybook | null
  error: string | null
}>()

function fieldTypeBadgeColor(type: string) {
  switch (type) {
    case 'PACKED_DECIMAL': return 'warning' as const
    case 'BINARY': return 'info' as const
    case 'ZONED_DECIMAL': return 'success' as const
    default: return 'neutral' as const
  }
}
</script>

<template>
  <div class="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
    <div class="flex items-center justify-between">
      <span class="text-sm font-semibold text-highlighted">Inspecteur de structure</span>
      <UBadge v-if="parsed" color="primary" variant="solid" class="font-mono">
        LRECL = {{ parsed.lrecl }} octets
      </UBadge>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-alert-circle"
      title="Erreur d'analyse"
      :description="error"
    />

    <div
      v-else-if="!parsed"
      class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted"
    >
      Collez votre copybook puis cliquez sur <strong>Analyser la structure</strong> pour vérifier le LRECL, les offsets et les blocs REDEFINES.
    </div>

    <template v-else>
      <UAlert
        v-for="(warn, idx) in parsed.warnings"
        :key="idx"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :description="warn"
      />

      <!-- Champs communs -->
      <div class="space-y-2">
        <h4 class="text-xs font-semibold uppercase tracking-wider text-muted">
          Tronc commun ({{ parsed.commonFields.length }} champs)
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
              <tr v-for="f in parsed.commonFields" :key="`${f.offset}-${f.name}`">
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
          Branches REDEFINES ({{ parsed.redefinesBranches.length }})
        </h4>
        <div v-if="parsed.redefinesBranches.length === 0" class="text-xs text-muted italic">
          Aucun REDEFINES détecté dans ce copybook.
        </div>
        <div
          v-for="branch in parsed.redefinesBranches"
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
</template>
