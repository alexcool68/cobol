import type { FtpConfigPublic } from '#shared/types/config'

const FTP_STATUS_KEY = 'shared-ftp-config'

export function useFtpStatus() {
  const { data: ftpConfig, refresh } = useFetch<FtpConfigPublic>('/api/admin/ftp', {
    key: FTP_STATUS_KEY
  })

  const isFtpConfigured = computed(() =>
    Boolean(ftpConfig.value?.host && ftpConfig.value?.user)
  )

  return {
    ftpConfig,
    isFtpConfigured,
    refreshFtpStatus: refresh
  }
}
