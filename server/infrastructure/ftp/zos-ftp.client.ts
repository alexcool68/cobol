import { Writable } from 'node:stream'
import { Client } from 'basic-ftp'
import type { FtpConfig } from '#shared/types/config'

/**
 * Formats a z/OS Dataset Name according to quoteDsn setting.
 * When quoteDsn is enabled, wraps in single quotes ('TEST.SPE.GJ020005')
 * so z/OS FTP does not prepend the RACF user HLQ.
 */
export function formatZosDsn(dsn: string, quoteDsn: boolean): string {
  const trimmed = dsn.trim()
  if (!quoteDsn) return trimmed
  if (trimmed.startsWith('\'') && trimmed.endsWith('\'')) return trimmed
  return `'${trimmed}'`
}

export const zosFtpClient = {
  async testConnection(config: FtpConfig): Promise<{ ok: boolean; message: string; pwd?: string }> {
    if (!config.host || !config.user) {
      return { ok: false, message: 'Host et utilisateur RACF requis.' }
    }

    const client = new Client(config.timeoutMs || 15000)
    try {
      await client.access({
        host: config.host,
        port: config.port || 21,
        user: config.user,
        password: config.password ?? '',
        secure: false
      })
      // Verify binary mode command is accepted by z/OS FTP server
      await client.send('TYPE I')
      const pwd = await client.pwd()
      return {
        ok: true,
        message: `Connexion réussie en mode binaire (TYPE I). Répertoire courant : ${pwd}`,
        pwd
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, message: `Échec de connexion FTP : ${msg}` }
    } finally {
      client.close()
    }
  },

  /**
   * Downloads a z/OS sequential dataset in strict BINARY mode (TYPE I) into a Node.js Buffer.
   */
  async downloadDatasetBinary(config: FtpConfig, dsn: string): Promise<Buffer> {
    if (!config.host || !config.user) {
      throw new Error('Configuration FTP incomplète (host ou utilisateur manquant).')
    }

    const client = new Client(config.timeoutMs || 30000)
    const chunks: Buffer[] = []

    const writable = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        callback()
      }
    })

    try {
      await client.access({
        host: config.host,
        port: config.port || 21,
        user: config.user,
        password: config.password ?? '',
        secure: false
      })

      // Enforce strict binary transfer (no EBCDIC -> ASCII translation!)
      await client.send('TYPE I')

      const remoteTarget = formatZosDsn(dsn, config.quoteDsn)
      await client.downloadTo(writable, remoteTarget)

      return Buffer.concat(chunks)
    } finally {
      client.close()
    }
  }
}
