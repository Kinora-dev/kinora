import { slackApp } from '../lib/env'
import { mailerEnabled } from '../lib/mailer'
import { publicProcedure, router } from '../trpc/index'

// App-level server capabilities the dashboard gates UI on: static per deployment, not per-user.
export const configRouter = router({
  get: publicProcedure.query(() => ({
    // SMTP configured? gates the email-verification UI.
    mailerEnabled,
    // Slack OAuth app present? front shows "Add to Slack" vs manual webhook paste.
    slackOauthEnabled: slackApp !== null,
  })),
})
