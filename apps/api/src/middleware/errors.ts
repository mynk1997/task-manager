import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { config } from '../config.js'
import { AppError } from '../lib/errors.js'

export const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } })
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  void next
  if (error instanceof ZodError) {
    const fields = Object.fromEntries(error.issues.map((issue) => [issue.path.join('.') || 'body', issue.message]))
    response.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'The request contains invalid fields.', fields } })
    return
  }

  if (error instanceof AppError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message, fields: error.fields } })
    return
  }

  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
    response.status(409).json({ error: { code: 'CONFLICT', message: 'A resource with those details already exists.' } })
    return
  }

  if (!config.isProduction) console.error(error)
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } })
}
