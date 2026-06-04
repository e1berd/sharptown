/**
 * Error thrown by the Sharptown client — for invalid operations (validated before the
 * request) and for unsuccessful server responses (`!res.ok`).
 *
 * @example
 * import { SharptownError } from '@sharptown/client'
 * try {
 *   await st.transform(file).convert('webp')
 * } catch (error) {
 *   if (error instanceof SharptownError) console.error(error.status, error.message)
 * }
 */
export class SharptownError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, body?: unknown, cause?: unknown }} [details]
   */
  constructor(message, details = {}) {
    super(message, details.cause != null ? { cause: details.cause } : undefined)
    this.name = 'SharptownError'
    /** HTTP status of the response, when the error came from the server. @type {number | undefined} */
    this.status = details.status
    /** Parsed error body (`{ error }`), when present. @type {unknown} */
    this.body = details.body
  }
}
