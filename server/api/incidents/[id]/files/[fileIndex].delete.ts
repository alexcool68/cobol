import { incidentService } from '../../../../services/incident.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const fileIndex = Number.parseInt(getRouterParam(event, 'fileIndex') ?? '', 10)

  if (Number.isNaN(fileIndex) || fileIndex < 0) {
    throw createError({ statusCode: 400, statusMessage: 'Index de fichier invalide' })
  }

  const updated = await incidentService.deleteFile(id, fileIndex)
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Incident ou fichier introuvable' })
  }
  return updated
})
