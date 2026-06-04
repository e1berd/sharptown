/**
 * Ошибка клиента Sharptown. Бросается при некорректных операциях (валидация
 * до запроса) и при неуспешных ответах сервера (`!res.ok`).
 */
export class SharptownError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, body?: unknown, cause?: unknown }} [details]
   */
  constructor(message, details = {}) {
    super(message, details.cause != null ? { cause: details.cause } : undefined)
    this.name = 'SharptownError'
    /** HTTP-статус ответа, если ошибка пришла от сервера. @type {number | undefined} */
    this.status = details.status
    /** Распарсенное тело ошибки (`{ error }`), если было. @type {unknown} */
    this.body = details.body
  }
}
