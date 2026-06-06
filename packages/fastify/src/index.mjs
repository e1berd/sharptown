import fp from 'fastify-plugin'
import { env } from 'node:process'
import multipart from '@fastify/multipart'
import { transformBuffer, parseCompositeOption, InvalidOperationError } from '@sharptown/core'
import { readUploads } from './extract-file.mjs'
import { createImageFetcher, registerProxyRoute, resolveProxyConfig } from './proxy.mjs'

/**
 * Resolves `composite` specs that reference uploaded watermark files by `ref` index,
 * replacing each `ref` with the uploaded bytes. Specs using `url`/`text` pass through.
 *
 * @param {unknown} raw The raw `composite` option (JSON string or array).
 * @param {Buffer[]} uploads Watermark files in upload order.
 * @returns {object[] | undefined}
 */
function resolveCompositeUploads(raw, uploads) {
  const specs = parseCompositeOption(raw)
  if (specs.length === 0) return undefined
  for (const spec of specs) {
    if (spec.ref == null) continue
    const buffer = uploads[Number(spec.ref)]
    if (!buffer) throw new InvalidOperationError(`Watermark upload #${spec.ref} is missing`)
    spec.buffer = buffer
    delete spec.ref
  }
  return specs
}

/**
 * @typedef {object} SharptownFastifyOptions
 * @property {string} [prefix] Route prefix. Defaults to `/api/v1`.
 * @property {import('@fastify/multipart').FastifyMultipartBaseOptions} [multipart]
 *   Options forwarded to `@fastify/multipart` when this plugin registers it.
 * @property {object} [proxy] Signed image-proxy options, merged over the `SHARPTOWN_PROXY_*`
 *   environment variables. See {@link resolveProxyConfig}.
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
 * // GET  /api/v1/fetch      (?url=...&width=500&convertTo=webp&sig=...)
 */
async function sharptownFastify(app, options) {
  const prefix = options.prefix ?? '/api/v1'

  if (!app.hasContentTypeParser('multipart/form-data')) {
    app.register(multipart, options.multipart)
  }

  const proxyConfig = resolveProxyConfig(options.proxy, env)
  const fetchImage = createImageFetcher(proxyConfig)

  registerProxyRoute(app, prefix, proxyConfig)

  app.post(`${prefix}/transform`, async function transformRoute(request, reply) {
    let uploads
    try {
      uploads = await readUploads(request)
    } catch (error) {
      request.log.error(error)
      return reply.code(400).send({ error: 'Invalid multipart upload' })
    }
    if (!uploads.image) {
      return reply.code(400).send({ error: 'No file uploaded' })
    }

    try {
      const composite = resolveCompositeUploads(request.query.composite, uploads.watermarks)
      const options = composite ? { ...request.query, composite } : request.query
      const { data, contentType } = await transformBuffer(uploads.image, options, { fetchImage })
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
