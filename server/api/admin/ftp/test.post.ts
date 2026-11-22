import { z } from 'zod'
import { configService } from '../../../services/config.service'

const schema = z.object({
  host: z.string().trim().optional(),
  port: z.coerce.number().int().optional(),
  user: z.string().trim().optional(),
  password: z.string().optional(),
  quoteDsn: z.boolean().optional(),
  timeoutMs: z.coerce.number().int().optional()
}).optional()

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => undefined)
  const parsed = schema.safeParse(body)
  return configService.testFtpConnection(parsed.success ? parsed.data : undefined)
})
