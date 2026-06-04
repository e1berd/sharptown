import Fastify from 'fastify'
import { env } from 'node:process'
import websocket from '@fastify/websocket'
import cors from '@fastify/cors'
import { handleRpcMessage } from './src/rpc.mjs'

const port = parseInt(env.SHARPTOWN_JSONRPC_PORT || '3002')
const host = env.SHARPTOWN_JSONRPC_HOST || '0.0.0.0'

const app = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: '@mgcrea/pino-pretty-compact',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
})

try {
  await app.register(cors, { origin: '*' })
  await app.register(websocket)

  app.get('/rpc', { websocket: true }, function rpc(socket) {
    socket.on('message', async function onMessage(raw) {
      const response = await handleRpcMessage(raw.toString())
      if (response !== null) {
        socket.send(JSON.stringify(response))
      }
    })
  })

  await app.listen({ port, host })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
