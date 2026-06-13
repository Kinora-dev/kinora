import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { account } from '../db/schemas/index'
import { mailerEnabled } from '../lib/mailer'
import { publicProcedure, router } from '../trpc/index'

export const userRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user)
      return null
    // hasPassword gates email/password editing: social-only users have no credential account.
    const credential = await db.query.account.findFirst({
      where: and(eq(account.userId, ctx.user.id), eq(account.providerId, 'credential')),
      columns: { id: true },
    })
    // mailerEnabled gates the verification UI: no SMTP means email can't be verified or resent.
    return { ...ctx.user, hasPassword: !!credential, mailerEnabled }
  }),
})
