import { z } from 'zod'
import { incidentService, type ConvertFileRequest } from '../../services/incident.service'

const itemSchema = z.object({
  modelId: z.string().min(1),
  dsn: z.string().min(1),
  fileField: z.string().optional()
})

const itemsArraySchema = z.array(itemSchema).min(1, 'Veuillez sélectionner au moins un fichier DSN.')

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Requête multipart invalide.' })
  }

  let incidentNumber = ''
  let rawItemsJson = ''
  const fileBuffers = new Map<string, Buffer>()

  for (const part of parts) {
    if (!part.name) continue
    if (part.name === 'incidentNumber') {
      incidentNumber = part.data.toString('utf-8').trim()
    } else if (part.name === 'items') {
      rawItemsJson = part.data.toString('utf-8')
    } else if (part.filename) {
      fileBuffers.set(part.name, part.data)
    }
  }

  if (!incidentNumber) {
    throw createError({ statusCode: 400, statusMessage: 'Le numéro d\'incident est requis.' })
  }

  let parsedItems: z.infer<typeof itemsArraySchema>
  try {
    const json = JSON.parse(rawItemsJson)
    const validated = itemsArraySchema.safeParse(json)
    if (!validated.success) {
      throw createError({
        statusCode: 400,
        statusMessage: validated.error.issues[0]?.message ?? 'Liste de fichiers invalide.'
      })
    }
    parsedItems = validated.data
  } catch (err: unknown) {
    if ((err as { statusCode?: number })?.statusCode) throw err
    throw createError({ statusCode: 400, statusMessage: 'Format de la liste de fichiers invalide.' })
  }

  const convertItems: ConvertFileRequest[] = parsedItems.map(item => ({
    modelId: item.modelId,
    dsn: item.dsn,
    localBuffer: item.fileField ? fileBuffers.get(item.fileField) : undefined
  }))

  return incidentService.runConversion({
    incidentNumber,
    items: convertItems
  })
})
