import { incidentService } from '../../../services/incident.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const zip = await incidentService.buildIncidentZip(id)
  if (!zip) {
    throw createError({ statusCode: 404, statusMessage: 'Aucun fichier CSV disponible pour cet incident' })
  }

  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', `attachment; filename="${zip.fileName}"`)
  return zip.buffer
})
