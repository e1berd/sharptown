import sharp from 'sharp'
import { applyOperations } from './operations.mjs'
import { mimeTypeFor } from './mime.mjs'

/**
 * @typedef {object} TransformResult
 * @property {Buffer} data The resulting image bytes.
 * @property {string} format The final format reported by Sharp (`info.format`).
 * @property {string} contentType MIME type ready for a response header.
 */

/**
 * Transforms an image in memory and returns the bytes together with the resulting
 * format/MIME type. The format is read from Sharp's own output, so the Content-Type
 * is correct even when no explicit `convertTo` is requested.
 *
 * @param {Buffer | Uint8Array | ArrayBuffer} input The source image.
 * @param {import('./operations.mjs').TransformOptions} [options]
 * @returns {Promise<TransformResult>}
 * @throws {import('./operations.mjs').InvalidOperationError}
 *
 * @example
 * import { transformBuffer } from '@sharptown/core'
 *
 * const { data, contentType } = await transformBuffer(inputBuffer, {
 *   width: 200,
 *   convertTo: 'webp',
 * })
 * reply.header('content-type', contentType).send(data) // => image/webp
 */
export async function transformBuffer(input, options) {
  const image = applyOperations(sharp(input), options)
  const { data, info } = await image.toBuffer({ resolveWithObject: true })
  return { data, format: info.format, contentType: mimeTypeFor(info.format) }
}

/**
 * Creates a Sharp duplex stream configured for streaming arbitrary-size files
 * (`sequentialRead`, no input-pixel limit). Pipe source bytes in and read the
 * transformed bytes out — used by the gRPC streaming host.
 *
 * @param {import('./operations.mjs').TransformOptions} [options]
 * @returns {import('sharp').Sharp}
 * @throws {import('./operations.mjs').InvalidOperationError}
 *
 * @example
 * import { createTransformStream } from '@sharptown/core'
 * import { createReadStream, createWriteStream } from 'node:fs'
 *
 * const transformer = createTransformStream({ width: 4096, convertTo: 'webp' })
 * createReadStream('huge-map.png').pipe(transformer).pipe(createWriteStream('out.webp'))
 */
export function createTransformStream(options) {
  return applyOperations(sharp({ limitInputPixels: false, sequentialRead: true }), options)
}
