import { and, eq, gt } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db/client.js'
import { accountTokens, sessions, users } from '../db/schema.js'
import { createAccountToken } from '../lib/account-tokens.js'
import { sendPasswordResetEmail, sendVerificationEmail } from '../lib/email.js'
import { AppError } from '../lib/errors.js'
import { hashPassword, verifyPassword } from '../lib/passwords.js'
import { clearSessionCookie, createSession, destroySession, readSessionCookie, setSessionCookie } from '../lib/sessions.js'
import { hashToken } from '../lib/tokens.js'
import { requireAuthentication } from '../middleware/authentication.js'
import { config } from '../config.js'

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(12).max(128),
})
const loginSchema = registerSchema
const tokenSchema = z.object({ token: z.string().min(32).max(512) })
const emailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(320) })
const resetPasswordSchema = tokenSchema.extend({ password: z.string().min(12).max(128) })

const publicUser = (user: typeof users.$inferSelect) => ({
  id: user.id,
  email: user.email,
  emailVerified: user.emailVerifiedAt !== null,
  createdAt: user.createdAt,
})

export const authRouter = Router()

authRouter.post('/register', async (request, response, next) => {
  try {
    const input = registerSchema.parse(request.body)
    const [user] = await db.insert(users).values({
      email: input.email,
      passwordHash: await hashPassword(input.password),
    }).returning()
    if (!user) throw new Error('User could not be created.')

    const verificationToken = await createAccountToken(user.id, 'email_verification')
    await sendVerificationEmail(user.email, verificationToken)

    response.status(201).json({
      user: publicUser(user),
      message: 'Account created. Verify your email to sign in.',
      ...(config.nodeEnv === 'development' ? { developmentVerificationToken: verificationToken } : {}),
    })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/verification-email/resend', async (request, response, next) => {
  try {
    const { email } = emailSchema.parse(request.body)
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (user && !user.emailVerifiedAt) {
      const token = await createAccountToken(user.id, 'email_verification')
      await sendVerificationEmail(user.email, token)
    }
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

authRouter.post('/verify-email', async (request, response, next) => {
  try {
    const { token } = tokenSchema.parse(request.body)
    const [record] = await db.select().from(accountTokens)
      .where(and(
        eq(accountTokens.tokenHash, hashToken(token)),
        eq(accountTokens.purpose, 'email_verification'),
        gt(accountTokens.expiresAt, new Date()),
      ))
      .limit(1)
    if (!record) throw new AppError(400, 'INVALID_TOKEN', 'The verification token is invalid or expired.')

    const [user] = await db.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, record.userId)).returning()
    await db.delete(accountTokens).where(eq(accountTokens.id, record.id))
    if (!user) throw new AppError(400, 'INVALID_TOKEN', 'The verification token is invalid or expired.')

    const { token: sessionToken } = await createSession(user.id)
    setSessionCookie(response, sessionToken)
    response.json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/login', async (request, response, next) => {
  try {
    const input = loginSchema.parse(request.body)
    const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1)
    const validPassword = user ? await verifyPassword(user.passwordHash, input.password) : false
    if (!user || !validPassword) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.')
    if (!user.emailVerifiedAt) throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before signing in.')

    const { token } = await createSession(user.id)
    setSessionCookie(response, token)
    response.json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/logout', async (request, response, next) => {
  try {
    await destroySession(readSessionCookie(request.cookies))
    clearSessionCookie(response)
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

authRouter.post('/password-reset/request', async (request, response, next) => {
  try {
    const { email } = emailSchema.parse(request.body)
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (user) {
      const token = await createAccountToken(user.id, 'password_reset')
      await sendPasswordResetEmail(user.email, token)
    }
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

authRouter.post('/password-reset/confirm', async (request, response, next) => {
  try {
    const { token, password } = resetPasswordSchema.parse(request.body)
    const [record] = await db.select().from(accountTokens)
      .where(and(
        eq(accountTokens.tokenHash, hashToken(token)),
        eq(accountTokens.purpose, 'password_reset'),
        gt(accountTokens.expiresAt, new Date()),
      ))
      .limit(1)
    if (!record) throw new AppError(400, 'INVALID_TOKEN', 'The reset token is invalid or expired.')

    const [user] = await db.update(users).set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
      .where(eq(users.id, record.userId)).returning()
    await db.delete(accountTokens).where(eq(accountTokens.userId, record.userId))
    await db.delete(sessions).where(eq(sessions.userId, record.userId))
    if (!user) throw new AppError(400, 'INVALID_TOKEN', 'The reset token is invalid or expired.')

    const { token: sessionToken } = await createSession(user.id)
    setSessionCookie(response, sessionToken)
    response.json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

authRouter.get('/me', requireAuthentication, (request, response) => {
  response.json({ user: publicUser(request.auth!.user) })
})
