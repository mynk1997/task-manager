import { and, eq, gt } from 'drizzle-orm'
import type { NextFunction, Request, Response } from 'express'
import { db } from '../db/client.js'
import { sessions, users } from '../db/schema.js'
import { AppError } from '../lib/errors.js'
import { hashToken } from '../lib/tokens.js'
import { readSessionCookie } from '../lib/sessions.js'

export async function requireAuthentication(request: Request, _response: Response, next: NextFunction) {
  try {
    const token = readSessionCookie(request.cookies)
    if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.')

    const [record] = await db.select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
      .limit(1)

    if (!record) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.')
    request.auth = { user: record.user, sessionId: record.session.id }
    next()
  } catch (error) {
    next(error)
  }
}
