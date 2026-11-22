import { incidentService } from '../../../services/incident.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const detail = await incidentService.getById(id)
  if (!detail) {
    throw createError({ statusCode: 404, statusMessage: 'Incident introuvable' })
  }
  return detail
})
