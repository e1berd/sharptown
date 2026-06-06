/**
 * `@sharptown/core` — the framework-agnostic image transformation engine built on
 * Sharp. It depends on no web framework: adapters (Fastify, Hono, Elysia, Express,
 * gRPC, JSON-RPC) reuse it through {@link transformBuffer} and {@link createTransformStream}.
 *
 * @module @sharptown/core
 *
 * @example
 * import { transformBuffer } from '@sharptown/core'
 *
 * const { data, contentType } = await transformBuffer(inputBuffer, {
 *   width: 800,
 *   convertTo: 'webp',
 * })
 */

export {
  applyOperations, applyTransforms, applyOutput,
  InvalidOperationError, SUPPORTED_FORMATS, FIT_MODES,
} from './operations.mjs'
export { transformBuffer, createTransformStream } from './transform.mjs'
export { applyChromaKey, prepareWatermarks, parseCompositeOption } from './effects.mjs'
export { mimeTypeFor } from './mime.mjs'
