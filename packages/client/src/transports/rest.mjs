import { SharptownError } from '../errors.mjs'
import { normalizeInput } from '../input.mjs'
import { toSearchParams } from '../operations.mjs'

/**
 * @typedef {object} TransportRequest
 * @property {URL} baseUrl
 * @property {(input: Request) => Promise<Response>} fetchImpl
 * @property {Record<string, string>} headers
 * @property {import('../input.mjs').ImageInput} input
 * @property {string} [filename]
 * @property {AbortSignal} [signal]
 * @property {import('../operations.mjs').Operations} operations
 */

/**
 * @typedef {object} Transport
 * @property {string} name
 * @property {(req: TransportRequest) => Promise<Response>} transform
 */

/**
 * The REST transport — isomorphic, built on `fetch` + `FormData`. Targets
 * `POST {baseUrl}/api/v1/transform`. This is the default transport used by `sharptown()`.
 *
 * @param {{ path?: string, field?: string }} [options]
 *   `path` — endpoint path (default `/api/v1/transform`).
 *   `field` — multipart field name for the file (default `image`).
 * @returns {Transport}
 *
 * @example
 * import { sharptown, rest } from '@sharptown/client'
 * const st = sharptown('http://localhost:3001', { transport: rest({ field: 'image' }) })
 */
export function rest(options = {}) {
  const path = options.path ?? '/api/v1/transform'
  const field = options.field ?? 'image'

  return {
    name: 'rest',
    async transform({ baseUrl, fetchImpl, headers, input, filename, signal, operations }) {
      const { blob, filename: detectedName } = await normalizeInput(input, filename || 'image')

      const form = new FormData()
      form.append(field, blob, filename || detectedName)

      const endpoint = resolveEndpoint(baseUrl, path, toSearchParams(operations))
      const request = new Request(endpoint, {
        method: 'POST',
        body: form,
        headers,
        signal,
      })

      const res = await fetchImpl(request)

      if (!res.ok) {
        let body
        let message = `Sharptown request failed with status ${res.status}`
        try {
          body = await res.clone().json()
          if (body && typeof body.error === 'string') message = body.error
        } catch {
          body = undefined
        }
        throw new SharptownError(message, { status: res.status, body })
      }

      return res
    },
  }
}

/**
 * @param {URL} baseUrl
 * @param {string} path
 * @param {URLSearchParams} params
 * @returns {URL}
 */
function resolveEndpoint(baseUrl, path, params) {
  const endpoint = new URL(baseUrl.href)
  endpoint.pathname = endpoint.pathname.replace(/\/+$/, '') + path
  endpoint.search = params.toString()
  return endpoint
}
