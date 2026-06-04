FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /repo

COPY . .
RUN pnpm install --filter "@sharptown/server-grpc..." --frozen-lockfile
RUN pnpm --filter @sharptown/server-grpc deploy --prod /app

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 50051
USER node
CMD ["node", "grpc.mjs"]
