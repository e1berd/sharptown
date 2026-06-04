/**
 * Output formats supported by the engine. These map directly to the formats that
 * Sharp understands via `toFormat`.
 * @type {readonly string[]}
 */
export const SUPPORTED_FORMATS = Object.freeze(['webp', 'png', 'jpg', 'jpeg', 'avif', 'gif', 'heif'])

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
 * @property {number|string} [rotate] Rotation in degrees.
 * @property {boolean|string} [flip] Flip horizontally when truthy.
 * @property {number|string} [blur] Gaussian blur sigma.
 * @property {number|string} [r] Tint red channel (0–255).
 * @property {number|string} [g] Tint green channel (0–255).
 * @property {number|string} [b] Tint blue channel (0–255).
 * @property {boolean|string} [grayscale] Desaturate when truthy.
 * @property {boolean|string} [greyscale] British alias of `grayscale`.
 * @property {boolean|string} [removeAlpha] Drop the alpha channel.
 * @property {boolean|string} [ensureAlpha] Ensure an alpha channel exists.
 * @property {string} [convertTo] Output format, one of {@link SUPPORTED_FORMATS}.
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
 * Applies a set of operations to a Sharp instance. Works identically for a buffered
 * (REST) instance and a streaming (gRPC) one — this is the engine shared across every
 * framework adapter. Values may be numbers or query-style strings.
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
 *   blur: 3,
 *   grayscale: true,
 *   convertTo: 'webp',
 * }).toBuffer()
 */
export function applyOperations(image, opts = {}) {
  const { width, height, rotate, flip, blur, r, g, b, removeAlpha, ensureAlpha, convertTo } = opts
  const grayscale = opts.grayscale ?? opts.greyscale

  if (isEnabled(removeAlpha)) {
    image = image.removeAlpha()
  }

  if (isEnabled(ensureAlpha)) {
    image = image.ensureAlpha()
  }

  if (r != null || g != null || b != null) {
    const tint = {}
    if (r != null) tint.r = toColor(r, 'red color')
    if (g != null) tint.g = toColor(g, 'green color')
    if (b != null) tint.b = toColor(b, 'blue color')
    image = image.tint(tint)
  }

  if (isEnabled(grayscale)) {
    image = image.greyscale(true)
  }

  if (blur) {
    image = image.blur(toInt(blur, 'blur'))
  }

  if (isEnabled(flip)) {
    image = image.flip()
  }

  if (rotate) {
    image = image.rotate(toInt(rotate, 'rotate'))
  }

  if (width || height) {
    const resize = {}
    if (width) resize.width = toInt(width, 'width')
    if (height) resize.height = toInt(height, 'height')
    image = image.resize(resize)
  }

  if (convertTo) {
    if (!SUPPORTED_FORMATS.includes(convertTo)) {
      throw new InvalidOperationError('Invalid convert format target')
    }
    image = image.toFormat(convertTo)
  }

  return image
}
