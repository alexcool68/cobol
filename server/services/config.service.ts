import { randomUUID } from 'node:crypto'
import type { ChainRule, DsnModel, FtpConfig, FtpConfigPublic } from '#shared/types/config'
import { configRepository } from '../infrastructure/repositories/config.repo'
import { zosFtpClient } from '../infrastructure/ftp/zos-ftp.client'

export interface SaveChainRuleInput {
  id?: string
  copybookId: string
  chainFieldName: string
  codeChaine: string
  typEnrFieldName?: string
  typEnrValue?: string
  redefinesBranchName?: string
  label?: string
}

export interface SaveDsnModelInput {
  id?: string
  name: string
  defaultDsn: string
  description?: string
  copybookId: string
  lreclOverride?: number
  chainRuleIds: string[]
}

export const configService = {
  // --- Chain Rules ---
  async listChains(copybookId?: string): Promise<ChainRule[]> {
    const all = await configRepository.listChains()
    const filtered = copybookId ? all.filter(c => c.copybookId === copybookId) : all
    return filtered.sort((a, b) => {
      const cmp = a.codeChaine.localeCompare(b.codeChaine)
      if (cmp !== 0) return cmp
      return (a.typEnrValue ?? '').localeCompare(b.typEnrValue ?? '')
    })
  },

  async saveChain(input: SaveChainRuleInput): Promise<ChainRule> {
    const all = await configRepository.listChains()
    const now = new Date().toISOString()
    const existingIdx = input.id ? all.findIndex(c => c.id === input.id) : -1
    const existing = existingIdx >= 0 ? all[existingIdx] : undefined

    const rule: ChainRule = {
      id: existing?.id ?? randomUUID().slice(0, 8),
      copybookId: input.copybookId,
      chainFieldName: input.chainFieldName.trim().toUpperCase(),
      codeChaine: input.codeChaine.trim().toUpperCase(),
      typEnrFieldName: input.typEnrFieldName?.trim().toUpperCase() || undefined,
      typEnrValue: input.typEnrValue?.trim() || undefined,
      redefinesBranchName: input.redefinesBranchName?.trim().toUpperCase() || undefined,
      label: input.label?.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }

    if (existingIdx >= 0) {
      all[existingIdx] = rule
    } else {
      all.push(rule)
    }

    await configRepository.saveChains(all)
    return rule
  },

  async deleteChain(id: string): Promise<boolean> {
    const all = await configRepository.listChains()
    const next = all.filter(c => c.id !== id)
    if (next.length === all.length) return false
    await configRepository.saveChains(next)
    return true
  },

  // --- DSN Models ---
  async listModels(): Promise<DsnModel[]> {
    const all = await configRepository.listModels()
    return all.sort((a, b) => a.name.localeCompare(b.name))
  },

  async saveModel(input: SaveDsnModelInput): Promise<DsnModel> {
    const all = await configRepository.listModels()
    const now = new Date().toISOString()
    const existingIdx = input.id ? all.findIndex(m => m.id === input.id) : -1
    const existing = existingIdx >= 0 ? all[existingIdx] : undefined

    const model: DsnModel = {
      id: existing?.id ?? randomUUID().slice(0, 8),
      name: input.name.trim(),
      defaultDsn: input.defaultDsn.trim().toUpperCase(),
      description: input.description?.trim() || undefined,
      copybookId: input.copybookId,
      lreclOverride: input.lreclOverride && input.lreclOverride > 0 ? input.lreclOverride : undefined,
      chainRuleIds: input.chainRuleIds,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }

    if (existingIdx >= 0) {
      all[existingIdx] = model
    } else {
      all.push(model)
    }

    await configRepository.saveModels(all)
    return model
  },

  async deleteModel(id: string): Promise<boolean> {
    const all = await configRepository.listModels()
    const next = all.filter(m => m.id !== id)
    if (next.length === all.length) return false
    await configRepository.saveModels(next)
    return true
  },

  // --- FTP Config ---
  async getFtpConfigPublic(): Promise<FtpConfigPublic> {
    const cfg = await configRepository.getFtpConfig()
    const { password, ...rest } = cfg
    return {
      ...rest,
      hasPassword: Boolean(password)
    }
  },

  async updateFtpConfig(input: Partial<FtpConfig>): Promise<FtpConfigPublic> {
    const current = await configRepository.getFtpConfig()
    const next: FtpConfig = {
      host: input.host !== undefined ? input.host.trim() : current.host,
      port: input.port !== undefined ? input.port : current.port,
      user: input.user !== undefined ? input.user.trim() : current.user,
      // Keep existing password if empty/undefined was sent
      password: input.password !== undefined && input.password !== ''
        ? input.password
        : current.password,
      quoteDsn: input.quoteDsn !== undefined ? input.quoteDsn : current.quoteDsn,
      timeoutMs: input.timeoutMs !== undefined ? input.timeoutMs : current.timeoutMs
    }
    await configRepository.saveFtpConfig(next)
    const { password, ...rest } = next
    return {
      ...rest,
      hasPassword: Boolean(password)
    }
  },

  async testFtpConnection(override?: Partial<FtpConfig>) {
    const current = await configRepository.getFtpConfig()
    const merged: FtpConfig = {
      ...current,
      ...override,
      password: override?.password ? override.password : current.password
    }
    return zosFtpClient.testConnection(merged)
  }
}
