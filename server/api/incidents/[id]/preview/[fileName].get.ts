import { incidentService } from '../../../../services/incident.service'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const fileName = decodeURIComponent(getRouterParam(event, 'fileName')!)
  return incidentService.getPreviewRows(id, fileName)
})
