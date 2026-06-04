import { fileURLToPath } from 'node:url'
import * as grpc from '@grpc/grpc-js'
import protoLoader from '@grpc/proto-loader'
import { transform } from './imageProcessor.mjs'

const PROTO_PATH = fileURLToPath(new URL('../../proto/sharptown.proto', import.meta.url))

/**
 * Loads the `ImageProcessor` service definition from the bundled proto file.
 *
 * @returns {import('@grpc/grpc-js').ServiceDefinition}
 *
 * @example
 * const server = new grpc.Server()
 * server.addService(loadServiceDefinition(), { Transform: transform })
 */
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
 * Builds a gRPC server with the `ImageProcessor` service wired to the streaming
 * {@link transform} handler. The returned instance is not yet bound.
 *
 * @returns {import('@grpc/grpc-js').Server}
 *
 * @example
 * const server = createServer()
 * server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {})
 */
export function createServer() {
  const server = new grpc.Server()
  server.addService(loadServiceDefinition(), { Transform: transform })
  return server
}

/**
 * Creates and binds a gRPC server. Resolves with the server instance (for graceful
 * shutdown) and the bound port.
 *
 * @param {{ host?: string, port?: number }} [address]
 * @returns {Promise<{ server: import('@grpc/grpc-js').Server, port: number }>}
 *
 * @example
 * const { server, port } = await startServer({ host: '0.0.0.0', port: 50051 })
 * console.log(`listening on ${port}`)
 */
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
