import { z } from 'zod'
import { configService } from '../../../services/config.service'

const schema = z.object({
  name: z.string().min(1, 'Nom du modèle requis'),
  defaultDsn: z.string().min(1, 'DSN par défaut requis'),
  description: z.string().optional(),
  copybookId: z.string().min(1, 'Copybook requis'),
  lreclOverride: z.number().int().positive().optional().nullable(),
  chainRuleIds: z.array(z.string()).default([])
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Données invalides' })
  }
  return configService.saveModel({
    ...parsed.data,
    id,
    lreclOverride: parsed.data.lreclOverride ?? undefined
  })
})
