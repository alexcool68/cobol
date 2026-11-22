import { copybookService } from '../../../services/copybook.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const detail = await copybookService.getById(id)
  if (!detail) {
    throw createError({ statusCode: 404, statusMessage: 'Copybook introuvable' })
  }
  return detail
})
