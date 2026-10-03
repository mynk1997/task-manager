import { boolean, index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const taskStatus = pgEnum('task_status', ['pending', 'completed'])
export const tokenPurpose = pgEnum('token_purpose', ['email_verification', 'password_reset'])

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [index('sessions_user_id_idx').on(table.userId)])

export const accountTokens = pgTable('account_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  purpose: tokenPurpose('purpose').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [index('account_tokens_lookup_idx').on(table.tokenHash, table.purpose)])

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true, mode: 'date' }).notNull(),
  hasScheduledTime: boolean('has_scheduled_time').notNull().default(false),
  status: taskStatus('status').notNull().default('pending'),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [index('tasks_user_scheduled_at_idx').on(table.userId, table.scheduledAt)])
