import { randomUUID } from 'node:crypto'
import type { ChainRule, DsnModel, FtpConfig } from '#shared/types/config'
import type { ChainGroupSummary, IncidentDetail, IncidentFileResult, IncidentSummary } from '#shared/types/incident'
import { decodeBinaryFile } from '../domain/cobol/decoder'
import { formatCsvExcelFr } from '../domain/csv/formatter'
import { zosFtpClient } from '../infrastructure/ftp/zos-ftp.client'
import { configRepository } from '../infrastructure/repositories/config.repo'
import { copybookRepository } from '../infrastructure/repositories/copybook.repo'
import { incidentRepository, type IncidentCsvOutput } from '../infrastructure/repositories/incident.repo'
import { buildZipArchive } from '../infrastructure/zip/archive.builder'

const MAX_PREVIEW_ROWS = 200

export interface ConvertFileRequest {
  modelId: string
  dsn: string
  localBuffer?: Buffer
}

export interface ConvertIncidentInput {
  incidentNumber: string
  existingIncidentId?: string
  items: ConvertFileRequest[]
}

function sanitizeFileSegment(raw: string): string {
  return raw
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'FICHIER'
}

function computeIncidentStats(files: IncidentFileResult[]): {
  filesCount: number
  totalRecords: number
  totalCsvFiles: number
  status: IncidentDetail['status']
} {
  let successCount = 0
  let errorCount = 0
  let totalRecords = 0
  let totalCsvFiles = 0

  for (const file of files) {
    if (file.status === 'success') {
      successCount++
      totalRecords += file.totalRecords
      totalCsvFiles += file.groups.length
    } else {
      errorCount++
    }
  }

  const status: IncidentDetail['status'] = files.length === 0
    ? 'completed'
    : errorCount === 0
      ? 'completed'
      : successCount > 0
        ? 'partial'
        : 'failed'

  return {
    filesCount: files.length,
    totalRecords,
    totalCsvFiles,
    status
  }
}

async function processSingleItem(
  item: ConvertFileRequest,
  context: {
    modelMap: Map<string, DsnModel>
    allChains: ChainRule[]
    ftpConfig: FtpConfig
    usedCsvNames: Set<string>
  }
): Promise<{ fileResult: IncidentFileResult; csvOutputs: IncidentCsvOutput[] }> {
  const { modelMap, allChains, ftpConfig, usedCsvNames } = context
  const model = modelMap.get(item.modelId)

  if (!model) {
    return {
      fileResult: {
        modelId: item.modelId,
        modelName: item.modelId,
        dsnUsed: item.dsn,
        source: item.localBuffer ? 'local' : 'ftp',
        copybookId: '',
        copybookName: '',
        lrecl: 0,
        fileSizeBytes: 0,
        totalRecords: 0,
        status: 'error',
        errorMessage: 'Modèle DSN introuvable.',
        groups: []
      },
      csvOutputs: []
    }
  }

  const copybook = await copybookRepository.getById(model.copybookId)
  if (!copybook) {
    return {
      fileResult: {
        modelId: model.id,
        modelName: model.name,
        dsnUsed: item.dsn,
        source: item.localBuffer ? 'local' : 'ftp',
        copybookId: model.copybookId,
        copybookName: 'Introuvable',
        lrecl: 0,
        fileSizeBytes: 0,
        totalRecords: 0,
        status: 'error',
        errorMessage: 'Copybook associé introuvable.',
        groups: []
      },
      csvOutputs: []
    }
  }

  const effectiveRules = model.chainRuleIds.length > 0
    ? allChains.filter(c => model.chainRuleIds.includes(c.id))
    : allChains.filter(c => c.copybookId === copybook.id)

  try {
    const rawBuffer = item.localBuffer
      ? item.localBuffer
      : await zosFtpClient.downloadDatasetBinary(ftpConfig, item.dsn)

    const decoded = decodeBinaryFile(rawBuffer, copybook.parsed, effectiveRules, {
      lreclOverride: model.lreclOverride
    })

    const basePrefix = sanitizeFileSegment(item.dsn || model.name)
    const groupSummaries: ChainGroupSummary[] = []
    const csvOutputs: IncidentCsvOutput[] = []

    for (const group of decoded.groups) {
      let csvFileName = `${basePrefix}_${sanitizeFileSegment(group.key)}.csv`
      let suffix = 2
      while (usedCsvNames.has(csvFileName)) {
        csvFileName = `${basePrefix}_${sanitizeFileSegment(group.key)}_${suffix}.csv`
        suffix++
      }
      usedCsvNames.add(csvFileName)

      const csvContent = formatCsvExcelFr(group.columns, group.rows)
      csvOutputs.push({
        fileName: csvFileName,
        csvContent,
        previewRows: group.rows.slice(0, MAX_PREVIEW_ROWS)
      })

      groupSummaries.push({
        key: group.key,
        codeChaine: group.codeChaine,
        typEnr: group.typEnr,
        label: group.label,
        redefinesBranchName: group.redefinesBranchName,
        recordCount: group.rows.length,
        isRejected: group.isRejected,
        csvFileName,
        columns: group.columns
      })
    }

    return {
      fileResult: {
        modelId: model.id,
        modelName: model.name,
        dsnUsed: item.dsn,
        source: item.localBuffer ? 'local' : 'ftp',
        copybookId: copybook.id,
        copybookName: copybook.name,
        lrecl: decoded.lrecl,
        lreclAutoDetected: decoded.lreclAutoDetected,
        fileSizeBytes: rawBuffer.length,
        totalRecords: decoded.totalRecords,
        status: 'success',
        groups: groupSummaries
      },
      csvOutputs
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      fileResult: {
        modelId: model.id,
        modelName: model.name,
        dsnUsed: item.dsn,
        source: item.localBuffer ? 'local' : 'ftp',
        copybookId: copybook.id,
        copybookName: copybook.name,
        lrecl: model.lreclOverride ?? copybook.lrecl,
        fileSizeBytes: 0,
        totalRecords: 0,
        status: 'error',
        errorMessage: msg,
        groups: []
      },
      csvOutputs: []
    }
  }
}

