import { configService } from '../../../services/config.service'

export default defineEventHandler(async () => {
  return configService.listModels()
})
