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
# Demo seed (seed-market) uploads real trace.zip blobs; it resolves them at
# ../../trace-viewer/public/fixtures relative to dist/scripts -> /app/trace-viewer/public/fixtures.
COPY --chown=kinora:nodejs \
  packages/trace-viewer/public/fixtures/error-trace.zip \
  packages/trace-viewer/public/fixtures/demo.zip \
  /app/trace-viewer/public/fixtures/
# Pre-create STORAGE_DIR owned by kinora so a fresh named volume inherits uid 1001 (else
# Docker inits the volume root-owned and the non-root process can't write artifacts).
RUN mkdir -p /app/.data/artifacts && chown -R kinora:nodejs /app/.data
USER kinora
EXPOSE 3000

# --enable-source-maps so Sentry stack traces map back to TS source.
CMD ["node", "--enable-source-maps", "dist/src/index.mjs"]
