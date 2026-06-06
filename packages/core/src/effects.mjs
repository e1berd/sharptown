import sharp from 'sharp'
import { InvalidOperationError } from './operations.mjs'

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }
const MAX_COLOR_DISTANCE = Math.sqrt(3 * 255 * 255)
const GRAVITIES = new Set([
  'north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'center', 'centre',
])
const NAMED_COLORS = {
  white: [255, 255, 255], black: [0, 0, 0], red: [255, 0, 0], green: [0, 128, 0],
  lime: [0, 255, 0], blue: [0, 0, 255], cyan: [0, 255, 255], magenta: [255, 0, 255], yellow: [255, 255, 0],
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function toInt(value, field) {
  const parsed = parseInt(value, 10)
  if (Number.isNaN(parsed)) throw new InvalidOperationError(`Invalid ${field} value`)
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
 * Parses an RGB colour from `#rgb`/`#rrggbb`, an `r,g,b` triple, or a common colour name.
 * @param {string} value
 * @returns {[number, number, number]}
 */
function parseColor(value) {
  const str = String(value).trim()
  const hex = str.replace(/^#/, '')
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
  }
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)]
  }
  const named = NAMED_COLORS[str.toLowerCase()]
  if (named) return [...named]
  const parts = str.split(',').map((part) => parseInt(part.trim(), 10))
  if (parts.length === 3 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    return /** @type {[number, number, number]} */ (parts)
  }
  throw new InvalidOperationError('Invalid chromaKey colour')
}

/**
 * Parses the `chromaKey` option `"<color>"` or `"<color>;<tolerance%>"` into the target RGB
 * and a squared colour-distance threshold.
 * @param {string} value
 * @returns {{ color: [number, number, number], toleranceSq: number }}
 */
function parseChromaKey(value) {
  const [rawColor, rawTolerance] = String(value).split(';')
  const color = parseColor(rawColor)
  const percent = rawTolerance != null ? clamp(Number(rawTolerance), 0, 100) : 12
  if (!Number.isFinite(percent)) throw new InvalidOperationError('Invalid chromaKey tolerance')
  const distance = (percent / 100) * MAX_COLOR_DISTANCE
  return { color, toleranceSq: distance * distance }
}

/**
 * Makes every pixel within the tolerance of the keyed colour fully transparent. This reads
 * the raw pixels, so it is buffer-only (not available on the streaming gRPC path).
 *
 * @param {import('sharp').Sharp} image
 * @param {string} value The `chromaKey` option.
 * @returns {Promise<import('sharp').Sharp>} A fresh Sharp instance over the keyed pixels.
 */
export async function applyChromaKey(image, value) {
  const { color: [tr, tg, tb], toleranceSq } = parseChromaKey(value)
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const channels = info.channels
  for (let i = 0; i < data.length; i += channels) {
    const dr = data[i] - tr
    const dg = data[i + 1] - tg
    const db = data[i + 2] - tb
    if (dr * dr + dg * dg + db * db <= toleranceSq) {
      data[i + channels - 1] = 0
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels } })
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * @typedef {object} WatermarkSpec
 * @property {'image'|'text'} type
 * @property {string} [url] Image source URL (resolved by the adapter via `fetchImage`).
 * @property {Buffer|Uint8Array} [buffer] Image bytes (e.g. an uploaded file), used instead of `url`.
 * @property {string} [text] Text content for `type: 'text'`.
 * @property {number} [size] Text font size in pixels.
 * @property {string} [color] Text colour (any CSS colour).
 * @property {string} [font] Text font family.
 * @property {string} [weight] Text font weight.
 * @property {string} [background] Text tile background colour.
 * @property {number} [width] Overlay target width.
 * @property {number} [height] Overlay target height.
 * @property {number} [rotate] Overlay rotation in degrees.
 * @property {number} [opacity] Overlay opacity `0`–`1`.
 * @property {string} [gravity] Placement gravity (`southeast` by default).
 * @property {number} [x] Left offset (with `y`, instead of `gravity`).
 * @property {number} [y] Top offset.
 * @property {boolean} [tile] Repeat the overlay across the whole image.
 * @property {string} [blend] Sharp blend mode (`over` by default).
 */

/**
 * Renders a text watermark to an SVG buffer Sharp can rasterise.
 * @param {WatermarkSpec} spec
 * @returns {Buffer}
 */
