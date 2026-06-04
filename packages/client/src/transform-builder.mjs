import {
  toInt,
  toColor,
  toPositiveInt,
  assertFormat,
} from './operations.mjs'

/**
 * @typedef {object} BuilderContext
 * @property {string} baseUrl
 * @property {import('./transports/rest.mjs').Transport} transport
 * @property {(input: any, init?: any) => Promise<Response>} fetchImpl
 * @property {Record<string, string>} headers
 * @property {import('./input.mjs').ImageInput} input
 * @property {string} [filename]
 * @property {AbortSignal} [signal]
 */

/**
 * Выразительный, цепочечный построитель трансформации одного изображения.
 *
 * Каждый метод-операция возвращает `this`, поэтому вызовы можно объединять в
 * цепочку. Объект «thenable»: его можно `await`-ить напрямую (результат — `Blob`),
 * либо завершить явным терминалом (`blob()`, `arrayBuffer()`, `bytes()`,
 * `response()`, `stream()`, `toFile()`).
 *
 * @example
 * const blob = await st.transform(file)
 *   .resize(800, 600)
 *   .blur(3)
 *   .grayscale()
 *   .convert('webp')
 */
export class TransformBuilder {
  /** @type {BuilderContext} */
  #ctx
  /** @type {import('./operations.mjs').Operations} */
  #ops = {}

  /** @param {BuilderContext} ctx */
  constructor(ctx) {
    this.#ctx = ctx
  }

  /**
   * Ресайз. Принимает `(width, height)`, только `(width)` или объект
   * `{ width, height }`.
   * @param {number | { width?: number, height?: number }} [width]
   * @param {number} [height]
   * @returns {this}
   */
  resize(width, height) {
    if (typeof width === 'object' && width !== null) {
      height = width.height
      width = width.width
    }
    if (width != null) this.#ops.width = toPositiveInt(width, 'width')
    if (height != null) this.#ops.height = toPositiveInt(height, 'height')
    return this
  }

  /** Задать только ширину. @param {number} value @returns {this} */
  width(value) {
    this.#ops.width = toPositiveInt(value, 'width')
    return this
  }

  /** Задать только высоту. @param {number} value @returns {this} */
  height(value) {
    this.#ops.height = toPositiveInt(value, 'height')
    return this
  }

  /** Повернуть на градусы. @param {number} degrees @returns {this} */
  rotate(degrees) {
    this.#ops.rotate = toInt(degrees, 'rotate')
    return this
  }

  /** Отразить по горизонтали. @param {boolean} [enabled=true] @returns {this} */
  flip(enabled = true) {
    this.#ops.flip = Boolean(enabled)
    return this
  }

  /** Размытие (радиус/sigma). @param {number} [sigma=1] @returns {this} */
  blur(sigma = 1) {
    this.#ops.blur = toPositiveInt(sigma, 'blur')
    return this
  }

  /**
   * Тонировать цветом. Принимает `(r, g, b)` или объект `{ r, g, b }`.
   * Любая компонента опциональна (0–255).
   * @param {number | { r?: number, g?: number, b?: number }} r
   * @param {number} [g]
   * @param {number} [b]
   * @returns {this}
   */
  tint(r, g, b) {
    if (typeof r === 'object' && r !== null) {
      g = r.g
      b = r.b
      r = r.r
    }
    if (r != null) this.#ops.r = toColor(r, 'r')
    if (g != null) this.#ops.g = toColor(g, 'g')
    if (b != null) this.#ops.b = toColor(b, 'b')
    return this
  }

  /** Обесцветить. @param {boolean} [enabled=true] @returns {this} */
  grayscale(enabled = true) {
    this.#ops.grayscale = Boolean(enabled)
    return this
  }

  /** Британский алиас для {@link grayscale}. @param {boolean} [enabled=true] @returns {this} */
  greyscale(enabled = true) {
    return this.grayscale(enabled)
  }

  /** Удалить альфа-канал. @param {boolean} [enabled=true] @returns {this} */
  removeAlpha(enabled = true) {
    this.#ops.removeAlpha = Boolean(enabled)
    return this
  }

  /** Гарантировать альфа-канал. @param {boolean} [enabled=true] @returns {this} */
  ensureAlpha(enabled = true) {
    this.#ops.ensureAlpha = Boolean(enabled)
    return this
  }

  /**
   * Сконвертировать в формат (`webp`, `png`, `jpg`, `jpeg`, `avif`, `gif`, `heif`).
   * @param {string} format
   * @returns {this}
   */
  convert(format) {
    this.#ops.convertTo = assertFormat(String(format).toLowerCase())
    return this
  }

  /** Алиас для {@link convert}. @param {string} format @returns {this} */
  toFormat(format) {
    return this.convert(format)
  }

  /** Привязать `AbortSignal` к запросу. @param {AbortSignal} signal @returns {this} */
  abortWith(signal) {
    this.#ctx.signal = signal
    return this
  }

  /**
   * Выполнить запрос и вернуть «сырой» `Response` (для доступа к заголовкам,
   * стримингу и т.п.).
   * @returns {Promise<Response>}
   */
  response() {
    return this.#ctx.transport.transform({
      baseUrl: this.#ctx.baseUrl,
      fetchImpl: this.#ctx.fetchImpl,
      headers: this.#ctx.headers,
      input: this.#ctx.input,
      filename: this.#ctx.filename,
      signal: this.#ctx.signal,
      operations: this.#ops,
    })
  }

  /** Результат как `Blob`. @returns {Promise<Blob>} */
  async blob() {
    return (await this.response()).blob()
  }

  /** Результат как `ArrayBuffer`. @returns {Promise<ArrayBuffer>} */
  async arrayBuffer() {
    return (await this.response()).arrayBuffer()
  }

  /** Результат как `Uint8Array`. @returns {Promise<Uint8Array>} */
  async bytes() {
    return new Uint8Array(await this.arrayBuffer())
  }

  /** Результат как `ReadableStream` тела ответа. @returns {Promise<ReadableStream<Uint8Array> | null>} */
  async stream() {
    return (await this.response()).body
  }

  /**
   * Записать результат в файл (Node/Bun/Deno). Возвращает путь.
   * @param {string | URL} path
   * @returns {Promise<string | URL>}
   */
  async toFile(path) {
    const bytes = await this.bytes()
    const { writeFile } = await import('node:fs/promises')
    await writeFile(path, bytes)
    return path
  }

  /**
   * Делает построитель «thenable»: `await builder` эквивалентно `builder.blob()`.
   * @template TResult1, TResult2
   * @param {((value: Blob) => TResult1 | PromiseLike<TResult1>) | null} [onfulfilled]
   * @param {((reason: any) => TResult2 | PromiseLike<TResult2>) | null} [onrejected]
   * @returns {Promise<TResult1 | TResult2>}
   */
  then(onfulfilled, onrejected) {
    return this.blob().then(onfulfilled, onrejected)
  }

  /**
   * @param {((reason: any) => any) | null} [onrejected]
   * @returns {Promise<any>}
   */
  catch(onrejected) {
    return this.blob().catch(onrejected)
  }

  /**
   * @param {(() => void) | null} [onfinally]
   * @returns {Promise<Blob>}
   */
  finally(onfinally) {
    return this.blob().finally(onfinally)
  }
}
