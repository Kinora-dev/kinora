# syntax=docker/dockerfile:1

# --- build the dashboard ---
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app

# deps first - cached unless a manifest or the lockfile changes
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/
COPY packages/ui/package.json packages/ui/
COPY packages/web/package.json packages/web/
COPY packages/trace-viewer/package.json packages/trace-viewer/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @kinora/web build
RUN pnpm --filter @kinora/trace-viewer build

# --- serve the static output ---
FROM nginx:alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
# the trace viewer is served under /trace/ (built with base '/trace/')
COPY --from=build /app/packages/trace-viewer/dist /usr/share/nginx/html/trace
# nginx runs /docker-entrypoint.d/*.sh before starting; regenerate config.js from env there
COPY docker/40-kinora-config.sh /docker-entrypoint.d/40-kinora-config.sh
RUN chmod +x /docker-entrypoint.d/40-kinora-config.sh
EXPOSE 80
