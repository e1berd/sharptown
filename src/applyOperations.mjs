import { SUPPORTED_FORMATS } from './convert.mjs'

/**
 * Ошибка некорректного значения операции. Вызывающий код решает, как её
 * представить (HTTP 400 для REST, gRPC INVALID_ARGUMENT для gRPC).
 */
export class InvalidOperationError extends Error {}

function toInt(value, field) {
  const parsed = parseInt(value, 10)
  if (Number.isNaN(parsed)) {
    throw new InvalidOperationError(`Invalid ${field} value`)
  }
  return parsed
}

function toColor(value, field) {
  const parsed = toInt(value, field)
  if (parsed < 0 || parsed > 255) {
    throw new InvalidOperationError(`Invalid ${field} value`)
  }
  return parsed
}

/**
 * Применяет к sharp-инстансу набор операций. Работает одинаково и для
 * буферного (REST), и для стримингового (gRPC) инстанса sharp.
 *
 * @param {import('sharp').Sharp} image — sharp-инстанс (буфер или трансформер)
 * @param {object} opts — значения операций (строки из query или типы из proto)
 * @returns {import('sharp').Sharp} тот же инстанс с применёнными операциями
 * @throws {InvalidOperationError} при некорректных значениях
 */
export function applyOperations(image, opts = {}) {
  let {
    width,
    height,
    rotate,
    flip,
    blur,
    r,
    g,
    b,
    grayscale,
    greyscale,
    removeAlpha,
    ensureAlpha,
    convertTo,
  } = opts

  grayscale ||= greyscale

  if (removeAlpha === true || removeAlpha === 'true') {
    image = image.removeAlpha()
  }

  if (ensureAlpha === true || ensureAlpha === 'true') {
    image = image.ensureAlpha()
  }

  if (r != null || g != null || b != null) {
    const tintOptions = {}
    if (r != null) tintOptions.r = toColor(r, 'red color')
    if (g != null) tintOptions.g = toColor(g, 'green color')
    if (b != null) tintOptions.b = toColor(b, 'blue color')
    image = image.tint(tintOptions)
  }

  if (grayscale === true || grayscale === 'true' || (grayscale && grayscale !== 'false')) {
    image = image.greyscale(true)
  }

  if (blur) {
    image = image.blur(toInt(blur, 'blur'))
  }

  if (flip === true || flip === 'true') {
    image = image.flip()
  }

  if (rotate) {
    image = image.rotate(toInt(rotate, 'rotate'))
  }

  if (width || height) {
    const resizeOptions = {}
    if (width) resizeOptions.width = toInt(width, 'width')
    if (height) resizeOptions.height = toInt(height, 'height')
    image = image.resize(resizeOptions)
  }

  if (convertTo) {
    if (!SUPPORTED_FORMATS.includes(convertTo)) {
      throw new InvalidOperationError('Invalid convert format target')
    }
    image = image.toFormat(convertTo)
  }

  return image
}
