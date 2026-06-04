/**
 * Output formats supported by the engine. These map directly to the formats that
 * Sharp understands via `toFormat`.
 * @type {readonly string[]}
 */
export const SUPPORTED_FORMATS = Object.freeze(['webp', 'png', 'jpg', 'jpeg', 'avif', 'gif', 'heif'])

/**
 * Resize fit modes, matching Sharp's `fit` option.
 * @type {readonly string[]}
 */
export const FIT_MODES = Object.freeze(['cover', 'contain', 'fill', 'inside', 'outside'])

/**
 * Thrown when an operation value is invalid. The calling adapter decides how to
 * surface it (HTTP 400 for REST, `INVALID_ARGUMENT` for gRPC, `-32602` for JSON-RPC).
 *
 * @example
 * import { applyOperations, InvalidOperationError } from '@sharptown/core'
 * try {
 *   applyOperations(sharp(buf), { convertTo: 'bmp' })
 * } catch (error) {
 *   if (error instanceof InvalidOperationError) console.error(error.message)
 * }
 */
export class InvalidOperationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'InvalidOperationError'
  }
}

/**
 * @typedef {object} TransformOptions
 * @property {number|string} [width] Resize width in pixels.
 * @property {number|string} [height] Resize height in pixels.
 * @property {number|string} [dpr] Device pixel ratio; multiplies the target width/height.
 * @property {number|string} [aspectRatio] Target aspect ratio (e.g. `1.7778`). Needs `width` or `height`.
 * @property {string} [fit] Resize fit mode, one of {@link FIT_MODES}.
 * @property {string} [background] Background colour for `contain` (e.g. `white`, `#000`, `rgba(0,0,0,0)`).
 * @property {boolean|string} [smartCrop] Crop to the most salient region (attention strategy) when resizing.
 * @property {string} [crop] Crop rectangle as `x,y,width,height`, or a size `WxH` paired with `cropOffset`.
 * @property {string} [cropOffset] Offset `x,y` for the `WxH` crop form.
 * @property {boolean|string} [autoOrient] Rotate according to the EXIF orientation tag.
 * @property {number|string} [rotate] Rotation in degrees.
 * @property {boolean|string} [flip] Flip horizontally when truthy.
 * @property {number|string} [blur] Gaussian blur sigma.
 * @property {number|string|boolean} [sharpen] Sharpen sigma (`0`–`5`); truthy with no value uses the default.
 * @property {number|string|boolean} [oilPaint] Oil-paint approximation via a median filter; the value is the window size.
 * @property {number|string} [brightness] Brightness, `-100`–`100`.
 * @property {number|string} [contrast] Contrast, `-100`–`100`.
 * @property {number|string} [saturation] Saturation multiplier, `0`–`2` (`1` is the original).
 * @property {number|string} [exposure] Exposure in EV stops, `-3`–`3`.
 * @property {number|string} [hue] Hue rotation in degrees, `0`–`360`.
 * @property {number|string} [gamma] Gamma correction, `1.0`–`3.0`.
 * @property {string} [colorize] Map the image to shades of one colour (greyscale + tint).
 * @property {number|string|boolean} [sepia] Sepia intensity `0`–`1`, or truthy for full sepia.
 * @property {boolean|string} [invert] Invert colours.
 * @property {number|string} [threshold] Black/white threshold, `0`–`255`.
 * @property {number|string} [r] Tint red channel (0–255).
 * @property {number|string} [g] Tint green channel (0–255).
 * @property {number|string} [b] Tint blue channel (0–255).
 * @property {boolean|string} [grayscale] Desaturate when truthy.
 * @property {boolean|string} [greyscale] British alias of `grayscale`.
 * @property {boolean|string} [removeAlpha] Drop the alpha channel.
 * @property {boolean|string} [ensureAlpha] Ensure an alpha channel exists.
 * @property {string} [convertTo] Output format, one of {@link SUPPORTED_FORMATS}.
 * @property {number|string} [quality] Output quality `1`–`100` (applies when re-encoding via `convertTo`).
 * @property {boolean|string} [progressive] Progressive (interlaced) output when re-encoding.
 * @property {boolean|string} [stripMetadata] Strip EXIF/metadata. Defaults to stripped; `false` keeps metadata.
 */

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function toInt(value, field) {
  const parsed = parseInt(value, 10)
  if (Number.isNaN(parsed)) {
    throw new InvalidOperationError(`Invalid ${field} value`)
  }
  return parsed
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function toNumber(value, field) {
  const parsed = typeof value === 'number' ? value : parseFloat(value)
  if (!Number.isFinite(parsed)) {
    throw new InvalidOperationError(`Invalid ${field} value`)
  }
  return parsed
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function toColor(value, field) {
  const parsed = toInt(value, field)
  if (parsed < 0 || parsed > 255) {
    throw new InvalidOperationError(`Invalid ${field} value`)
  }
  return parsed
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isEnabled(value) {
  return value === true || value === 'true' || (Boolean(value) && value !== 'false')
}

/**
 * Normalises a colour into a string Sharp's colour parser accepts. Bare hex (`000`,
 * `aabbcc`, `aabbccdd`) gains a leading `#`; named colours and `rgb()`/`rgba()` pass through.
 * @param {string} value
 * @returns {string}
 */
function toColorString(value) {
  const str = String(value).trim()
  if (/^[0-9a-f]{3}$|^[0-9a-f]{4}$|^[0-9a-f]{6}$|^[0-9a-f]{8}$/i.test(str)) {
    return `#${str}`
  }
  return str
}

/**
 * Parses the `crop` option into an `extract` rectangle. Accepts `x,y,width,height` or a
 * size `WxH` combined with an `x,y` `cropOffset`.
 * @param {string} crop
 * @param {string} [cropOffset]
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
function parseCrop(crop, cropOffset) {
  const value = String(crop).trim()

  const sizeMatch = value.match(/^(\d+)\s*[x×]\s*(\d+)$/i)
  if (sizeMatch) {
    const width = toInt(sizeMatch[1], 'crop width')
    const height = toInt(sizeMatch[2], 'crop height')
    let left = 0
    let top = 0
    if (cropOffset != null) {
      const offset = String(cropOffset).split(',').map((part) => toInt(part.trim(), 'cropOffset'))
      if (offset.length !== 2) throw new InvalidOperationError('Invalid cropOffset value')
      ;[left, top] = offset
    }
    return assertRect({ left, top, width, height })
  }

  const parts = value.split(',').map((part) => toInt(part.trim(), 'crop'))
  if (parts.length !== 4) {
    throw new InvalidOperationError('Invalid crop value, expected "x,y,width,height" or "WxH"')
  }
  const [left, top, width, height] = parts
  return assertRect({ left, top, width, height })
}

/**
 * @param {{ left: number, top: number, width: number, height: number }} rect
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
function assertRect(rect) {
  if (rect.left < 0 || rect.top < 0 || rect.width <= 0 || rect.height <= 0) {
    throw new InvalidOperationError('Invalid crop rectangle')
  }
  return rect
}

const SEPIA_MATRIX = [
  [0.393, 0.769, 0.189],
  [0.349, 0.686, 0.168],
  [0.272, 0.534, 0.131],
]

const IDENTITY_MATRIX = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]

/**
 * Blends the sepia recombination matrix with identity by `intensity` (`0`–`1`).
 * @param {number} intensity
 * @returns {number[][]}
 */
function sepiaMatrix(intensity) {
  const t = clamp(intensity, 0, 1)
  return SEPIA_MATRIX.map((row, i) => row.map((value, j) => IDENTITY_MATRIX[i][j] * (1 - t) + value * t))
}

/**
 * Resolves the `modulate` arguments from the brightness/exposure/saturation/hue options.
 * Brightness (`-100`–`100`) and exposure (EV) multiply together into one factor.
 * @param {TransformOptions} opts
 * @returns {{ brightness?: number, saturation?: number, hue?: number } | null}
 */
function resolveModulation(opts) {
  const modulation = {}
  let brightnessFactor = 1
  let touched = false

  if (opts.brightness != null) {
    brightnessFactor *= 1 + clamp(toNumber(opts.brightness, 'brightness'), -100, 100) / 100
    touched = true
  }
  if (opts.exposure != null) {
    brightnessFactor *= 2 ** clamp(toNumber(opts.exposure, 'exposure'), -3, 3)
    touched = true
  }
  if (touched) {
    modulation.brightness = Math.max(0, brightnessFactor)
  }
  if (opts.saturation != null) {
    modulation.saturation = Math.max(0, clamp(toNumber(opts.saturation, 'saturation'), 0, 2))
  }
  if (opts.hue != null) {
    modulation.hue = Math.round(toNumber(opts.hue, 'hue'))
  }

  return Object.keys(modulation).length > 0 ? modulation : null
}

/**
 * Applies a set of operations to a Sharp instance. Works identically for a buffered
 * (REST) instance and a streaming (gRPC) one — this is the engine shared across every
 * framework adapter. Values may be numbers or query-style strings. Every operation here
 * is streaming-safe: none requires reading the image dimensions first.
 *
 * @param {import('sharp').Sharp} image A Sharp instance (buffer or stream transformer).
 * @param {TransformOptions} [opts]
 * @returns {import('sharp').Sharp} The same instance with operations applied.
 * @throws {InvalidOperationError} When a value is out of range or the format is unknown.
 *
 * @example
 * import sharp from 'sharp'
 * import { applyOperations } from '@sharptown/core'
 *
 * const webp = await applyOperations(sharp(inputBuffer), {
 *   width: 800,
 *   brightness: 10,
 *   saturation: 1.2,
 *   convertTo: 'webp',
 *   quality: 80,
 * }).toBuffer()
 */
export function applyOperations(image, opts = {}) {
  const {
    width, height, dpr, aspectRatio, fit, background, smartCrop,
    crop, cropOffset, autoOrient, rotate, flip, blur, sharpen, oilPaint,
    gamma, colorize, sepia, invert, threshold,
    r, g, b, removeAlpha, ensureAlpha,
    convertTo, quality, progressive, stripMetadata,
  } = opts
  const grayscale = opts.grayscale ?? opts.greyscale

  if (isEnabled(autoOrient)) {
    image = image.rotate()
  }

  if (crop != null) {
    image = image.extract(parseCrop(crop, cropOffset))
  }

  if (isEnabled(removeAlpha)) {
    image = image.removeAlpha()
  }

  if (isEnabled(ensureAlpha)) {
    image = image.ensureAlpha()
  }

  if (colorize != null) {
    image = image.greyscale().tint(toColorString(colorize))
  }

  if (r != null || g != null || b != null) {
    const tint = {}
    if (r != null) tint.r = toColor(r, 'red color')
    if (g != null) tint.g = toColor(g, 'green color')
    if (b != null) tint.b = toColor(b, 'blue color')
    image = image.tint(tint)
  }

  const modulation = resolveModulation(opts)
  if (modulation) {
    image = image.modulate(modulation)
  }

  if (opts.contrast != null) {
    const factor = 1 + clamp(toNumber(opts.contrast, 'contrast'), -100, 100) / 100
    image = image.linear(factor, 128 * (1 - factor))
  }

  if (gamma != null) {
    image = image.gamma(clamp(toNumber(gamma, 'gamma'), 1, 3))
  }

  if (isEnabled(grayscale)) {
    image = image.greyscale(true)
  }

  if (sepia != null && isEnabled(sepia)) {
    const intensity = sepia === true || sepia === 'true' ? 1 : clamp(toNumber(sepia, 'sepia'), 0, 1)
    image = image.recomb(sepiaMatrix(intensity))
  }

  if (isEnabled(invert)) {
    image = image.negate({ alpha: false })
  }

  if (threshold != null) {
    image = image.threshold(clamp(toInt(threshold, 'threshold'), 0, 255))
  }

  if (blur) {
    image = image.blur(toInt(blur, 'blur'))
  }

  if (sharpen != null && isEnabled(sharpen)) {
    image = sharpen === true || sharpen === 'true'
      ? image.sharpen()
      : image.sharpen({ sigma: clamp(toNumber(sharpen, 'sharpen'), 0.000001, 5) })
  }

  if (oilPaint != null && isEnabled(oilPaint)) {
    const windowSize = oilPaint === true || oilPaint === 'true' ? 3 : clamp(toInt(oilPaint, 'oilPaint'), 1, 25)
    image = image.median(windowSize)
  }

  if (isEnabled(flip)) {
    image = image.flip()
  }

  if (rotate) {
    image = image.rotate(toInt(rotate, 'rotate'))
  }

  image = applyResize(image, { width, height, dpr, aspectRatio, fit, background, smartCrop })

  if (convertTo) {
    if (!SUPPORTED_FORMATS.includes(convertTo)) {
      throw new InvalidOperationError('Invalid convert format target')
    }
    image = image.toFormat(convertTo, formatOptions(quality, progressive))
  }

  if (stripMetadata === false || stripMetadata === 'false') {
    image = image.withMetadata()
  }

  return image
}

/**
 * Builds and applies the resize step from the size/fit/aspect options. Returns the
 * instance untouched when no target dimension is given.
 *
 * @param {import('sharp').Sharp} image
 * @param {Pick<TransformOptions, 'width'|'height'|'dpr'|'aspectRatio'|'fit'|'background'|'smartCrop'>} opts
 * @returns {import('sharp').Sharp}
 */
function applyResize(image, { width, height, dpr, aspectRatio, fit, background, smartCrop }) {
  let targetWidth = width != null ? toInt(width, 'width') : undefined
  let targetHeight = height != null ? toInt(height, 'height') : undefined

  if (aspectRatio != null) {
    const ratio = toNumber(aspectRatio, 'aspectRatio')
    if (ratio <= 0) throw new InvalidOperationError('Invalid aspectRatio value')
    if (targetWidth != null && targetHeight == null) {
      targetHeight = Math.round(targetWidth / ratio)
    } else if (targetHeight != null && targetWidth == null) {
      targetWidth = Math.round(targetHeight * ratio)
    } else if (targetWidth == null && targetHeight == null) {
      throw new InvalidOperationError('aspectRatio requires width or height')
    }
  }

  if (targetWidth == null && targetHeight == null) {
    return image
  }

  const scale = dpr != null ? clamp(toNumber(dpr, 'dpr'), 0.1, 5) : 1
  const resize = {}
  if (targetWidth != null) resize.width = Math.round(targetWidth * scale)
  if (targetHeight != null) resize.height = Math.round(targetHeight * scale)

  if (fit != null) {
    if (!FIT_MODES.includes(fit)) {
      throw new InvalidOperationError('Invalid fit value')
    }
    resize.fit = fit
  }

  if (isEnabled(smartCrop) || aspectRatio != null) {
    resize.fit = resize.fit ?? 'cover'
  }
  if (isEnabled(smartCrop)) {
    resize.position = 'attention'
  }

  if (background != null) {
    resize.background = toColorString(background)
  }

  return image.resize(resize)
}

/**
 * Builds the per-format options object for `toFormat` from `quality`/`progressive`.
 * @param {number|string} [quality]
 * @param {boolean|string} [progressive]
 * @returns {{ quality?: number, progressive?: boolean } | undefined}
 */
function formatOptions(quality, progressive) {
  const options = {}
  if (quality != null) options.quality = clamp(toInt(quality, 'quality'), 1, 100)
  if (isEnabled(progressive)) options.progressive = true
  return Object.keys(options).length > 0 ? options : undefined
}