export const incidentService = {
  async list(): Promise<IncidentSummary[]> {
    return incidentRepository.list()
  },

  async getById(id: string): Promise<IncidentDetail | null> {
    return incidentRepository.getById(id)
  },

  async remove(id: string): Promise<boolean> {
    return incidentRepository.remove(id)
  },

  async getCsvFile(incidentId: string, fileName: string): Promise<Buffer | null> {
    return incidentRepository.getCsvFile(incidentId, fileName)
  },

  async getPreviewRows(incidentId: string, fileName: string) {
    return incidentRepository.getPreviewRows(incidentId, fileName)
  },

  async buildIncidentZip(incidentId: string): Promise<{ fileName: string; buffer: Buffer } | null> {
    const incident = await incidentRepository.getById(incidentId)
    if (!incident) return null

    const entries: Array<{ fileName: string; content: Buffer }> = []
    for (const file of incident.files) {
      for (const group of file.groups) {
        const content = await incidentRepository.getCsvFile(incidentId, group.csvFileName)
        if (content) {
          entries.push({ fileName: group.csvFileName, content })
        }
      }
    }

    if (entries.length === 0) return null

    const buffer = await buildZipArchive(entries)
    const safeInc = sanitizeFileSegment(incident.incidentNumber)
    return {
      fileName: `${safeInc}_csv.zip`,
      buffer
    }
  },

  async runConversion(input: ConvertIncidentInput): Promise<IncidentDetail> {
    const [models, allChains, ftpConfig, existingIncident] = await Promise.all([
      configRepository.listModels(),
      configRepository.listChains(),
      configRepository.getFtpConfig(),
      input.existingIncidentId ? incidentRepository.getById(input.existingIncidentId) : Promise.resolve(null)
    ])

    const modelMap = new Map(models.map(m => [m.id, m]))
    const incidentId = existingIncident?.id ?? `${sanitizeFileSegment(input.incidentNumber)}_${randomUUID().slice(0, 6)}`
    const createdAt = existingIncident?.createdAt ?? new Date().toISOString()

    const fileResults: IncidentFileResult[] = existingIncident ? [...existingIncident.files] : []
    const usedCsvNames = new Set<string>(
      fileResults.flatMap(f => f.groups.map(g => g.csvFileName))
    )
    const newCsvOutputs: IncidentCsvOutput[] = []

    for (const item of input.items) {
      const { fileResult, csvOutputs } = await processSingleItem(item, {
        modelMap,
        allChains,
        ftpConfig,
        usedCsvNames
      })
      fileResults.push(fileResult)
      newCsvOutputs.push(...csvOutputs)
    }

    const stats = computeIncidentStats(fileResults)

    const detail: IncidentDetail = {
      id: incidentId,
      incidentNumber: existingIncident?.incidentNumber ?? input.incidentNumber.trim(),
      createdAt,
      ...stats,
      files: fileResults
    }

    return incidentRepository.saveIncident(detail, newCsvOutputs)
  },

  async deleteFile(incidentId: string, fileIndex: number): Promise<IncidentDetail | null> {
    const incident = await incidentRepository.getById(incidentId)
    if (!incident || fileIndex < 0 || fileIndex >= incident.files.length) {
      return null
    }

    const targetFile = incident.files[fileIndex]!
    const csvsToRemove = targetFile.groups.map(g => g.csvFileName)
    await incidentRepository.removeCsvFiles(incidentId, csvsToRemove)

    const nextFiles = incident.files.filter((_, idx) => idx !== fileIndex)
    const stats = computeIncidentStats(nextFiles)

    const updated: IncidentDetail = {
      ...incident,
      ...stats,
      files: nextFiles
    }

    return incidentRepository.saveIncident(updated, [])
  },

  async rerunFile(
    incidentId: string,
    fileIndex: number,
    options?: { dsn?: string; localBuffer?: Buffer }
  ): Promise<IncidentDetail | null> {
    const incident = await incidentRepository.getById(incidentId)
    if (!incident || fileIndex < 0 || fileIndex >= incident.files.length) {
      return null
    }

    const targetFile = incident.files[fileIndex]!
    const oldCsvNames = targetFile.groups.map(g => g.csvFileName)
    await incidentRepository.removeCsvFiles(incidentId, oldCsvNames)

    const [models, allChains, ftpConfig] = await Promise.all([
      configRepository.listModels(),
      configRepository.listChains(),
      configRepository.getFtpConfig()
    ])

    const usedCsvNames = new Set<string>(
      incident.files
        .filter((_, idx) => idx !== fileIndex)
        .flatMap(f => f.groups.map(g => g.csvFileName))
    )

    const { fileResult, csvOutputs } = await processSingleItem(
      {
        modelId: targetFile.modelId,
        dsn: options?.dsn?.trim() || targetFile.dsnUsed,
        localBuffer: options?.localBuffer
      },
      {
        modelMap: new Map(models.map(m => [m.id, m])),
        allChains,
        ftpConfig,
        usedCsvNames
      }
    )

    const nextFiles = [...incident.files]
    nextFiles[fileIndex] = fileResult
    const stats = computeIncidentStats(nextFiles)

    const updated: IncidentDetail = {
      ...incident,
      ...stats,
      files: nextFiles
    }

    return incidentRepository.saveIncident(updated, csvOutputs)
  }
}
