# Node pinned by version and digest: the same image every build.
ARG NODE_IMAGE=node:24.22.3-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530

FROM ${NODE_IMAGE} AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Full install and the Next build
FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && rm -rf .next/cache

# Runtime dependencies only (tsx stays: the release step runs TypeScript)
FROM base AS deps
RUN pnpm install --frozen-lockfile --prod

FROM ${NODE_IMAGE}
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY package.json next.config.ts tsconfig.json ./
# read at runtime by the release step: migrations, seed data, and the code they import
COPY drizzle ./drizzle
COPY data/seed ./data/seed
COPY lib ./lib
COPY scripts ./scripts
USER node
EXPOSE 3000
# The app only serves. Migrations and seeding are the separate release step (scripts/release.ts).
# next is PID 1, so it gets SIGTERM and finishes in-flight requests on stop.
CMD ["node", "node_modules/next/dist/bin/next", "start"]
