import { copybookService } from '../../../services/copybook.service'

export default defineEventHandler(async () => {
  return copybookService.list()
})
