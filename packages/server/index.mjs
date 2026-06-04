import Fastify from 'fastify'
import { env } from 'node:process'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'

const port = parseInt(env.SHARPTOWN_PORT || '3001')
const host = env.SHARPTOWN_HOST || '0.0.0.0'

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
  disableRequestLogging: false,
})

app
.register(import('@fastify/cors'), { origin: '*' })
.register(import('@mgcrea/fastify-request-logger'))
.register(import('@fastify/multipart'))
.register(import('@fastify/static'), {
  root: fileURLToPath(new URL('./public', import.meta.url)),
})
.register(import('./src/plugin.mjs'))
.get('/', function(req, res) {
  res.header('content-type', 'text/html')
  return readFile('./public/index.html', 'utf-8')
})
.listen({ port, host })
.catch(err => {
  app.log.error(err)
  process.exit(1)
})
