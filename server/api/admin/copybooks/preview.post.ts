import { z } from 'zod'
import { copybookService } from '../../../services/copybook.service'

const schema = z.object({
  rawContent: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Contenu du copybook requis' })
  }

  try {
    return copybookService.preview(parsed.data.rawContent)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur de syntaxe COBOL'
    throw createError({ statusCode: 422, statusMessage: msg })
  }
})
