import { SharptownError } from './errors.mjs'

/**
 * @typedef {Blob | File | ArrayBuffer | ArrayBufferView | ReadableStream | URL | string} ImageInput
 * Возможные виды входа:
 *  - `Blob` / `File` — как есть (браузер, Node 18+, Bun, Deno)
 *  - `ArrayBuffer` / `Uint8Array` и прочие `TypedArray` / `DataView` (включая Node `Buffer`)
 *  - `ReadableStream` — web-стрим
 *  - `string` — `http(s)://…` (будет загружен через fetch) или путь к файлу (Node/Bun/Deno)
 *  - `URL` — `http(s):`/`file:` URL
 */

/**
 * @typedef {object} NormalizedInput
 * @property {Blob} blob
 * @property {string} filename
 */

const HTTP_RE = /^https?:\/\//i

/**
 * Приводит любой поддерживаемый вход к `Blob` + имени файла. Изоморфно: чтение
 * файлов с диска подгружается динамически (`node:fs/promises`) и не попадает в
 * браузерный бандл.
 * @param {ImageInput} input
 * @param {string} [fallbackName]
 * @returns {Promise<NormalizedInput>}
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
