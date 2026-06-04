import sharp from 'sharp'
import { extractFilesFromRequest } from './extractFilesFromRequest.mjs'

export async function rotate(request, reply) {
  let {
    angle,
  } = request.query

  reply.header('Content-Type', 'multipart/form-data')
  const [file] = await extractFilesFromRequest(request)
  let image = sharp(file.content)
  if (angle) {
    try {
      angle = parseInt(angle)
    } catch (error) {
      reply.status(400).send({ error: 'Invalid angle' })
      return
    }
    image = image.rotate(angle)
  }
  return image.toBuffer()
}
