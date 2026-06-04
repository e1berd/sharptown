
import sharp from 'sharp'
import { extractFilesFromRequest } from './extractFilesFromRequest.mjs'


export async function blur(request, reply) {
  const [file] = await extractFilesFromRequest(request)

  let { sigma = undefined } = request.query

  if (sigma) {
    try {
      sigma = parseInt(sigma)
    } catch (error) {
      reply.status(400).send('Invalid sigma value')
    }
  }


  return sharp(file).blur(sigma).toBuffer()
}
