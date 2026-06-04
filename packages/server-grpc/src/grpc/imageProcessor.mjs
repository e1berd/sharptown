import * as grpc from '@grpc/grpc-js'
import { createTransformStream, InvalidOperationError } from '@sharptown/core'

/**
 * Maps proto `TransformOptions` (camelCase from proto-loader) to the options object
 * understood by `@sharptown/core`.
 *
 * @param {Record<string, unknown>} [o]
 * @returns {import('@sharptown/core').TransformOptions}
 */
function mapOptions(o = {}) {
  return {
    width: o.width,
    height: o.height,
    rotate: o.rotate,
    flip: o.flip,
    blur: o.blur,
    r: o.tintR,
    g: o.tintG,
    b: o.tintB,
    grayscale: o.grayscale,
    removeAlpha: o.removeAlpha,
    ensureAlpha: o.ensureAlpha,
    convertTo: o.convertTo,
  }
}

/**
 * Fails a server stream with a gRPC status. The error is delivered via the `'error'`
 * event (not `call.destroy()`): grpc-js converts it to a proper gRPC status and ends
 * the stream cleanly, whereas destroying would tear the stream down before the status
 * is sent and hang the client.
 *
 * @param {import('@grpc/grpc-js').ServerDuplexStream} call
 * @param {number} code
 * @param {string} message
 */
function failCall(call, code, message) {
  const err = new Error(message)
  err.code = code
  call.emit('error', err)
}

/**
 * Bidirectional streaming image handler. Data flows in chunks and is never buffered
 * whole in memory — the input stream is piped into a Sharp transformer and its output
 * is streamed back as chunks. Backpressure is honoured in both directions.
 *
 * The first client message must carry `options`; every later message carries a `chunk`.
 *
 * @param {import('@grpc/grpc-js').ServerDuplexStream} call
 *
 * @example
 * import * as grpc from '@grpc/grpc-js'
 * const server = new grpc.Server()
 * server.addService(ImageProcessor.service, { Transform: transform })
 */
export function transform(call) {
  /** @type {import('sharp').Sharp | null} */
  let transformer = null
  let finished = false

  const fail = (code, message) => {
    if (finished) return
    finished = true
    failCall(call, code, message)
  }

  const startTransformer = (options) => {
    transformer = createTransformStream(mapOptions(options))

    transformer.on('data', (chunk) => {
      if (finished) return
      if (!call.write({ chunk })) {
        transformer.pause()
        call.once('drain', () => {
          if (!finished) transformer.resume()
        })
      }
    })
    transformer.on('end', () => {
      if (finished) return
      finished = true
      call.end()
    })
    transformer.on('error', (error) => {
      fail(grpc.status.INVALID_ARGUMENT, error.message)
    })
  }

  call.on('data', (request) => {
    if (finished) return

    if (request.payload === 'options') {
      if (transformer) {
        return fail(grpc.status.INVALID_ARGUMENT, 'options message sent more than once')
      }
      try {
        startTransformer(request.options)
      } catch (error) {
        const code = error instanceof InvalidOperationError
          ? grpc.status.INVALID_ARGUMENT
          : grpc.status.INTERNAL
        return fail(code, error.message)
      }
      return
    }

    if (request.payload === 'chunk') {
      if (!transformer) {
        return fail(grpc.status.INVALID_ARGUMENT, 'first message must contain options')
      }
      if (!transformer.write(request.chunk)) {
        call.pause()
        transformer.once('drain', () => {
          if (!finished) call.resume()
        })
      }
      return
    }

    return fail(grpc.status.INVALID_ARGUMENT, 'empty request payload')
  })

  call.on('end', () => {
    if (transformer) {
      transformer.end()
    } else if (!finished) {
      finished = true
      call.end()
    }
  })

  call.on('error', () => {
    finished = true
    if (transformer) transformer.destroy()
  })
}
