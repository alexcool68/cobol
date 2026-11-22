import { incidentService } from '../../services/incident.service'

export default defineEventHandler(async () => {
  return incidentService.list()
})
