import { SharptownError } from './errors.mjs'
import { toInt, toPositiveInt, toRange } from './operations.mjs'

/**
 * @typedef {object} ResolvedMark
 * @property {object} spec The wire spec for the `composite` operation.
 * @property {Blob} [blob] Binary overlay to upload (for `File`/`Blob` sources).
 */

/**
 * An image overlay composited onto the transformed image. Pass it to
 * {@link TransformBuilder#composite}. The source is resolved by the server when it is a URL
 * (`string`, `URL`, or `Request`), or uploaded alongside the image when it is binary
 * (`File` or `Blob`). Configure placement and appearance with the chainable methods.
 *
 * @example
 * st.transform(file)
 *   .composite(new Watermark('https://cdn.example.com/logo.png').resize(120).opacity(0.6).gravity('southeast'))
 *   .convert('webp')
 */
export class Watermark {
  /** @type {File|Blob|Request|URL|string} */
  #source
  /** @type {Record<string, unknown>} */
  #spec = { type: 'image' }

  /** @param {File|Blob|Request|URL|string} source */
  constructor(source) {
    if (source == null || source === '') {
      throw new SharptownError('Watermark(source): a File, Blob, Request, URL or string is required')
    }
    this.#source = source
  }

  /**
   * Resizes the overlay, fitting inside `width`×`height`. Either dimension is optional.
   * @param {number} [width]
   * @param {number} [height]
   * @returns {this}
   */
  resize(width, height) {
    if (typeof width === 'object' && width !== null) {
      height = width.height
      width = width.width
    }
    if (width != null) this.#spec.width = toPositiveInt(width, 'watermark width')
    if (height != null) this.#spec.height = toPositiveInt(height, 'watermark height')
    return this
  }

  /** Sets the overlay width only. @param {number} value @returns {this} */
  width(value) {
    this.#spec.width = toPositiveInt(value, 'watermark width')
    return this
  }

  /** Sets the overlay height only. @param {number} value @returns {this} */
  height(value) {
    this.#spec.height = toPositiveInt(value, 'watermark height')
    return this
  }

  /** Rotates the overlay by degrees. @param {number} degrees @returns {this} */
  rotate(degrees) {
    this.#spec.rotate = toInt(degrees, 'watermark rotate')
    return this
  }

  /** Overlay opacity, `0`–`1`. @param {number} value @returns {this} */
  opacity(value) {
    this.#spec.opacity = toRange(value, 'watermark opacity', 0, 1)
    return this
  }

  /**
   * Placement gravity: `north`, `northeast`, `east`, `southeast`, `south`, `southwest`,
   * `west`, `northwest`, `center`. Defaults to `southeast`.
   * @param {string} value
   * @returns {this}
   */
  gravity(value) {
    this.#spec.gravity = String(value)
    return this
  }

  /** Absolute placement at `(x, y)` from the top-left, instead of a gravity. @param {number} x @param {number} y @returns {this} */
  offset(x, y) {
    this.#spec.x = toInt(x, 'watermark x')
    this.#spec.y = toInt(y, 'watermark y')
    return this
  }

  /** Repeats the overlay across the whole image. @param {boolean} [enabled=true] @returns {this} */
  tile(enabled = true) {
    this.#spec.tile = Boolean(enabled)
    return this
  }

  /** Sharp blend mode (`over` by default). @param {string} mode @returns {this} */
  blend(mode) {
    this.#spec.blend = String(mode)
    return this
  }

  /**
   * Resolves the overlay into a wire spec, plus a `Blob` to upload when the source is binary.
   * @returns {ResolvedMark}
   */
  resolve() {
    const spec = { ...this.#spec }
    const source = this.#source
    if (typeof source === 'string') {
      spec.url = source
    } else if (source instanceof URL) {
      spec.url = source.href
    } else if (typeof Request !== 'undefined' && source instanceof Request) {
      spec.url = source.url
    } else if (typeof Blob !== 'undefined' && source instanceof Blob) {
      return { spec, blob: source }
    } else {
      throw new SharptownError('Watermark(source): expected a File, Blob, Request, URL or string')
    }
    return { spec }
  }
}

/**
 * A text overlay composited onto the transformed image, rendered server-side. Pass it to
 * {@link TransformBuilder#composite}.
 *
 * @example
 * st.transform(file)
 *   .composite(new Textmark('© Acme').size(48).color('white').rotate(-30).tile())
 *   .convert('webp')
 */
export class Textmark {
  /** @type {Record<string, unknown>} */
  #spec = { type: 'text' }

  /** @param {string} text */
  constructor(text) {
    if (text == null) throw new SharptownError('Textmark(text): text is required')
    this.#spec.text = String(text)
  }

  /** Font size in pixels. @param {number} value @returns {this} */
  size(value) {
    this.#spec.size = toPositiveInt(value, 'textmark size')
    return this
  }

  /** Text colour (any CSS colour, e.g. `white`, `#fff`, `rgba(0,0,0,.5)`). @param {string} value @returns {this} */
  color(value) {
    this.#spec.color = String(value)
    return this
  }

  /** Font family. @param {string} value @returns {this} */
  font(value) {
    this.#spec.font = String(value)
    return this
  }

  /** Font weight (e.g. `bold`, `400`). @param {string|number} value @returns {this} */
  weight(value) {
    this.#spec.weight = String(value)
    return this
  }

  /** Background colour painted behind the text tile. @param {string} value @returns {this} */
  background(value) {
    this.#spec.background = String(value)
    return this
  }

  /** Rotates the text by degrees. @param {number} degrees @returns {this} */
  rotate(degrees) {
    this.#spec.rotate = toInt(degrees, 'textmark rotate')
    return this
  }

  /** Text opacity, `0`–`1`. @param {number} value @returns {this} */
  opacity(value) {
    this.#spec.opacity = toRange(value, 'textmark opacity', 0, 1)
    return this
  }

  /** Placement gravity (see {@link Watermark#gravity}). @param {string} value @returns {this} */
  gravity(value) {
    this.#spec.gravity = String(value)
    return this
  }

  /** Absolute placement at `(x, y)` from the top-left. @param {number} x @param {number} y @returns {this} */
  offset(x, y) {
    this.#spec.x = toInt(x, 'textmark x')
    this.#spec.y = toInt(y, 'textmark y')
    return this
  }

  /** Repeats the text across the whole image. @param {boolean} [enabled=true] @returns {this} */
  tile(enabled = true) {
    this.#spec.tile = Boolean(enabled)
    return this
  }

  /**
   * Resolves the text overlay into a wire spec.
   * @returns {ResolvedMark}
   */
  resolve() {
    return { spec: { ...this.#spec } }
  }
}