function buildTextSvg(spec) {
  const text = String(spec.text ?? '')
  const size = clamp(spec.size != null ? toInt(spec.size, 'watermark size') : 32, 4, 2048)
  const color = spec.color ?? 'white'
  const font = spec.font ?? 'sans-serif'
  const weight = spec.weight ?? 'bold'
  const opacity = spec.opacity != null ? clamp(Number(spec.opacity), 0, 1) : 1
  const padding = spec.padding != null ? clamp(toInt(spec.padding, 'watermark padding'), 0, 4096) : Math.round(size * 0.35)
  const width = Math.max(1, Math.ceil(text.length * size * 0.62) + padding * 2)
  const height = Math.ceil(size * 1.35) + padding * 2
  const background = spec.background
    ? `<rect width="100%" height="100%" fill="${escapeXml(spec.background)}"/>`
    : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
    + background
    + `<text x="${padding}" y="${padding + size}" font-family="${escapeXml(font)}" font-size="${size}"`
    + ` font-weight="${escapeXml(weight)}" fill="${escapeXml(color)}" fill-opacity="${opacity}">`
    + `${escapeXml(text)}</text></svg>`
  return Buffer.from(svg)
}

/**
 * @param {Buffer|Uint8Array} input
 * @param {number} opacity
 * @returns {Promise<Buffer>}
 */
async function multiplyAlpha(input, opacity) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = info.channels - 1; i < data.length; i += info.channels) {
    data[i] = Math.round(data[i] * opacity)
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer()
}

/**
 * Builds a single Sharp `composite` descriptor from a watermark spec, preparing the overlay
 * bytes (resize, rotate, opacity) and resolving its placement.
 * @param {WatermarkSpec} spec
 * @param {(url: string) => Promise<Buffer|Uint8Array>} [fetchImage]
 * @returns {Promise<import('sharp').OverlayOptions>}
 */
async function prepareOverlay(spec, fetchImage) {
  let textOpacityBaked = false
  let overlay

  if (spec.type === 'text') {
    overlay = sharp(buildTextSvg(spec))
    textOpacityBaked = true
  } else {
    let source = spec.buffer
    if (!source && spec.url) {
      if (!fetchImage) throw new InvalidOperationError('Watermark image by URL is not available here')
      source = await fetchImage(spec.url)
    }
    if (!source) throw new InvalidOperationError('Watermark image requires a url or an uploaded file')
    overlay = sharp(source)
    if (spec.width != null || spec.height != null) {
      overlay = overlay.resize({
        width: spec.width != null ? toInt(spec.width, 'watermark width') : undefined,
        height: spec.height != null ? toInt(spec.height, 'watermark height') : undefined,
        fit: 'inside',
      })
    }
  }

  if (spec.rotate) {
    overlay = overlay.rotate(toInt(spec.rotate, 'watermark rotate'), { background: TRANSPARENT })
  }

  let bytes = await overlay.ensureAlpha().png().toBuffer()
  if (!textOpacityBaked && spec.opacity != null && Number(spec.opacity) < 1) {
    bytes = await multiplyAlpha(bytes, clamp(Number(spec.opacity), 0, 1))
  }

  /** @type {import('sharp').OverlayOptions} */
  const descriptor = { input: bytes, blend: spec.blend ?? 'over' }
  if (spec.tile) {
    descriptor.tile = true
  } else if (spec.x != null || spec.y != null) {
    descriptor.left = spec.x != null ? toInt(spec.x, 'watermark x') : 0
    descriptor.top = spec.y != null ? toInt(spec.y, 'watermark y') : 0
  } else {
    const gravity = spec.gravity ?? 'southeast'
    if (!GRAVITIES.has(gravity)) throw new InvalidOperationError('Invalid watermark gravity')
    descriptor.gravity = gravity
  }
  return descriptor
}

/**
 * Prepares an ordered list of Sharp `composite` descriptors from watermark specs. Image
 * overlays referenced by `url` are fetched through the injected `fetchImage` (so SSRF
 * protection lives in the adapter); text overlays are rendered locally.
 *
 * @param {WatermarkSpec[]} specs
 * @param {{ fetchImage?: (url: string) => Promise<Buffer|Uint8Array> }} [deps]
 * @returns {Promise<import('sharp').OverlayOptions[]>}
 */
export async function prepareWatermarks(specs, { fetchImage } = {}) {
  if (!Array.isArray(specs) || specs.length === 0) return []
  const descriptors = []
  for (const spec of specs) {
    descriptors.push(await prepareOverlay(spec, fetchImage))
  }
  return descriptors
}

/**
 * Normalises the `composite` option into an array of overlay specs. Accepts an array
 * directly or a JSON string (as it arrives in a query parameter), and tolerates a single
 * spec object.
 *
 * @param {unknown} value
 * @returns {WatermarkSpec[]}
 */
export function parseCompositeOption(value) {
  if (value == null || value === '') return []
  let parsed = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      throw new InvalidOperationError('Invalid composite value: expected JSON')
    }
  }
  if (Array.isArray(parsed)) return parsed
  if (typeof parsed === 'object') return [parsed]
  throw new InvalidOperationError('Invalid composite value')
}
