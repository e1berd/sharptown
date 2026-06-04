import { convert } from './convert.mjs'
import { resize } from './resize.mjs'
import { rotate } from './rotate.mjs'
import { flip } from './flip.mjs'
import { blur } from './blur.mjs'
import { tint } from './tint.mjs'
import { greyscale } from './greyscale.mjs'
import { removeAlpha } from './removeAlpha.mjs'
import { ensureAlpha } from './ensureAlpha.mjs'
import { transform } from './transform.mjs'

/**
 * @param {import('fastify').FastifyInstance} app
*/
export default function any2webpConverterPlugin(app, {}, done) {
  const apiPrefix = '/api/v1/'

  app.post(apiPrefix + 'convert', convert)
  app.post(apiPrefix + 'resize', resize)
  app.post(apiPrefix + 'rotate', rotate)
  app.post(apiPrefix + 'flip', flip)
  app.post(apiPrefix + 'blur', blur)
  app.post(apiPrefix + 'tint', tint)
  app.post(apiPrefix + 'greyscale', greyscale)
  app.post(apiPrefix + 'grayscale', greyscale)
  app.post(apiPrefix + 'remove-alpha', removeAlpha)
  app.post(apiPrefix + 'ensure-alpha', ensureAlpha)

  app.post(apiPrefix + 'transform', transform)

  done()
}
