import { configService } from '../../../services/config.service'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const copybookId = typeof query.copybookId === 'string' ? query.copybookId : undefined
  return configService.listChains(copybookId)
})
