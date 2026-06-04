# syntax=docker/dockerfile:1

# --- build the dashboard ---
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app

# deps first - cached unless a manifest or the lockfile changes
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/
COPY packages/app/package.json packages/app/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @playbackhq/app build

# --- serve the static output ---
FROM nginx:alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/app/dist /usr/share/nginx/html
# nginx runs /docker-entrypoint.d/*.sh before starting; regenerate config.js from env there
COPY docker/40-playback-config.sh /docker-entrypoint.d/40-playback-config.sh
RUN chmod +x /docker-entrypoint.d/40-playback-config.sh
EXPOSE 80
