import { incidentService } from '../../../../services/incident.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const fileName = decodeURIComponent(getRouterParam(event, 'fileName')!)

  const buffer = await incidentService.getCsvFile(id, fileName)
  if (!buffer) {
    throw createError({ statusCode: 404, statusMessage: 'Fichier CSV introuvable' })
  }

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="${fileName}"`)
  return buffer
})
