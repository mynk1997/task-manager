import nodemailer from 'nodemailer'
import { config } from '../config.js'
import { AppError } from './errors.js'

function actionUrl(path: string, token: string) {
  const url = new URL(path, config.appOrigin)
  url.searchParams.set('token', token)
  return url.toString()
}

async function send(to: string, subject: string, text: string) {
  if (!config.smtpUrl) {
    if (config.isProduction) {
      throw new AppError(503, 'EMAIL_UNAVAILABLE', 'Email delivery is not configured.')
    }
    console.info(`[development email] To: ${to}\nSubject: ${subject}\n${text}`)
    return
  }
  const transporter = nodemailer.createTransport(config.smtpUrl)
  await transporter.sendMail({ from: config.emailFrom, to, subject, text })
}

export function sendVerificationEmail(email: string, token: string) {
  const url = actionUrl('/verify-email', token)
  return send(email, 'Verify your Task Manager email', `Verify your email address: ${url}`)
}

export function sendPasswordResetEmail(email: string, token: string) {
  const url = actionUrl('/reset-password', token)
  return send(email, 'Reset your Task Manager password', `Reset your password: ${url}`)
}
