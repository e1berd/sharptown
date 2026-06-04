import { env } from 'node:process'
import { startServer } from './src/grpc/server.mjs'

const port = parseInt(env.SHARPTOWN_GRPC_PORT || '50051', 10)
const host = env.SHARPTOWN_GRPC_HOST || '0.0.0.0'

const { server, port: boundPort } = await startServer({ host, port })
console.log(`gRPC ImageProcessor listening on ${host}:${boundPort}`)

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gRPC server...`)
  server.tryShutdown((error) => {
    if (error) {
      console.error('Graceful shutdown failed, forcing exit', error)
      server.forceShutdown()
      process.exit(1)
    }
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
