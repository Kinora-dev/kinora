import { cloud, demo, githubOauthEnabled, googleOauthEnabled, slackApp } from '../lib/env'
import { mailerEnabled } from '../lib/mailer'
import { feedbackEnabled } from '../lib/stowline'
import { publicProcedure, router } from '../trpc/index'

// App-level server capabilities the dashboard gates UI on: static per deployment, not per-user.
export const configRouter = router({
  get: publicProcedure.query(() => ({
    // SMTP configured? gates the email-verification UI.
    mailerEnabled,
    // Slack OAuth app present? front shows "Add to Slack" vs manual webhook paste.
    slackOauthEnabled: slackApp !== null,
    // Social providers configured? front hides the button when not.
    googleOauthEnabled,
    githubOauthEnabled,
    // Public read-only demo? front shows a banner + hides mutation UI.
    demo,
    // Stowline configured (cloud)? front shows the "Send feedback" entry.
    feedbackEnabled,
    // Cloud deployment? front shows the platform-admin nav entry to admin-role users.
    adminEnabled: cloud !== null,
  })),
})
