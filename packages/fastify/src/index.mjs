import fp from 'fastify-plugin'
import multipart from '@fastify/multipart'
import { transformBuffer, InvalidOperationError } from '@sharptown/core'
import { readFirstFile } from './extract-file.mjs'

/**
 * @typedef {object} SharptownFastifyOptions
 * @property {string} [prefix] Route prefix. Defaults to `/api/v1`.
 * @property {import('@fastify/multipart').FastifyMultipartBaseOptions} [multipart]
 *   Options forwarded to `@fastify/multipart` when this plugin registers it.
 */

/**
 * Fastify plugin that exposes Sharptown's image transform as
 * `POST {prefix}/transform`. It is a thin adapter over `@sharptown/core`: it extracts
 * the uploaded file, calls {@link transformBuffer}, and sends the bytes with the right
 * Content-Type. `@fastify/multipart` is registered automatically unless the host
 * already did.
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {SharptownFastifyOptions} options
 *
 * @example
 * import Fastify from 'fastify'
 * import sharptown from '@sharptown/fastify-plugin'
 *
 * const app = Fastify()
 * await app.register(sharptown, { prefix: '/api/v1' })
 * await app.listen({ port: 3001 })
 * // POST /api/v1/transform  (multipart file + ?width=500&convertTo=webp)
 */
async function sharptownFastify(app, options) {
  const prefix = options.prefix ?? '/api/v1'

  if (!app.hasContentTypeParser('multipart/form-data')) {
    app.register(multipart, options.multipart)
  }

  app.post(`${prefix}/transform`, async function transformRoute(request, reply) {
    const input = await readFirstFile(request)
    if (!input) {
      return reply.code(400).send({ error: 'No file uploaded' })
    }

    try {
      const { data, contentType } = await transformBuffer(input, request.query)
      reply.header('content-type', contentType)
      return data
    } catch (error) {
      if (error instanceof InvalidOperationError) {
        return reply.code(400).send({ error: error.message })
      }
      request.log.error(error)
      return reply.code(415).send({ error: 'Unsupported or corrupt image' })
    }
  })
}

export default fp(sharptownFastify, {
  name: '@sharptown/fastify-plugin',
  fastify: '5.x',
})
