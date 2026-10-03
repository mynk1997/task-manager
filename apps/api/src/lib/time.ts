import { DateTime } from 'luxon'
import { AppError } from './errors.js'

export function assertTimeZone(timeZone: string) {
  if (!DateTime.now().setZone(timeZone).isValid) {
    throw new AppError(422, 'VALIDATION_ERROR', 'A valid IANA timezone is required.', { timeZone: 'Invalid timezone' })
  }
}

export function toUtcTaskAnchor(date: string, time: string | null | undefined, timeZone: string) {
  assertTimeZone(timeZone)
  const local = DateTime.fromISO(`${date}T${time ?? '12:00'}`, { zone: timeZone })
  if (!local.isValid) {
    throw new AppError(422, 'VALIDATION_ERROR', 'The task date or time is invalid.')
  }
  return local.toUTC().toJSDate()
}

export function localDayRange(date: string, timeZone: string) {
  assertTimeZone(timeZone)
  const start = DateTime.fromISO(date, { zone: timeZone }).startOf('day')
  if (!start.isValid) {
    throw new AppError(422, 'VALIDATION_ERROR', 'The date is invalid.', { date: 'Expected YYYY-MM-DD' })
  }
  return {
    start: start.toUTC().toJSDate(),
    end: start.plus({ days: 1 }).toUTC().toJSDate(),
  }
}
