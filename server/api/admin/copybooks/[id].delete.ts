import { copybookService } from '../../../services/copybook.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const removed = await copybookService.remove(id)
  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: 'Copybook introuvable' })
  }
  return { deleted: true }
})
