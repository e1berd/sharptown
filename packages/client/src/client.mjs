import { SharptownError } from './errors.mjs'
import { rest } from './transports/rest.mjs'
import { TransformBuilder } from './transform-builder.mjs'

/**
 * @typedef {object} ClientOptions
 * @property {import('./transports/rest.mjs').Transport} [transport]
 *   Транспорт. По умолчанию `rest()`. Подключаемо — позже можно добавить gRPC.
 * @property {(input: any, init?: any) => Promise<Response>} [fetch]
 *   Своя реализация `fetch` (для Node < 18, прокси, тестов). По умолчанию `globalThis.fetch`.
 * @property {Record<string, string>} [headers]
 *   Заголовки по умолчанию для каждого запроса (например, авторизация).
 */

/**
 * @typedef {object} TransformOptions
 * @property {string} [filename] Имя файла в multipart-запросе.
 * @property {AbortSignal} [signal] Сигнал отмены запроса.
 */

/**
 * Клиент Sharptown. Создаётся через {@link createClient}.
 */
export class SharptownClient {
  /** @type {Required<Pick<ClientOptions, 'transport' | 'headers'>> & { baseUrl: string, fetchImpl: Function }} */
  #ctx

  /** @param {{ baseUrl: string, transport: any, fetchImpl: Function, headers: Record<string,string> }} ctx */
  constructor(ctx) {
    this.#ctx = ctx
  }

  /** Базовый URL сервера. @returns {string} */
  get url() {
    return this.#ctx.baseUrl
  }

  /**
   * Начать цепочку трансформации изображения.
   * @param {import('./input.mjs').ImageInput} input Источник изображения.
   * @param {TransformOptions} [options]
   * @returns {TransformBuilder}
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
   * Шорткат: только конвертация формата.
   * @param {import('./input.mjs').ImageInput} input
   * @param {string} format
   * @param {TransformOptions} [options]
   * @returns {TransformBuilder}
   */
  convert(input, format, options) {
    return this.transform(input, options).convert(format)
  }

  /**
   * Шорткат: только ресайз.
   * @param {import('./input.mjs').ImageInput} input
   * @param {number | { width?: number, height?: number }} width
   * @param {number} [height]
   * @param {TransformOptions} [options]
   * @returns {TransformBuilder}
   */
  resize(input, width, height, options) {
    return this.transform(input, options).resize(width, height)
  }
}

/**
 * Создать клиент Sharptown.
 *
 * @example
 * import { createClient } from '@sharptown/client'
 * const st = createClient('http://localhost:3001')
 * const webp = await st.transform(file).resize(800).convert('webp')
 *
 * @param {string} baseUrl Базовый URL сервера Sharptown.
 * @param {ClientOptions} [options]
 * @returns {SharptownClient}
 */
export function createClient(baseUrl, options = {}) {
  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new SharptownError('createClient(baseUrl): baseUrl must be a non-empty string')
  }

  const fetchImpl = options.fetch ??
    (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined)

  if (!fetchImpl) {
    throw new SharptownError(
      'No global fetch available in this runtime. Pass a fetch implementation via options.fetch.',
    )
  }

  return new SharptownClient({
    baseUrl: baseUrl.replace(/\/+$/, ''),
    transport: options.transport ?? rest(),
    fetchImpl,
    headers: options.headers ?? {},
  })
}
