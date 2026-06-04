import { SharptownError } from './errors.mjs'

/**
 * @typedef {Blob | File | ArrayBuffer | ArrayBufferView | ReadableStream | URL | string} ImageInput
 * Accepted input kinds:
 *  - `Blob` / `File` — used as-is (browser, Node 18+, Bun, Deno)
 *  - `ArrayBuffer` / `Uint8Array` and other `TypedArray` / `DataView` (including Node `Buffer`)
 *  - `ReadableStream` — a web stream
 *  - `string` — an `http(s)://…` URL (fetched) or a file path (Node/Bun/Deno)
 *  - `URL` — an `http(s):` or `file:` URL
 */

/**
 * @typedef {object} NormalizedInput
 * @property {Blob} blob
 * @property {string} filename
 */

const HTTP_RE = /^https?:\/\//i

/**
 * Normalizes any supported input into a `Blob` plus a filename. Isomorphic: reading
 * files from disk is imported dynamically (`node:fs/promises`) so it never reaches the
 * browser bundle.
 * @param {ImageInput} input
 * @param {string} [fallbackName]
 * @returns {Promise<NormalizedInput>}
 *
 * @example
 * const { blob, filename } = await normalizeInput('./photo.jpg')
 * const { blob: b2 } = await normalizeInput(new Uint8Array([0, 1, 2]))
 */
export async function normalizeInput(input, fallbackName = 'image') {
  if (input == null) {
    throw new SharptownError('No input provided to transform()')
  }

  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    const name = /** @type {File} */ (input).name || fallbackName
    return { blob: input, filename: name }
  }

  if (input instanceof ArrayBuffer) {
    return { blob: new Blob([input]), filename: fallbackName }
  }

  if (ArrayBuffer.isView(input)) {
    return { blob: new Blob([input]), filename: fallbackName }
  }

  if (typeof ReadableStream !== 'undefined' && input instanceof ReadableStream) {
    const blob = await new Response(input).blob()
    return { blob, filename: fallbackName }
  }

  if (input instanceof URL || typeof input === 'string') {
    return fromUrlOrPath(input, fallbackName)
  }

  throw new SharptownError(
    'Unsupported input type. Use a Blob/File, ArrayBuffer, TypedArray, ReadableStream, URL or path string.',
  )
}

/**
 * @param {URL | string} input
 * @param {string} fallbackName
 * @returns {Promise<NormalizedInput>}
 */
async function fromUrlOrPath(input, fallbackName) {
  const str = String(input)

  if (input instanceof URL ? input.protocol.startsWith('http') : HTTP_RE.test(str)) {
    const res = await fetch(str)
    if (!res.ok) {
      throw new SharptownError(`Failed to fetch input from ${str}: ${res.status}`, { status: res.status })
    }
    const blob = await res.blob()
    return { blob, filename: basename(new URL(str).pathname) || fallbackName }
  }

  let fs
  try {
    fs = await import('node:fs/promises')
  } catch {
    throw new SharptownError('Reading files from a path is only supported in Node/Bun/Deno')
  }
  const path = input instanceof URL ? input : str
  const buf = await fs.readFile(path)
  const name = basename(input instanceof URL ? input.pathname : str)
  return { blob: new Blob([buf]), filename: name || fallbackName }
}

/**
 * @param {string} p
 * @returns {string}
 */
function basename(p) {
  return p.split(/[\\/]/).pop() ?? ''
}
