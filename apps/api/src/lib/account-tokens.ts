import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { accountTokens } from '../db/schema.js'
import { createOpaqueToken, hashToken } from './tokens.js'

type AccountTokenPurpose = 'email_verification' | 'password_reset'

export async function createAccountToken(userId: string, purpose: AccountTokenPurpose) {
  const token = createOpaqueToken()
  await db.delete(accountTokens).where(and(eq(accountTokens.userId, userId), eq(accountTokens.purpose, purpose)))
  await db.insert(accountTokens).values({
    userId,
    tokenHash: hashToken(token),
    purpose,
    expiresAt: new Date(Date.now() + (purpose === 'email_verification' ? 24 : 1) * 60 * 60 * 1000),
  })
  return token
}
