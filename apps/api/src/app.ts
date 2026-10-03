import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { config } from './config.js'
import { errorHandler, notFound } from './middleware/errors.js'
import { requireTrustedOrigin } from './middleware/csrf.js'
import { authRouter } from './routes/auth.js'
import { tasksRouter } from './routes/tasks.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({ origin: config.appOrigin, credentials: true }))
  app.use(express.json({ limit: '32kb' }))
  app.use(cookieParser())
  app.use(requireTrustedOrigin)

  app.get('/health', (_request, response) => response.json({ status: 'ok' }))
  app.use('/api/v1/auth', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.isProduction ? 20 : 1000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
  }), authRouter)
  app.use('/api/v1/tasks', tasksRouter)
  app.use(notFound)
  app.use(errorHandler)
  return app
}
