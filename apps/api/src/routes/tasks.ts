import { taskInputSchema, taskUpdateSchema } from '@task-manager/api-contract'
import { and, asc, eq, gte, lt } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db/client.js'
import { tasks } from '../db/schema.js'
import { AppError } from '../lib/errors.js'
import { localDayRange, toUtcTaskAnchor } from '../lib/time.js'
import { requireAuthentication } from '../middleware/authentication.js'

const dayQuerySchema = z.object({
  date: z.iso.date(),
  timeZone: z.string().min(1).max(100),
})

export const tasksRouter = Router()
tasksRouter.use(requireAuthentication)

tasksRouter.get('/', async (request, response, next) => {
  try {
    const { date, timeZone } = dayQuerySchema.parse(request.query)
    const range = localDayRange(date, timeZone)
    const records = await db.select().from(tasks).where(and(
      eq(tasks.userId, request.auth!.user.id),
      gte(tasks.scheduledAt, range.start),
      lt(tasks.scheduledAt, range.end),
    )).orderBy(asc(tasks.scheduledAt), asc(tasks.createdAt))
    response.json({ tasks: records })
  } catch (error) {
    next(error)
  }
})

tasksRouter.post('/', async (request, response, next) => {
  try {
    const input = taskInputSchema.parse(request.body)
    const [task] = await db.insert(tasks).values({
      userId: request.auth!.user.id,
      title: input.title,
      description: input.description || null,
      scheduledAt: toUtcTaskAnchor(input.scheduledDate, input.scheduledTime, input.timeZone),
      hasScheduledTime: Boolean(input.scheduledTime),
    }).returning()
    response.status(201).json({ task })
  } catch (error) {
    next(error)
  }
})

tasksRouter.get('/:id', async (request, response, next) => {
  try {
    const [task] = await db.select().from(tasks).where(and(eq(tasks.id, request.params.id), eq(tasks.userId, request.auth!.user.id))).limit(1)
    if (!task) throw new AppError(404, 'NOT_FOUND', 'Task not found.')
    response.json({ task })
  } catch (error) {
    next(error)
  }
})

tasksRouter.patch('/:id', async (request, response, next) => {
  try {
    const input = taskUpdateSchema.parse(request.body)
    const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, request.params.id), eq(tasks.userId, request.auth!.user.id))).limit(1)
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Task not found.')

    const changesSchedule = input.scheduledDate !== undefined || input.scheduledTime !== undefined || input.timeZone !== undefined
    if (changesSchedule && (!input.scheduledDate || !input.timeZone)) {
      throw new AppError(422, 'VALIDATION_ERROR', 'scheduledDate and timeZone are required when changing a schedule.')
    }

    const update = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.status !== undefined ? {
        status: input.status,
        completedAt: input.status === 'completed' ? new Date() : null,
      } : {}),
      ...(changesSchedule ? {
        scheduledAt: toUtcTaskAnchor(input.scheduledDate!, input.scheduledTime, input.timeZone!),
        hasScheduledTime: Boolean(input.scheduledTime),
      } : {}),
      updatedAt: new Date(),
    }
    const [task] = await db.update(tasks).set(update).where(eq(tasks.id, existing.id)).returning()
    response.json({ task })
  } catch (error) {
    next(error)
  }
})

tasksRouter.delete('/:id', async (request, response, next) => {
  try {
    const [task] = await db.delete(tasks).where(and(eq(tasks.id, request.params.id), eq(tasks.userId, request.auth!.user.id))).returning()
    if (!task) throw new AppError(404, 'NOT_FOUND', 'Task not found.')
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})
