import { incidentService } from '../../../services/incident.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const deleted = await incidentService.remove(id)
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Incident introuvable' })
  }
  return { deleted: true }
})
