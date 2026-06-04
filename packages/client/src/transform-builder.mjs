import {
  toInt,
  toNumber,
  toRange,
  toColor,
  toPositiveInt,
  assertFormat,
  assertFit,
} from './operations.mjs'

/**
 * @typedef {object} BuilderContext
 * @property {URL} baseUrl
 * @property {import('./transports/rest.mjs').Transport} transport
 * @property {(input: any, init?: any) => Promise<Response>} fetchImpl
 * @property {Record<string, string>} headers
 * @property {import('./input.mjs').ImageInput} input
 * @property {string} [filename]
 * @property {AbortSignal} [signal]
 */

/**
 * An expressive, chainable builder for transforming a single image.
 *
 * Every operation method returns `this`, so calls can be chained. The object is
 * "thenable": you can `await` it directly (resolving to a `Blob`) or finish with an
 * explicit terminal (`blob()`, `arrayBuffer()`, `bytes()`, `response()`, `stream()`,
 * `toFile()`).
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
   * Resize. Accepts `(width, height)`, just `(width)`, or an object `{ width, height }`.
   * @param {number | { width?: number, height?: number }} [width]
   * @param {number} [height]
   * @returns {this}
   *
   * @example
   * st.transform(file).resize(800, 600)
   * st.transform(file).resize({ width: 800 })
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

  /** Sets the width only. @param {number} value @returns {this} */
  width(value) {
    this.#ops.width = toPositiveInt(value, 'width')
    return this
  }

  /** Sets the height only. @param {number} value @returns {this} */
  height(value) {
    this.#ops.height = toPositiveInt(value, 'height')
    return this
  }

  /**
   * Crops a rectangle. Accepts `(x, y, width, height)` or an object
   * `{ left, top, width, height }`.
   * @param {number | { left?: number, top?: number, width: number, height: number }} x
   * @param {number} [y]
   * @param {number} [width]
   * @param {number} [height]
   * @returns {this}
   *
   * @example
   * st.transform(file).crop(10, 20, 300, 200)
   * st.transform(file).crop({ left: 10, top: 20, width: 300, height: 200 })
   */
  crop(x, y, width, height) {
    if (typeof x === 'object' && x !== null) {
      const left = toPositiveInt(x.left ?? 0, 'crop.left')
      const top = toPositiveInt(x.top ?? 0, 'crop.top')
      const w = toPositiveInt(x.width, 'crop.width')
      const h = toPositiveInt(x.height, 'crop.height')
      this.#ops.crop = `${left},${top},${w},${h}`
      return this
    }
    this.#ops.crop = [
      toPositiveInt(x, 'crop.x'),
      toPositiveInt(y, 'crop.y'),
      toPositiveInt(width, 'crop.width'),
      toPositiveInt(height, 'crop.height'),
    ].join(',')
    return this
  }

  /**
   * Crops to the most salient region (faces, contrast) when resizing. Combine with a
   * target `width`/`height`.
   * @param {boolean} [enabled=true]
   * @returns {this}
   *
   * @example
   * st.transform(file).resize(200, 200).smartCrop()
   */
  smartCrop(enabled = true) {
    this.#ops.smartCrop = Boolean(enabled)
    return this
  }

  /**
   * Sets the resize fit mode: `cover`, `contain`, `fill`, `inside`, `outside`.
   * @param {string} mode
   * @returns {this}
   */
  fit(mode) {
    this.#ops.fit = assertFit(String(mode).toLowerCase())
    return this
  }

  /**
   * Background colour used by `fit: 'contain'` (e.g. `white`, `#000`, `rgba(0,0,0,0)`).
   * @param {string} color
   * @returns {this}
   */
  background(color) {
    this.#ops.background = String(color)
    return this
  }

  /**
   * Device pixel ratio; multiplies the target `width`/`height` for retina screens.
   * @param {number} value
   * @returns {this}
   *
   * @example
   * st.transform(file).width(400).dpr(2) // renders at 800px
   */
  dpr(value) {
    this.#ops.dpr = toRange(value, 'dpr', 0.1, 5)
    return this
  }

  /**
   * Target aspect ratio (width / height). Combine with a `width` or `height`.
   * @param {number} ratio
   * @returns {this}
   *
   * @example
   * st.transform(file).width(1600).aspectRatio(16 / 9)
   */
  aspectRatio(ratio) {
    this.#ops.aspectRatio = toRange(ratio, 'aspectRatio', 0.0001, 1000)
    return this
  }

  /** Rotates according to the EXIF orientation tag. @param {boolean} [enabled=true] @returns {this} */
  autoOrient(enabled = true) {
    this.#ops.autoOrient = Boolean(enabled)
    return this
  }

  /** Rotates by the given degrees. @param {number} degrees @returns {this} */
  rotate(degrees) {
    this.#ops.rotate = toInt(degrees, 'rotate')
    return this
  }

  /** Flips horizontally. @param {boolean} [enabled=true] @returns {this} */
  flip(enabled = true) {
    this.#ops.flip = Boolean(enabled)
    return this
  }

  /** Blurs by the given sigma/radius. @param {number} [sigma=1] @returns {this} */
  blur(sigma = 1) {
    this.#ops.blur = toPositiveInt(sigma, 'blur')
    return this
  }

  /**
   * Tints with a color. Accepts `(r, g, b)` or an object `{ r, g, b }`. Each channel
   * is optional (0–255).
   * @param {number | { r?: number, g?: number, b?: number }} r
   * @param {number} [g]
   * @param {number} [b]
   * @returns {this}
   *
   * @example
   * st.transform(file).tint(255, 0, 0)
   * st.transform(file).tint({ r: 10, b: 20 })
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

  /** Desaturates the image. @param {boolean} [enabled=true] @returns {this} */
  grayscale(enabled = true) {
    this.#ops.grayscale = Boolean(enabled)
    return this
  }

  /** British alias of {@link grayscale}. @param {boolean} [enabled=true] @returns {this} */
  greyscale(enabled = true) {
    return this.grayscale(enabled)
  }

  /** Removes the alpha channel. @param {boolean} [enabled=true] @returns {this} */
  removeAlpha(enabled = true) {
    this.#ops.removeAlpha = Boolean(enabled)
    return this
  }

  /** Ensures an alpha channel exists. @param {boolean} [enabled=true] @returns {this} */
  ensureAlpha(enabled = true) {
    this.#ops.ensureAlpha = Boolean(enabled)
    return this
  }

  /** Adjusts brightness, `-100`–`100`. @param {number} value @returns {this} */
  brightness(value) {
    this.#ops.brightness = toRange(value, 'brightness', -100, 100)
    return this
  }

  /** Adjusts contrast, `-100`–`100`. @param {number} value @returns {this} */
  contrast(value) {
    this.#ops.contrast = toRange(value, 'contrast', -100, 100)
    return this
  }

  /** Adjusts saturation, `0`–`2` (`1` is the original). @param {number} value @returns {this} */
  saturation(value) {
    this.#ops.saturation = toRange(value, 'saturation', 0, 2)
    return this
  }

  /** Adjusts exposure in EV stops, `-3`–`3`. @param {number} value @returns {this} */
  exposure(value) {
    this.#ops.exposure = toRange(value, 'exposure', -3, 3)
    return this
  }

  /** Rotates hue in degrees, `0`–`360`. @param {number} value @returns {this} */
  hue(value) {
    this.#ops.hue = toRange(value, 'hue', 0, 360)
    return this
  }

  /** Gamma correction, `1.0`–`3.0`. @param {number} value @returns {this} */
  gamma(value) {
    this.#ops.gamma = toRange(value, 'gamma', 1, 3)
    return this
  }

  /**
   * Maps the image to shades of one colour (greyscale + tint).
   * @param {string} color
   * @returns {this}
   */
  colorize(color) {
    this.#ops.colorize = String(color)
    return this
  }

  /**
   * Applies a sepia tone. Intensity `0`–`1`, defaulting to full sepia.
   * @param {number} [intensity=1]
   * @returns {this}
   */
  sepia(intensity = 1) {
    this.#ops.sepia = toRange(intensity, 'sepia', 0, 1)
    return this
  }

  /** Inverts colours. @param {boolean} [enabled=true] @returns {this} */
  invert(enabled = true) {
    this.#ops.invert = Boolean(enabled)
    return this
  }

  /** Binarises the image at the given threshold, `0`–`255`. @param {number} value @returns {this} */
  threshold(value) {
    this.#ops.threshold = toRange(value, 'threshold', 0, 255)
    return this
  }

  /**
   * Sharpens the image. With no argument uses the default; otherwise sets the sigma `0`–`5`.
   * @param {number} [sigma]
   * @returns {this}
   */
  sharpen(sigma) {
    this.#ops.sharpen = sigma == null ? true : toRange(sigma, 'sharpen', 0, 5)
    return this
  }

  /**
   * Oil-paint effect via a median filter; the value is the window size (`1`–`25`).
   * @param {number} [size=3]
   * @returns {this}
   */
  oilPaint(size = 3) {
    this.#ops.oilPaint = toRange(size, 'oilPaint', 1, 25)
    return this
  }

  /** Output quality `1`–`100` (applies when re-encoding via {@link convert}). @param {number} value @returns {this} */
  quality(value) {
    this.#ops.quality = toRange(value, 'quality', 1, 100)
    return this
  }

  /** Progressive (interlaced) output when re-encoding. @param {boolean} [enabled=true] @returns {this} */
  progressive(enabled = true) {
    this.#ops.progressive = Boolean(enabled)
    return this
  }

  /**
   * Strips EXIF/metadata (the default). Pass `false` to keep metadata.
   * @param {boolean} [enabled=true]
   * @returns {this}
   */
  stripMetadata(enabled = true) {
    this.#ops.stripMetadata = Boolean(enabled)
    return this
  }

  /**
   * Converts to a format (`webp`, `png`, `jpg`, `jpeg`, `avif`, `gif`, `heif`).
   * @param {string} format
   * @returns {this}
   *
   * @example
   * st.transform(file).convert('webp')
   */
  convert(format) {
    this.#ops.convertTo = assertFormat(String(format).toLowerCase())
    return this
  }

  /** Alias of {@link convert}. @param {string} format @returns {this} */
  toFormat(format) {
    return this.convert(format)
  }

  /** Attaches an `AbortSignal` to the request. @param {AbortSignal} signal @returns {this} */
  abortWith(signal) {
    this.#ctx.signal = signal
    return this
  }

  /**
   * Runs the request and returns the raw `Response` (for headers, streaming, etc.).
   * @returns {Promise<Response>}
   *
   * @example
   * const res = await st.transform(file).convert('webp').response()
   * console.log(res.headers.get('content-type'))
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

  /** Result as a `Blob`. @returns {Promise<Blob>} */
  async blob() {
    return (await this.response()).blob()
  }

  /** Result as an `ArrayBuffer`. @returns {Promise<ArrayBuffer>} */
  async arrayBuffer() {
    return (await this.response()).arrayBuffer()
  }

  /** Result as a `Uint8Array`. @returns {Promise<Uint8Array>} */
  async bytes() {
    return new Uint8Array(await this.arrayBuffer())
  }

  /** Result as the response body `ReadableStream`. @returns {Promise<ReadableStream<Uint8Array> | null>} */
  async stream() {
    return (await this.response()).body
  }

  /**
   * Writes the result to a file (Node/Bun/Deno) and returns the path.
   * @param {string | URL} path
   * @returns {Promise<string | URL>}
   *
   * @example
   * await st.transform('./in.jpg').resize(1024).convert('avif').toFile('./out.avif')
   */
  async toFile(path) {
    const bytes = await this.bytes()
    const { writeFile } = await import('node:fs/promises')
    await writeFile(path, bytes)
    return path
  }

  /**
   * Makes the builder "thenable": `await builder` is equivalent to `builder.blob()`.
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
