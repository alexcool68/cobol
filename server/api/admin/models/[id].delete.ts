import { configService } from '../../../services/config.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const deleted = await configService.deleteModel(id)
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Modèle DSN introuvable' })
  }
  return { deleted: true }
})
