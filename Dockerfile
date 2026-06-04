FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm i

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3001
EXPOSE 50051
USER node
# REST-сервер по умолчанию. Для gRPC-сервиса запускайте как отдельный
# контейнер/процесс с CMD ["node", "grpc.mjs"].
CMD ["node", "index.mjs"]