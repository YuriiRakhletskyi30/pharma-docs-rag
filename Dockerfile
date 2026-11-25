FROM node:24-slim
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

ENV NODE_ENV=production
EXPOSE 3000
# shortcut: migrate + seed on every start (both idempotent); in prod these run as a one-off release job
# exec: next start replaces the shell as PID 1, so it gets SIGTERM and finishes in-flight requests on stop
CMD ["sh", "-c", "pnpm check-env && pnpm migrate && pnpm seed && exec ./node_modules/.bin/next start"]
