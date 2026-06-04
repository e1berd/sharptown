FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /repo

COPY . .
RUN pnpm install --filter "@sharptown/server-jsonrpc..." --frozen-lockfile
RUN pnpm --filter @sharptown/server-jsonrpc deploy --prod /app

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 3002
USER node
CMD ["node", "index.mjs"]
