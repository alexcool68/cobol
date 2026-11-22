import { randomUUID } from 'node:crypto'
import type { CopybookDetail, CopybookMeta, ParsedCopybook } from '#shared/types/cobol'
import { parseCopybook } from '../domain/cobol/parser'
import { copybookRepository } from '../infrastructure/repositories/copybook.repo'

export interface SaveCopybookInput {
  id?: string
  name: string
  description?: string
  rawContent: string
}

export const copybookService = {
  preview(rawContent: string): ParsedCopybook {
    return parseCopybook(rawContent)
  },

  async list(): Promise<CopybookMeta[]> {
    return copybookRepository.list()
  },

  async getById(id: string): Promise<CopybookDetail | null> {
    return copybookRepository.getById(id)
  },

  async save(input: SaveCopybookInput): Promise<CopybookDetail> {
    const parsed = parseCopybook(input.rawContent)
    const now = new Date().toISOString()

    const existing = input.id ? await copybookRepository.getById(input.id) : null
    const id = existing?.id ?? randomUUID().slice(0, 8)

    const detail: CopybookDetail = {
      id,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      lrecl: parsed.lrecl,
      redefinesCount: parsed.redefinesBranches.length,
      commonFieldsCount: parsed.commonFields.length,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      rawContent: input.rawContent,
      parsed
    }

    return copybookRepository.save(detail)
  },

  async remove(id: string): Promise<boolean> {
    return copybookRepository.remove(id)
  }
}
