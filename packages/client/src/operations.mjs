import { SharptownError } from './errors.mjs'

/**
 * Output formats supported by the Sharptown server. Must match `SUPPORTED_FORMATS`
 * in `@sharptown/core`.
 * @type {readonly string[]}
 */
export const SUPPORTED_FORMATS = Object.freeze([
  'webp', 'png', 'jpg', 'jpeg', 'avif', 'gif', 'heif',
])

/**
 * @typedef {object} Operations
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [rotate]
 * @property {boolean} [flip]
 * @property {number} [blur]
 * @property {number} [r]
 * @property {number} [g]
 * @property {number} [b]
 * @property {boolean} [grayscale]
 * @property {boolean} [removeAlpha]
 * @property {boolean} [ensureAlpha]
 * @property {string} [convertTo]
 */

/**
 * Coerces a value to an integer, throwing a clear error on invalid input.
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
export function toInt(value, field) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed)) {
    throw new SharptownError(`Invalid ${field}: expected an integer, got ${value}`)
  }
  return parsed
}

/**
 * An integer in the [0, 255] range — for tint color channels.
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
export function toColor(value, field) {
  const parsed = toInt(value, field)
  if (parsed < 0 || parsed > 255) {
    throw new SharptownError(`Invalid ${field}: expected 0-255, got ${parsed}`)
  }
  return parsed
}

/**
 * A non-negative integer — for sizes and radii.
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
export function toPositiveInt(value, field) {
  const parsed = toInt(value, field)
  if (parsed < 0) {
    throw new SharptownError(`Invalid ${field}: expected a non-negative integer, got ${parsed}`)
  }
  return parsed
}

/**
 * Asserts that a format is supported by the server.
 * @param {string} format
 * @returns {string}
 */
export function assertFormat(format) {
  if (!SUPPORTED_FORMATS.includes(format)) {
    throw new SharptownError(
      `Unsupported format "${format}". Supported: ${SUPPORTED_FORMATS.join(', ')}`,
    )
  }
  return format
}

/**
 * Serializes accumulated operations into `URLSearchParams`. Parameter names match
 * what the server parses (see `@sharptown/core`'s `applyOperations`).
 * @param {Operations} ops
 * @returns {URLSearchParams}
 *
 * @example
 * toSearchParams({ width: 500, convertTo: 'webp' }).toString()
 * // => 'width=500&convertTo=webp'
 */
export function toSearchParams(ops) {
  const params = new URLSearchParams()
  if (ops.width != null) params.set('width', String(ops.width))
  if (ops.height != null) params.set('height', String(ops.height))
  if (ops.rotate != null) params.set('rotate', String(ops.rotate))
  if (ops.flip) params.set('flip', 'true')
  if (ops.blur != null) params.set('blur', String(ops.blur))
  if (ops.r != null) params.set('r', String(ops.r))
  if (ops.g != null) params.set('g', String(ops.g))
  if (ops.b != null) params.set('b', String(ops.b))
  if (ops.grayscale) params.set('grayscale', 'true')
  if (ops.removeAlpha) params.set('removeAlpha', 'true')
  if (ops.ensureAlpha) params.set('ensureAlpha', 'true')
  if (ops.convertTo) params.set('convertTo', ops.convertTo)
  return params
}
