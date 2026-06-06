import sharp from 'sharp'
import { applyOperations, applyTransforms, applyOutput } from './operations.mjs'
import { applyChromaKey, parseCompositeOption, prepareWatermarks } from './effects.mjs'
import { mimeTypeFor } from './mime.mjs'

/**
 * @typedef {object} TransformResult
 * @property {Buffer} data The resulting image bytes.
 * @property {string} format The final format reported by Sharp (`info.format`).
 * @property {string} contentType MIME type ready for a response header.
 */

/**
 * @typedef {object} TransformDeps
 * @property {(url: string) => Promise<Buffer|Uint8Array>} [fetchImage]
 *   Resolver for image watermarks referenced by URL. The adapter supplies it so SSRF
 *   protection lives next to the proxy fetch; without it, `url` watermarks are rejected.
 */

/**
 * Transforms an image in memory and returns the bytes together with the resulting
 * format/MIME type. The format is read from Sharp's own output, so the Content-Type
 * is correct even when no explicit `convertTo` is requested.
 *
 * Buffer-only effects run between the transforms and the re-encode: `chromaKey` keys out a
 * colour, then `composite` overlays each watermark. Both are unavailable on the streaming
 * gRPC path ({@link createTransformStream}), which only applies streaming-safe operations.
 *
 * @param {Buffer | Uint8Array | ArrayBuffer} input The source image.
 * @param {import('./operations.mjs').TransformOptions} [options]
 * @param {TransformDeps} [deps]
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
export async function transformBuffer(input, options = {}, deps = {}) {
  let image = applyTransforms(sharp(input), options)

  if (options.chromaKey != null && options.chromaKey !== '') {
    image = await applyChromaKey(image, options.chromaKey)
  }

  const watermarks = await prepareWatermarks(parseCompositeOption(options.composite), deps)
  if (watermarks.length > 0) {
    image = image.composite(watermarks)
  }

  image = applyOutput(image, options)
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
