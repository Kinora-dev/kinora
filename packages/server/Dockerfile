# Build from the REPO ROOT (needs the pnpm workspace + @kinora/core):
#   docker build -f packages/server/Dockerfile -t kinora-server .
FROM node:26-alpine AS base
RUN npm i -g corepack@latest && corepack enable
WORKDIR /repo

FROM base AS builder
COPY . .
# Install only the server + its workspace deps (@kinora/core).
RUN pnpm install --frozen-lockfile --filter @kinora/server...
# tsdown bundles @kinora/core into dist, so the prod image needs no workspace lib.
RUN pnpm --filter @kinora/server build
# Self-contained package + prod node_modules -> /prod.
RUN pnpm deploy --filter=@kinora/server --prod /prod

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 kinora
COPY --from=builder --chown=kinora:nodejs /prod /app
USER kinora
EXPOSE 3000

CMD ["node", "dist/src/index.mjs"]
