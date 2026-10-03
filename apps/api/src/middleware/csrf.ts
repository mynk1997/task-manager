import type { RequestHandler } from 'express'
import { config } from '../config.js'
import { AppError } from '../lib/errors.js'

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

export const requireTrustedOrigin: RequestHandler = (request, _response, next) => {
  if (safeMethods.has(request.method)) return next()
  if (request.get('origin') !== config.appOrigin) {
    return next(new AppError(403, 'UNTRUSTED_ORIGIN', 'This request origin is not allowed.'))
  }
  next()
}
