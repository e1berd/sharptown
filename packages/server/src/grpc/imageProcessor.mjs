import sharp from 'sharp'
import * as grpc from '@grpc/grpc-js'
import { applyOperations, InvalidOperationError } from '../applyOperations.mjs'

/**
 * Преобразует proto TransformOptions (camelCase от proto-loader)
 * в opts для applyOperations.
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

function failCall(call, code, message) {
  // Для серверного стрима статус ошибки доставляется через событие 'error':
  // grpc-js конвертирует его в gRPC-статус и корректно завершает стрим.
  // call.destroy() порвал бы стрим раньше отправки статуса — клиент завис бы.
  const err = new Error(message)
  err.code = code
  call.emit('error', err)
}

/**
 * Bidi-стрим обработки изображения. Данные идут чанками и никогда не
 * собираются целиком в память — входной поток пайпится в sharp-трансформер,
 * а его выход отдаётся обратно чанками. Backpressure соблюдается в обе стороны.
 *
 * @param {import('@grpc/grpc-js').ServerDuplexStream} call
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

  call.on('data', (request) => {
    if (finished) return

    // proto-loader выставляет имя выбранного oneof-поля в `request.payload`.
    if (request.payload === 'options') {
      if (transformer) {
        return fail(grpc.status.INVALID_ARGUMENT, 'options message sent more than once')
      }
      try {
        transformer = sharp({ limitInputPixels: false, sequentialRead: true })
        applyOperations(transformer, mapOptions(request.options))
      } catch (error) {
        const code = error instanceof InvalidOperationError
          ? grpc.status.INVALID_ARGUMENT
          : grpc.status.INTERNAL
        return fail(code, error.message)
      }

      // Выход sharp → gRPC, с backpressure.
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
      // Битый/неподдерживаемый файл не должен ронять процесс.
      transformer.on('error', (error) => {
        fail(grpc.status.INVALID_ARGUMENT, error.message)
      })
      return
    }

    if (request.payload === 'chunk') {
      if (!transformer) {
        return fail(grpc.status.INVALID_ARGUMENT, 'first message must contain options')
      }
      // Backpressure на входе: притормаживаем чтение из gRPC, пока sharp занят.
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
      // Клиент не прислал ни одного сообщения.
      finished = true
      call.end()
    }
  })

  call.on('error', () => {
    finished = true
    if (transformer) transformer.destroy()
  })
}
