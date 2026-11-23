import { readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { IncidentDetail, IncidentSummary } from '#shared/types/incident'
import type { DecodedRecord } from '../../domain/cobol/decoder'
import { ensureDir, INCIDENTS_DIR, readJsonFile, writeJsonFile } from '../storage/paths'

const INDEX_FILE = join(INCIDENTS_DIR, 'index.json')

function getIncidentDir(id: string): string {
  return join(INCIDENTS_DIR, basename(id))
}

function getCsvDir(id: string): string {
  return join(getIncidentDir(id), 'csv')
}

function getPreviewDir(id: string): string {
  return join(getIncidentDir(id), 'preview')
}

export interface IncidentCsvOutput {
  fileName: string
  csvContent: string
  previewRows: DecodedRecord[]
}

export const incidentRepository = {
  async list(): Promise<IncidentSummary[]> {
    const items = await readJsonFile<IncidentSummary[]>(INDEX_FILE, [])
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async getById(id: string): Promise<IncidentDetail | null> {
    const metaPath = join(getIncidentDir(id), 'meta.json')
    return readJsonFile<IncidentDetail | null>(metaPath, null)
  },

  async saveIncident(detail: IncidentDetail, csvOutputs: IncidentCsvOutput[]): Promise<IncidentDetail> {
    const incDir = getIncidentDir(detail.id)
    const csvDir = getCsvDir(detail.id)
    const previewDir = getPreviewDir(detail.id)

    await Promise.all([
      ensureDir(incDir),
      ensureDir(csvDir),
      ensureDir(previewDir)
    ])

    // Write CSV files and preview JSONs
    await Promise.all(
      csvOutputs.map(async (out) => {
        const safeName = basename(out.fileName)
        await Promise.all([
          writeFile(join(csvDir, safeName), out.csvContent, 'utf-8'),
          writeJsonFile(join(previewDir, `${safeName}.json`), out.previewRows)
        ])
      })
    )

    // Write meta.json
    await writeJsonFile(join(incDir, 'meta.json'), detail)

    // Update index.json
    const { files: _files, ...summary } = detail
    const items = await this.list()
    const idx = items.findIndex(i => i.id === detail.id)
    if (idx >= 0) {
      items[idx] = summary
    } else {
      items.unshift(summary)
    }
    await writeJsonFile(INDEX_FILE, items)

    return detail
  },

  async getCsvFile(incidentId: string, fileName: string): Promise<Buffer | null> {
    try {
      const safeName = basename(fileName)
      return await readFile(join(getCsvDir(incidentId), safeName))
    } catch {
      return null
    }
  },

  async getPreviewRows(incidentId: string, fileName: string): Promise<DecodedRecord[]> {
    const safeName = basename(fileName)
    return readJsonFile<DecodedRecord[]>(join(getPreviewDir(incidentId), `${safeName}.json`), [])
  },

  async removeCsvFiles(incidentId: string, fileNames: string[]): Promise<void> {
    await Promise.allSettled(
      fileNames.flatMap((fileName) => {
        const safeName = basename(fileName)
        return [
          rm(join(getCsvDir(incidentId), safeName), { force: true }),
          rm(join(getPreviewDir(incidentId), `${safeName}.json`), { force: true })
        ]
      })
    )
  },

  async remove(id: string): Promise<boolean> {
    const items = await this.list()
    const next = items.filter(i => i.id !== id)
    if (next.length === items.length) return false

    await writeJsonFile(INDEX_FILE, next)
    await rm(getIncidentDir(id), { recursive: true, force: true })
    return true
  }
}
