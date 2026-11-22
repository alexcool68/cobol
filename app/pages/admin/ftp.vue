<script setup lang="ts">
import type { FtpConfigPublic } from '#shared/types/config'

useHead({ title: 'Connexion FTP — Administration' })

const toast = useToast()
const { data: ftpConfig, refresh } = await useFetch<FtpConfigPublic>('/api/admin/ftp')

const form = reactive({
  host: ftpConfig.value?.host ?? '',
  port: ftpConfig.value?.port ?? 21,
  user: ftpConfig.value?.user ?? '',
  password: '',
  quoteDsn: ftpConfig.value?.quoteDsn ?? true,
  timeoutMs: ftpConfig.value?.timeoutMs ?? 15000
})

const saving = ref(false)
const testing = ref(false)
const testResult = ref<{ ok: boolean; message: string } | null>(null)

async function saveConfig() {
  saving.value = true
  try {
    await $fetch('/api/admin/ftp', {
      method: 'PUT',
      body: {
        host: form.host,
        port: Number(form.port),
        user: form.user,
        password: form.password || undefined,
        quoteDsn: form.quoteDsn,
        timeoutMs: Number(form.timeoutMs)
      }
    })
    form.password = ''
    await refresh()
    toast.add({ title: 'Configuration FTP enregistrée', color: 'success' })
  } catch (err: unknown) {
    const fetchErr = err as { statusMessage?: string; message?: string }
    toast.add({
      title: 'Erreur',
      description: fetchErr.statusMessage ?? fetchErr.message ?? 'Impossible d\'enregistrer la configuration.',
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

async function testConnection() {
  testing.value = true
  testResult.value = null
  try {
    testResult.value = await $fetch<{ ok: boolean; message: string }>('/api/admin/ftp/test', {
      method: 'POST',
      body: {
        host: form.host,
        port: Number(form.port),
        user: form.user,
        password: form.password || undefined,
        quoteDsn: form.quoteDsn,
        timeoutMs: Number(form.timeoutMs)
      }
    })
  } catch (err: unknown) {
    const fetchErr = err as { statusMessage?: string; message?: string }
    testResult.value = {
      ok: false,
      message: fetchErr.statusMessage ?? fetchErr.message ?? 'Erreur lors du test FTP.'
    }
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="admin-ftp">
    <template #header>
      <UDashboardNavbar title="Connexion FTP z/OS">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-2xl space-y-6">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-semibold text-highlighted">Serveur FTP Mainframe (z/OS)</h3>
                <p class="text-xs text-muted mt-0.5">
                  Tous les transferts sont effectués en mode binaire strict (TYPE I) pour préserver les champs COMP et COMP-3.
                </p>
              </div>
              <UBadge color="info" variant="subtle" class="font-mono">TYPE I • IBM-1147</UBadge>
            </div>
          </template>

          <div class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <UFormField label="Serveur (Host / IP)" required class="sm:col-span-2">
                <UInput v-model="form.host" placeholder="ex: mainframe.assurance.local" class="w-full font-mono" />
              </UFormField>
              <UFormField label="Port" required>
                <UInput v-model.number="form.port" type="number" class="w-full font-mono" />
              </UFormField>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Utilisateur RACF" required>
                <UInput v-model="form.user" placeholder="ex: U123456" class="w-full font-mono" />
              </UFormField>
              <UFormField
                label="Mot de passe"
                :hint="ftpConfig?.hasPassword ? 'Un mot de passe est déjà enregistré (laissez vide pour le conserver)' : undefined"
              >
                <UInput
                  v-model="form.password"
                  type="password"
                  :placeholder="ftpConfig?.hasPassword ? '••••••••' : 'Mot de passe RACF'"
                  class="w-full"
                />
              </UFormField>
            </div>

            <USeparator />

            <USwitch
              v-model="form.quoteDsn"
              label="Entourer automatiquement les DSN de guillemets simples ('DSN')"
              description="Recommandé sur z/OS pour éviter que le serveur FTP n'ajoute votre identifiant RACF devant le nom du fichier."
            />

            <UFormField label="Timeout de connexion (ms)">
              <UInput v-model.number="form.timeoutMs" type="number" class="w-40 font-mono" />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex items-center justify-between gap-3">
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-plug-zap"
                label="Tester la connexion"
                :loading="testing"
                @click="testConnection"
              />
              <UButton
                icon="i-lucide-save"
                label="Enregistrer"
                :loading="saving"
                @click="saveConfig"
              />
            </div>
          </template>
        </UCard>

        <UAlert
          v-if="testResult"
          :color="testResult.ok ? 'success' : 'error'"
          variant="subtle"
          :icon="testResult.ok ? 'i-lucide-check-circle-2' : 'i-lucide-x-circle'"
          :title="testResult.ok ? 'Connexion FTP opérationnelle' : 'Échec de connexion'"
          :description="testResult.message"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
