<script setup lang="ts">
import type { DsnModel } from '#shared/types/config'

export interface IncidentFileRowModel {
  model: DsnModel
  checked: boolean
  dsn: string
  localFile: File | null
}

const props = defineProps<{
  row: IncidentFileRowModel
  sourceMode: 'ftp' | 'local'
  copybookName: string
  effectiveLrecl: number | string
}>()

const { formatBytes } = useFormatters()
const dragging = ref(false)

function attachFile(file: File | null) {
  props.row.localFile = file
  if (file) {
    props.row.checked = true
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  attachFile(input.files?.[0] ?? null)
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  const file = event.dataTransfer?.files?.[0] ?? null
  if (file) attachFile(file)
}

function clearFile() {
  props.row.localFile = null
  if (props.sourceMode === 'local') {
    props.row.checked = false
  }
}
</script>

<template>
  <div class="py-4 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-center gap-4">
    <!-- Checkbox + Infos modèle -->
    <div class="flex items-start gap-3 lg:w-72 shrink-0">
      <UCheckbox v-model="row.checked" class="mt-0.5" />
      <div class="min-w-0">
        <div class="font-medium text-sm text-highlighted truncate">
          {{ row.model.name }}
        </div>
        <div class="flex items-center gap-1.5 mt-1 flex-wrap">
          <UBadge color="neutral" variant="soft" size="xs" class="font-mono">
            {{ copybookName }}
          </UBadge>
          <UBadge color="neutral" variant="outline" size="xs" class="font-mono">
            LRECL {{ effectiveLrecl }}
          </UBadge>
        </div>
      </div>
    </div>

    <!-- MODE UPLOAD LOCAL -->
    <template v-if="sourceMode === 'local'">
      <div
        class="flex-1 min-w-0 rounded-lg border border-dashed px-4 py-3 transition-colors"
        :class="[
          dragging
            ? 'border-primary bg-primary/10'
            : row.localFile
              ? 'border-primary/60 bg-primary/5'
              : 'border-default hover:border-primary/40 bg-elevated/20'
        ]"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <div v-if="row.localFile" class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <UIcon name="i-lucide-file-check-2" class="size-4.5 text-primary shrink-0" />
            <div class="min-w-0">
              <div class="text-sm font-mono font-medium text-highlighted truncate">
                {{ row.localFile.name }}
              </div>
              <div class="text-xs text-muted">
                {{ formatBytes(row.localFile.size) }} • Prêt pour conversion binaire
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <label class="cursor-pointer">
              <input type="file" class="hidden" @change="onFileChange">
              <span class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline px-2 py-1">
                Changer
              </span>
            </label>
            <UButton
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-x"
              title="Retirer le fichier"
              @click="clearFile"
            />
          </div>
        </div>

        <label v-else class="flex items-center justify-between gap-3 cursor-pointer">
          <div class="flex items-center gap-2.5 text-muted">
            <UIcon name="i-lucide-upload-cloud" class="size-5 shrink-0" />
            <span class="text-xs">
              Glissez un fichier binaire ici ou <strong class="text-primary">parcourez votre PC</strong>
            </span>
          </div>
          <span class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-default bg-default text-highlighted shrink-0">
            <UIcon name="i-lucide-folder-open" class="size-3.5" />
            Importer (.bin)
          </span>
          <input type="file" class="hidden" @change="onFileChange">
        </label>
      </div>
    </template>

    <!-- MODE FTP -->
    <template v-else>
      <div class="flex-1 min-w-0">
        <UInput
          v-model="row.dsn"
          :disabled="!row.checked"
          placeholder="DSN z/OS (ex: TEST.SPE.GJ020005)"
          icon="i-lucide-hard-drive"
          class="w-full font-mono uppercase"
        />
      </div>

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
            @click="clearFile"
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
            <input type="file" class="hidden" @change="onFileChange">
            <span class="inline-flex items-center gap-1 text-xs text-muted hover:text-highlighted px-2 py-1 rounded border border-default hover:bg-elevated transition-colors">
              <UIcon name="i-lucide-upload" class="size-3.5" />
              Local
            </span>
          </label>
        </template>
      </div>
    </template>
  </div>
</template>
