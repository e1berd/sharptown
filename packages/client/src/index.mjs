/**
 * `@sharptown/client` — an expressive, isomorphic client for the Sharptown image
 * transformation API. Works in the browser, Node, Bun and Deno.
 *
 * @module @sharptown/client
 *
 * @example
 * import { sharptown } from '@sharptown/client'
 *
 * const st = sharptown('http://localhost:3001')
 * const webp = await st.transform(file).resize(800).convert('webp')
 */

export { sharptown, SharptownClient } from './client.mjs'
export { TransformBuilder } from './transform-builder.mjs'
export { Watermark, Textmark } from './watermark.mjs'
export { rest } from './transports/rest.mjs'
export { buildProxyUrl } from './proxy.mjs'
export { SharptownError } from './errors.mjs'
export { SUPPORTED_FORMATS, FIT_MODES } from './operations.mjs'
