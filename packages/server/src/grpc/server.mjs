import { fileURLToPath } from 'node:url'
import * as grpc from '@grpc/grpc-js'
import protoLoader from '@grpc/proto-loader'
import { transform } from './imageProcessor.mjs'

const PROTO_PATH = fileURLToPath(new URL('../../proto/sharptown.proto', import.meta.url))

export function loadServiceDefinition() {
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
  })
  const proto = grpc.loadPackageDefinition(packageDefinition)
  return proto.sharptown.v1.ImageProcessor.service
}

/**
 * Создаёт и поднимает gRPC-сервер. Возвращает инстанс для graceful shutdown.
 */
export function createServer() {
  const server = new grpc.Server()
  server.addService(loadServiceDefinition(), { Transform: transform })
  return server
}

export function startServer({ host, port } = {}) {
  const server = createServer()
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `${host}:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (error, boundPort) => {
        if (error) return reject(error)
        resolve({ server, port: boundPort })
      },
    )
  })
}
