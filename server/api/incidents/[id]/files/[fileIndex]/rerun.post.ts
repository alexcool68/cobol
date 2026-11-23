import { incidentService } from '../../../../../services/incident.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const fileIndex = Number.parseInt(getRouterParam(event, 'fileIndex') ?? '', 10)

  if (Number.isNaN(fileIndex) || fileIndex < 0) {
    throw createError({ statusCode: 400, statusMessage: 'Index de fichier invalide' })
  }

  const contentType = getHeader(event, 'content-type') ?? ''
  let dsn: string | undefined
  let localBuffer: Buffer | undefined

  if (contentType.includes('multipart/form-data')) {
    const parts = await readMultipartFormData(event)
    for (const part of parts ?? []) {
      if (part.name === 'dsn') {
        dsn = part.data.toString('utf-8').trim() || undefined
      } else if (part.filename) {
        localBuffer = part.data
      }
    }
  } else {
    const body = await readBody<{ dsn?: string }>(event).catch(() => undefined)
    dsn = body?.dsn?.trim() || undefined
  }

  const updated = await incidentService.rerunFile(id, fileIndex, { dsn, localBuffer })
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Incident ou fichier introuvable' })
  }
  return updated
})
