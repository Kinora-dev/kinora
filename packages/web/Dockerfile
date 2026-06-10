# Frontend image: web dashboard (SPA at /) + trace viewer (static at /trace).
# Build from the REPO ROOT (pnpm workspace):
#   docker build -f packages/web/Dockerfile \
#     --build-arg VITE_KINORA_SERVER_URL=https://api.kinora.dev -t kinora-web .
FROM node:24-alpine AS build
RUN npm i -g corepack@latest && corepack enable
WORKDIR /repo

# Baked at build time (Vite). VITE_KINORA_VIEWER_URL defaults to /trace/ (same origin).
ARG VITE_KINORA_SERVER_URL
ENV VITE_KINORA_SERVER_URL=$VITE_KINORA_SERVER_URL

COPY . .
RUN pnpm install --frozen-lockfile --filter @kinora/web... --filter @kinora/trace-viewer...
RUN pnpm --filter @kinora/web build
RUN pnpm --filter @kinora/trace-viewer build

FROM nginx:1.27-alpine AS runtime
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/packages/web/dist /usr/share/nginx/html
COPY --from=build /repo/packages/trace-viewer/dist /usr/share/nginx/html/trace
EXPOSE 80
