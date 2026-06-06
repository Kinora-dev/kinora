import { publicProcedure, router } from '../trpc/index'

export const userRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),
})
