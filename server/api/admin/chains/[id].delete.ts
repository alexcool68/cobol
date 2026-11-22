import { configService } from '../../../services/config.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const deleted = await configService.deleteChain(id)
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Règle introuvable' })
  }
  return { deleted: true }
})
