import sharp from 'sharp'
import { extractFilesFromRequest } from './extractFilesFromRequest.mjs'

export const SUPPORTED_FORMATS = Object.freeze(['webp', 'png', 'jpg', 'jpeg', 'avif', 'gif', 'heif'])

export async function convert(request, reply) {

  const {
    toFormat = 'webp',
  } = request.query
  if (!SUPPORTED_FORMATS.includes(toFormat)) {
    reply.status(400).send({ error: 'Invalid format' })
    return
  }

  reply.header('Content-Type', 'multipart/form-data')
  const files = await extractFilesFromRequest(request)
  return sharp(files.at(0).content).toFormat(toFormat).toBuffer()
}
