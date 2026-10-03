import { z } from 'zod'

export const taskStatusSchema = z.enum(['pending', 'completed'])

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2_000).optional().nullable(),
  scheduledDate: z.iso.date(),
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm').optional().nullable(),
  timeZone: z.string().min(1).max(100),
})

export const taskUpdateSchema = taskInputSchema.partial().extend({
  status: taskStatusSchema.optional(),
})

export type TaskInput = z.infer<typeof taskInputSchema>
export type TaskUpdate = z.infer<typeof taskUpdateSchema>
