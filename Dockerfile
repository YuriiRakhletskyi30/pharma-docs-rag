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
CMD ["sh", "-c", "pnpm migrate && pnpm seed && pnpm start"]
