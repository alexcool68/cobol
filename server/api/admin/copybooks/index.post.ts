import { z } from 'zod'
import { copybookService } from '../../../services/copybook.service'

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  rawContent: z.string().min(1, 'Contenu du copybook requis')
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Données invalides' })
  }

  try {
    return await copybookService.save(parsed.data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur lors du parsing du copybook'
    throw createError({ statusCode: 422, statusMessage: msg })
  }
})
