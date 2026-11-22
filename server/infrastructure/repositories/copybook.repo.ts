import { readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CopybookDetail, CopybookMeta, ParsedCopybook } from '#shared/types/cobol'
import { COPYBOOKS_DIR, ensureDir, readJsonFile, writeJsonFile } from '../storage/paths'

const INDEX_FILE = join(COPYBOOKS_DIR, 'index.json')

function getRawPath(id: string): string {
  return join(COPYBOOKS_DIR, `${id}.cpy`)
}

function getSchemaPath(id: string): string {
  return join(COPYBOOKS_DIR, `${id}.schema.json`)
}

export const copybookRepository = {
  async list(): Promise<CopybookMeta[]> {
    const items = await readJsonFile<CopybookMeta[]>(INDEX_FILE, [])
    return items.sort((a, b) => a.name.localeCompare(b.name))
  },

  async getById(id: string): Promise<CopybookDetail | null> {
    const items = await this.list()
    const meta = items.find(c => c.id === id)
    if (!meta) return null

    try {
      const [rawContent, parsed] = await Promise.all([
        readFile(getRawPath(id), 'utf-8'),
        readJsonFile<ParsedCopybook | null>(getSchemaPath(id), null)
      ])
      if (!parsed) return null
      return { ...meta, rawContent, parsed }
    } catch {
      return null
    }
  },

  async save(detail: CopybookDetail): Promise<CopybookDetail> {
    await ensureDir(COPYBOOKS_DIR)

    const { rawContent, parsed, ...meta } = detail
    await Promise.all([
      writeFile(getRawPath(detail.id), rawContent, 'utf-8'),
      writeJsonFile(getSchemaPath(detail.id), parsed)
    ])

    const items = await this.list()
    const idx = items.findIndex(c => c.id === detail.id)
    if (idx >= 0) {
      items[idx] = meta
    } else {
      items.push(meta)
    }
    await writeJsonFile(INDEX_FILE, items)
    return detail
  },

  async remove(id: string): Promise<boolean> {
    const items = await this.list()
    const next = items.filter(c => c.id !== id)
    if (next.length === items.length) return false

    await writeJsonFile(INDEX_FILE, next)
    await Promise.allSettled([
      unlink(getRawPath(id)),
      unlink(getSchemaPath(id))
    ])
    return true
  }
}
