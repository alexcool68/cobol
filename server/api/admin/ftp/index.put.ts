import { z } from 'zod'
import { configService } from '../../../services/config.service'

const schema = z.object({
  host: z.string().trim(),
  port: z.coerce.number().int().min(1).max(65535).default(21),
  user: z.string().trim(),
  password: z.string().optional(),
  quoteDsn: z.boolean().default(true),
  timeoutMs: z.coerce.number().int().min(1000).max(120000).default(15000)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Données invalides' })
  }
  return configService.updateFtpConfig(parsed.data)
})
