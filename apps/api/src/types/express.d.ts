import type { users } from '../db/schema.js'

declare global {
  namespace Express {
    interface Request {
      auth?: {
        user: typeof users.$inferSelect
        sessionId: string
      }
    }
  }
}

export {}
