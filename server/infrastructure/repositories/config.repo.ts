import { join } from 'node:path'
import type { ChainRule, DsnModel, FtpConfig } from '#shared/types/config'
import { CONFIG_DIR, readJsonFile, writeJsonFile } from '../storage/paths'

const CHAINS_FILE = join(CONFIG_DIR, 'chains.json')
const MODELS_FILE = join(CONFIG_DIR, 'models.json')
const FTP_FILE = join(CONFIG_DIR, 'ftp.json')

const DEFAULT_FTP_CONFIG: FtpConfig = {
  host: '',
  port: 21,
  user: '',
  password: '',
  quoteDsn: true,
  timeoutMs: 15000
}

export const configRepository = {
  async listChains(): Promise<ChainRule[]> {
    return readJsonFile<ChainRule[]>(CHAINS_FILE, [])
  },

  async saveChains(chains: ChainRule[]): Promise<void> {
    await writeJsonFile(CHAINS_FILE, chains)
  },

  async listModels(): Promise<DsnModel[]> {
    return readJsonFile<DsnModel[]>(MODELS_FILE, [])
  },

  async saveModels(models: DsnModel[]): Promise<void> {
    await writeJsonFile(MODELS_FILE, models)
  },

  async getFtpConfig(): Promise<FtpConfig> {
    const stored = await readJsonFile<Partial<FtpConfig>>(FTP_FILE, {})
    return { ...DEFAULT_FTP_CONFIG, ...stored }
  },

  async saveFtpConfig(config: FtpConfig): Promise<void> {
    await writeJsonFile(FTP_FILE, config)
  }
}
