FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/server/package.json ./packages/server/package.json
RUN pnpm install --filter "@sharptown/server..." --frozen-lockfile

COPY packages/server ./packages/server
RUN pnpm --filter @sharptown/server deploy --prod /app

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 3001
EXPOSE 50051
USER node
CMD ["node", "index.mjs"]
