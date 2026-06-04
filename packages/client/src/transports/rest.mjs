import { SharptownError } from '../errors.mjs'
import { normalizeInput } from '../input.mjs'
import { buildQuery } from '../operations.mjs'

/**
 * @typedef {object} TransportRequest
 * @property {string} baseUrl
 * @property {(input: any, init?: any) => Promise<Response>} fetchImpl
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
 * REST-транспорт — изоморфный, работает поверх `fetch` + `FormData`. Целится в
 * `POST {baseUrl}/api/v1/transform`. Это дефолтный транспорт `createClient`.
 *
 * @param {{ path?: string, field?: string }} [options]
 *   `path` — путь эндпоинта (по умолчанию `/api/v1/transform`).
 *   `field` — имя поля multipart с файлом (по умолчанию `image`).
 * @returns {Transport}
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

      const query = buildQuery(operations)
      const url = `${baseUrl}${path}${query ? `?${query}` : ''}`

      const res = await fetchImpl(url, {
        method: 'POST',
        body: form,
        headers,
        signal,
      })

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
