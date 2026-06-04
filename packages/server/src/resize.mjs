
import sharp from 'sharp'
import { extractFilesFromRequest } from './extractFilesFromRequest.mjs'

export async function resize(request, reply) {
  let {
    width,
    height,
  } = request.query

  reply.header('Content-Type', 'multipart/form-data')
  const [file] = await extractFilesFromRequest(request)
  let image = sharp(file.content)
  if (width || height) {
    try {
      if (width) width = parseInt(width)
    } catch (error) {
      reply.status(400).send({ error: 'Invalid width' })
      return
    }
    try {
      if (height) height = parseInt(height)
    } catch (error) {
      reply.status(400).send({ error: 'Invalid height' })
      return
    }
    image = image.resize({ width, height })
  }
  return image.toBuffer()
}
