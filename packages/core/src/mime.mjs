/** @type {Record<string, string>} */
const MIME_BY_FORMAT = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  avif: 'image/avif',
  gif: 'image/gif',
  heif: 'image/heif',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
}

/**
 * Returns the MIME type for a format reported by Sharp (`info.format`). Falls back
 * to `application/octet-stream` for unknown formats.
 *
 * @param {string} [format]
 * @returns {string}
 *
 * @example
 * mimeTypeFor('webp') // => 'image/webp'
 * mimeTypeFor('jpeg') // => 'image/jpeg'
 */
export function mimeTypeFor(format) {
  return MIME_BY_FORMAT[format] ?? 'application/octet-stream'
}
