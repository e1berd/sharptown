import sharp from 'sharp'
import { extractFilesFromRequest } from './extractFilesFromRequest.mjs'

export async function tint(request, reply) {
  let {
    r = undefined,
    g = undefined,
    b = undefined,
  } = request.query

  if (!r || !g || !b) {
    reply.status(400).send({ error: 'Missing required parameters' })
    return
  }


  try {
    r = parseInt(r)
  } catch(error) {
    reply.status(400).send({ error: 'Invalid red color value' })
    return
  }

  try {
    g = parseInt(g)
  } catch(error) {
    reply.status(400).send({ error: 'Invalid green color value' })
    return
  }

  try {
    b = parseInt(b)
  } catch(error) {
    reply.status(400).send({ error: 'Invalid blue color value' })
    return
  }

  if (r > 255) {
    reply.status(400).send({ error: 'Invalid red color value' })
    return
  }
  if (g > 255) {
    reply.status(400).send({ error: 'Invalid green color value' })
    return
  }
  if (b > 255) {
    reply.status(400).send({ error: 'Invalid blue color value' })
    return
  }

  reply.header('Content-Type', 'multipart/form-data')
  const [file] = await extractFilesFromRequest(request)
  let image = sharp(file.content)

  image.tint({ r, g, b })

  return image.toBuffer()
}
