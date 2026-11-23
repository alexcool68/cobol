export function useFormatters() {
  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`
  }

  function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR')
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR')
  }

  function formatNumber(n: number): string {
    return n.toLocaleString('fr-FR')
  }

  function getApiErrorMessage(err: unknown, fallback = 'Une erreur est survenue.'): string {
    if (err && typeof err === 'object') {
      const fetchErr = err as { data?: { statusMessage?: string; message?: string }; statusMessage?: string; message?: string }
      return fetchErr.data?.statusMessage ?? fetchErr.statusMessage ?? fetchErr.data?.message ?? fetchErr.message ?? fallback
    }
    return fallback
  }

  return {
    formatBytes,
    formatDateTime,
    formatDate,
    formatNumber,
    getApiErrorMessage
  }
}
