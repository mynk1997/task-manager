import type { Response } from 'express'
import { eq } from 'drizzle-orm'
import { config } from '../config.js'
import { db } from '../db/client.js'
import { sessions } from '../db/schema.js'
import { createOpaqueToken, hashToken } from './tokens.js'

const cookieName = config.isProduction ? '__Host-task-manager-session' : 'task_manager_session'

export async function createSession(userId: string) {
  const token = createOpaqueToken()
  const expiresAt = new Date(Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000)
  const [session] = await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  }).returning()

  if (!session) throw new Error('Session could not be created.')
  return { session, token }
}

export function setSessionCookie(response: Response, token: string) {
  response.cookie(cookieName, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: config.sessionTtlDays * 24 * 60 * 60 * 1000,
  })
}

export async function destroySession(token: string | undefined) {
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)))
}

export function clearSessionCookie(response: Response) {
  response.clearCookie(cookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
  })
}

export function readSessionCookie(cookies: Record<string, string | undefined>) {
  return cookies[cookieName]
}
