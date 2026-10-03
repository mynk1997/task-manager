import { z } from 'zod'

const configurationSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: z.string().url().default('postgres://task_manager:task_manager@localhost:5432/task_manager'),
  APP_ORIGIN: z.string().url().default('http://localhost:5173'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  EMAIL_FROM: z.string().min(3).default('Task Manager <no-reply@example.com>'),
  SMTP_URL: z.string().url().optional(),
})

const parsed = configurationSchema.parse(process.env)

export const config = {
  nodeEnv: parsed.NODE_ENV,
  port: parsed.PORT,
  databaseUrl: parsed.DATABASE_URL,
  appOrigin: parsed.APP_ORIGIN,
  sessionTtlDays: parsed.SESSION_TTL_DAYS,
  emailFrom: parsed.EMAIL_FROM,
  smtpUrl: parsed.SMTP_URL,
  isProduction: parsed.NODE_ENV === 'production',
}
