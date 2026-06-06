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
 * Resize fit modes. Must match `FIT_MODES` in `@sharptown/core`.
 * @type {readonly string[]}
 */
export const FIT_MODES = Object.freeze([
  'cover', 'contain', 'fill', 'inside', 'outside',
])

/**
 * @typedef {object} Operations
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [dpr]
 * @property {number} [aspectRatio]
 * @property {string} [fit]
 * @property {string} [background]
 * @property {boolean} [smartCrop]
 * @property {string} [crop]
 * @property {string} [cropOffset]
 * @property {boolean|number} [trim]
 * @property {string} [chromaKey]
 * @property {string} [composite]
 * @property {boolean} [autoOrient]
 * @property {number} [rotate]
 * @property {boolean} [flip]
 * @property {number} [blur]
 * @property {number|boolean} [sharpen]
 * @property {number|boolean} [oilPaint]
 * @property {number} [brightness]
 * @property {number} [contrast]
 * @property {number} [saturation]
 * @property {number} [exposure]
 * @property {number} [hue]
 * @property {number} [gamma]
 * @property {string} [colorize]
 * @property {number|boolean} [sepia]
 * @property {boolean} [invert]
 * @property {number} [threshold]
 * @property {number} [r]
 * @property {number} [g]
 * @property {number} [b]
 * @property {boolean} [grayscale]
 * @property {boolean} [removeAlpha]
 * @property {boolean} [ensureAlpha]
 * @property {string} [convertTo]
 * @property {number} [quality]
 * @property {boolean} [progressive]
 * @property {boolean} [stripMetadata]
 */

/**
 * Every operation key understood by {@link toSearchParams}, in the same order. This is the
 * single source of truth UI-framework packages (`@sharptown/vue`, `@sharptown/react`, …) use
 * to split component props into transform operations and pass-through `<img>` attributes.
 * @type {readonly (keyof Operations)[]}
 */
export const OPERATION_KEYS = Object.freeze([
  'width', 'height', 'dpr', 'aspectRatio', 'fit', 'background', 'smartCrop', 'crop',
  'cropOffset', 'trim', 'chromaKey', 'composite', 'autoOrient', 'rotate', 'flip', 'blur',
  'sharpen', 'oilPaint', 'brightness', 'contrast', 'saturation', 'exposure', 'hue', 'gamma',
  'colorize', 'sepia', 'invert', 'threshold', 'r', 'g', 'b', 'grayscale', 'removeAlpha',
  'ensureAlpha', 'convertTo', 'quality', 'progressive', 'stripMetadata',
])

/**
 * Splits a flat props object into Sharptown transform {@link Operations} and the remaining
 * keys. A key listed in {@link OPERATION_KEYS} whose value is not `undefined` becomes an
 * operation; everything else goes to `rest` (typically spread onto an `<img>` element). The
 * `src` key, if present, is left in `rest` — components handle the source separately.
 * @param {Record<string, unknown>} source
 * @returns {{ operations: Operations, rest: Record<string, unknown> }}
 *
 * @example
 * pickOperations({ width: 800, blur: 2, alt: 'photo', onLoad: fn })
 * // => { operations: { width: 800, blur: 2 }, rest: { alt: 'photo', onLoad: fn } }
 */
export function pickOperations(source) {
  /** @type {Operations} */
  const operations = {}
  /** @type {Record<string, unknown>} */
  const rest = {}
  for (const key of Object.keys(source)) {
    if (source[key] !== undefined && OPERATION_KEYS.includes(/** @type {keyof Operations} */ (key))) {
      operations[key] = source[key]
    } else {
      rest[key] = source[key]
    }
  }
  return { operations, rest }
}

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
 * Coerces a value to a finite number, throwing a clear error on invalid input.
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
export function toNumber(value, field) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    throw new SharptownError(`Invalid ${field}: expected a number, got ${value}`)
  }
  return parsed
}

/**
 * A number constrained to an inclusive range.
 * @param {unknown} value
 * @param {string} field
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function toRange(value, field, min, max) {
  const parsed = toNumber(value, field)
  if (parsed < min || parsed > max) {
    throw new SharptownError(`Invalid ${field}: expected ${min}–${max}, got ${parsed}`)
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
 * Asserts that a fit mode is supported by the server.
 * @param {string} fit
 * @returns {string}
 */
export function assertFit(fit) {
  if (!FIT_MODES.includes(fit)) {
    throw new SharptownError(
      `Unsupported fit "${fit}". Supported: ${FIT_MODES.join(', ')}`,
    )
  }
  return fit
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
  const setNumber = (key) => { if (ops[key] != null) params.set(key, String(ops[key])) }
  const setFlag = (key) => { if (ops[key] != null) params.set(key, ops[key] ? 'true' : 'false') }
  const setString = (key) => { if (ops[key] != null) params.set(key, String(ops[key])) }
  const setScalar = (key) => {
    if (ops[key] == null) return
    params.set(key, ops[key] === true ? 'true' : String(ops[key]))
  }

  setNumber('width')
  setNumber('height')
  setNumber('dpr')
  setNumber('aspectRatio')
  setString('fit')
  setString('background')
  setFlag('smartCrop')
  setString('crop')
  setString('cropOffset')
  setScalar('trim')
  setString('chromaKey')
  setString('composite')
  setFlag('autoOrient')
  setNumber('rotate')
  setFlag('flip')
  setNumber('blur')
  setScalar('sharpen')
  setScalar('oilPaint')
  setNumber('brightness')
  setNumber('contrast')
  setNumber('saturation')
  setNumber('exposure')
  setNumber('hue')
  setNumber('gamma')
  setString('colorize')
  setScalar('sepia')
  setFlag('invert')
  setNumber('threshold')
  setNumber('r')
  setNumber('g')
  setNumber('b')
  setFlag('grayscale')
  setFlag('removeAlpha')
  setFlag('ensureAlpha')
  setString('convertTo')
  setNumber('quality')
  setFlag('progressive')
  setFlag('stripMetadata')

  return params
}
