import { SharptownError } from './errors.mjs'
import { rest } from './transports/rest.mjs'
import { TransformBuilder } from './transform-builder.mjs'

/**
 * @typedef {object} ClientOptions
 * @property {import('./transports/rest.mjs').Transport} [transport]
 *   Transport. Defaults to `rest()`. Pluggable — e.g. a gRPC transport can be added later.
 * @property {(input: any, init?: any) => Promise<Response>} [fetch]
 *   A custom `fetch` implementation (for Node < 18, proxies, tests). Defaults to `globalThis.fetch`.
 * @property {Record<string, string>} [headers]
 *   Default headers sent with every request (e.g. authorization).
 */

/**
 * @typedef {object} TransformOptions
 * @property {string} [filename] File name used in the multipart request.
 * @property {AbortSignal} [signal] Signal to abort the request.
 */

/**
 * The Sharptown client. Create one via {@link sharptown}.
 *
 * @example
 * const st = sharptown('http://localhost:3001')
 * const webp = await st.transform(file).resize(800).convert('webp')
 */
export class SharptownClient {
  /** @type {{ baseUrl: URL, transport: any, fetchImpl: Function, headers: Record<string,string> }} */
  #ctx

  /** @param {{ baseUrl: URL, transport: any, fetchImpl: Function, headers: Record<string,string> }} ctx */
  constructor(ctx) {
    this.#ctx = ctx
  }

  /** The server base URL. @returns {URL} */
  get url() {
    return this.#ctx.baseUrl
  }

  /**
   * Starts an image transformation chain.
   * @param {import('./input.mjs').ImageInput} input The image source.
   * @param {TransformOptions} [options]
   * @returns {TransformBuilder}
   *
   * @example
   * const blob = await st.transform(file).resize(400).blur(2).convert('webp')
   */
  transform(input, options = {}) {
    return new TransformBuilder({
      baseUrl: this.#ctx.baseUrl,
      transport: this.#ctx.transport,
      fetchImpl: this.#ctx.fetchImpl,
      headers: this.#ctx.headers,
      input,
      filename: options.filename,
      signal: options.signal,
    })
  }

  /**
   * Shortcut: format conversion only.
   * @param {import('./input.mjs').ImageInput} input
   * @param {string} format
   * @param {TransformOptions} [options]
   * @returns {TransformBuilder}
   *
   * @example
   * const png = await st.convert(file, 'png')
   */
  convert(input, format, options) {
    return this.transform(input, options).convert(format)
  }

  /**
   * Shortcut: resize only.
   * @param {import('./input.mjs').ImageInput} input
   * @param {number | { width?: number, height?: number }} width
   * @param {number} [height]
   * @param {TransformOptions} [options]
   * @returns {TransformBuilder}
   *
   * @example
   * const small = await st.resize(file, 320, 240)
   */
  resize(input, width, height, options) {
    return this.transform(input, options).resize(width, height)
  }
}

/**
 * Creates a Sharptown client.
 *
 * @example
 * import { sharptown } from '@sharptown/client'
 * const st = sharptown('http://localhost:3001')
 * const webp = await st.transform(file).resize(800).convert('webp')
 *
 * The scheme is optional: a bare `localhost:3001` resolves to `https://localhost:3001`.
 * Without a scheme the secure variant is used; pass `http://` explicitly to opt out.
 *
 * @param {string | URL} url The Sharptown server base URL (a string or a `URL`).
 * @param {ClientOptions} [options]
 * @returns {SharptownClient}
 */
export function sharptown(url, options = {}) {
  const baseUrl = toBaseUrl(url)

  const fetchImpl = options.fetch ??
    (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined)

  if (!fetchImpl) {
    throw new SharptownError(
      'No global fetch available in this runtime. Pass a fetch implementation via options.fetch.',
    )
  }

  return new SharptownClient({
    baseUrl,
    transport: options.transport ?? rest(),
    fetchImpl,
    headers: options.headers ?? {},
  })
}

/**
 * Resolves a user-supplied URL to an `http(s)` base. A missing scheme defaults to the
 * secure variant (`https`), so `localhost:3001` becomes `https://localhost:3001`; an
 * explicit `http://`/`ws://` selects the insecure variant. The transport owns the protocol
 * family — here it is always `http`/`https`.
 *
 * @param {string | URL} url
 * @returns {URL}
 */
function toBaseUrl(url) {
  if (url instanceof URL) {
    return new URL(url.href)
  }
  if (typeof url !== 'string' || url.trim().length === 0) {
    throw new SharptownError('sharptown(url): url must be a non-empty string or a URL instance')
  }

  const trimmed = url.trim()
  const scheme = trimmed.match(/^([a-z][a-z0-9+.-]*):\/\//i)
  const secure = scheme ? !/^(http|ws)$/i.test(scheme[1]) : true
  const authority = scheme ? trimmed.slice(scheme[0].length) : trimmed

  try {
    return new URL(`${secure ? 'https' : 'http'}://${authority}`)
  } catch {
    throw new SharptownError(`sharptown(url): invalid URL ${JSON.stringify(url)}`)
  }
}
