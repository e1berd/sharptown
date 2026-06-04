import { SharptownError } from './errors.mjs'

/**
 * Форматы вывода, поддерживаемые сервером Sharptown. Должны совпадать с
 * `SUPPORTED_FORMATS` в `@sharptown/server` (`src/convert.mjs`).
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
 * Превращает целое значение в число, бросая понятную ошибку при невалидном вводе.
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
 * Целое в диапазоне [0, 255] — для компонент цвета (tint).
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
 * Положительное целое — для размеров/радиусов.
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
 * Проверяет, что формат поддерживается сервером.
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
 * Сериализует накопленные операции в query-строку. Имена параметров совпадают
 * с тем, что разбирает сервер в `src/applyOperations.mjs`.
 * @param {Operations} ops
 * @returns {string} query-строка без ведущего `?`
 */
export function buildQuery(ops) {
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
  return params.toString()
}
