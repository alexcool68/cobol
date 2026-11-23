import { z } from 'zod'
import { configService } from '../../../services/config.service'

const schema = z.object({
  copybookId: z.string().min(1, 'Copybook requis'),
  chainFieldName: z.string().min(1, 'Champ Code Chaîne requis'),
  codeChaine: z.string().trim().length(4, 'Le Code Chaîne doit faire exactement 4 caractères'),
  typEnrFieldName: z.string().optional(),
  typEnrValue: z.string().optional(),
  redefinesBranchName: z.string().optional(),
  label: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Données invalides' })
  }
  return configService.saveChain({ ...parsed.data, id })
})
