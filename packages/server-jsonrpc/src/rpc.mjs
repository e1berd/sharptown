import { transformBuffer, InvalidOperationError } from '@sharptown/core'

const RPC_CODE = Object.freeze({
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
  server: -32000,
})

/**
 * An error carrying a JSON-RPC code. Thrown by methods and mapped to an `error` response.
 */
class RpcError extends Error {
  /**
   * @param {number} code
   * @param {string} message
   * @param {unknown} [data]
   */
  constructor(code, message, data) {
    super(message)
    this.code = code
    this.data = data
  }
}

const methods = {
  /**
   * Transforms a base64-encoded image and returns the result as base64.
   *
   * @param {{ image?: string, options?: import('@sharptown/core').TransformOptions }} [params]
   * @returns {Promise<{ image: string, format: string, contentType: string }>}
   *
   * @example
   * // request params:
   * { image: '<base64>', options: { width: 200, convertTo: 'webp' } }
   * // result:
   * { image: '<base64>', format: 'webp', contentType: 'image/webp' }
   */
  async 'image.transform'(params) {
    if (!params || typeof params.image !== 'string') {
      throw new RpcError(RPC_CODE.invalidParams, 'params.image must be a base64-encoded string')
    }
    const input = Buffer.from(params.image, 'base64')
    try {
      const { data, format, contentType } = await transformBuffer(input, params.options ?? {})
      return { image: data.toString('base64'), format, contentType }
    } catch (error) {
      if (error instanceof InvalidOperationError) {
        throw new RpcError(RPC_CODE.invalidParams, error.message)
      }
      throw new RpcError(RPC_CODE.server, 'Unsupported or corrupt image')
    }
  },
}

/**
 * Parses and executes a single incoming JSON-RPC message (a string). Supports single
 * requests, batches, and notifications (requests without an `id`).
 *
 * @param {string} raw
 * @returns {Promise<object | object[] | null>} The response(s), or `null` for notifications.
 *
 * @example
 * socket.on('message', async (raw) => {
 *   const response = await handleRpcMessage(raw.toString())
 *   if (response !== null) socket.send(JSON.stringify(response))
 * })
 */
export async function handleRpcMessage(raw) {
  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return errorResponse(null, RPC_CODE.parse, 'Parse error')
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return errorResponse(null, RPC_CODE.invalidRequest, 'Invalid Request')
    }
    const responses = await Promise.all(payload.map(handleSingle))
    const answered = responses.filter((response) => response !== null)
    return answered.length > 0 ? answered : null
  }

  return handleSingle(payload)
}

/**
 * @param {any} request
 * @returns {Promise<object | null>}
 */
async function handleSingle(request) {
  const id = request && typeof request === 'object' ? (request.id ?? null) : null
  const isNotification = Boolean(request) && typeof request === 'object' && !('id' in request)

  if (!request || typeof request !== 'object' || request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    return isNotification ? null : errorResponse(id, RPC_CODE.invalidRequest, 'Invalid Request')
  }

  const method = methods[request.method]
  if (!method) {
    return isNotification ? null : errorResponse(id, RPC_CODE.methodNotFound, `Method not found: ${request.method}`)
  }

  try {
    const result = await method(request.params)
    return isNotification ? null : { jsonrpc: '2.0', id, result }
  } catch (error) {
    if (isNotification) return null
    if (error instanceof RpcError) {
      return errorResponse(id, error.code, error.message, error.data)
    }
    return errorResponse(id, RPC_CODE.internal, 'Internal error')
  }
}

/**
 * @param {string | number | null} id
 * @param {number} code
 * @param {string} message
 * @param {unknown} [data]
 * @returns {object}
 */
function errorResponse(id, code, message, data) {
  const error = { code, message }
  if (data !== undefined) error.data = data
  return { jsonrpc: '2.0', id, error }
}
