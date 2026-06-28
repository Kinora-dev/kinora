# Frontend image: web dashboard (SPA at /) + trace viewer (static at /trace).
# Build from the REPO ROOT (pnpm workspace):
#   docker build -f packages/web/Dockerfile \
#     --build-arg VITE_KINORA_SERVER_URL=https://api.kinora.dev -t kinora-web .
FROM node:26-alpine AS build
RUN npm i -g corepack@latest && corepack enable
WORKDIR /repo

# Baked at build time (Vite). VITE_KINORA_VIEWER_URL defaults to /trace/ (same origin).
ARG VITE_KINORA_SERVER_URL
ENV VITE_KINORA_SERVER_URL=$VITE_KINORA_SERVER_URL

# Cloud-only: Sentry stays off unless both are passed (self-host omits them).
ARG VITE_KINORA_CLOUD
ENV VITE_KINORA_CLOUD=$VITE_KINORA_CLOUD
ARG VITE_KINORA_SENTRY_DSN
ENV VITE_KINORA_SENTRY_DSN=$VITE_KINORA_SENTRY_DSN

# Source-map upload (cloud only): org/project are non-secret; the auth token comes via a
# BuildKit secret so it never lands in an image layer. Absent token = upload skipped.
ARG SENTRY_ORG
ENV SENTRY_ORG=$SENTRY_ORG
ARG SENTRY_PROJECT
ENV SENTRY_PROJECT=$SENTRY_PROJECT

COPY . .
RUN pnpm install --frozen-lockfile --filter @kinora/web... --filter @kinora/trace-viewer...
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    pnpm --filter @kinora/web build
RUN pnpm --filter @kinora/trace-viewer build

FROM nginx:1.27-alpine AS runtime
# Default = cloud (static-only, API is a separate origin). Single-origin demo/self-host passes
# NGINX_CONF=selfhost/nginx.conf to bake the reverse-proxy config instead.
ARG NGINX_CONF=packages/web/nginx.conf
COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf
COPY --from=build /repo/packages/web/dist /usr/share/nginx/html
COPY --from=build /repo/packages/trace-viewer/dist /usr/share/nginx/html/trace
EXPOSE 80
