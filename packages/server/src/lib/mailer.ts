import nodemailer from 'nodemailer'
import { smtp } from './env'
import { logger } from './logger'

export interface Mail {
  to: string
  subject: string
  text: string
}

export interface MailTransport {
  sendMail: (mail: { from: string, to: string, subject: string, text: string }) => Promise<unknown>
}

function createTransport(): MailTransport | null {
  if (!smtp)
    return null
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    // 465 is implicit TLS; 587/25 upgrade via STARTTLS.
    secure: smtp.port === 465,
    auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
  })
}

const transport = createTransport()

export const mailerEnabled = transport !== null

// Fire-and-forget: auth flows must not await delivery (timing attacks) nor fail on it.
export function sendMail(mail: Mail, transportImpl: MailTransport | null = transport, from = smtp?.from): void {
  if (!transportImpl || !from) {
    logger.info({ to: mail.to, subject: mail.subject }, 'smtp not configured, mail skipped')
    return
  }
  transportImpl
    .sendMail({ from, ...mail })
    .then(() => logger.info({ to: mail.to, subject: mail.subject }, 'mail sent'))
    .catch(error => logger.error({ error, to: mail.to, subject: mail.subject }, 'mail send failed'))
}
